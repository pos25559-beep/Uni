import { differenceInCalendarDays, differenceInMinutes, parseISO } from 'date-fns';
import { newId } from '../../store/useStore';
import type {
  Assessment,
  Course,
  ID,
  PlannerWindowMode,
  StudyLogEntry,
  StudySession,
  StudySessionReason,
  Topic,
} from '../../types';
import { computeExtraActivityPenaltyByWeekday } from '../academicCredits';
import { resolveWeekdayAvailability } from '../plannerBriefing';
import { sessionMinutes } from '../selectors';
import { isTopicReviewDue } from '../spacedRepetition';
import { extractStudyFocusPhrase } from '../uniCheckInNlu';
import { isWithinWindow, parseFocusWindow, type FocusWindow } from './focusWindow';
import {
  advanceCursorPastBusy,
  availableWindowMinutes,
  dayKey,
  firstSlotBefore,
  fmtTime,
  matchBestMaterialForTopic,
  occupied,
  parseDay,
  parseDueMinutes,
  resolveDayPlanProfile,
  roundUp5,
  toMin,
} from './slots';
import {
  ADAPTIVE_LOW_CONFIDENCE_BLOCK,
  BLOCK,
  BREAK,
  EVENT_THRESHOLD_MIN,
  HORIZON_DAYS,
  LIGHT_CLASS_LOAD_MIN,
  MAX_BLOCKS_PER_COURSE,
  MAX_BLOCKS_PER_DAY,
  MIN_BLOCK,
  MIN_DAY_BUDGET,
  PERIOD_BUSY_RANGES,
  SPACED_MINUTES,
  TEST_MODE_DAYS,
  effortBase,
  needBase,
  type Block,
  type BusyInterval,
  type PlanInput,
  type WorkItem,
} from './types';

function extractLogSignals(
  studyLogs: StudyLogEntry[],
  assessments: Assessment[],
  start: Date,
) {
  const recentLogs = studyLogs.filter((l) => {
    try {
      const diff = differenceInCalendarDays(start, parseDay(l.date));
      return diff >= -1 && diff <= 7;
    } catch {
      return false;
    }
  });

  const postClassHardCourseSet = new Set<ID>();
  const examAnxiousCourseSet = new Set<ID>();
  const logHighlightedTopicIds = new Set<ID>();
  const logTopicHints: string[] = [];
  const examFocusEntries: Array<{
    focus: string;
    assessmentId?: ID;
    courseId?: ID;
    due?: Date;
    logDate: string;
    /** Janela escrita na frase («de sexta a segunda»); fora dela a nota não aparece. */
    window?: FocusWindow;
  }> = [];
  const examFocusByAssessmentId = new Map<ID, { focus: string; window?: FocusWindow }>();
  const classFocusByCourseId = new Map<ID, string>();
  let recentTiredDay = false;

  const sortedLogs = [...studyLogs].sort((a, b) =>
    (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''),
  );
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));
  const openAssessmentIds = new Set(
    assessments.filter((a) => a.grade === undefined).map((a) => a.id),
  );

  for (const log of sortedLogs) {
    const focus =
      log.studyFocus?.trim() ||
      extractStudyFocusPhrase(
        [
          log.studiedSummary,
          log.notes,
          ...(log.messages?.filter((m) => m.role === 'user').map((m) => m.text) ?? []),
        ]
          .filter(Boolean)
          .join('. '),
      );
    if (!focus) continue;
    if (log.kind === 'exam_prep') {
      const linkedAssessment = log.assessmentId ? assessmentById.get(log.assessmentId) : undefined;
      if (
        log.assessmentId &&
        openAssessmentIds.has(log.assessmentId) &&
        !examFocusByAssessmentId.has(log.assessmentId)
      ) {
        examFocusByAssessmentId.set(log.assessmentId, { focus, window: parseFocusWindow(focus, log.date) });
      }
      // Sem teste ligado, um registo só vale 14 dias (antes valia para sempre).
      if (!linkedAssessment) {
        try {
          if (differenceInCalendarDays(start, parseDay(log.date)) > 14) continue;
        } catch {
          continue;
        }
      }
      examFocusEntries.push({
        focus,
        assessmentId: log.assessmentId,
        courseId: log.courseId,
        due: linkedAssessment ? parseDay(linkedAssessment.date) : undefined,
        logDate: log.date,
        window: parseFocusWindow(focus, log.date),
      });
      for (const tid of log.topicIds ?? []) logHighlightedTopicIds.add(tid);
    } else if (log.courseId && !classFocusByCourseId.has(log.courseId)) {
      try {
        const diff = differenceInCalendarDays(start, parseDay(log.date));
        if (diff >= -1 && diff <= 7) classFocusByCourseId.set(log.courseId, focus);
      } catch {
        // Ignora data inválida
      }
    }
  }

  for (const log of recentLogs) {
    if (log.kind === 'class' && (log.feeling === 'dificil' || log.feeling === 'faltei')) {
      if (log.courseId) postClassHardCourseSet.add(log.courseId);
      if (log.topicTitle?.trim()) logTopicHints.push(log.topicTitle.trim().toLowerCase());
      if (log.difficulties?.trim()) logTopicHints.push(log.difficulties.trim().toLowerCase());
      for (const tid of log.topicIds ?? []) logHighlightedTopicIds.add(tid);
    }
    if (log.kind === 'exam_prep' && (log.feeling === 'ansioso' || log.feeling === 'atrasado')) {
      if (log.courseId) examAnxiousCourseSet.add(log.courseId);
      for (const tid of log.topicIds ?? []) logHighlightedTopicIds.add(tid);
    }
    if (log.kind === 'day' && (log.feeling === 'cansado' || (log.rating !== undefined && log.rating <= 2))) {
      const diff = Math.abs(differenceInCalendarDays(start, parseDay(log.date)));
      if (diff <= 1) recentTiredDay = true;
    }
  }

  return {
    assessmentById,
    postClassHardCourseSet,
    examAnxiousCourseSet,
    logHighlightedTopicIds,
    logTopicHints,
    examFocusEntries,
    examFocusByAssessmentId,
    classFocusByCourseId,
    recentTiredDay,
  };
}

