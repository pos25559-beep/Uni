import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  ID,
  Material,
  PlannerContentMix,
  PlannerDayPeriod,
  PlannerWindowMode,
  PreExamMarathonConfig,
  Settings,
  StudySession,
  Topic,
  WeekdayAvailability,
} from '../../types';
import { resolveWeekdayAvailability } from '../plannerBriefing';
import { sessionMinutes } from '../selectors';
import { extractOrdinalNumber } from '../uniCheckInNlu';
import {
  BREAK,
  PERIOD_BUSY_RANGES,
  type BusyInterval,
  type DayPlanProfile,
} from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/** Lê yyyy-MM-dd (ou yyyy-MM-ddTHH:mm…) como data local à meia-noite. */
export const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmtTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** Extrai minutos do dia (entre 07:00 e 22:00) de `yyyy-MM-ddTHH:mm...`, se aplicável. */
export const parseDueMinutes = (s: string): number | undefined => {
  const tIdx = s.indexOf('T');
  if (tIdx === -1) return undefined;
  const hhmm = s.slice(tIdx + 1, tIdx + 6);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
  const mins = toMin(hhmm);
  return mins >= 7 * 60 && mins <= 22 * 60 ? mins : undefined;
};

export const roundUp5 = (min: number) => Math.ceil(min / 5) * 5;

/** Avança `cursor` até evitar colisões com intervalos ocupados (aulas, eventos, sessões existentes), arredondando a múltiplos de 5 min. */
export const advanceCursorPastBusy = (
  cursor: number,
  duration: number,
  busy: BusyInterval[],
): number => {
  let next = roundUp5(cursor);
  for (const iv of busy) {
    if (next < iv.end && next + duration > iv.start) {
      next = roundUp5(Math.max(next, iv.end + BREAK));
    }
  }
  return next;
};

export const firstSlotBefore = (
  cursor: number,
  duration: number,
  busy: BusyInterval[],
  maxEnd: number,
): number | null => {
  const next = advanceCursorPastBusy(cursor, duration, busy);
  return next + duration <= maxEnd ? next : null;
};

export const availableWindowMinutes = (
  cursor: number,
  maxEnd: number,
  busy: BusyInterval[],
): number => {
  let c = roundUp5(cursor);
  if (c >= maxEnd) return 0;
  let total = 0;
  for (const iv of busy) {
    if (iv.end <= c) continue;
    if (iv.start >= maxEnd) break;
    if (iv.start > c) {
      total += iv.start - c;
    }
    c = Math.max(c, roundUp5(iv.end + BREAK));
    if (c >= maxEnd) break;
  }
  if (c < maxEnd) {
    total += maxEnd - c;
  }
  return total;
};

/** Minutos "ocupados" por uma sessão: realizados se concluída, planeados caso contrário. */
export const occupied = (s: StudySession) => (s.done ? sessionMinutes(s) : s.minutes);

const stripNorm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Associa o material mais relevante ao tópico/momento de estudo (testes antigos vs slides/sebenta). */
export function matchBestMaterialForTopic(args: {
  courseId: ID;
  topic?: Topic | null;
  materials: Material[];
  contentMix: PlannerContentMix;
  isExamUrgent: boolean;
}): ID | undefined {
  const { courseId, topic, materials, contentMix, isExamUrgent } = args;
  const mine = materials.filter((m) => m.courseId === courseId);
  if (mine.length === 0) return undefined;

  const topicOrd = topic ? extractOrdinalNumber(topic.title) : null;
  const topicWords = topic
    ? stripNorm(topic.title)
        .split(/\s+/)
        .filter((w) => w.length >= 4)
    : [];
  const preferPractice =
    isExamUrgent ||
    contentMix === 'practice_first' ||
    (topic ? topic.status === 'review' || topic.status === 'done' : false);
  const preferTheory = contentMix === 'theory_first' || topic?.status === 'todo';

  let bestId: string | undefined;
  let bestScore = 0;

  for (const m of mine) {
    let score = 0;
    const matOrd = extractOrdinalNumber(m.title);
    const matNorm = stripNorm(m.title);

    if (topicOrd !== null && matOrd !== null && topicOrd === matOrd) {
      score += 6;
    }
    if (topicWords.length > 0) {
      const hits = topicWords.filter((w) => matNorm.includes(w)).length;
      score += hits * 4;
    }
    if (preferPractice) {
      if (m.category === 'teste_antigo' || m.category === 'exame_antigo') score += 12;
      else if (m.category === 'ficha') score += 9;
      if (m.hasSolution) score += 3;
    } else if (preferTheory) {
      if (m.category === 'slide_oficial' || m.category === 'sebenta') score += 10;
      else if (m.category === 'ficha') score += 4;
    } else {
      if (m.category === 'ficha' || m.category === 'slide_oficial' || m.category === 'sebenta') score += 4;
    }
    if (m.pinned) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestId = m.id;
    }
  }
  return bestScore > 0 ? bestId : undefined;
}

