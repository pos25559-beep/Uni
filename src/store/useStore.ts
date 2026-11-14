import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultSettings, emptyCollections } from '../lib/seed';
import {
  syncAcademicProfile,
  syncCourseBatch,
  syncPatch,
  syncRemove,
  syncSettings,
  syncUpsert,
  syncWeeklyCheckIn,
} from '../lib/firestoreSync';
import { migrateStoreState, rehydrateStoreState, sanitizeMaterials } from '../lib/storeMigration';
import type {
  AcademicProfile,
  Collections,
  ID,
  IntegrationKey,
  IntegrationStatus,
  Settings,
  Source,
  Topic,
  WeeklyCheckIn,
} from '../types';
import { buildActiveCoursesFromCurriculum } from '../lib/portugalCurriculum';
import { generatePlan } from '../lib/planner';
import { todayStr } from '../lib/selectors';

type Key = keyof Collections;
type Item<K extends Key> = Collections[K][number];

const emptyData = emptyCollections;

const defaultIntegrations: Record<IntegrationKey, IntegrationStatus> = {
  google: { connected: false },
  microsoft: { connected: false },
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

  /** Cria ou atualiza (por id) um registo numa coleção. */
  upsert: <K extends Key>(key: K, item: Item<K>) => void;
  upsertMany: <K extends Key>(key: K, items: Item<K>[]) => void;
  /** Atualiza parcialmente um registo existente. */
  patch: <K extends Key>(key: K, id: ID, changes: Partial<Item<K>>) => void;
  remove: (key: Key, id: ID) => void;
  replaceSource: <K extends 'assessments' | 'classes' | 'events'>(
    key: K,
    source: Source,
    items: Item<K>[],
  ) => void;
  replaceGeneratedSessions: (fromDate: string, sessions: Collections['sessions']) => void;
  /** Regenera sessões futuras pendentes se já existir um plano gerado ativo (ou quando `force = true`). */
  reconcileFuturePlan: (force?: boolean) => void;
  updateTopic: (courseId: ID, topicId: ID, changes: Partial<Topic>) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  setIntegration: (key: IntegrationKey, status: Partial<IntegrationStatus>) => void;
  cleanupMismatchedMaterials: () => number;
  saveAcademicProfile: (changes: Partial<AcademicProfile>) => void;
  addWeeklyCheckIn: (checkIn: WeeklyCheckIn) => void;
  applyCurriculumCourses: (profile: AcademicProfile) => void;
  clearAll: () => void;
}

export const newId = (): ID => crypto.randomUUID();

