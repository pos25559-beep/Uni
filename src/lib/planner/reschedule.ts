import { parseISO } from 'date-fns';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  PlannerDayPeriod,
  PreExamMarathonConfig,
  Settings,
  StudySession,
  WeekdayAvailability,
  ID,
} from '../../types';
import {
  MIN_DAY_BUDGET,
  PERIOD_BUSY_RANGES,
  BREAK,
  type BusyInterval,
} from './types';
import {
  advanceCursorPastBusy,
  dayKey,
  fmtTime,
  occupied,
  parseDay,
  parseDueMinutes,
  resolveDayPlanProfile,
  roundUp5,
  toMin,
} from './slots';

const EXAM_REASONS = new Set(['exam_prep', 'exam_marathon', 'exam_eve']);
/** Folga mínima (min) entre o fim do bloco e a hora de uma avaliação no mesmo dia. */
const EXAM_GAP = 30;

/**
 * Redistribui sessões em atraso pelos próximos dias de estudo disponíveis,
 * respeitando aulas, eventos, sessões já agendadas e o limite diário do estudante.
 *
 * - Nunca trunca blocos: só coloca um bloco se os `minutes` completos couberem
 *   no orçamento do dia e num intervalo livre; senão tenta o dia seguinte.
 * - Nunca coloca um bloco no dia (ou depois) da avaliação a que está ligado
 *   (`assessmentId`) nem, se o motivo for de exame, da próxima avaliação por
 *   classificar da cadeira. No dia de uma avaliação com hora, termina ≥30 min antes.
 * - `pausedCourseIds`: sessões dessas cadeiras ficam por agendar (contam em `unscheduledCount`).
 * - Os blocos devolvidos ficam `locked: true`, para o próximo replaneamento automático não os apagar.
 */
export function rescheduleOverdueSessions(args: {
  overdue: StudySession[];
  existing: StudySession[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  settings: Settings;
  from: string;
  nowMinutes?: number;
  days?: number;
  preferredPeriod?: PlannerDayPeriod;
  weekdaySchedule?: Record<string, WeekdayAvailability>;
  preExamMarathon?: PreExamMarathonConfig;
  assessments?: Assessment[];
  pausedCourseIds?: ID[];
}): { updated: StudySession[]; unscheduledCount: number } {
  const {
    overdue,
    existing,
    classes,
    events,
    settings,
    from,
    nowMinutes,
    days = 14,
    preferredPeriod = 'auto',
    weekdaySchedule,
    preExamMarathon,
    assessments = [],
    pausedCourseIds = [],
  } = args;

  if (overdue.length === 0) return { updated: [], unscheduledCount: 0 };

  const paused = new Set(pausedCourseIds);
  const start = parseDay(from);
  const queue = overdue
    .filter((s) => !paused.has(s.courseId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pausedCount = overdue.length - queue.length;
  const updated: StudySession[] = [];

  const ungraded = assessments.filter((a) => a.grade === undefined);
  /** Primeiro dia (exclusivo) em que a sessão já não pode ser colocada. */
  const cutoffOf = (t: StudySession): string | undefined => {
    if (t.assessmentId) {
      const a = assessments.find((x) => x.id === t.assessmentId);
      if (a) return a.date.slice(0, 10);
    }
    if (t.reason && EXAM_REASONS.has(t.reason.code)) {
      const next = ungraded
        .filter((a) => a.courseId === t.courseId && a.date.slice(0, 10) >= from)
        .map((a) => a.date.slice(0, 10))
        .sort()[0];
      return next;
    }
    return undefined;
  };
  const cutoffs = new Map(queue.map((t) => [t.id, cutoffOf(t)] as const));
  let pending = [...queue];

  for (let i = 0; i < days && pending.length > 0; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(day);
    const weekday = day.getDay();
    const dayProfile = resolveDayPlanProfile({
      dateKey: key,
      weekday,
      settings,
      assessments,
      weekdaySchedule,
      preferredPeriod,
      preExamMarathon,
    });
    if (!dayProfile.enabled) continue;

    const roundedNow =
      i === 0 && nowMinutes !== undefined
        ? Math.ceil((nowMinutes + 10) / 30) * 30
        : undefined;
    if (roundedNow !== undefined && roundedNow > 22 * 60 + 30) continue;

    const weekend = weekday === 0 || weekday === 6;
    const win = dayProfile.windowMode;
    const periodBase =
      win === 'all_day' || win === 'morning'
        ? 8 * 60 + 30
        : win === 'afternoon'
          ? 14 * 60
          : win === 'evening'
            ? 17 * 60 + 30
            : weekend
              ? 10 * 60
              : 17 * 60;
    const baseStart = Math.max(periodBase, roundedNow ?? 0);

    const dayBusy: BusyInterval[] = [];
    if (!dayProfile.isMarathonDay) {
      for (const bp of dayProfile.blockedPeriods) dayBusy.push(PERIOD_BUSY_RANGES[bp]);
    }
    for (const c of classes) {
      if (c.weekday === weekday) dayBusy.push({ start: toMin(c.start), end: toMin(c.end) });
    }
    for (const e of events) {
      if (!e.allDay && e.start.slice(0, 10) === key) {
        const s = parseISO(e.start);
        const en = parseISO(e.end);
        dayBusy.push({
          start: s.getHours() * 60 + s.getMinutes(),
          end: en.getHours() * 60 + en.getMinutes(),
        });
      }
    }
    for (const s of existing) {
      if (s.date === key && s.start) {
        const st = toMin(s.start);
        dayBusy.push({ start: st, end: st + occupied(s) });
      }
    }
    dayBusy.sort((a, b) => a.start - b.start);

    const existingMinutes = existing
      .filter((s) => s.date === key)
      .reduce((sum, s) => sum + occupied(s), 0);
    const budget = Math.max(MIN_DAY_BUDGET, dayProfile.baseBudget);
    let remaining = Math.max(0, budget - existingMinutes);
    let cursor = baseStart;

    const stillPending: StudySession[] = [];
    for (const target of pending) {
      const cutoff = cutoffs.get(target.id);
      if (cutoff && key >= cutoff) {
        // Fora do prazo: nunca mais cabe; fica por agendar.
        stillPending.push(target);
        continue;
      }
      if (target.minutes > remaining) {
        stillPending.push(target);
        continue;
      }
      // No dia de uma avaliação com hora da mesma cadeira, acaba ≥30 min antes.
      let maxEnd = 23 * 60 + 30;
      for (const a of ungraded) {
        if (a.courseId !== target.courseId || a.date.slice(0, 10) !== key) continue;
        const due = parseDueMinutes(a.date);
        if (due !== undefined) maxEnd = Math.min(maxEnd, due - EXAM_GAP);
      }
      const at = advanceCursorPastBusy(cursor, target.minutes, dayBusy);
      if (at + target.minutes > maxEnd) {
        stillPending.push(target);
        continue;
      }
      updated.push({
        ...target,
        date: key,
        start: fmtTime(at),
        locked: true,
        reason: target.reason ?? { code: 'overdue' },
      });
      dayBusy.push({ start: at, end: at + target.minutes });
      dayBusy.sort((a, b) => a.start - b.start);
      remaining -= target.minutes;
      cursor = roundUp5(at + target.minutes + BREAK);
    }
    pending = stillPending;
  }

  return {
    updated,
    unscheduledCount: pending.length + pausedCount,
  };
}