/** Calcula o perfil de estudo real de um dia específico (Seg–Dom + Reta Final Pré-Teste). */
export function resolveDayPlanProfile(args: {
  dateKey: string;
  weekday: number;
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>;
  assessments: Assessment[];
  pausedCourseIds?: ID[];
  weekdaySchedule?: Record<string, WeekdayAvailability>;
  preferredPeriod?: PlannerDayPeriod;
  preExamMarathon?: PreExamMarathonConfig;
}): DayPlanProfile {
  const {
    dateKey,
    weekday,
    settings,
    assessments,
    pausedCourseIds = [],
    weekdaySchedule,
    preferredPeriod = 'auto',
    preExamMarathon,
  } = args;

  const pausedSet = new Set(pausedCourseIds);
  const avail = resolveWeekdayAvailability(weekday, settings, weekdaySchedule, preferredPeriod);
  const day = parseDay(dateKey);

  let minExamDaysLeft: number | undefined;
  let hasImminentOffDayExam = false;
  for (const a of assessments) {
    if (a.grade !== undefined || pausedSet.has(a.courseId)) continue;
    const dl = differenceInCalendarDays(parseDay(a.date), day);
    if (dl >= 0 && (minExamDaysLeft === undefined || dl < minExamDaysLeft)) {
      minExamDaysLeft = dl;
    }
    if (!avail.enabled && dl >= 1 && dl <= 2 && avail.minutes > 0) {
      hasImminentOffDayExam = true;
    }
  }

  const marathonActive = Boolean(
    preExamMarathon?.enabled &&
      minExamDaysLeft !== undefined &&
      minExamDaysLeft >= 0 &&
      minExamDaysLeft <= preExamMarathon.daysBefore,
  );

  const enabled = avail.enabled || hasImminentOffDayExam || marathonActive;
  const baseBudget = marathonActive
    ? Math.max(avail.minutes || settings.dailyStudyMinutes || 120, preExamMarathon!.dailyMinutes)
    : avail.minutes > 0
      ? avail.minutes
      : settings.dailyStudyMinutes;

  return {
    enabled,
    baseBudget,
    windowMode: marathonActive ? 'all_day' : avail.window,
    blockedPeriods: avail.blockedPeriods ?? [],
    isMarathonDay: marathonActive,
    ...(marathonActive && minExamDaysLeft !== undefined ? { marathonDaysLeft: minExamDaysLeft } : {}),
  };
}

/** Encontra o primeiro horário livre HH:mm num determinado dia para mover/encaixar um bloco. */
export function findFirstFreeSlotOnDate(args: {
  dateKey: string;
  minutes: number;
  preferredPeriod?: PlannerWindowMode;
  nowMinutes?: number;
  classes: ClassSlot[];
  events: CalendarEvent[];
  existingSessions: StudySession[];
  blockedPeriods?: Array<'morning' | 'afternoon' | 'evening'>;
}): string | undefined {
  const {
    dateKey,
    minutes,
    preferredPeriod = 'auto',
    nowMinutes,
    classes,
    events,
    existingSessions,
    blockedPeriods = [],
  } = args;
  const day = parseDay(dateKey);
  const weekday = day.getDay();
  const weekend = weekday === 0 || weekday === 6;

  const busy: BusyInterval[] = [];
  for (const bp of blockedPeriods) busy.push(PERIOD_BUSY_RANGES[bp]);
  for (const c of classes) {
    if (c.weekday === weekday) busy.push({ start: toMin(c.start), end: toMin(c.end) });
  }
  for (const e of events) {
    if (!e.allDay && e.start.slice(0, 10) === dateKey) {
      const s = parseISO(e.start);
      const en = parseISO(e.end);
      busy.push({
        start: s.getHours() * 60 + s.getMinutes(),
        end: en.getHours() * 60 + en.getMinutes(),
      });
    }
  }
  for (const s of existingSessions) {
    if (s.date === dateKey && s.start) {
      const st = toMin(s.start);
      busy.push({ start: st, end: st + occupied(s) });
    }
  }
  busy.sort((a, b) => a.start - b.start);

  const periodStart =
    preferredPeriod === 'all_day' || preferredPeriod === 'morning'
      ? 8 * 60 + 30
      : preferredPeriod === 'afternoon'
        ? 14 * 60
        : preferredPeriod === 'evening'
          ? 17 * 60 + 30
          : weekend
            ? 10 * 60
            : 9 * 60;
  const cursor = Math.max(periodStart, nowMinutes !== undefined ? Math.ceil((nowMinutes + 10) / 30) * 30 : 0);
  const slot = firstSlotBefore(cursor, minutes, busy, 23 * 60 + 30);
  return slot !== null ? fmtTime(slot) : undefined;
}
