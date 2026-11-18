import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultSettings, emptyCollections } from '../lib/seed';
import {
  deleteCourseCascadeFromCloud,
  deleteStudyLogFromCloud,
  syncAcademicProfile,
  syncCollectionDiff,
  syncCourseBatch,
  syncPatch,
  syncRemove,
  syncSessionsDiff,
  syncSettings,
  syncStudyLog,
  syncUpsert,
  syncWeeklyCheckIn,
  isRemoteSyncing,
} from '../lib/firestoreSync';
import { deleteFile } from '../lib/fileStorage';
import { deleteTopicSheet, deleteUniMemory, listTopicSheetsByCourse } from '../lib/localDb';
import { deleteUniAgentLocal } from '../lib/uniAgents';
import { computeReplan, isReplaceable, type ReplanReason } from '../lib/planner/replan';
import { applyPlanIntent, type IntentItem } from '../lib/planner/intent';
import { notifyPlanReplanned, recordPlanUndo, takePlanUndo } from './planUndo';
import { migrateStoreState, rehydrateStoreState, sanitizeMaterials } from '../lib/storeMigration';
import { reconcileAvailabilityChanges } from '../lib/planner/availability';
import type {
  AcademicProfile,
  Collections,
  Course,
  ID,
  IntegrationKey,
  IntegrationStatus,
  Settings,
  Source,
  StudyLogEntry,
  Topic,
  WeeklyCheckIn,
} from '../types';
import { setAppLanguage } from '../i18n';
import { normalizeAppLanguage } from '../lib/grading';
import { todayStr } from '../lib/selectors';

type Key = keyof Collections;
type Item<K extends Key> = Collections[K][number];

const emptyData = emptyCollections;

const defaultIntegrations: Record<IntegrationKey, IntegrationStatus> = {
  google: { connected: false },
  gemini: { connected: false },
  clip: { connected: false },
};

export const defaultAcademicProfile: AcademicProfile = {
  onboardingCompleted: false,
  universityId: 'outra',
  universityName: '',
  degreeId: 'outro',
  degreeName: '',
  entryYear: new Date().getFullYear(),
  currentAcademicYear: 1,
  currentSemester: 1,
  difficultCourseIds: [],
  difficultTopicsNotes: '',
  completedCourses: [],
};

export interface AppState extends Collections {
  settings: Settings;
  integrations: Record<IntegrationKey, IntegrationStatus>;
  academicProfile: AcademicProfile;
  weeklyCheckIns: WeeklyCheckIn[];
  studyLogs: StudyLogEntry[];

