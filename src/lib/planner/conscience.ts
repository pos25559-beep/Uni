// «Consciência do Uni»: avalia deterministicamente ($0, sem IA) o plano real
// do estudante (manual ou automático) e devolve pareceres objetivos com ações de 1 toque.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { computeExtraActivityPenaltyByWeekday } from '../academicCredits';
import { getDueReviewQueue } from '../spacedRepetition';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  Settings,
  StudySession,
  WeeklyCheckIn,
} from '../../types';
import { resolvePlannerPrefs } from './availability';
import {
  computeDayBudget,
  dayKey,
  findFirstFreeSlotOnDate,
  matchBestMaterialForTopic,
  occupied,
  parseDay,
  resolveDayPlanProfile,
  toMin,
} from './slots';
import { BLOCK, TEST_MODE_DAYS, type BusyInterval } from './types';

export type ConscienceAction =
  | {
      kind: 'remove_sessions';
      sessionIds: ID[];
      labelKey: string;
    }
  | {
      kind: 'move_session';
      sessionId: ID;
      targetDate: string;
      targetStart: string;
      labelKey: string;
    }
  | {
      kind: 'add_session';
      session: Omit<StudySession, 'id'>;
      labelKey: string;
    };

export type ConscienceOpinionKind =
  | 'paused_course_active'
  | 'exclusive_violation'
  | 'schedule_clash'
  | 'urgent_exam_underfunded'
  | 'day_over_budget'
  | 'srs_due_waiting';

export interface ConscienceOpinion {
  id: string;
  kind: ConscienceOpinionKind;
  severity: 'warn' | 'tip';
  messageKey: string;
  messageParams: Record<string, string | number>;
  action?: ConscienceAction;
}

export interface PlanConscienceReport {
  status: 'empty' | 'aligned' | 'needs_attention';
  opinions: ConscienceOpinion[];
}

export interface AnalyzeConscienceInput {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials?: Material[];
  sessions: StudySession[];
  settings: Settings;
  extraActivities?: ExtraActivity[];
  weeklyCheckIns?: WeeklyCheckIn[];
  today: string;
  nowMinutes?: number;
}

function overlapsClassOrEvent(
  s: StudySession,
  classes: ClassSlot[],
  events: CalendarEvent[],
): boolean {
  if (!s.start) return false;
  const start = toMin(s.start);
  const end = start + s.minutes;
  const weekday = parseDay(s.date).getDay();
  const busy: BusyInterval[] = [];
  for (const c of classes) {
    if (c.weekday === weekday) busy.push({ start: toMin(c.start), end: toMin(c.end) });
  }
  for (const e of events) {
    if (!e.allDay && e.start.slice(0, 10) === s.date) {
      const es = parseISO(e.start);
      const ee = parseISO(e.end);
      busy.push({
        start: es.getHours() * 60 + es.getMinutes(),
        end: ee.getHours() * 60 + ee.getMinutes(),
      });
    }
  }
  return busy.some((b) => start < b.end && end > b.start);
}

function findNextFreeSlotAcrossDays(args: {
  from: string;
  maxDate?: string;
  maxDays: number;
  minutes: number;
  nowMinutes?: number;
  classes: ClassSlot[];
  events: CalendarEvent[];
  assessments: Assessment[];
  sessions: StudySession[];
  settings: Settings;
  excludeSessionId?: ID;
}): { date: string; start: string } | null {
  const prefs = resolvePlannerPrefs(args.settings);
  const startDay = parseDay(args.from);
  const others = args.excludeSessionId
    ? args.sessions.filter((x) => x.id !== args.excludeSessionId)
    : args.sessions;

  for (let i = 0; i <= args.maxDays; i++) {
    const dk = format(addDays(startDay, i), 'yyyy-MM-dd');
    if (args.maxDate && dk > args.maxDate) break;
    const wd = addDays(startDay, i).getDay();
    const avail = prefs.weekdaySchedule?.[String(wd)];
    if (avail && !avail.enabled) continue;
    const start = findFirstFreeSlotOnDate({
      dateKey: dk,
      minutes: args.minutes,
      preferredPeriod: avail?.window ?? prefs.preferredPeriod ?? 'auto',
      nowMinutes: dk === args.from ? args.nowMinutes : undefined,
      classes: args.classes,
      events: args.events,
      existingSessions: others,
      blockedPeriods: avail?.blockedPeriods,
      assessments: args.assessments,
    });
    if (start) return { date: dk, start };
  }
  return null;
}

