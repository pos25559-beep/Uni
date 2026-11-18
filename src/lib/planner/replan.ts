// Um só caminho para (re)gerar o plano: todas as entradas (botões, briefing, check-in,
// onboarding, ferramentas do Uni, recálculos automáticos) passam por aqui, sempre com as
// preferências guardadas e sem marcar por cima de sessões fixadas. Puro e testável.
import type {
  AcademicProfile,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  Material,
  PlannerPreferences,
  Settings,
  StudyLogEntry,
  StudySession,
  WeeklyCheckIn,
} from '../../types';
import { generatePlan } from './engine';
import { resolvePlannerPrefs } from './availability';
import type { PlanInput } from './types';

export type ReplanReason =
  | 'manual'
  | 'prefs'
  | 'briefing'
  | 'checkin'
  | 'onboarding'
  | 'uni_tool'
  | 'assessment'
  | 'topic'
  | 'schedule'
  | 'session_done';

export interface ReplanState {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials: Material[];
  settings: Settings;
  sessions: StudySession[];
  academicProfile: Pick<AcademicProfile, 'difficultCourseIds' | 'extraActivities'>;
  weeklyCheckIns: WeeklyCheckIn[];
  studyLogs: StudyLogEntry[];
}

/** Sessão que o motor pode substituir: gerada, por fazer, não fixada, de hoje em diante. */
export const isReplaceable = (s: StudySession, from: string) =>
  Boolean(s.generated) && !s.done && !s.locked && s.date >= from;

/** Limpa notas, exceções e reforços/pausas já expirados. Devolve as mesmas prefs se nada mudou. */
export function pruneExpiredPrefs(prefs: PlannerPreferences, today: string): PlannerPreferences {
  let changed = false;
  const next: PlannerPreferences = { ...prefs };
  if (prefs.courseNotes) {
    const kept = Object.fromEntries(Object.entries(prefs.courseNotes).filter(([, n]) => n.until >= today));
    if (Object.keys(kept).length !== Object.keys(prefs.courseNotes).length) {
      next.courseNotes = kept;
      changed = true;
    }
  }
  if (prefs.dateOverrides) {
    const kept = Object.fromEntries(Object.entries(prefs.dateOverrides).filter(([d]) => d >= today));
    if (Object.keys(kept).length !== Object.keys(prefs.dateOverrides).length) {
      next.dateOverrides = kept;
      changed = true;
    }
  }
  if (prefs.courseModeUntil) {
    const expired = Object.entries(prefs.courseModeUntil)
      .filter(([, until]) => until < today)
      .map(([id]) => id);
    if (expired.length > 0) {
      const gone = new Set(expired);
      next.courseModeUntil = Object.fromEntries(
        Object.entries(prefs.courseModeUntil).filter(([id]) => !gone.has(id)),
      );
      next.boostCourseIds = (prefs.boostCourseIds ?? []).filter((id) => !gone.has(id));
      next.pausedCourseIds = (prefs.pausedCourseIds ?? []).filter((id) => !gone.has(id));
      changed = true;
    }
  }
  return changed ? next : prefs;
}

/** O único sítio onde se monta a entrada do motor. */
export function buildPlanInput(
  state: ReplanState,
  prefs: PlannerPreferences,
  args: { from: string; nowMinutes?: number; existing: StudySession[] },
): PlanInput {
  return {
    courses: state.courses,
    assessments: state.assessments,
    classes: state.classes,
    events: state.events,
    materials: state.materials,
    settings: state.settings,
    from: args.from,
    nowMinutes: args.nowMinutes,
    days: prefs.horizonDays ?? 14,
    existing: args.existing,
    difficultCourseIds: state.academicProfile.difficultCourseIds,
    weeklyCheckIns: state.weeklyCheckIns,
    studyLogs: state.studyLogs,
    extraActivities: state.academicProfile.extraActivities,
    preferredPeriod: prefs.preferredPeriod ?? 'auto',
    blockMinutes: prefs.blockMinutes,
    strategy: prefs.strategy,
    boostCourseIds: prefs.boostCourseIds,
    pausedCourseIds: prefs.pausedCourseIds,
    exclusiveTestFocus: prefs.exclusiveTestFocus,
    weekdaySchedule: prefs.weekdaySchedule,
    fillClassGaps: prefs.fillClassGaps,
    preExamMarathon: prefs.preExamMarathon,
    contentMix: prefs.contentMix,
    courseNotes: prefs.courseNotes,
    // Notas antigas sem validade só contam enquanto não houver notas novas.
    briefingCourseFocus: prefs.courseNotes ? undefined : prefs.briefingCourseFocus,
  };
}

const slotKey = (s: StudySession) => `${s.date}|${s.start ?? ''}|${s.courseId}|${s.topicId ?? ''}`;

/**
 * Bloco novo igual a um antigo (mesmo dia, hora, cadeira e tópico) mantém o id e, se nada mais
 * mudou, o próprio objeto: a sincronização só escreve o que mudou (poupa escritas no plano Spark).
 */
export function reuseStableIds(previous: StudySession[], next: StudySession[]): StudySession[] {
  const pool = new Map<string, StudySession[]>();
  for (const p of previous) {
    const k = slotKey(p);
    pool.set(k, [...(pool.get(k) ?? []), p]);
  }
  return next.map((n) => {
    const candidates = pool.get(slotKey(n));
    const old = candidates?.shift();
    if (!old) return n;
    const withId = { ...n, id: old.id };
    return JSON.stringify(withId) === JSON.stringify(old) ? old : withId;
  });
}

export interface ReplanResult {
  sessions: StudySession[];
  /** Sessões substituíveis antes do recálculo (para Desfazer). */
  previousFuture: StudySession[];
  /** O plano visível mudou? */
  changed: boolean;
  /** Preferências sem entradas expiradas, quando houve limpeza. */
  prunedPrefs?: PlannerPreferences;
}

/**
 * Recalcula o plano a partir de `today`. Sem `force`, só recalcula se já houver plano gerado
 * pendente (não cria plano a quem nunca o pediu).
 */
export function computeReplan(
  state: ReplanState,
  opts: { today: string; nowMinutes?: number; force?: boolean },
): ReplanResult {
  const { today } = opts;
  const previousFuture = state.sessions.filter((s) => isReplaceable(s, today));
  if (!opts.force && previousFuture.length === 0) {
    return { sessions: state.sessions, previousFuture, changed: false };
  }
  const kept = state.sessions.filter((s) => !isReplaceable(s, today));
  if (state.courses.length === 0) {
    return { sessions: kept, previousFuture, changed: previousFuture.length > 0 };
  }

  const resolved = resolvePlannerPrefs(state.settings);
  const pruned = pruneExpiredPrefs(resolved, today);
  const generated = generatePlan(
    buildPlanInput(state, pruned, { from: today, nowMinutes: opts.nowMinutes, existing: kept }),
  );
  const stable = reuseStableIds(previousFuture, generated);
  const previousSet = new Set(previousFuture);
  const changed = stable.length !== previousFuture.length || stable.some((s) => !previousSet.has(s));

  return {
    sessions: [...kept, ...stable],
    previousFuture,
    changed,
    ...(pruned !== resolved ? { prunedPrefs: pruned } : {}),
  };
}
