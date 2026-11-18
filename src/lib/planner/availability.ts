// Disponibilidade de estudo: uma só fonte de verdade (plannerPrefs.weekdaySchedule).
// `settings.studyDays` e `settings.dailyStudyMinutes` passam a ser sempre DERIVADOS do horário,
// para clientes antigos e ecrãs que ainda os leem. Funções puras e testáveis.
import type {
  PlannerDayPeriod,
  PlannerPreferences,
  Settings,
  WeekdayAvailability,
} from '../../types';

export type WeekdaySchedule = Record<string, WeekdayAvailability>;

const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
const FALLBACK_DAYS = [1, 2, 3, 4, 5, 6];
const MIN_DAY_MINUTES = 30;
const MAX_DAY_MINUTES = 720;

export const DEFAULT_PLANNER_PREFS: PlannerPreferences = {
  horizonDays: 14,
  preferredPeriod: 'auto',
  blockMinutes: 50,
  strategy: 'balanced',
  boostCourseIds: [],
  pausedCourseIds: [],
  includeOverdue: true,
  fillClassGaps: false,
  contentMix: 'balanced',
  plannerMode: 'auto',
  preExamMarathon: { enabled: false, daysBefore: 2, dailyMinutes: 480 },
};

const clampMinutes = (m: number) =>
  Math.max(0, Math.min(MAX_DAY_MINUTES, Math.round(Number.isFinite(m) ? m : 0)));

/**
 * Horário equivalente ao que as definições antigas davam: os mesmos minutos em todos os dias ligados.
 * (Não usa buildDefaultWeekdaySchedule, que soma tempo ao fim de semana e mudaria planos existentes.)
 */
export function legacyScheduleFromSettings(
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>,
  preferredPeriod: PlannerDayPeriod = 'auto',
): WeekdaySchedule {
  const minutes = Math.max(MIN_DAY_MINUTES, clampMinutes(settings.dailyStudyMinutes || 120));
  const days = new Set(Array.isArray(settings.studyDays) ? settings.studyDays : FALLBACK_DAYS);
  const out: WeekdaySchedule = {};
  for (const d of ALL_DAYS) {
    out[String(d)] = { enabled: days.has(d), minutes, window: preferredPeriod };
  }
  return out;
}

/** Completa um horário parcial (dias em falta vêm das definições antigas) e normaliza valores. */
export function completeSchedule(
  schedule: WeekdaySchedule | undefined,
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>,
  preferredPeriod: PlannerDayPeriod = 'auto',
): WeekdaySchedule {
  const fallback = legacyScheduleFromSettings(settings, preferredPeriod);
  if (!schedule) return fallback;
  const out: WeekdaySchedule = {};
  for (const d of ALL_DAYS) {
    const k = String(d);
    const cur = schedule[k];
    if (!cur) {
      out[k] = fallback[k];
      continue;
    }
    out[k] = {
      enabled: Boolean(cur.enabled),
      minutes: clampMinutes(cur.minutes || fallback[k].minutes),
      window: cur.window ?? fallback[k].window,
      ...(cur.blockedPeriods && cur.blockedPeriods.length > 0
        ? { blockedPeriods: [...new Set(cur.blockedPeriods)] }
        : {}),
    };
  }
  return out;
}

/**
 * Antes desta versão, um dia desligado em `studyDays` vencia o horário. Ao migrar, esse veto
 * passa para dentro do horário, para que os planos existentes não mudem.
 */
export function bakeStudyDaysVeto(schedule: WeekdaySchedule, studyDays: number[] | undefined): WeekdaySchedule {
  if (!Array.isArray(studyDays)) return schedule;
  const allowed = new Set(studyDays);
  const out: WeekdaySchedule = {};
  for (const [k, v] of Object.entries(schedule)) {
    out[k] = allowed.has(Number(k)) ? v : { ...v, enabled: false };
  }
  return out;
}

/** Preferências completas, com horário de 7 dias sempre presente. Tudo o que planeia lê por aqui. */
export function resolvePlannerPrefs(settings: Settings): PlannerPreferences {
  const prefs = { ...DEFAULT_PLANNER_PREFS, ...(settings.plannerPrefs ?? {}) };
  return {
    ...prefs,
    weekdaySchedule: completeSchedule(prefs.weekdaySchedule, settings, prefs.preferredPeriod),
  };
}