/**
 * Avalia o plano atual face às preferências, aulas, orçamento diário e provas próximas.
 * Devolve até 3 pareceres acionáveis ordenados por prioridade.
 */
export function analyzePlanConscience(input: AnalyzeConscienceInput): PlanConscienceReport {
  const {
    courses,
    assessments,
    classes,
    events,
    materials = [],
    sessions,
    settings,
    extraActivities = [],
    weeklyCheckIns = [],
    today,
    nowMinutes,
  } = input;

  if (courses.length === 0) {
    return { status: 'empty', opinions: [] };
  }

  const prefs = resolvePlannerPrefs(settings);
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const pausedSet = new Set(prefs.pausedCourseIds ?? []);
  const boostSet = new Set(prefs.boostCourseIds ?? []);
  const modeUntil = prefs.courseModeUntil ?? {};
  const futurePending = sessions.filter((s) => !s.done && s.date >= today);

  const opinions: ConscienceOpinion[] = [];

  // 1) Cadeira em pausa com blocos ainda marcados
  for (const cid of pausedSet) {
    const course = courseMap.get(cid);
    if (!course) continue;
    const until = modeUntil[cid];
    const offending = futurePending.filter(
      (s) => s.courseId === cid && (!until || s.date <= until),
    );
    if (offending.length > 0) {
      opinions.push({
        id: `paused-${cid}`,
        kind: 'paused_course_active',
        severity: 'warn',
        messageKey: 'conscience.opinions.pausedCourseActive',
        messageParams: {
          course: course.shortName || course.name,
          count: offending.length,
        },
        action: {
          kind: 'remove_sessions',
          sessionIds: offending.map((s) => s.id),
          labelKey: 'conscience.actions.removeSessions',
        },
      });
    }
  }

  // 2) Foco exclusivo ativo com blocos de outras cadeiras
  if (prefs.exclusiveTestFocus) {
    const urgentCourseIds = new Set(
      assessments
        .filter((a) => {
          if (a.grade !== undefined || pausedSet.has(a.courseId)) return false;
          const dl = differenceInCalendarDays(parseDay(a.date), parseDay(today));
          return dl >= 0 && dl <= TEST_MODE_DAYS;
        })
        .map((a) => a.courseId),
    );
    const targetIds = new Set(
      [...boostSet].filter((id) => !pausedSet.has(id) && (!modeUntil[id] || today <= modeUntil[id])),
    );
    const activeTargetIds = targetIds.size > 0 ? targetIds : urgentCourseIds;
    if (activeTargetIds.size > 0) {
      const targetNames = [...activeTargetIds]
        .map((id) => courseMap.get(id)?.shortName || courseMap.get(id)?.name || id)
        .join(', ');
      const maxUntil = [...activeTargetIds]
        .map((id) => modeUntil[id])
        .filter((d): d is string => Boolean(d))
        .sort()[0];
      const conflicting = futurePending.filter(
        (s) =>
          !activeTargetIds.has(s.courseId) &&
          !pausedSet.has(s.courseId) &&
          (!maxUntil || s.date <= maxUntil),
      );
      if (conflicting.length > 0) {
        opinions.push({
          id: 'exclusive-conflict',
          kind: 'exclusive_violation',
          severity: 'warn',
          messageKey: 'conscience.opinions.exclusiveConflict',
          messageParams: {
            course: targetNames,
            count: conflicting.length,
          },
          action: {
            kind: 'remove_sessions',
            sessionIds: conflicting.map((s) => s.id),
            labelKey: 'conscience.actions.keepFocusOnly',
          },
        });
      }
    }
  }

  // 3) Choques com aulas ou eventos nos próximos 7 dias
  const weekEnd = format(addDays(parseDay(today), 6), 'yyyy-MM-dd');
  const clashed = futurePending.find(
    (s) => s.date <= weekEnd && overlapsClassOrEvent(s, classes, events),
  );
  if (clashed) {
    const course = courseMap.get(clashed.courseId);
    const slot = findNextFreeSlotAcrossDays({
      from: clashed.date,
      maxDays: 5,
      minutes: clashed.minutes,
      nowMinutes,
      classes,
      events,
      assessments,
      sessions,
      settings,
      excludeSessionId: clashed.id,
    });
    opinions.push({
      id: `clash-${clashed.id}`,
      kind: 'schedule_clash',
      severity: 'warn',
      messageKey: 'conscience.opinions.scheduleClash',
      messageParams: {
        course: course?.shortName || course?.name || clashed.courseId,
        time: clashed.start ?? '',
      },
      ...(slot
        ? {
            action: {
              kind: 'move_session',
              sessionId: clashed.id,
              targetDate: slot.date,
              targetStart: slot.start,
              labelKey: 'conscience.actions.moveFreeSlot',
            },
          }
        : {}),
    });
  }

  // 4) Teste próximo (< 10d) sem tempo mínimo marcado antes da data
  const urgentOpen = assessments
    .filter((a) => {
      if (a.grade !== undefined || pausedSet.has(a.courseId)) return false;
      const dl = differenceInCalendarDays(parseDay(a.date), parseDay(today));
      return dl >= 0 && dl <= TEST_MODE_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const exam of urgentOpen) {
    const course = courseMap.get(exam.courseId);
    if (!course) continue;
    const examDay = exam.date.slice(0, 10);
    const dl = Math.max(0, differenceInCalendarDays(parseDay(examDay), parseDay(today)));
    const plannedMinutes = futurePending
      .filter((s) => s.courseId === course.id && s.date <= examDay)
      .reduce((sum, s) => sum + s.minutes, 0);
    const coveredTopics =
      exam.topicIds.length > 0
        ? course.topics.filter((t) => exam.topicIds.includes(t.id))
        : course.topics;
    const pendingTopics = coveredTopics.filter((t) => t.status !== 'done');
    const thresholdMin = Math.max(50, Math.min(180, pendingTopics.length * 45));

    if (plannedMinutes < thresholdMin && (plannedMinutes === 0 || pendingTopics.length > 0)) {
      const targetTopic = [...pendingTopics].sort((a, b) => a.confidence - b.confidence)[0];
      const blockMin = prefs.blockMinutes || BLOCK;
      const slot = findNextFreeSlotAcrossDays({
        from: today,
        maxDate: examDay,
        maxDays: Math.max(0, dl),
        minutes: blockMin,
        nowMinutes,
        classes,
        events,
        assessments,
        sessions,
        settings,
      });
      const matId = matchBestMaterialForTopic({
        courseId: course.id,
        topic: targetTopic,
        materials,
        contentMix: prefs.contentMix ?? 'balanced',
        isExamUrgent: true,
      });
      opinions.push({
        id: `exam-low-${exam.id}`,
        kind: 'urgent_exam_underfunded',
        severity: plannedMinutes === 0 ? 'warn' : 'tip',
        messageKey:
          plannedMinutes === 0
            ? 'conscience.opinions.examNoBlocks'
            : 'conscience.opinions.examLowMinutes',
        messageParams: {
          course: course.shortName || course.name,
          title: exam.title,
          days: dl,
          minutes: plannedMinutes,
        },
        ...(slot
          ? {
              action: {
                kind: 'add_session',
                session: {
                  courseId: course.id,
                  ...(targetTopic ? { topicId: targetTopic.id } : {}),
                  assessmentId: exam.id,
                  ...(matId ? { materialId: matId } : {}),
                  date: slot.date,
                  start: slot.start,
                  minutes: blockMin,
                  done: false,
                  generated: false,
                  notes: exam.title,
                },
                labelKey: 'conscience.actions.addStudyBlock',
              },
            }
          : {}),
      });
      break;
    }
  }

  // 5) Dia sobrecarregado face ao orçamento real (computeDayBudget)
  const extraPenaltyByWeekday = computeExtraActivityPenaltyByWeekday(extraActivities);
  const latestMood = weeklyCheckIns[0]?.mood;
  const todayDate = parseDay(today);
  for (let i = 0; i < 7; i++) {
    const d = addDays(todayDate, i);
    const dk = dayKey(d);
    const daySessions = sessions.filter((s) => s.date === dk);
    const pendingDay = daySessions.filter((s) => !s.done);
    if (pendingDay.length <= 1) continue;
    const profile = resolveDayPlanProfile({
      dateKey: dk,
      weekday: d.getDay(),
      settings,
      assessments,
      pausedCourseIds: prefs.pausedCourseIds,
      weekdaySchedule: prefs.weekdaySchedule,
      preferredPeriod: prefs.preferredPeriod,
      preExamMarathon: prefs.preExamMarathon,
      dateOverrides: prefs.dateOverrides,
    });
    const { budget } = computeDayBudget({
      dateKey: dk,
      weekday: d.getDay(),
      dayProfile: profile,
      classes,
      events,
      extraPenaltyMinutes: extraPenaltyByWeekday.get(d.getDay()) ?? 0,
      latestCheckInMood: latestMood,
    });
    const plannedTotal = daySessions.reduce((sum, s) => sum + occupied(s), 0);
    if (budget > 0 && plannedTotal > budget + 30) {
      const candidate = pendingDay.filter((s) => !s.locked).at(-1) ?? pendingDay.at(-1);
      const targetSlot = candidate
        ? findNextFreeSlotAcrossDays({
            from: format(addDays(d, 1), 'yyyy-MM-dd'),
            maxDays: 6,
            minutes: candidate.minutes,
            classes,
            events,
            assessments,
            sessions,
            settings,
            excludeSessionId: candidate.id,
          })
        : null;
      opinions.push({
        id: `over-${dk}`,
        kind: 'day_over_budget',
        severity: 'tip',
        messageKey: 'conscience.opinions.dayOverBudget',
        messageParams: {
          date: dk,
          planned: plannedTotal,
          budget,
        },
        ...(candidate && targetSlot
          ? {
              action: {
                kind: 'move_session',
                sessionId: candidate.id,
                targetDate: targetSlot.date,
                targetStart: targetSlot.start,
                labelKey: 'conscience.actions.lightenDay',
              },
            }
          : {}),
      });
      break;
    }
  }

  // 6) Revisões espaçadas em atraso sem bloco próximo
  if (!prefs.exclusiveTestFocus && opinions.length < 3) {
    const dueQueue = getDueReviewQueue(courses, today).filter(
      (item) => !pausedSet.has(item.course.id),
    );
    const fourDaysOut = format(addDays(todayDate, 4), 'yyyy-MM-dd');
    const unscheduledSrs = dueQueue.find(
      (item) =>
        !futurePending.some(
          (s) => s.topicId === item.topic.id && s.date <= fourDaysOut,
        ),
    );
    if (unscheduledSrs) {
      const srsSlot = findNextFreeSlotAcrossDays({
        from: today,
        maxDays: 4,
        minutes: 25,
        nowMinutes,
        classes,
        events,
        assessments,
        sessions,
        settings,
      });
      const matId = matchBestMaterialForTopic({
        courseId: unscheduledSrs.course.id,
        topic: unscheduledSrs.topic,
        materials,
        contentMix: prefs.contentMix ?? 'balanced',
        isExamUrgent: false,
      });
      opinions.push({
        id: `srs-${unscheduledSrs.topic.id}`,
        kind: 'srs_due_waiting',
        severity: 'tip',
        messageKey: 'conscience.opinions.srsDueWaiting',
        messageParams: {
          course: unscheduledSrs.course.shortName || unscheduledSrs.course.name,
          topic: unscheduledSrs.topic.title,
        },
        ...(srsSlot
          ? {
              action: {
                kind: 'add_session',
                session: {
                  courseId: unscheduledSrs.course.id,
                  topicId: unscheduledSrs.topic.id,
                  ...(matId ? { materialId: matId } : {}),
                  date: srsSlot.date,
                  start: srsSlot.start,
                  minutes: 25,
                  done: false,
                  generated: false,
                  reason: { code: 'srs_due' },
                },
                labelKey: 'conscience.actions.addQuickReview',
              },
            }
          : {}),
      });
    }
  }

  const trimmed = opinions.slice(0, 3);
  return {
    status: futurePending.length === 0 && trimmed.length === 0 ? 'empty' : trimmed.length > 0 ? 'needs_attention' : 'aligned',
    opinions: trimmed,
  };
}
