// Motor do plano de estudo. Funções puras (sem React): mesma entrada, mesma saída.
import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from 'date-fns';
import { newId } from '../store/useStore';
import { computeExtraActivityPenaltyByWeekday } from './academicCredits';
import { isTopicReviewDue } from './spacedRepetition';
import { extractStudyFocusPhrase } from './uniCheckInNlu';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  PlannerDayPeriod,
  PlannerStrategy,
  Settings,
  StudyLogEntry,
  StudySession,
  StudySessionReason,
  TestModeStatus,
  Topic,
  WeeklyCheckIn,
} from '../types';
import { sessionMinutes } from './selectors';

export interface PlanInput {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  settings: Settings;
  /** yyyy-MM-dd */
  from: string;
  /** Minutos atuais desde a meia-noite no dia `from` (opcional; evita agendar no passado). */
  nowMinutes?: number;
  /** Número de dias a planear (por omissão 14). */
  days?: number;
  /**
   * Sessões que se mantêm ao regenerar (concluídas e manuais). Ocupam tempo do dia
   * e o tempo já estudado diminui o esforço que falta em cada tópico.
   */
  existing?: StudySession[];
  /** Cadeiras declaradas pelo estudante como mais difíceis (recebem prioridade adicional). */
  difficultCourseIds?: ID[];
  /** Check-ins semanais do tutor para reforçar tópicos difíceis recentes. */
  weeklyCheckIns?: WeeklyCheckIn[];
  /** Registos recentes do Diário do Uni (pós-aula, fim do dia, domingo, Modo Teste). */
  studyLogs?: StudyLogEntry[];
  /** Atividades extracurriculares que reduzem a margem disponível em dias específicos. */
  extraActivities?: ExtraActivity[];
  /** Período preferido do dia para encaixar blocos livres. */
  preferredPeriod?: PlannerDayPeriod;
  /** Duração padrão desejada para cada bloco de estudo (em minutos). */
  blockMinutes?: 25 | 35 | 50 | 75;
  /** Estratégia principal do criador de planos. */
  strategy?: PlannerStrategy;
  /** Cadeiras selecionadas para reforço extra nesta geração. */
  boostCourseIds?: ID[];
  /** Cadeiras pausadas/excluídas temporariamente nesta geração. */
  pausedCourseIds?: ID[];
  /** Em Modo Teste único (> 2 dias), se verdadeiro concentra 100% na prova sem reservar bloco para outras cadeiras. */
  exclusiveTestFocus?: boolean;
}

interface Block {
  courseId: ID;
  topicId?: ID;
  assessmentId?: ID;
  minutes: number;
  notes?: string;
  reason?: StudySessionReason;
}

interface WorkItem {
  assessment: Assessment;
  due: Date;
  dueMinutes?: number;
  courseId: ID;
  topics: Topic[];
}

interface BusyInterval {
  start: number;
  end: number;
}

const BLOCK = 50;
const ADAPTIVE_LOW_CONFIDENCE_BLOCK = 35;
const MIN_BLOCK = 25;
const BREAK = 10;
const MAX_BLOCKS_PER_DAY = 4;
const MAX_BLOCKS_PER_COURSE = 2;
const HORIZON_DAYS = 45;
const TEST_MODE_DAYS = 10;
const SPACED_MINUTES = 25;
const LIGHT_CLASS_LOAD_MIN = 240;
const EVENT_THRESHOLD_MIN = 120;
const MIN_DAY_BUDGET = 30;