/** Valores antigos derivados do horário: dias ligados e média dos minutos desses dias. */
export function deriveLegacyAvailability(schedule: WeekdaySchedule): {
  studyDays: number[];
  dailyStudyMinutes: number;
} {
  const enabled = ALL_DAYS.filter((d) => schedule[String(d)]?.enabled && (schedule[String(d)]?.minutes ?? 0) > 0);
  if (enabled.length === 0) {
    return { studyDays: [], dailyStudyMinutes: MIN_DAY_MINUTES };
  }
  const sum = enabled.reduce((acc, d) => acc + (schedule[String(d)]?.minutes ?? 0), 0);
  return {
    studyDays: [...enabled],
    dailyStudyMinutes: Math.max(MIN_DAY_MINUTES, Math.round(sum / enabled.length)),
  };
}

/** Minutos de estudo previstos numa semana normal (sem maratona). */
export function weeklyStudyMinutes(schedule: WeekdaySchedule): number {
  return ALL_DAYS.reduce((acc, d) => {
    const day = schedule[String(d)];
    return acc + (day?.enabled ? day.minutes : 0);
  }, 0);
}

/** Minutos previstos para um dia da semana (0 se desligado). */
export function minutesForWeekday(schedule: WeekdaySchedule, weekday: number): number {
  const day = schedule[String(weekday)];
  return day?.enabled ? day.minutes : 0;
}

/** Maior número de minutos num dia ligado (para «até X h/dia»). */
export function maxDailyMinutes(schedule: WeekdaySchedule): number {
  return ALL_DAYS.reduce((acc, d) => Math.max(acc, minutesForWeekday(schedule, d)), 0);
}

/**
 * Mantém horário e valores antigos coerentes numa escrita de definições.
 * - Se vem um horário novo → os valores antigos são recalculados a partir dele.
 * - Se só vêm valores antigos (onboarding, clientes antigos, Definições antigas) → o horário
 *   é atualizado: dias ligam/desligam; minutos aplicam-se a todos os dias ligados.
 */
export function reconcileAvailabilityChanges(
  prev: Settings,
  changes: Partial<Settings>,
): Partial<Settings> {
  const nextSchedule = changes.plannerPrefs?.weekdaySchedule;
  const touchesLegacy = changes.studyDays !== undefined || changes.dailyStudyMinutes !== undefined;
  if (!nextSchedule && !touchesLegacy) return changes;

  const prevPrefs = { ...(prev.plannerPrefs ?? DEFAULT_PLANNER_PREFS) };
  const period = changes.plannerPrefs?.preferredPeriod ?? prevPrefs.preferredPeriod ?? 'auto';

  let schedule: WeekdaySchedule;
  if (nextSchedule) {
    schedule = completeSchedule(nextSchedule, prev, period);
  } else {
    const base = completeSchedule(prevPrefs.weekdaySchedule, prev, period);
    schedule = { ...base };
    if (Array.isArray(changes.studyDays)) {
      const on = new Set(changes.studyDays);
      for (const d of ALL_DAYS) schedule[String(d)] = { ...schedule[String(d)], enabled: on.has(d) };
    }
    if (changes.dailyStudyMinutes !== undefined) {
      const m = Math.max(MIN_DAY_MINUTES, clampMinutes(changes.dailyStudyMinutes));
      for (const d of ALL_DAYS) {
        if (schedule[String(d)].enabled) schedule[String(d)] = { ...schedule[String(d)], minutes: m };
      }
    }
  }

  const legacy = deriveLegacyAvailability(schedule);
  return {
    ...changes,
    plannerPrefs: { ...prevPrefs, ...(changes.plannerPrefs ?? {}), weekdaySchedule: schedule },
    studyDays: legacy.studyDays,
    dailyStudyMinutes: legacy.dailyStudyMinutes,
  };
}

/** Migração (store v10): materializa o horário com o veto antigo de `studyDays` incluído. */
export function migrateAvailabilitySettings<T extends Partial<Settings>>(settings: T): T {
  if (!settings) return settings;
  const prefs = { ...DEFAULT_PLANNER_PREFS, ...(settings.plannerPrefs ?? {}) };
  const legacySource = {
    dailyStudyMinutes: settings.dailyStudyMinutes ?? 120,
    studyDays: Array.isArray(settings.studyDays) ? settings.studyDays : FALLBACK_DAYS,
  };
  const schedule = bakeStudyDaysVeto(
    completeSchedule(prefs.weekdaySchedule, legacySource, prefs.preferredPeriod),
    settings.studyDays,
  );
  const legacy = deriveLegacyAvailability(schedule);
  return {
    ...settings,
    plannerPrefs: { ...(settings.plannerPrefs ?? DEFAULT_PLANNER_PREFS), weekdaySchedule: schedule },
    studyDays: legacy.studyDays,
    dailyStudyMinutes: legacy.dailyStudyMinutes,
  };
}