  /** Cria ou atualiza (por id) um registo numa coleção. */
  upsert: <K extends Key>(key: K, item: Item<K>) => void;
  upsertMany: <K extends Key>(key: K, items: Item<K>[]) => void;
  /** Atualiza parcialmente um registo existente. */
  patch: <K extends Key>(
    key: K,
    id: ID,
    changes: Partial<Item<K>>,
    opts?: { skipReconcile?: boolean },
  ) => void;
  remove: (key: Key, id: ID) => void;
  replaceSource: <K extends 'assessments' | 'classes' | 'events'>(
    key: K,
    source: Source,
    items: Item<K>[],
  ) => void;
  /**
   * O ÚNICO caminho para (re)gerar o plano. Sem `force`, só recalcula se já houver plano.
   * Mostra «Plano atualizado · Desfazer» (exceto `silent`). Devolve se o plano mudou.
   */
  replan: (reason: ReplanReason, opts?: ReplanOptions) => boolean;
  /**
   * «Como está a tua semana?»: aplica a intenção (regras guardadas nas preferências e estado de
   * tópicos) e recalcula o plano. Tudo conta como um só Desfazer.
   */
  applyBriefing: (items: IntentItem[], text: string) => boolean;
  /** Desfaz o último recálculo (sessões e, se mudaram, preferências e tópicos). */
  undoLastReplan: (token?: number) => boolean;
  updateTopic: (courseId: ID, topicId: ID, changes: Partial<Topic>) => void;
  /** Atualiza vários tópicos em lote (ex.: calibração de meio do semestre no construtor). */
  batchUpdateTopicStates: (
    updates: Array<{ courseId: ID; topicId: ID; changes: Partial<Topic> }>,
  ) => void;
  /** Garante que um tópico dado em aula / Modo Teste existe na cadeira (criando ou atualizando confiança/estado). */
  ensureCourseTopic: (
    courseId: ID,
    title: string,
    opts?: { status?: Topic['status']; confidence?: Topic['confidence']; lastStudied?: string },
  ) => Topic | null;
  /**
   * Mudar disponibilidade/preferências do plano recalcula o plano (exceto vindo da nuvem).
   * `replan: false` adia o recálculo (para juntar várias mudanças num só Desfazer).
   */
  updateSettings: (
    changes: Partial<Settings>,
    opts?: { replan?: ReplanReason | false; force?: boolean },
  ) => void;
  setIntegration: (key: IntegrationKey, status: Partial<IntegrationStatus>) => void;
  cleanupMismatchedMaterials: (protectedIds?: Set<string>) => number;
  saveAcademicProfile: (changes: Partial<AcademicProfile>) => void;
  addWeeklyCheckIn: (checkIn: WeeklyCheckIn) => void;
  addStudyLog: (entry: StudyLogEntry) => void;
  removeStudyLog: (id: ID) => void;
  applyBuiltCurriculumCourses: (profile: AcademicProfile, built: Course[]) => void;
  applyCurriculumCourses: (profile: AcademicProfile) => void;
  clearAll: () => void;
}

export const newId = (): ID => crypto.randomUUID();

export interface ReplanOptions {
  force?: boolean;
  silent?: boolean;
  /** Permite gerar mesmo quando `plannerMode === 'manual'` (ex.: botão explícito «Sugerir com o Uni»). */
  allowInManualMode?: boolean;
  /** Preferências antes da mudança que levou a este recálculo (para o Desfazer as repor). */
  prevPrefs?: Settings['plannerPrefs'];
  /** Cadeiras antes da mudança (briefing que mexeu em tópicos). */
  prevCourses?: Course[];
}