const effortBase: Record<Topic['status'], number> = { todo: 150, learning: 100, review: 50, done: 25 };
const needBase: Record<Topic['status'], number> = { todo: 1, learning: 0.8, review: 0.5, done: 0.25 };

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
/** Lê yyyy-MM-dd (ou yyyy-MM-ddTHH:mm…) como data local à meia-noite. */
const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmtTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
/** Extrai minutos do dia (entre 07:00 e 22:00) de `yyyy-MM-ddTHH:mm...`, se aplicável. */
const parseDueMinutes = (s: string): number | undefined => {
  const tIdx = s.indexOf('T');
  if (tIdx === -1) return undefined;
  const hhmm = s.slice(tIdx + 1, tIdx + 6);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
  const mins = toMin(hhmm);
  return mins >= 7 * 60 && mins <= 22 * 60 ? mins : undefined;
};
const roundUp5 = (min: number) => Math.ceil(min / 5) * 5;
/** Avança `cursor` até evitar colisões com intervalos ocupados (aulas, eventos, sessões existentes), arredondando a múltiplos de 5 min. */
const advanceCursorPastBusy = (cursor: number, duration: number, busy: BusyInterval[]): number => {
  let next = roundUp5(cursor);
  for (const iv of busy) {
    if (next < iv.end && next + duration > iv.start) {
      next = roundUp5(Math.max(next, iv.end + BREAK));
    }
  }
  return next;
};
const firstSlotBefore = (
  cursor: number,
  duration: number,
  busy: BusyInterval[],
  maxEnd: number,
): number | null => {
  const next = advanceCursorPastBusy(cursor, duration, busy);
  return next + duration <= maxEnd ? next : null;
};
const availableWindowMinutes = (
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
const occupied = (s: StudySession) => (s.done ? sessionMinutes(s) : s.minutes);

/** Analisa se o estudante está em Modo Teste (< 10 dias para 1 ou 2+ avaliações). */
export function analyzeTestMode(
  courses: Course[],
  assessments: Assessment[],
  from: string,
): TestModeStatus {
  const refDay = parseDay(from);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const urgentAssessments = assessments
    .filter((a) => a.grade === undefined)
    .map((assessment) => {
      const course = courseById.get(assessment.courseId);
      if (!course) return null;
      const daysLeft = differenceInCalendarDays(parseDay(assessment.date), refDay);
      if (daysLeft < 0 || daysLeft > TEST_MODE_DAYS) return null;
      return { assessment, course, daysLeft };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.assessment.weight - a.assessment.weight);

  const urgentCourseIds = Array.from(new Set(urgentAssessments.map((u) => u.course.id)));
  const mode: TestModeStatus['mode'] =
    urgentCourseIds.length === 0
      ? 'normal'
      : urgentCourseIds.length === 1
        ? 'single_test'
        : 'multi_test';

  return { mode, urgentAssessments, urgentCourseIds };
}

/**
 * Gera sessões de estudo para `days` dias a partir de `from`.
 * Determinístico: sem aleatoriedade; empates resolvem-se pela ordem das avaliações e dos tópicos.
 * Adapta-se automaticamente a dificuldades declaradas, check-ins semanais e Modo Teste (< 10 dias).
 */
export function generatePlan(input: PlanInput): StudySession[] {
  const {
    courses,
    assessments,
    classes,
    events,
    settings,
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
  } = input;
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

  const resolvePeriodStart = (weekday: number, roundedNow?: number) => {
    const weekend = weekday === 0 || weekday === 6;
    const eveningClassMin = classes
      .filter((c) => c.weekday === weekday && toMin(c.end) > 17 * 60)
      .reduce((sum, c) => sum + Math.max(0, toMin(c.end) - Math.max(17 * 60, toMin(c.start))), 0);
    const autoBase = weekend
      ? 10 * 60
      : eveningClassMin >= 120 || settings.dailyStudyMinutes > 200
        ? 9 * 60
        : 17 * 60;
    const base =
      preferredPeriod === 'morning'
        ? 8 * 60 + 30
        : preferredPeriod === 'afternoon'
          ? 14 * 60
          : preferredPeriod === 'evening'
            ? 17 * 60 + 30
            : autoBase;
    return Math.max(base, roundedNow ?? 0);
  };

  const latestCheckIn = weeklyCheckIns[0];
  const difficultCheckInCourseSet = new Set(latestCheckIn?.hardCourseIds ?? []);
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
  }> = [];
  const examFocusByAssessmentId = new Map<ID, string>();
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
      if (log.assessmentId && openAssessmentIds.has(log.assessmentId) && !examFocusByAssessmentId.has(log.assessmentId)) {
        examFocusByAssessmentId.set(log.assessmentId, focus);
      }
      examFocusEntries.push({
        focus,
        assessmentId: log.assessmentId,
        courseId: log.courseId,
        due: linkedAssessment ? parseDay(linkedAssessment.date) : undefined,
        logDate: log.date,
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
        if (exact) return exact;
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
      return entry.focus;
    }
    return undefined;
  };

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
      const studied = existing
        .filter((s) => s.done && s.topicId === t.id)
        .reduce((sum, s) => sum + sessionMinutes(s), 0);
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
    const isConfiguredStudyDay = settings.studyDays.includes(weekday);
    const hasImminentOffDayExam =
      !isConfiguredStudyDay &&
      settings.dailyStudyMinutes > 0 &&
      items.some((it) => {
        const dl = differenceInCalendarDays(it.due, day);
        return dl >= 1 && dl <= 2;
      });
    if (!isConfiguredStudyDay && !hasImminentOffDayExam) continue;

    // Hora mínima de início para este dia (evita agendar no passado quando `nowMinutes` é fornecido).
    const roundedNow =
      i === 0 && input.nowMinutes !== undefined
        ? Math.ceil((input.nowMinutes + 10) / 30) * 30
        : undefined;
    if (roundedNow !== undefined && roundedNow > 22 * 60 + 30) continue;

    const baseStart = resolvePeriodStart(weekday, roundedNow);

    // Intervalos ocupados (aulas, eventos com hora marcada, provas do dia e sessões fixas existentes).
    const dayBusy: BusyInterval[] = [];
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
      if (s.date === key && s.start && (s.done || !s.generated)) {
        const st = toMin(s.start);
        dayBusy.push({ start: st, end: st + occupied(s) });
      }
    }
    dayBusy.sort((a, b) => a.start - b.start);

    // Orçamento do dia.
    const classMinutes = classes
      .filter((c) => c.weekday === weekday)
      .reduce((sum, c) => sum + Math.max(0, toMin(c.end) - toMin(c.start)), 0);
    const eventMinutes = events
      .filter((e) => !e.allDay && e.start.slice(0, 10) === key)
      .reduce((sum, e) => sum + Math.max(0, differenceInMinutes(parseISO(e.end), parseISO(e.start))), 0);
    let budget = settings.dailyStudyMinutes;
    if (classMinutes >= LIGHT_CLASS_LOAD_MIN) budget *= 0.75;
    if (eventMinutes > EVENT_THRESHOLD_MIN) budget -= eventMinutes;
    const extraPenalty = extraPenaltyByWeekday.get(weekday) ?? 0;
    if (extraPenalty > 0) budget -= Math.min(120, Math.round(extraPenalty * 0.5));
    if (latestCheckIn?.mood === 'atrasado' || latestCheckIn?.mood === 'pressionado') {
      // Protege contra sobrecarga quando o aluno sinaliza atraso no check-in semanal.
      budget *= 0.85;
    }
    budget = Math.round(Math.max(MIN_DAY_BUDGET, budget));
    const alreadyUsed = existing
      .filter((s) => s.date === key && (s.done || !s.generated))
      .reduce((sum, s) => sum + occupied(s), 0);

    let remaining = Math.max(0, budget - alreadyUsed);
    const dayMaxBlocks =
      budget > MAX_BLOCKS_PER_DAY * targetBlock
        ? Math.min(10, Math.ceil(budget / adaptiveLowCap))
        : MAX_BLOCKS_PER_DAY;
    const blocks: Block[] = [];
    const perCourse = new Map<ID, number>();
    const perCourseMinutes = new Map<ID, number>();
    const topicPicksToday = new Map<ID, number>();

    // Cadeiras cuja avaliação do próprio dia já passou (ou falta < 30 min para começar):
    // não devem receber revisões nem consolidação depois da hora do exame nesse dia.
    const finishedExamCourseIdsToday = new Set<ID>();
    const sameDayDeadlineByAssessment = new Map<ID, number>();
    const activeRaw = items
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
    const active = activeRaw;

    const activeCourseIds = new Set(active.map((it) => it.courseId));
    // Se uma cadeira teve exame que já passou hoje (ou sem janela pré-exame) e não tem outro exame ativo hoje, fica bloqueada para hoje.
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

    // Deteção dinâmica de Modo Teste progressivo (<= 10 dias).
    const urgentToday = active.filter((it) => it.daysLeft <= TEST_MODE_DAYS);
    const urgentCourseIdsToday = new Set(urgentToday.map((u) => u.courseId));
    const minUrgentDays = urgentToday.reduce((min, u) => Math.min(min, u.daysLeft), Infinity);
    const singleTestMode = urgentCourseIdsToday.size === 1;
    const strictSingleTestMode = singleTestMode && minUrgentDays <= 2;
    const multiTestMode = urgentCourseIdsToday.size >= 2;

    // Revisão geral na véspera de cada avaliação (verificação prévia antes dos limites).
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
        // Quando falta > 2 dias e há margem no dia (sem foco exclusivo), reserva 1 bloco para SRS/outras cadeiras.
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
      const eveFocus = getValidExamFocus(it.courseId, day, active, it.assessment.id);
      add({
        courseId: it.courseId,
        assessmentId: it.assessment.id,
        minutes: Math.min(targetBlock, remaining),
        notes: eveFocus || 'Revisão geral',
      });
    }

    // Revisão espaçada contínua (SRS 1→3→7→21d): reserva 1 slot diário (ou 2 em srs_focus) quando há matéria vencida.
    // Mesmo em véspera/Modo Teste crítico, não adia revisões vencidas da própria cadeira da prova para depois do exame.
    if (dueTopics.length > 0 && canTake()) {
      const srsQuota = active.length === 0 ? dueTopics.length : strategy === 'srs_focus' ? 2 : 1;
      let addedSrs = 0;
      for (const s of dueTopics) {
        if (addedSrs >= srsQuota || !canTake()) break;
        const isUrgentSrs = urgentCourseIdsToday.has(s.courseId);
        if ((hasImminentTomorrow || strictSingleTestMode || hasImminentOffDayExam) && !isUrgentSrs) continue;
        const srsMin = Math.min(SPACED_MINUTES, remaining);
        if (!courseOk(s.courseId, srsMin)) continue;
        add({
          courseId: s.courseId,
          topicId: s.topic.id,
          minutes: srsMin,
          notes: s.topic.nextReviewDate ? 'Revisão espaçada (SRS)' : 'Revisão ativa',
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
        // Curva acentuada: o que está a dias de distância pesa bem mais do que o que está a semanas.
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
            // Penaliza repetição no mesmo dia e ao longo do horizonte para equilibrar 2+ testes próximos
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
          const statusUrgencyFactor = !preferConsolidated ? 1.0 : t.status === 'todo' ? 0.72 : 1.15;
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

        // Fallback quando a avaliação urgente ainda não tem tópicos associados ou todos já foram marcados como revistos:
        // garante que a segunda cadeira em Modo Teste nunca fica com 0 sessões.
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
      const customFocus =
        getValidExamFocus(best.item.courseId, day, active, best.item.assessment.id) ??
        classFocusByCourseId.get(best.item.courseId);
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
      add({
        courseId: best.item.courseId,
        ...(best.topic ? { topicId: best.topic.id } : {}),
        assessmentId: best.item.assessment.id,
        minutes,
        notes: customFocus || naturalNote,
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
          add({
            courseId: pickedMaint.course.id,
            ...(pickedMaint.topic ? { topicId: pickedMaint.topic.id } : {}),
            minutes: maintMin,
            notes: 'Manutenção · ritmo contínuo',
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
      // Modo Arranque de Semestre: distribui preparação contínua equilibrada quando ainda não existem provas marcadas.
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
        const starterFocus =
          getValidExamFocus(picked.course.id, day, active) ??
          classFocusByCourseId.get(picked.course.id);
        add({
          courseId: picked.course.id,
          ...(picked.topic ? { topicId: picked.topic.id } : {}),
          minutes,
          notes:
            starterFocus ||
            (postClassHardCourseSet.has(picked.course.id)
              ? 'Reforçar dúvidas'
              : boostSet.has(picked.course.id)
                ? 'Prática guiada'
                : 'Consolidação'),
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

    // Coloca primeiro blocos com prazo no próprio dia (exames hoje) para garantir vaga antes da prova.
    const blockDeadline = (b: Block) =>
      (b.assessmentId ? sameDayDeadlineByAssessment.get(b.assessmentId) : undefined) ??
      sameDayCourseDeadline.get(b.courseId);
    const orderedBlocks = [...blocks].sort(
      (a, b) => (blockDeadline(a) ?? Infinity) - (blockDeadline(b) ?? Infinity),
    );

    // Horas de início sequenciais, evitando colisões com aulas, eventos ou sessões existentes e respeitando o início das provas do próprio dia.
    let cursor = baseStart;
    for (const b of orderedBlocks) {
      const deadline = blockDeadline(b) ?? 23 * 60 + 30;
      const nextStart = advanceCursorPastBusy(cursor, b.minutes, dayBusy);
      if (nextStart + b.minutes > deadline) continue;
      cursor = nextStart;
      result.push({
        id: newId(),
        courseId: b.courseId,
        ...(b.topicId ? { topicId: b.topicId } : {}),
        ...(b.assessmentId ? { assessmentId: b.assessmentId } : {}),
        date: key,
        start: fmtTime(cursor),
        minutes: b.minutes,
        done: false,
        ...(b.notes ? { notes: b.notes } : {}),
        generated: true,
      });
      cursor = roundUp5(cursor + b.minutes + BREAK);
    }
  }

  return result;
}

export interface CourseMinutes {
  courseId: ID;
  /** Minutos planeados (todas as sessões). */
  planned: number;
  /** Minutos realmente estudados (sessões concluídas). */
  done: number;
}

/** Minutos planeados e realizados por cadeira, na ordem de `courses`. */
export function planSummary(sessions: StudySession[], courses: Course[]): CourseMinutes[] {
  return courses.map((c) => {
    const mine = sessions.filter((s) => s.courseId === c.id);
    return {
      courseId: c.id,
      planned: mine.reduce((sum, s) => sum + s.minutes, 0),
      done: mine.reduce((sum, s) => sum + sessionMinutes(s), 0),
    };
  });
}

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
    if (!settings.studyDays.includes(weekday)) continue;

    const roundedNow =
      i === 0 && nowMinutes !== undefined
        ? Math.ceil((nowMinutes + 10) / 30) * 30
        : undefined;
    if (roundedNow !== undefined && roundedNow > 22 * 60 + 30) continue;

    const weekend = weekday === 0 || weekday === 6;
    const periodBase =
      preferredPeriod === 'morning'
        ? 8 * 60 + 30
        : preferredPeriod === 'afternoon'
          ? 14 * 60
          : preferredPeriod === 'evening'
            ? 17 * 60 + 30
            : weekend
              ? 10 * 60
              : 17 * 60;
    const baseStart = Math.max(periodBase, roundedNow ?? 0);

    const dayBusy: BusyInterval[] = [];
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
    const budget = Math.max(MIN_DAY_BUDGET, settings.dailyStudyMinutes);
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