/**
 * Gera sessões de estudo para `days` dias a partir de `from`.
 * Determinístico: sem aleatoriedade; empates resolvem-se pela ordem das avaliações e dos tópicos.
 * Adapta-se automaticamente a dificuldades declaradas, disponibilidade por dia da semana,
 * Maratona Pré-Teste, check-ins semanais e Modo Teste (< 10 dias).
 */
export function generatePlan(input: PlanInput): StudySession[] {
  const {
    courses,
    assessments,
    classes,
    events,
    settings,
    materials = [],
    from,
    existing = [],
    difficultCourseIds = [],
    weeklyCheckIns = [],
    studyLogs = [],
    extraActivities = [],
    preferredPeriod = 'auto',
    blockMinutes = BLOCK,
    strategy = 'balanced',
    boostCourseIds = [],
    pausedCourseIds = [],
    exclusiveTestFocus = false,
    weekdaySchedule,
    fillClassGaps = false,
    preExamMarathon,
    contentMix = 'balanced',
    briefingCourseFocus = {},
    courseNotes = {},
  } = input;

  /** Nota de foco da cadeira válida neste dia (com validade); a antiga sem validade só se não houver nova. */
  const courseNoteFor = (courseId: ID, day: Date): string | undefined => {
    const note = courseNotes[courseId];
    if (note) return isWithinWindow(dayKey(day), note) ? note.text : undefined;
    return briefingCourseFocus[courseId];
  };

  const extraPenaltyByWeekday = computeExtraActivityPenaltyByWeekday(extraActivities);
  const days = input.days ?? 14;
  const start = parseDay(from);
  const pausedSet = new Set(pausedCourseIds);
  const boostSet = new Set(boostCourseIds);
  const activeCourses = pausedSet.size > 0 ? courses.filter((c) => !pausedSet.has(c.id)) : courses;
  const courseById = new Map(activeCourses.map((c) => [c.id, c]));
  const difficultSet = new Set(difficultCourseIds);
  const targetBlock = Math.max(MIN_BLOCK, Math.min(75, blockMinutes));
  const adaptiveLowCap = Math.min(targetBlock, ADAPTIVE_LOW_CONFIDENCE_BLOCK);

  const resolvePeriodStart = (
    weekday: number,
    windowMode: PlannerWindowMode,
    roundedNow?: number,
    dayBudget?: number,
  ) => {
    const weekend = weekday === 0 || weekday === 6;
    const eveningClassMin = classes
      .filter((c) => c.weekday === weekday && toMin(c.end) > 17 * 60)
      .reduce((sum, c) => sum + Math.max(0, toMin(c.end) - Math.max(17 * 60, toMin(c.start))), 0);
    const autoBase =
      fillClassGaps || eveningClassMin >= 120 || (dayBudget ?? settings.dailyStudyMinutes) > 200
        ? 9 * 60
        : weekend
          ? 10 * 60
          : 17 * 60;
    const base =
      windowMode === 'all_day' || windowMode === 'morning'
        ? 8 * 60 + 30
        : windowMode === 'afternoon'
          ? 14 * 60
          : windowMode === 'evening'
            ? 17 * 60 + 30
            : autoBase;
    return Math.max(base, roundedNow ?? 0);
  };

  const latestCheckIn = weeklyCheckIns[0];
  const difficultCheckInCourseSet = new Set(latestCheckIn?.hardCourseIds ?? []);
  const {
    assessmentById,
    postClassHardCourseSet,
    examAnxiousCourseSet,
    logHighlightedTopicIds,
    logTopicHints,
    examFocusEntries,
    examFocusByAssessmentId,
    classFocusByCourseId,
    recentTiredDay,
  } = extractLogSignals(studyLogs, assessments, start);

  const getValidExamFocus = (
    courseId: ID,
    day: Date,
    activeCourseAssessments: Array<{ assessment: Assessment; daysLeft: number }>,
    assessmentId?: ID,
  ): string | undefined => {
    if (assessmentId) {
      const target = assessmentById.get(assessmentId);
      if (target && target.grade === undefined && differenceInCalendarDays(parseDay(target.date), day) >= 0) {
        const exact = examFocusByAssessmentId.get(assessmentId);
        if (exact && (!exact.window || isWithinWindow(dayKey(day), exact.window))) return exact.focus;
      }
    }
    const hasUrgentCourseExam = activeCourseAssessments.some(
      (u) => u.assessment.courseId === courseId && u.daysLeft >= 0 && u.daysLeft <= TEST_MODE_DAYS,
    );
    if (!hasUrgentCourseExam) return undefined;
    for (const entry of examFocusEntries) {
      if (entry.courseId !== courseId) continue;
      if (entry.due && differenceInCalendarDays(entry.due, day) < 0) continue;
      if (assessmentId && entry.assessmentId && entry.assessmentId !== assessmentId) continue;
      if (entry.window && !isWithinWindow(dayKey(day), entry.window)) continue;
      return entry.focus;
    }
    return undefined;
  };

  const checkInTopicHints = [
    ...(latestCheckIn?.classDifficulties ?? []),
    ...(latestCheckIn?.pendingNextWeek ?? []),
    ...logTopicHints,
  ]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);

  const isTopicHighlightedByCheckIn = (topicTitle: string, topicId?: ID) => {
    if (topicId && logHighlightedTopicIds.has(topicId)) return true;
    if (checkInTopicHints.length === 0) return false;
    const lower = topicTitle.toLowerCase();
    return checkInTopicHints.some((hint) => lower.includes(hint) || hint.includes(lower));
  };

  // Esforço restante por tópico, no início do plano (já descontado o que foi concluído).
  const effort = new Map<ID, number>();
  for (const c of activeCourses) {
    for (const t of c.topics) {
      // Conta o que já foi feito e o que já está marcado de forma fixa (fixado ou manual, por fazer):
      // assim um bloco reagendado ou manual não leva o motor a planear a mesma matéria outra vez.
      const studied = existing
        .filter(
          (s) =>
            s.topicId === t.id &&
            (s.done || (s.date >= from && (!s.generated || s.locked))),
        )
        .reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes), 0);
      const checkInExtra = isTopicHighlightedByCheckIn(t.title, t.id) ? 35 : 0;
      const estimate = effortBase[t.status] * (1.3 - t.confidence * 0.1) + checkInExtra;
      effort.set(t.id, Math.max(0, Math.round(estimate) - studied));
    }
  }

  // Avaliações ainda por fazer, com os tópicos que cobrem (ou todos, se não houver lista).
  const items: WorkItem[] = [];
  for (const a of assessments) {
    if (a.grade !== undefined) continue;
    const course = courseById.get(a.courseId);
    if (!course) continue;
    const covered = a.topicIds.length > 0
      ? course.topics.filter((t) => a.topicIds.includes(t.id))
      : course.topics;
    const topics = covered.filter((t) => !(t.status === 'done' && t.confidence >= 4));
    items.push({
      assessment: a,
      due: parseDay(a.date),
      dueMinutes: parseDueMinutes(a.date),
      courseId: course.id,
      topics,
    });
  }

  const fallbackEffortByAssessment = new Map<ID, number>();
  for (const a of assessments) {
    if (a.grade !== undefined) continue;
    fallbackEffortByAssessment.set(a.id, Math.max(targetBlock * 2, 100));
  }

  const lastScheduled = new Map<ID, string>(); // revisões espaçadas já marcadas neste plano
  const topicPicksTotal = new Map<ID, number>();
  const urgentCourseMinutesTotal = new Map<ID, number>();
  const starterMinutesByCourse = new Map<ID, number>();
  const starterTopicPicks = new Map<ID, number>();
  const result: StudySession[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(day);
    const weekday = day.getDay();

    const dayProfile = resolveDayPlanProfile({
      dateKey: key,
      weekday,
      settings,
      assessments,
      pausedCourseIds,
      weekdaySchedule,
      preferredPeriod,
      preExamMarathon,
    });

    const hasImminentOffDayExam =
      !resolveWeekdayAvailability(weekday, settings, weekdaySchedule, preferredPeriod).enabled &&
      dayProfile.baseBudget > 0 &&
      items.some((it) => {
        const dl = differenceInCalendarDays(it.due, day);
        return dl >= 1 && dl <= 2;
      });
    if (!dayProfile.enabled) continue;

    // Hora mínima de início para este dia (evita agendar no passado quando `nowMinutes` é fornecido).
    const roundedNow =
      i === 0 && input.nowMinutes !== undefined
        ? Math.ceil((input.nowMinutes + 10) / 30) * 30
        : undefined;
    if (roundedNow !== undefined && roundedNow > 22 * 60 + 30) continue;

    // Intervalos ocupados (aulas, eventos com hora marcada, provas do dia, turnos bloqueados e sessões fixas/manuais existentes).
    const dayBusy: BusyInterval[] = [];
    for (const bp of dayProfile.blockedPeriods) {
      if (!dayProfile.isMarathonDay) {
        dayBusy.push(PERIOD_BUSY_RANGES[bp]);
      }
    }
    for (const c of classes) {
      if (c.weekday === weekday) {
        dayBusy.push({ start: toMin(c.start), end: toMin(c.end) });
      }
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
    for (const it of items) {
      if (differenceInCalendarDays(it.due, day) === 0 && it.dueMinutes !== undefined) {
        dayBusy.push({
          start: Math.max(0, it.dueMinutes - 30),
          end: Math.min(23 * 60 + 59, it.dueMinutes + 120),
        });
      }
    }
    for (const s of existing) {
      if (s.date === key && s.start && (s.done || !s.generated || s.locked)) {
        const st = toMin(s.start);
        dayBusy.push({ start: st, end: st + occupied(s) });
      }
    }
    dayBusy.sort((a, b) => a.start - b.start);

    // Orçamento do dia (individual Seg-Dom ou expandido em Modo Maratona Pré-Teste).
    const classMinutes = classes
      .filter((c) => c.weekday === weekday)
      .reduce((sum, c) => sum + Math.max(0, toMin(c.end) - toMin(c.start)), 0);
    const eventMinutes = events
      .filter((e) => !e.allDay && e.start.slice(0, 10) === key)
      .reduce((sum, e) => sum + Math.max(0, differenceInMinutes(parseISO(e.end), parseISO(e.start))), 0);
    let budget = dayProfile.baseBudget;
    if (!dayProfile.isMarathonDay && classMinutes >= LIGHT_CLASS_LOAD_MIN) budget *= 0.75;
    if (eventMinutes > EVENT_THRESHOLD_MIN) budget -= eventMinutes;
    const extraPenalty = extraPenaltyByWeekday.get(weekday) ?? 0;
    if (!dayProfile.isMarathonDay && extraPenalty > 0) {
      budget -= Math.min(120, Math.round(extraPenalty * 0.5));
    }
    if (!dayProfile.isMarathonDay && (latestCheckIn?.mood === 'atrasado' || latestCheckIn?.mood === 'pressionado')) {
      budget *= 0.85;
    }
    budget = Math.round(Math.max(MIN_DAY_BUDGET, budget));
    const baseStart = resolvePeriodStart(weekday, dayProfile.windowMode, roundedNow, budget);

    const alreadyUsed = existing
      .filter((s) => s.date === key && (s.done || !s.generated || s.locked))
      .reduce((sum, s) => sum + occupied(s), 0);

    let remaining = Math.max(0, budget - alreadyUsed);
    const dayMaxBlocks = dayProfile.isMarathonDay
      ? Math.min(14, Math.max(MAX_BLOCKS_PER_DAY, Math.ceil(budget / adaptiveLowCap)))
      : budget > MAX_BLOCKS_PER_DAY * targetBlock
        ? Math.min(10, Math.ceil(budget / adaptiveLowCap))
        : MAX_BLOCKS_PER_DAY;
    const blocks: Block[] = [];
    const perCourse = new Map<ID, number>();
    const perCourseMinutes = new Map<ID, number>();
    const topicPicksToday = new Map<ID, number>();

    const finishedExamCourseIdsToday = new Set<ID>();
    const sameDayDeadlineByAssessment = new Map<ID, number>();
    const active = items
      .map((it) => ({ ...it, daysLeft: differenceInCalendarDays(it.due, day) }))
      .filter((it) => {
        if (it.daysLeft < 0 || it.daysLeft > HORIZON_DAYS) return false;
        if (hasImminentOffDayExam && it.daysLeft > 2) return false;
        if (it.daysLeft === 0 && it.dueMinutes !== undefined) {
          const cutoff = it.dueMinutes - 30;
          if (firstSlotBefore(baseStart, MIN_BLOCK, dayBusy, cutoff) === null) {
            finishedExamCourseIdsToday.add(it.courseId);
            return false;
          }
          sameDayDeadlineByAssessment.set(it.assessment.id, cutoff);
        }
        return true;
      });

    const activeCourseIds = new Set(active.map((it) => it.courseId));
    const blockedAfterExamToday = new Set(
      [...finishedExamCourseIdsToday].filter((cid) => !activeCourseIds.has(cid)),
    );
    const sameDayCourseDeadline = new Map<ID, number>();
    const preExamWindowLimitByCourse = new Map<ID, number>();
    for (const it of active) {
      if (it.daysLeft === 0 && it.dueMinutes !== undefined) {
        const hasLaterExamSameCourse = active.some(
          (other) => other.courseId === it.courseId && (other.daysLeft > 0 || (other.dueMinutes ?? 0) > it.dueMinutes!),
        );
        if (!hasLaterExamSameCourse) {
          const cutoff = it.dueMinutes - 30;
          sameDayCourseDeadline.set(it.courseId, cutoff);
          preExamWindowLimitByCourse.set(it.courseId, availableWindowMinutes(baseStart, cutoff, dayBusy));
        }
      }
    }
    const eligibleCoursesToday = activeCourses.filter((c) => !blockedAfterExamToday.has(c.id));

    const urgentToday = active.filter((it) => it.daysLeft <= TEST_MODE_DAYS);
    const urgentCourseIdsToday = new Set(urgentToday.map((u) => u.courseId));
    const minUrgentDays = urgentToday.reduce((min, u) => Math.min(min, u.daysLeft), Infinity);
    const singleTestMode = urgentCourseIdsToday.size === 1;
    const strictSingleTestMode = singleTestMode && minUrgentDays <= 2;
    const multiTestMode = urgentCourseIdsToday.size >= 2;

    const hasImminentTomorrow = active.some((it) => it.daysLeft <= 1);
    const dueTopics = eligibleCoursesToday
      .flatMap((c) => c.topics.map((topic) => ({ courseId: c.id, topic })))
      .filter(({ topic }) => {
        const scheduledOn = lastScheduled.get(topic.id);
        if (scheduledOn) {
          const interval = Math.max(1, topic.srsIntervalDays ?? 7);
          return differenceInCalendarDays(day, parseDay(scheduledOn)) >= interval;
        }
        return isTopicReviewDue(topic, key);
      })
      .sort((a, b) => {
        const aRelevant = activeCourseIds.has(a.courseId) ? 0 : 1;
        const bRelevant = activeCourseIds.has(b.courseId) ? 0 : 1;
        if (aRelevant !== bRelevant) return aRelevant - bRelevant;
        const aBoost = boostSet.has(a.courseId) ? 0 : 1;
        const bBoost = boostSet.has(b.courseId) ? 0 : 1;
        if (aBoost !== bBoost) return aBoost - bBoost;
        const aScore = a.topic.lastRecallScore ?? 2;
        const bScore = b.topic.lastRecallScore ?? 2;
        if (aScore !== bScore) return aScore - bScore;
        return (a.topic.nextReviewDate ?? a.topic.lastStudied ?? '').localeCompare(
          b.topic.nextReviewDate ?? b.topic.lastStudied ?? '',
        );
      });

    const otherMaintenanceCourses = eligibleCoursesToday.filter(
      (c) => !urgentCourseIdsToday.has(c.id),
    );
    const hasOtherPriority =
      dueTopics.length > 0 ||
      active.some((it) => !urgentCourseIdsToday.has(it.courseId)) ||
      (!exclusiveTestFocus && otherMaintenanceCourses.length > 0);

    const courseOk = (courseId: ID, plannedMin = MIN_BLOCK) => {
      if (blockedAfterExamToday.has(courseId)) return false;
      const preExamCap = preExamWindowLimitByCourse.get(courseId);
      if (preExamCap !== undefined && (perCourseMinutes.get(courseId) ?? 0) + plannedMin > preExamCap) {
        return false;
      }
      const count = perCourse.get(courseId) ?? 0;
      if (strictSingleTestMode && urgentCourseIdsToday.has(courseId)) {
        return count < dayMaxBlocks;
      }
      if (singleTestMode && urgentCourseIdsToday.has(courseId)) {
        const reserveForOther =
          !exclusiveTestFocus && minUrgentDays > 2 && budget >= targetBlock * 2 && hasOtherPriority;
        return count < (reserveForOther ? dayMaxBlocks - 1 : dayMaxBlocks);
      }
      if (multiTestMode && urgentCourseIdsToday.has(courseId)) {
        const balancedShare = Math.max(
          MAX_BLOCKS_PER_COURSE,
          Math.ceil(dayMaxBlocks / Math.max(1, urgentCourseIdsToday.size)),
        );
        const cap =
          urgentCourseIdsToday.size >= 3 && dayMaxBlocks <= MAX_BLOCKS_PER_DAY
            ? 2
            : boostSet.has(courseId)
              ? Math.min(dayMaxBlocks, balancedShare + 1)
              : balancedShare;
        return count < cap;
      }
      const baseCourseCap =
        dayMaxBlocks > MAX_BLOCKS_PER_DAY
          ? Math.max(MAX_BLOCKS_PER_COURSE, Math.ceil(dayMaxBlocks / Math.max(1, eligibleCoursesToday.length)))
          : MAX_BLOCKS_PER_COURSE;
      const maxForCourse = boostSet.has(courseId) ? Math.min(dayMaxBlocks, baseCourseCap + 1) : baseCourseCap;
      return count < maxForCourse;
    };

    const canTake = () => remaining >= MIN_BLOCK && blocks.length < dayMaxBlocks;
    const add = (b: Block) => {
      blocks.push(b);
      perCourse.set(b.courseId, (perCourse.get(b.courseId) ?? 0) + 1);
      perCourseMinutes.set(b.courseId, (perCourseMinutes.get(b.courseId) ?? 0) + b.minutes);
      if (b.topicId) {
        topicPicksToday.set(b.topicId, (topicPicksToday.get(b.topicId) ?? 0) + 1);
        topicPicksTotal.set(b.topicId, (topicPicksTotal.get(b.topicId) ?? 0) + 1);
      }
      if (urgentCourseIdsToday.has(b.courseId)) {
        urgentCourseMinutesTotal.set(b.courseId, (urgentCourseMinutesTotal.get(b.courseId) ?? 0) + b.minutes);
      }
      remaining -= b.minutes;
    };

    // Revisão geral na véspera de cada avaliação.
    for (const it of active) {
      if (it.daysLeft !== 1 || !canTake() || !courseOk(it.courseId)) continue;
      const eveFocus =
        getValidExamFocus(it.courseId, day, active, it.assessment.id) ??
        courseNoteFor(it.courseId, day);
      const matId = matchBestMaterialForTopic({
        courseId: it.courseId,
        topic: it.topics[0] ?? null,
        materials,
        contentMix,
        isExamUrgent: true,
      });
      add({
        courseId: it.courseId,
        assessmentId: it.assessment.id,
        ...(matId ? { materialId: matId } : {}),
        minutes: Math.min(targetBlock, remaining),
        notes: eveFocus || 'Revisão geral',
        reason: {
          code: dayProfile.isMarathonDay ? 'exam_marathon' : 'exam_eve',
          examDays: it.daysLeft,
          weight: it.assessment.weight,
        },
      });
    }

    // Revisão espaçada contínua (SRS 1→3→7→21d)
    if (dueTopics.length > 0 && canTake()) {
      const srsQuota = active.length === 0 ? dueTopics.length : strategy === 'srs_focus' ? 2 : 1;
      let addedSrs = 0;
      for (const s of dueTopics) {
        if (addedSrs >= srsQuota || !canTake()) break;
        const isUrgentSrs = urgentCourseIdsToday.has(s.courseId);
        if ((hasImminentTomorrow || strictSingleTestMode || hasImminentOffDayExam) && !isUrgentSrs) continue;
        const srsMin = Math.min(SPACED_MINUTES, remaining);
        if (!courseOk(s.courseId, srsMin)) continue;
        const matId = matchBestMaterialForTopic({
          courseId: s.courseId,
          topic: s.topic,
          materials,
          contentMix,
          isExamUrgent: isUrgentSrs,
        });
        add({
          courseId: s.courseId,
          topicId: s.topic.id,
          ...(matId ? { materialId: matId } : {}),
          minutes: srsMin,
          notes: s.topic.nextReviewDate ? 'Revisão espaçada (SRS)' : 'Revisão ativa',
          reason: { code: 'srs_due' },
        });
        lastScheduled.set(s.topic.id, key);
        addedSrs++;
      }
    }

    // Preenchimento guloso por prioridade.
    while (canTake()) {
      let best: { score: number; item: (typeof active)[number]; topic: Topic | null } | null = null;
      for (const it of active) {
        if (!courseOk(it.courseId)) continue;
        const rawTimeFactor = 1 / (1 + it.daysLeft / 3) ** 1.5;
        const timeFactor =
          strategy === 'exams_first'
            ? rawTimeFactor * (it.daysLeft <= 14 ? 1.55 : 0.8)
            : rawTimeFactor;
        const weightFactor = 0.5 + it.assessment.weight / 100;
        const isDifficult =
          difficultSet.has(it.courseId) ||
          difficultCheckInCourseSet.has(it.courseId) ||
          postClassHardCourseSet.has(it.courseId) ||
          examAnxiousCourseSet.has(it.courseId);
        const difficultyFactor = isDifficult ? 1.35 : 1.0;
        const boostFactor = boostSet.has(it.courseId) ? 1.5 : 1.0;

        let modeFactor = 1.0;
        if (strictSingleTestMode) {
          modeFactor = urgentCourseIdsToday.has(it.courseId) ? 4.5 : 0.1;
        } else if (singleTestMode) {
          modeFactor = urgentCourseIdsToday.has(it.courseId) ? 3.5 : 0.45;
        } else if (multiTestMode) {
          if (urgentCourseIdsToday.has(it.courseId)) {
            const alreadyAssigned = perCourse.get(it.courseId) ?? 0;
            const horizonBalance = 1 / (1 + (urgentCourseMinutesTotal.get(it.courseId) ?? 0) / 150);
            modeFactor = (alreadyAssigned === 0 ? 3.2 : 1.9 / (1 + alreadyAssigned * 1.6)) * horizonBalance;
          } else {
            modeFactor = 0.35;
          }
        }

        const preferConsolidated =
          it.daysLeft <= 2 &&
          it.topics.some((t) => t.status !== 'todo' && (effort.get(t.id) ?? 0) > 0);

        let hadTopicWithEffort = false;
        for (const t of it.topics) {
          if ((effort.get(t.id) ?? 0) <= 0) continue;
          hadTopicWithEffort = true;
          const statusUrgencyFactor =
            contentMix === 'theory_first'
              ? t.status === 'todo'
                ? 1.3
                : t.status === 'learning'
                  ? 1.1
                  : 0.78
              : contentMix === 'practice_first'
                ? t.status === 'todo'
                  ? 0.85
                  : 1.25
                : !preferConsolidated
                  ? 1.0
                  : t.status === 'todo'
                    ? 0.72
                    : 1.15;
          const todayTopicFactor = 1 / (1 + (topicPicksToday.get(t.id) ?? 0) * 1.8);
          const horizonTopicFactor = 1 / (1 + (topicPicksTotal.get(t.id) ?? 0) * 0.65);
          const untouchedBoost = (topicPicksTotal.get(t.id) ?? 0) === 0 ? 1.25 : 1.0;
          const checkInBoost = isTopicHighlightedByCheckIn(t.title, t.id) ? 0.35 : 0;
          const recallPenalty = t.lastRecallScore === 1 ? 0.25 : 0;
          const needFactor = (needBase[t.status] + checkInBoost + recallPenalty) * (1.2 - t.confidence * 0.15);
          const score =
            timeFactor *
            weightFactor *
            difficultyFactor *
            boostFactor *
            modeFactor *
            needFactor *
            statusUrgencyFactor *
            todayTopicFactor *
            horizonTopicFactor *
            untouchedBoost;
          if (!best || score > best.score) best = { score, item: it, topic: t };
        }

        if (!hadTopicWithEffort) {
          const courseObj = courseById.get(it.courseId);
          const fallbackTopic =
            it.topics[0] ??
            courseObj?.topics.find((t) => t.status !== 'done') ??
            courseObj?.topics[0] ??
            null;
          const remFallback = fallbackEffortByAssessment.get(it.assessment.id) ?? 0;
          if (remFallback > 0 || (it.daysLeft <= TEST_MODE_DAYS && (perCourse.get(it.courseId) ?? 0) === 0)) {
            const topicRepeatPenalty = fallbackTopic
              ? 1 / (1 + (topicPicksToday.get(fallbackTopic.id) ?? 0) * 1.8 + (topicPicksTotal.get(fallbackTopic.id) ?? 0) * 0.65)
              : 1 / (1 + (perCourse.get(it.courseId) ?? 0) * 1.8);
            const score = timeFactor * weightFactor * difficultyFactor * boostFactor * modeFactor * 0.55 * topicRepeatPenalty;
            if (!best || score > best.score) best = { score, item: it, topic: fallbackTopic };
          }
        }
      }
      if (!best) break;
      const eff = best.topic ? (effort.get(best.topic.id) ?? targetBlock) : (fallbackEffortByAssessment.get(best.item.assessment.id) ?? targetBlock);
      const lowConfidence = best.topic ? (best.topic.confidence <= 2 || best.topic.lastRecallScore === 1) : false;
      const postClassFlagged =
        postClassHardCourseSet.has(best.item.courseId) ||
        (best.topic ? logHighlightedTopicIds.has(best.topic.id) : false);
      const tiredModeration = recentTiredDay && i <= 1 ? Math.min(targetBlock, 35) : targetBlock;
      const targetCap = lowConfidence ? adaptiveLowCap : tiredModeration;
      const want = Math.min(targetCap, Math.max(MIN_BLOCK, eff));
      const preExamLeft = preExamWindowLimitByCourse.get(best.item.courseId);
      const preExamAvail = preExamLeft !== undefined
        ? Math.max(0, preExamLeft - (perCourseMinutes.get(best.item.courseId) ?? 0))
        : remaining;
      const minutes = Math.min(want, remaining, preExamAvail);
      if (minutes < MIN_BLOCK) {
        if (best.topic) effort.set(best.topic.id, 0);
        else fallbackEffortByAssessment.set(best.item.assessment.id, 0);
        continue;
      }
      const briefingFocus = courseNoteFor(best.item.courseId, day);
      const customFocus =
        getValidExamFocus(best.item.courseId, day, active, best.item.assessment.id) ??
        classFocusByCourseId.get(best.item.courseId) ??
        briefingFocus;
      const naturalNote = urgentCourseIdsToday.has(best.item.courseId)
        ? singleTestMode
          ? 'Prática para teste'
          : 'Revisão para teste'
        : postClassFlagged
          ? 'Reforçar dúvidas'
          : boostSet.has(best.item.courseId)
            ? 'Reforço escolhido'
            : lowConfidence
              ? 'Prática guiada'
              : best.topic?.status === 'todo'
                ? 'Estudar base'
                : 'Praticar exercícios';
      const isUrgent = urgentCourseIdsToday.has(best.item.courseId);
      const reason: StudySessionReason = dayProfile.isMarathonDay && isUrgent
        ? {
            code: 'exam_marathon',
            examDays: best.item.daysLeft,
            weight: best.item.assessment.weight,
          }
        : briefingFocus && !getValidExamFocus(best.item.courseId, day, active, best.item.assessment.id)
          ? {
              code: 'briefing',
              label: briefingFocus.slice(0, 60),
              ...(isUrgent ? { examDays: best.item.daysLeft, weight: best.item.assessment.weight } : {}),
            }
          : isUrgent
            ? {
                code: best.item.daysLeft === 1 ? 'exam_eve' : 'exam_prep',
                examDays: best.item.daysLeft,
                weight: best.item.assessment.weight,
              }
            : lowConfidence || postClassFlagged
              ? { code: 'weak_topic' }
              : { code: 'coverage' };
      const matId = matchBestMaterialForTopic({
        courseId: best.item.courseId,
        topic: best.topic,
        materials,
        contentMix,
        isExamUrgent: isUrgent,
      });
      add({
        courseId: best.item.courseId,
        ...(best.topic ? { topicId: best.topic.id } : {}),
        assessmentId: best.item.assessment.id,
        ...(matId ? { materialId: matId } : {}),
        minutes,
        notes: customFocus || naturalNote,
        reason,
      });
      if (best.topic) {
        effort.set(best.topic.id, Math.max(0, eff - minutes));
      } else {
        fallbackEffortByAssessment.set(best.item.assessment.id, Math.max(0, eff - minutes));
      }
    }

    // Manutenção leve de outras cadeiras em Modo Teste (> 2 dias) quando há tempo livre no dia.
    if (
      singleTestMode &&
      !strictSingleTestMode &&
      !exclusiveTestFocus &&
      otherMaintenanceCourses.length > 0 &&
      canTake()
    ) {
      let pickedMaint: { course: Course; topic?: Topic; score: number } | null = null;
      for (const c of otherMaintenanceCourses) {
        if (!courseOk(c.id)) continue;
        const pool = c.topics.filter((t) => !(t.status === 'done' && t.confidence >= 4));
        const list = pool.length > 0 ? pool : c.topics;
        const sortedTopics = [...list].sort((a, b) => {
          const pickDiff = (starterTopicPicks.get(a.id) ?? 0) - (starterTopicPicks.get(b.id) ?? 0);
          if (pickDiff !== 0) return pickDiff;
          return a.confidence - b.confidence;
        });
        const topic = sortedTopics[0];
        const loadPenalty = 1 + (starterMinutesByCourse.get(c.id) ?? 0) / 60;
        const diffBoost = difficultSet.has(c.id) || postClassHardCourseSet.has(c.id) ? 1.3 : 1.0;
        const score = diffBoost / loadPenalty;
        if (!pickedMaint || score > pickedMaint.score) {
          pickedMaint = { course: c, topic, score };
        }
      }
      if (pickedMaint) {
        const maintMin = Math.min(Math.min(targetBlock, 35), remaining);
        if (maintMin >= MIN_BLOCK) {
          const matId = matchBestMaterialForTopic({
            courseId: pickedMaint.course.id,
            topic: pickedMaint.topic,
            materials,
            contentMix,
            isExamUrgent: false,
          });
          add({
            courseId: pickedMaint.course.id,
            ...(pickedMaint.topic ? { topicId: pickedMaint.topic.id } : {}),
            ...(matId ? { materialId: matId } : {}),
            minutes: maintMin,
            notes: 'Manutenção · ritmo contínuo',
            reason: { code: 'coverage' },
          });
          starterMinutesByCourse.set(
            pickedMaint.course.id,
            (starterMinutesByCourse.get(pickedMaint.course.id) ?? 0) + maintMin,
          );
          if (pickedMaint.topic) {
            starterTopicPicks.set(
              pickedMaint.topic.id,
              (starterTopicPicks.get(pickedMaint.topic.id) ?? 0) + 1,
            );
          }
        }
      }
    }

    if (active.length === 0 && eligibleCoursesToday.length > 0 && canTake()) {
      while (canTake()) {
        let picked: { course: Course; topic?: Topic; score: number } | null = null;
        for (const c of eligibleCoursesToday) {
          if (!courseOk(c.id)) continue;
          const candidateTopics = c.topics.filter(
            (t) => !(t.status === 'done' && t.confidence >= 4),
          );
          const pool = candidateTopics.length > 0 ? candidateTopics : c.topics;
          const sortedTopics = [...pool].sort((a, b) => {
            const pickDiff = (starterTopicPicks.get(a.id) ?? 0) - (starterTopicPicks.get(b.id) ?? 0);
            if (pickDiff !== 0) return pickDiff;
            return a.confidence - b.confidence;
          });
          const topic = sortedTopics[0];
          const difficultyBoost =
            difficultSet.has(c.id) ||
            difficultCheckInCourseSet.has(c.id) ||
            postClassHardCourseSet.has(c.id)
              ? 1.4
              : 1.0;
          const chosenBoost = boostSet.has(c.id) ? 1.5 : 1.0;
          const loadPenalty = 1 + (starterMinutesByCourse.get(c.id) ?? 0) / 60;
          const topicBonus = topic
            ? (1.2 - topic.confidence * 0.1) * (isTopicHighlightedByCheckIn(topic.title, topic.id) ? 1.25 : 1)
            : 1.0;
          const score = (difficultyBoost * chosenBoost * topicBonus) / loadPenalty;
          if (!picked || score > picked.score) {
            picked = { course: c, topic, score };
          }
        }
        if (!picked) break;
        const lowConf = picked.topic ? picked.topic.confidence <= 2 : false;
        const targetMinutes = lowConf
          ? adaptiveLowCap
          : recentTiredDay && i <= 1
            ? Math.min(targetBlock, 35)
            : targetBlock;
        const minutes = Math.min(targetMinutes, remaining);
        if (minutes < MIN_BLOCK) break;
        const starterBriefing = courseNoteFor(picked.course.id, day);
        const starterFocus =
          getValidExamFocus(picked.course.id, day, active) ??
          classFocusByCourseId.get(picked.course.id) ??
          starterBriefing;
        const matId = matchBestMaterialForTopic({
          courseId: picked.course.id,
          topic: picked.topic,
          materials,
          contentMix,
          isExamUrgent: false,
        });
        add({
          courseId: picked.course.id,
          ...(picked.topic ? { topicId: picked.topic.id } : {}),
          ...(matId ? { materialId: matId } : {}),
          minutes,
          notes:
            starterFocus ||
            (postClassHardCourseSet.has(picked.course.id)
              ? 'Reforçar dúvidas'
              : boostSet.has(picked.course.id)
                ? 'Prática guiada'
                : 'Consolidação'),
          reason: starterBriefing
            ? { code: 'briefing', label: starterBriefing.slice(0, 60) }
            : { code: 'starter' },
        });
        starterMinutesByCourse.set(
          picked.course.id,
          (starterMinutesByCourse.get(picked.course.id) ?? 0) + minutes,
        );
        if (picked.topic) {
          starterTopicPicks.set(picked.topic.id, (starterTopicPicks.get(picked.topic.id) ?? 0) + 1);
        }
      }
    }

    const blockDeadline = (b: Block) =>
      (b.assessmentId ? sameDayDeadlineByAssessment.get(b.assessmentId) : undefined) ??
      sameDayCourseDeadline.get(b.courseId);
    const orderedBlocks = [...blocks].sort(
      (a, b) => (blockDeadline(a) ?? Infinity) - (blockDeadline(b) ?? Infinity),
    );

    let cursor = baseStart;
    for (let bIdx = 0; bIdx < orderedBlocks.length; bIdx++) {
      const b = orderedBlocks[bIdx]!;
      const deadline = blockDeadline(b) ?? 23 * 60 + 30;
      const nextStart = advanceCursorPastBusy(cursor, b.minutes, dayBusy);
      if (nextStart + b.minutes > deadline) continue;
      cursor = nextStart;
      result.push({
        id: newId(),
        courseId: b.courseId,
        ...(b.topicId ? { topicId: b.topicId } : {}),
        ...(b.assessmentId ? { assessmentId: b.assessmentId } : {}),
        ...(b.materialId ? { materialId: b.materialId } : {}),
        date: key,
        start: fmtTime(cursor),
        minutes: b.minutes,
        done: false,
        ...(b.notes ? { notes: b.notes } : {}),
        ...(b.reason ? { reason: b.reason } : {}),
        generated: true,
      });
      const breakGap = dayProfile.isMarathonDay && bIdx % 2 === 1 ? 20 : BREAK;
      cursor = roundUp5(cursor + b.minutes + breakGap);
    }
  }

  return result;
}