const PLAN_SETTING_KEYS: Array<keyof Settings> = ['plannerPrefs', 'studyDays', 'dailyStudyMinutes'];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      settings: defaultSettings,
      integrations: defaultIntegrations,
      academicProfile: defaultAcademicProfile,
      weeklyCheckIns: [],
      studyLogs: [],

      upsert: (key, item) => {
        syncUpsert(key as any, item).catch(() => {});
        set((s) => {
          const list = s[key] as { id: ID }[];
          const exists = list.some((x) => x.id === item.id);
          return {
            [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
          } as Partial<AppState>;
        });
        if (key === 'assessments') get().replan('assessment');
        else if (key === 'classes' || key === 'events') get().replan('schedule');
      },
      upsertMany: (key, items) => {
        items.forEach((item) => syncUpsert(key as any, item).catch(() => {}));
        set((s) => {
          const map = new Map((s[key] as { id: ID }[]).map((x) => [x.id, x]));
          for (const it of items) map.set(it.id, it);
          return { [key]: [...map.values()] } as Partial<AppState>;
        });
        if (items.length > 0 && (key === 'assessments' || key === 'classes' || key === 'events')) {
          get().replan(key === 'assessments' ? 'assessment' : 'schedule');
        }
      },
      patch: (key, id, changes, opts) => {
        syncPatch(key as any, id, changes).catch(() => {});
        set((s) => {
          const nextList = (s[key] as { id: ID }[]).map((x) => (x.id === id ? { ...x, ...changes } : x));
          return { [key]: nextList } as Partial<AppState>;
        });
        if (!opts?.skipReconcile) {
          if (key === 'assessments') get().replan('assessment');
          else if (key === 'classes' || key === 'events') get().replan('schedule');
        }
      },
      remove: (key, id) => {
        const snapshot = get();
        if (key === 'materials') {
          const targetMat = snapshot.materials.find((m) => m.id === id);
          if (targetMat?.provider === 'upload') {
            deleteFile(targetMat.id).catch(() => {});
          }
        }
        if (key === 'courses') {
          const assessmentIds = snapshot.assessments.filter((x) => x.courseId === id).map((x) => x.id);
          const classIds = snapshot.classes.filter((x) => x.courseId === id).map((x) => x.id);
          const sessionIds = snapshot.sessions.filter((x) => x.courseId === id).map((x) => x.id);
          const taskIds = snapshot.tasks.filter((x) => x.courseId === id).map((x) => x.id);
          const courseMaterials = snapshot.materials.filter((x) => x.courseId === id);
          const materialIds = courseMaterials.map((x) => x.id);
          const eventIds = snapshot.events.filter((x) => x.courseId === id).map((x) => x.id);

          for (const m of courseMaterials) {
            if (m.provider === 'upload') deleteFile(m.id).catch(() => {});
          }
          deleteUniAgentLocal(id).catch(() => {});
          deleteUniMemory(id).catch(() => {});
          listTopicSheetsByCourse(id)
            .then((sheets) => Promise.all(sheets.map((sh) => deleteTopicSheet(sh.id))))
            .catch(() => {});
          deleteCourseCascadeFromCloud(id, {
            assessmentIds,
            classIds,
            sessionIds,
            taskIds,
            materialIds,
            eventIds,
          }).catch(() => {});
        } else {
          syncRemove(key as any, id).catch(() => {});
        }
        set((s) => {
          const next: Partial<Collections> = {
            [key]: (s[key] as { id: ID }[]).filter((x) => x.id !== id),
          };
          if (key === 'courses') {
            next.assessments = s.assessments.filter((x) => x.courseId !== id);
            next.classes = s.classes.filter((x) => x.courseId !== id);
            next.sessions = s.sessions.filter((x) => x.courseId !== id);
            next.tasks = s.tasks.filter((x) => x.courseId !== id);
            next.materials = s.materials.filter((x) => x.courseId !== id);
            next.events = s.events.filter((x) => x.courseId !== id);
          }
          return next as Partial<AppState>;
        });
        if (key === 'assessments') get().replan('assessment');
        else if (key === 'classes' || key === 'events' || key === 'courses') get().replan('schedule');
      },
      replaceSource: (key, source, items) => {
        let prevItems: Collections[typeof key] = [];
        let nextItems: Collections[typeof key] = [];
        set((s) => {
          prevItems = s[key];
          nextItems = [
            ...(s[key] as { source: Source }[]).filter((x) => x.source !== source),
            ...items,
          ] as Collections[typeof key];
          return { [key]: nextItems } as Partial<AppState>;
        });
        syncCollectionDiff(key, prevItems, nextItems).catch(() => {});
        // Importações de calendário/horário: recálculo silencioso (não interrompe a importação).
        get().replan(key === 'assessments' ? 'assessment' : 'schedule', { silent: key !== 'assessments' });
      },
      replan: (reason, opts = {}) => {
        const now = new Date();
        const state = get();
        const result = computeReplan(state, {
          today: todayStr(),
          nowMinutes: now.getHours() * 60 + now.getMinutes(),
          force: opts.force,
          allowInManualMode: opts.allowInManualMode,
        });
        const prevSessions = state.sessions;
        const sessionsChanged = result.sessions !== prevSessions && result.changed;
        if (result.prunedPrefs) {
          // Limpeza de notas/exceções expiradas: grava sem recalcular de novo.
          const settings = { ...get().settings, plannerPrefs: result.prunedPrefs };
          set({ settings });
          syncSettings({ plannerPrefs: result.prunedPrefs }).catch(() => {});
        }
        if (!sessionsChanged) return false;
        set({ sessions: result.sessions });
        syncSessionsDiff(prevSessions, result.sessions).catch(() => {});
        const token = recordPlanUndo({
          reason,
          prevFuture: result.previousFuture,
          ...(opts.prevPrefs !== undefined ? { prevPrefs: opts.prevPrefs } : {}),
          ...(opts.prevCourses ? { prevCourses: opts.prevCourses } : {}),
        });
        notifyPlanReplanned(token, reason, Boolean(opts.silent));
        return true;
      },
      applyBriefing: (items, text) => {
        const state = get();
        const prevPrefs = state.settings.plannerPrefs;
        const prevCourses = state.courses;
        const { prefs, topicUpdates } = applyPlanIntent(prevPrefs, items);
        if (topicUpdates.length > 0) get().batchUpdateTopicStates(topicUpdates);
        get().updateSettings(
          {
            plannerPrefs: {
              ...prefs,
              briefingNote: text.trim().slice(0, 1200),
              briefingAppliedAt: new Date().toISOString(),
            },
          },
          { replan: false },
        );
        return get().replan('briefing', { force: true, prevPrefs, prevCourses });
      },
      undoLastReplan: (token) => {
        const snap = takePlanUndo(token);
        if (!snap) return false;
        const today = todayStr();
        const prev = get();
        const restored = [
          ...prev.sessions.filter((s) => !isReplaceable(s, today)),
          ...snap.prevFuture,
        ];
        const patch: Partial<AppState> = { sessions: restored };
        if (snap.prevPrefs !== undefined) {
          patch.settings = { ...prev.settings, plannerPrefs: snap.prevPrefs };
          if (snap.prevPrefs) syncSettings({ plannerPrefs: snap.prevPrefs }).catch(() => {});
        }
        if (snap.prevCourses) {
          patch.courses = snap.prevCourses;
          syncCourseBatch(snap.prevCourses).catch(() => {});
        }
        set(patch);
        syncSessionsDiff(prev.sessions, restored).catch(() => {});
        return true;
      },
      updateTopic: (courseId, topicId, changes) => {
        let shouldReconcile = false;
        set((s) => {
          const nextCourses = s.courses.map((c) =>
            c.id !== courseId
              ? c
              : { ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, ...changes } : t)) },
          );
          const updatedCourse = nextCourses.find((c) => c.id === courseId);
          if (updatedCourse) syncUpsert('courses', updatedCourse).catch(() => {});
          shouldReconcile =
            changes.nextReviewDate !== undefined ||
            changes.confidence !== undefined ||
            changes.status !== undefined;
          return { courses: nextCourses };
        });
        // Progresso num tópico ajusta o plano em silêncio (não interrompe quem está a estudar).
        if (shouldReconcile) get().replan('topic', { silent: true });
      },
      batchUpdateTopicStates: (updates) => {
        if (updates.length === 0) return;
        const byCourse = new Map<ID, Map<ID, Partial<Topic>>>();
        for (const u of updates) {
          let tMap = byCourse.get(u.courseId);
          if (!tMap) {
            tMap = new Map();
            byCourse.set(u.courseId, tMap);
          }
          tMap.set(u.topicId, { ...(tMap.get(u.topicId) ?? {}), ...u.changes });
        }
        const touchedCourses: Collections['courses'] = [];
        set((s) => {
          const nextCourses = s.courses.map((c) => {
            const tMap = byCourse.get(c.id);
            if (!tMap) return c;
            const updated = {
              ...c,
              topics: c.topics.map((t) => {
                const ch = tMap.get(t.id);
                return ch ? { ...t, ...ch } : t;
              }),
            };
            touchedCourses.push(updated);
            return updated;
          });
          return { courses: nextCourses };
        });
        for (const c of touchedCourses) {
          syncUpsert('courses', c).catch(() => {});
        }
      },
      ensureCourseTopic: (courseId, rawTitle, opts) => {
        const cleanTitle = rawTitle.trim().slice(0, 140);
        if (!cleanTitle) return null;
        const course = get().courses.find((c) => c.id === courseId);
        if (!course) return null;
        const lower = cleanTitle.toLowerCase();
        const existing = course.topics.find((t) => t.title.trim().toLowerCase() === lower);
        if (existing) {
          const patchFields: Partial<Topic> = {};
          if (opts?.status && existing.status === 'todo') patchFields.status = opts.status;
          if (opts?.confidence && opts.confidence !== existing.confidence) {
            patchFields.confidence = opts.confidence;
          }
          if (opts?.lastStudied) patchFields.lastStudied = opts.lastStudied;
          if (Object.keys(patchFields).length > 0) {
            get().updateTopic(courseId, existing.id, patchFields);
            return { ...existing, ...patchFields };
          }
          return existing;
        }
        const created: Topic = {
          id: newId(),
          title: cleanTitle,
          status: opts?.status ?? 'learning',
          confidence: opts?.confidence ?? 3,
          ...(opts?.lastStudied ? { lastStudied: opts.lastStudied } : {}),
        };
        set((s) => {
          const nextCourses = s.courses.map((c) =>
            c.id === courseId ? { ...c, topics: [...c.topics, created] } : c,
          );
          const updatedCourse = nextCourses.find((c) => c.id === courseId);
          if (updatedCourse) syncUpsert('courses', updatedCourse).catch(() => {});
          return { courses: nextCourses };
        });
        return created;
      },
      updateSettings: (changes, opts) => {
        const prevPrefs = get().settings.plannerPrefs;
        // Horário por dia e valores antigos (dias, minutos) ficam sempre coerentes.
        let nextChanges = reconcileAvailabilityChanges(get().settings, changes);
        if (changes.language !== undefined) {
          const normalizedLang = normalizeAppLanguage(changes.language);
          nextChanges = { ...nextChanges, language: normalizedLang };
          setAppLanguage(normalizedLang);
        }
        syncSettings(nextChanges).catch(() => {});
        set((s) => ({ settings: { ...s.settings, ...nextChanges } }));
        // Mudou o que o plano usa → recalcula (nunca para mudanças vindas da nuvem: evita pingue-pongue).
        const touchesPlan = PLAN_SETTING_KEYS.some((k) => k in changes);
        if (touchesPlan && opts?.replan !== false && !isRemoteSyncing()) {
          get().replan(opts?.replan ?? 'prefs', { force: opts?.force, prevPrefs: prevPrefs ?? undefined });
        }
      },
      setIntegration: (key, status) =>
        set((s) => ({
          integrations: { ...s.integrations, [key]: { ...s.integrations[key], ...status } },
        })),
      cleanupMismatchedMaterials: (protectedIds) => {
        let removedCount = 0;
        let prevMaterials: Collections['materials'] = [];
        let nextMaterials: Collections['materials'] = [];
        set((s) => {
          prevMaterials = s.materials;
          const result = sanitizeMaterials(s.materials, s.courses, s.academicProfile?.entryYear, protectedIds);
          removedCount = result.removedCount;
          nextMaterials = result.clean;
          return { materials: result.clean } as Partial<AppState>;
        });
        if (removedCount > 0) {
          const keptIds = new Set(nextMaterials.map((m) => m.id));
          for (const prev of prevMaterials) {
            if (prev.provider === 'upload' && !keptIds.has(prev.id)) {
              deleteFile(prev.id).catch(() => {});
            }
          }
          syncCollectionDiff('materials', prevMaterials, nextMaterials).catch(() => {});
        }
        return removedCount;
      },
      saveAcademicProfile: (changes) =>
        set((s) => {
          const nextProfile = { ...s.academicProfile, ...changes };
          syncAcademicProfile(nextProfile).catch(() => {});
          return { academicProfile: nextProfile };
        }),
      addWeeklyCheckIn: (checkIn) =>
        set((s) => {
          const filtered = s.weeklyCheckIns.filter((w) => w.weekOf !== checkIn.weekOf && w.id !== checkIn.id);
          const nextProfile = { ...s.academicProfile, difficultCourseIds: checkIn.hardCourseIds };
          syncWeeklyCheckIn(checkIn).catch(() => {});
          syncAcademicProfile(nextProfile).catch(() => {});
          return {
            weeklyCheckIns: [checkIn, ...filtered].slice(0, 24),
            academicProfile: nextProfile,
          };
        }),
      addStudyLog: (entry) => {
        const replacedIds: string[] = [];
        set((s) => {
          const filtered = s.studyLogs.filter((l) => {
            if (l.id === entry.id) return false;
            const sameDayClass =
              entry.kind === 'class' &&
              entry.classSlotId &&
              l.kind === 'class' &&
              l.classSlotId === entry.classSlotId &&
              l.date === entry.date;
            const sameDayLog = entry.kind === 'day' && l.kind === 'day' && l.date === entry.date;
            const sameDayExam =
              entry.kind === 'exam_prep' &&
              entry.assessmentId &&
              l.kind === 'exam_prep' &&
              l.assessmentId === entry.assessmentId &&
              l.date === entry.date;
            if (sameDayClass || sameDayLog || sameDayExam) {
              replacedIds.push(l.id);
              return false;
            }
            return true;
          });
          return {
            studyLogs: [entry, ...filtered].slice(0, 120),
          };
        });
        for (const oldId of replacedIds) {
          deleteStudyLogFromCloud(oldId).catch(() => {});
        }
        syncStudyLog(entry).catch((err) => {
          if (import.meta.env.DEV) console.warn('[Store] syncStudyLog failed:', err);
        });
      },
      removeStudyLog: (id) => {
        deleteStudyLogFromCloud(id).catch(() => {});
        set((s) => ({
          studyLogs: s.studyLogs.filter((l) => l.id !== id),
        }));
      },
      applyBuiltCurriculumCourses: (profile, built) =>
        set((s) => {
          if (built.length === 0) {
            syncAcademicProfile(profile).catch(() => {});
            return { academicProfile: profile };
          }
          const builtIds = new Set(built.map((c) => c.id));
          const removedCourseIds = s.courses.filter((c) => !builtIds.has(c.id)).map((c) => c.id);
          const mappedDifficultIds = profile.difficultCourseIds.map((idOrCode) => {
            const found = built.find(
              (c) => c.id === idOrCode || c.code.toLowerCase() === idOrCode.toLowerCase(),
            );
            return found ? found.id : idOrCode;
          });
          const nextProfile = {
            ...profile,
            difficultCourseIds: mappedDifficultIds,
          };
          syncAcademicProfile(nextProfile).catch(() => {});
          syncCourseBatch(built, removedCourseIds).catch(() => {});
          return {
            courses: built,
            academicProfile: nextProfile,
          };
        }),
      applyCurriculumCourses: (profile) => {
        void import('../lib/portugalCurriculum').then(({ buildActiveCoursesFromCurriculum }) => {
          const built = buildActiveCoursesFromCurriculum(
            profile.universityId,
            profile.degreeId,
            profile.completedCourses,
            get().courses,
          );
          get().applyBuiltCurriculumCourses(profile, built);
        });
      },
      clearAll: () => set({ ...emptyData(), weeklyCheckIns: [], studyLogs: [] }),
    }),
    {
      name: 'uni-erp-v5',
      version: 10,
      onRehydrateStorage: () => (state) => {
        rehydrateStoreState(state);
      },
      migrate: migrateStoreState,
    },
  ),
);
