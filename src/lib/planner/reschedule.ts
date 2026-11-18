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
} from '../../types';
import {
  MIN_BLOCK,
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
  resolveDayPlanProfile,
  roundUp5,
  toMin,
} from './slots';

/**
 * Redistribui sessões em atraso pelos próximos dias de estudo disponíveis,
 * respeitando aulas, eventos, sessões já agendadas e o limite diário do estudante.
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
  } = args;

  if (overdue.length === 0) return { updated: [], unscheduledCount: 0 };

  const start = parseDay(from);
  const queue = [...overdue].sort((a, b) => a.date.localeCompare(b.date));
  const updated: StudySession[] = [];
  let qIdx = 0;

  for (let i = 0; i < days && qIdx < queue.length; i++) {
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

    while (qIdx < queue.length && remaining >= MIN_BLOCK) {
      const target = queue[qIdx]!;
      const duration = Math.min(target.minutes, remaining);
      if (duration < MIN_BLOCK) break;
      cursor = advanceCursorPastBusy(cursor, duration, dayBusy);
      if (cursor + duration > 23 * 60 + 30) break;

      updated.push({
        ...target,
        date: key,
        start: fmtTime(cursor),
        minutes: duration,
        reason: target.reason ?? { code: 'overdue' },
      });
      dayBusy.push({ start: cursor, end: cursor + duration });
      dayBusy.sort((a, b) => a.start - b.start);
      remaining -= duration;
      cursor = roundUp5(cursor + duration + BREAK);
      qIdx++;
    }
  }

  return {
    updated,
    unscheduledCount: Math.max(0, queue.length - qIdx),
  };
}