function maybeReconcileSessions(
  s: Pick<AppState, 'courses' | 'assessments' | 'classes' | 'events' | 'settings' | 'sessions' | 'academicProfile' | 'weeklyCheckIns'>,
  force = false,
): AppState['sessions'] {
  const today = todayStr();
  const hasPendingGenerated = s.sessions.some((x) => x.generated && !x.done && x.date >= today);
  if (!force && !hasPendingGenerated) return s.sessions;
  if (s.courses.length === 0) {
    return s.sessions.filter((x) => !x.generated || x.done || x.date < today);
  }
  const now = new Date();
  const preserved = s.sessions.filter((x) => !x.generated || x.done || x.date < today);
  const nextPlan = generatePlan({
    courses: s.courses,
    assessments: s.assessments,
    classes: s.classes,
    events: s.events,
    settings: s.settings,
    from: today,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    days: 14,
    existing: preserved,
    difficultCourseIds: s.academicProfile.difficultCourseIds,
    weeklyCheckIns: s.weeklyCheckIns,
    extraActivities: s.academicProfile.extraActivities,
  });
  return [...preserved, ...nextPlan];
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...emptyData(),
      settings: defaultSettings,
      integrations: defaultIntegrations,
      academicProfile: defaultAcademicProfile,
      weeklyCheckIns: [],

      upsert: (key, item) => {
        syncUpsert(key as any, item).catch(() => {});
        return set((s) => {
          const list = s[key] as { id: ID }[];
          const exists = list.some((x) => x.id === item.id);
          const updated = {
            ...s,
            [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
          };
          if (key === 'assessments') {
            return {
              [key]: updated[key],
              sessions: maybeReconcileSessions(updated),
            } as Partial<AppState>;
          }
          return { [key]: updated[key] } as Partial<AppState>;
        });
      },
      upsertMany: (key, items) => {
        items.forEach((item) => syncUpsert(key as any, item).catch(() => {}));
        return set((s) => {
          const map = new Map((s[key] as { id: ID }[]).map((x) => [x.id, x]));
          for (const it of items) map.set(it.id, it);
          return { [key]: [...map.values()] } as Partial<AppState>;
        });
      },
      patch: (key, id, changes) => {
        syncPatch(key as any, id, changes).catch(() => {});
        return set((s) => {
          const nextList = (s[key] as { id: ID }[]).map((x) => (x.id === id ? { ...x, ...changes } : x));
          if (key === 'assessments') {
            const updated = { ...s, assessments: nextList as AppState['assessments'] };
            return {
              [key]: nextList,
              sessions: maybeReconcileSessions(updated),
            } as Partial<AppState>;
          }
          return { [key]: nextList } as Partial<AppState>;
        });
      },
      remove: (key, id) => {
        syncRemove(key as any, id).catch(() => {});
        return set((s) => {
          const next: Partial<Collections> = {
            [key]: (s[key] as { id: ID }[]).filter((x) => x.id !== id),
          };
          if (key === 'courses') {
            next.assessments = s.assessments.filter((x) => x.courseId !== id);
            next.classes = s.classes.filter((x) => x.courseId !== id);
            next.sessions = s.sessions.filter((x) => x.courseId !== id);
            next.tasks = s.tasks.filter((x) => x.courseId !== id);
            next.materials = s.materials.filter((x) => x.courseId !== id);
          } else if (key === 'assessments') {
            const updated = { ...s, assessments: next.assessments! };
            next.sessions = maybeReconcileSessions(updated);
          }
          return next as Partial<AppState>;
        });
      },
      replaceSource: (key, source, items) =>
        set((s) => ({
          [key]: [...(s[key] as { source: Source }[]).filter((x) => x.source !== source), ...items],
        }) as Partial<AppState>),
      replaceGeneratedSessions: (fromDate, sessions) =>
        set((s) => ({
          sessions: [
            ...s.sessions.filter((x) => !x.generated || x.done || x.date < fromDate),
            ...sessions,
          ],
        })),
      reconcileFuturePlan: (force = false) =>
        set((s) => ({
          sessions: maybeReconcileSessions(s, force),
        })),
      updateTopic: (courseId, topicId, changes) =>
        set((s) => {
          const nextCourses = s.courses.map((c) =>
            c.id !== courseId
              ? c
              : { ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, ...changes } : t)) },
          );
          const updatedCourse = nextCourses.find((c) => c.id === courseId);
          if (updatedCourse) syncUpsert('courses', updatedCourse).catch(() => {});
          const shouldReconcile =
            changes.nextReviewDate !== undefined ||
            changes.confidence !== undefined ||
            changes.status !== undefined;
          return {
            courses: nextCourses,
            ...(shouldReconcile
              ? { sessions: maybeReconcileSessions({ ...s, courses: nextCourses }) }
              : {}),
          };
        }),
      updateSettings: (changes) => {
        syncSettings(changes).catch(() => {});
        return set((s) => ({ settings: { ...s.settings, ...changes } }));
      },
      setIntegration: (key, status) =>
        set((s) => ({
          integrations: { ...s.integrations, [key]: { ...s.integrations[key], ...status } },
        })),
      cleanupMismatchedMaterials: () => {
        let removedCount = 0;
        set((s) => {
          const result = sanitizeMaterials(s.materials, s.courses);
          removedCount = result.removedCount;
          return { materials: result.clean } as Partial<AppState>;
        });
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
          const nextProfile =
            checkIn.hardCourseIds.length > 0
              ? { ...s.academicProfile, difficultCourseIds: checkIn.hardCourseIds }
              : s.academicProfile;
          syncWeeklyCheckIn(checkIn).catch(() => {});
          if (checkIn.hardCourseIds.length > 0) {
            syncAcademicProfile(nextProfile).catch(() => {});
          }
          return {
            weeklyCheckIns: [checkIn, ...filtered].slice(0, 24),
            academicProfile: nextProfile,
          };
        }),
      applyCurriculumCourses: (profile) =>
        set((s) => {
          const built = buildActiveCoursesFromCurriculum(
            profile.universityId,
            profile.degreeId,
            profile.completedCourses,
            s.courses,
          );
          if (built.length === 0) {
            syncAcademicProfile(profile).catch(() => {});
            return { academicProfile: profile };
          }
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
          syncCourseBatch(built).catch(() => {});
          return {
            courses: built,
            academicProfile: nextProfile,
          };
        }),
      clearAll: () => set({ ...emptyData() }),
    }),
    {
      name: 'uni-erp-v5',
      version: 7,
      onRehydrateStorage: () => (state) => {
        rehydrateStoreState(state);
      },
      migrate: migrateStoreState,
    },
  ),
);
