// Motor do plano de estudo. Funções puras (sem React): mesma entrada, mesma saída.
import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from 'date-fns';
import { newId } from '../store/useStore';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ID,
  Settings,
  StudySession,
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
}

interface Block {
  courseId: ID;
  topicId?: ID;
  assessmentId?: ID;
  minutes: number;
  notes?: string;
}

interface WorkItem {
  assessment: Assessment;
  due: Date;
  courseId: ID;
  topics: Topic[];
}

const BLOCK = 50;
const MIN_BLOCK = 25;
const BREAK = 10;
const MAX_BLOCKS_PER_DAY = 4;
const MAX_BLOCKS_PER_COURSE = 2;
const HORIZON_DAYS = 45;
const TEST_MODE_DAYS = 10;
const SPACED_MINUTES = 25;
const SPACED_AFTER_DAYS = 7;
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
  } = input;
  const days = input.days ?? 14;
  const start = parseDay(from);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const difficultSet = new Set(difficultCourseIds);

  const latestCheckIn = weeklyCheckIns[0];
  const difficultCheckInCourseSet = new Set(latestCheckIn?.hardCourseIds ?? []);
  const checkInTopicHints = [
    ...(latestCheckIn?.classDifficulties ?? []),
    ...(latestCheckIn?.pendingNextWeek ?? []),
  ]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);

  const isTopicHighlightedByCheckIn = (topicTitle: string) => {
    if (checkInTopicHints.length === 0) return false;
    const lower = topicTitle.toLowerCase();
    return checkInTopicHints.some((hint) => lower.includes(hint) || hint.includes(lower));
  };

  // Esforço restante por tópico, no início do plano (já descontado o que foi concluído).
  const effort = new Map<ID, number>();
  for (const c of courses) {
    for (const t of c.topics) {
      const studied = existing
        .filter((s) => s.done && s.topicId === t.id)
        .reduce((sum, s) => sum + sessionMinutes(s), 0);
      const checkInExtra = isTopicHighlightedByCheckIn(t.title) ? 35 : 0;
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
    items.push({ assessment: a, due: parseDay(a.date), courseId: course.id, topics });
  }

  const lastScheduled = new Map<ID, string>(); // revisões espaçadas já marcadas neste plano
  const result: StudySession[] = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(day);
    const weekday = day.getDay();
    if (!settings.studyDays.includes(weekday)) continue;

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
    budget = Math.round(Math.max(MIN_DAY_BUDGET, budget));
    const alreadyUsed = existing
      .filter((s) => s.date === key && (s.done || !s.generated))
      .reduce((sum, s) => sum + occupied(s), 0);

    let remaining = Math.max(0, budget - alreadyUsed);
    const blocks: Block[] = [];
    const perCourse = new Map<ID, number>();

    // Avaliações activas neste dia (dentro do horizonte).
    const active = items
      .map((it) => ({ ...it, daysLeft: differenceInCalendarDays(it.due, day) }))
      .filter((it) => it.daysLeft >= 0 && it.daysLeft <= HORIZON_DAYS);

    // Deteção dinâmica de Modo Teste (<= 10 dias) para este dia.
    const urgentToday = active.filter((it) => it.daysLeft <= TEST_MODE_DAYS);
    const urgentCourseIdsToday = new Set(urgentToday.map((u) => u.courseId));
    const singleTestMode = urgentCourseIdsToday.size === 1;
    const multiTestMode = urgentCourseIdsToday.size >= 2;

    const courseOk = (courseId: ID) => {
      const count = perCourse.get(courseId) ?? 0;
      if (singleTestMode && urgentCourseIdsToday.has(courseId)) {
        return count < MAX_BLOCKS_PER_DAY;
      }
      if (multiTestMode && urgentCourseIdsToday.has(courseId) && urgentCourseIdsToday.size >= 3) {
        return count < 2;
      }
      return count < MAX_BLOCKS_PER_COURSE;
    };

    const canTake = () => remaining >= MIN_BLOCK && blocks.length < MAX_BLOCKS_PER_DAY;
    const add = (b: Block) => {
      blocks.push(b);
      perCourse.set(b.courseId, (perCourse.get(b.courseId) ?? 0) + 1);
      remaining -= b.minutes;
    };

    // Revisão geral na véspera de cada avaliação.
    for (const it of active) {
      if (it.daysLeft !== 1 || !canTake() || !courseOk(it.courseId)) continue;
      add({
        courseId: it.courseId,
        assessmentId: it.assessment.id,
        minutes: Math.min(BLOCK, remaining),
        notes: 'Revisão geral',
      });
    }

    // Preenchimento guloso por prioridade.
    while (canTake()) {
      let best: { score: number; item: (typeof active)[number]; topic: Topic } | null = null;
      for (const it of active) {
        if (!courseOk(it.courseId)) continue;
        // Curva acentuada: o que está a dias de distância pesa bem mais do que o que está a semanas.
        const timeFactor = 1 / (1 + it.daysLeft / 3) ** 1.5;
        const weightFactor = 0.5 + it.assessment.weight / 100;
        const isDifficult = difficultSet.has(it.courseId) || difficultCheckInCourseSet.has(it.courseId);
        const difficultyFactor = isDifficult ? 1.35 : 1.0;

        let modeFactor = 1.0;
        if (singleTestMode) {
          modeFactor = urgentCourseIdsToday.has(it.courseId) ? 3.5 : 0.25;
        } else if (multiTestMode) {
          if (urgentCourseIdsToday.has(it.courseId)) {
            const alreadyAssigned = perCourse.get(it.courseId) ?? 0;
            // Penaliza repetição excessiva no mesmo dia para equilibrar 2+ testes próximos
            modeFactor = 2.2 / (1 + alreadyAssigned * 1.4);
          } else {
            modeFactor = 0.35;
          }
        }

        for (const t of it.topics) {
          if ((effort.get(t.id) ?? 0) <= 0) continue;
          const checkInBoost = isTopicHighlightedByCheckIn(t.title) ? 0.35 : 0;
          const needFactor = (needBase[t.status] + checkInBoost) * (1.2 - t.confidence * 0.15);
          const score = timeFactor * weightFactor * difficultyFactor * modeFactor * needFactor;
          if (!best || score > best.score) best = { score, item: it, topic: t };
        }
      }
      if (!best) break;
      const eff = effort.get(best.topic.id) ?? 0;
      const want = Math.min(BLOCK, Math.max(MIN_BLOCK, eff));
      const minutes = Math.min(want, remaining);
      add({
        courseId: best.item.courseId,
        topicId: best.topic.id,
        assessmentId: best.item.assessment.id,
        minutes,
        ...(urgentCourseIdsToday.has(best.item.courseId)
          ? { notes: singleTestMode ? 'Foco Modo Teste' : 'Equilíbrio Modo Teste' }
          : {}),
      });
      effort.set(best.topic.id, Math.max(0, eff - minutes));
    }

    // Sem avaliações próximas: revisão espaçada de tópicos consolidados há mais de 7 dias.
    if (active.length === 0) {
      const stale = courses
        .flatMap((c) => c.topics.map((t) => ({ courseId: c.id, topic: t })))
        .filter(({ topic }) => topic.status === 'review' || topic.status === 'done')
        .map(({ courseId, topic }) => ({
          courseId,
          topic,
          last: lastScheduled.get(topic.id) ?? topic.lastStudied,
        }))
        .filter(({ last }) => !last || differenceInCalendarDays(day, parseDay(last)) > SPACED_AFTER_DAYS)
        .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''));
      for (const s of stale) {
        if (!canTake()) break;
        if (!courseOk(s.courseId)) continue;
        add({ courseId: s.courseId, topicId: s.topic.id, minutes: SPACED_MINUTES, notes: 'Revisão espaçada' });
        lastScheduled.set(s.topic.id, key);
      }
    }

    // Horas de início sequenciais, com intervalo entre blocos.
    const weekend = weekday === 0 || weekday === 6;
    let cursor = weekend ? 10 * 60 : 17 * 60;
    for (const b of blocks) {
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
      cursor += b.minutes + BREAK;
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
