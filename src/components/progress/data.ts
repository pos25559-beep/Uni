// Funções puras que preparam os dados dos gráficos de Progresso. Sem React.
import { addDays, format, parseISO, startOfDay, startOfWeek } from 'date-fns';
import i18n from '../../i18n';
import { courseColors } from '../../lib/colors';
import { normalizeAppLanguage, resolveDateFnsLocale } from '../../lib/grading';
import {
  minutesForWeekday,
  resolvePlannerPrefs,
  weeklyStudyMinutes,
} from '../../lib/planner/availability';
import {
  daysUntil, gradeSummary, readiness, sessionMinutes, toDateStr, topicProgress, upcomingAssessments,
} from '../../lib/selectors';
import { estimateTopicRetention, isTopicReviewDue, type RetentionState } from '../../lib/spacedRepetition';
import type { Assessment, Course, Settings, StudySession } from '../../types';

export type Period = '7d' | '30d' | 'semestre';

export const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'semestre', label: 'Semestre' },
];

export interface PeriodRange {
  period: Period;
  /** yyyy-MM-dd, inclusivo. */
  from: string;
  /** yyyy-MM-dd, inclusivo. */
  to: string;
  /** Último dia já decorrido do período (nunca depois de hoje). */
  elapsedTo: string;
  /** Todos os dias do período (yyyy-MM-dd). */
  days: string[];
  /** Segundas-feiras que cobrem o período (yyyy-MM-dd). */
  weeks: string[];
  /** true = agregar por semana (semestre). */
  byWeek: boolean;
}

const ymd = (d: Date) => toDateStr(d);

function listDays(from: Date, to: Date): string[] {
  const out: string[] = [];
  for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) out.push(ymd(d));
  return out;
}

export function periodRange(
  period: Period,
  settings: Pick<Settings, 'semesterStart' | 'semesterEnd'>,
  now: Date,
): PeriodRange {
  const today = startOfDay(now);
  const to = period === 'semestre' ? parseISO(settings.semesterEnd) : today;
  const from = period === 'semestre'
    ? parseISO(settings.semesterStart)
    : addDays(today, period === '7d' ? -6 : -29);

  const weeks: string[] = [];
  for (let w = startOfWeek(from, { weekStartsOn: 1 }); w.getTime() <= to.getTime(); w = addDays(w, 7)) {
    weeks.push(ymd(w));
  }

  const toStr = ymd(to);
  const todayStr = ymd(today);
  return {
    period,
    from: ymd(from),
    to: toStr,
    elapsedTo: toStr < todayStr ? toStr : todayStr,
    days: listDays(from, to),
    weeks,
    byWeek: period === 'semestre',
  };
}

const weekStart = (date: string) => ymd(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
const bucketKey = (date: string, r: PeriodRange) => (r.byWeek ? weekStart(date) : date);

function activeLang(lang?: string): string {
  return lang ?? (i18n.isInitialized ? i18n.language : undefined) ?? 'pt-PT';
}

function decimalSep(lang?: string): '.' | ',' {
  return normalizeAppLanguage(activeLang(lang)) === 'en' ? '.' : ',';
}

export const fmtShortDate = (d: string, lang?: string) =>
  format(parseISO(d), 'd MMM', { locale: resolveDateFnsLocale(activeLang(lang)) });

const fmtDay = (d: string, period: Period, lang?: string) =>
  format(parseISO(d), period === '7d' ? 'EEE d' : 'd MMM', { locale: resolveDateFnsLocale(activeLang(lang)) });

/** Horas no eixo Y (ex.: 1,5 h ou 1.5 h em EN). */
export const fmtHours = (m: number, lang?: string) => {
  const num = (m / 60).toFixed(Number.isInteger(m / 60) ? 0 : 1);
  return `${decimalSep(lang) === ',' ? num.replace('.', ',') : num} h`;
};

export const fmtDec = (n: number, lang?: string) => {
  const num = n.toFixed(1);
  return decimalSep(lang) === ',' ? num.replace('.', ',') : num;
};

export const fmtPct = (n: number) => `${Math.round(n)}%`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Minutos de meta no período conforme o horário real por dia (`weekdaySchedule`). */
export function studyGoalMinutes(
  r: PeriodRange,
  settings: Pick<Settings, 'studyDays' | 'dailyStudyMinutes' | 'plannerPrefs'>,
): number {
  const schedule = resolvePlannerPrefs(settings as Settings).weekdaySchedule ?? {};
  return r.days
    .filter((d) => d <= r.elapsedTo)
    .reduce((sum, d) => sum + minutesForWeekday(schedule, parseISO(d).getDay()), 0);
}

/** Meta por barra: média dos dias ativos, ou semanal (`weeklyStudyMinutes`) quando agregado por semana. */
export function bucketGoal(
  r: PeriodRange,
  settings: Pick<Settings, 'studyDays' | 'dailyStudyMinutes' | 'plannerPrefs'>,
): number {
  const schedule = resolvePlannerPrefs(settings as Settings).weekdaySchedule ?? {};
  const weeklyTotal = weeklyStudyMinutes(schedule);
  if (r.byWeek) return weeklyTotal;
  const activeDayMinutes = [0, 1, 2, 3, 4, 5, 6]
    .map((wd) => minutesForWeekday(schedule, wd))
    .filter((m) => m > 0);
  if (activeDayMinutes.length === 0) return 0;
  return Math.round(weeklyTotal / activeDayMinutes.length);
}

export interface SeriesDef { key: string; name: string; color: string }

/** Linha de um gráfico empilhado: `total` e uma chave `s<i>` por cadeira. */
export interface StudyRow { key: string; label: string; total: number; [series: string]: string | number }

export function studyByBucket(
  sessions: StudySession[],
  courses: Course[],
  r: PeriodRange,
  lang?: string,
): { rows: StudyRow[]; series: SeriesDef[] } {
  const series: SeriesDef[] = courses.map((c, i) => ({
    key: `s${i}`, name: c.shortName, color: courseColors[c.color].hex,
  }));
  const index = new Map(courses.map((c, i) => [c.id, i]));
  const rows = new Map<string, StudyRow>();
  for (const k of r.byWeek ? r.weeks : r.days) {
    const row: StudyRow = { key: k, label: r.byWeek ? fmtShortDate(k, lang) : fmtDay(k, r.period, lang), total: 0 };
    for (const s of series) row[s.key] = 0;
    rows.set(k, row);
  }
  for (const s of sessions) {
    if (!s.done || s.date < r.from || s.date > r.to) continue;
    const i = index.get(s.courseId);
    const row = rows.get(bucketKey(s.date, r));
    if (i === undefined || !row) continue;
    const m = sessionMinutes(s);
    row[`s${i}`] = Number(row[`s${i}`]) + m;
    row.total += m;
  }
  return { rows: [...rows.values()], series };
}

export interface PlanRow { key: string; label: string; planned: number; done: number }

/** Planeado (todas as sessões) vs. feito (sessões concluídas), por semana. */
export function plannedByWeek(sessions: StudySession[], r: PeriodRange, lang?: string): PlanRow[] {
  const rows = new Map<string, PlanRow>(
    r.weeks.map((w) => [w, { key: w, label: fmtShortDate(w, lang), planned: 0, done: 0 }]),
  );
  for (const s of sessions) {
    if (s.date < r.from || s.date > r.to) continue;
    const row = rows.get(weekStart(s.date));
    if (!row) continue;
    row.planned += s.minutes;
    row.done += sessionMinutes(s);
  }
  return [...rows.values()];
}

/** Totais até hoje (sessões futuras não contam para a percentagem). */
export function planTotals(sessions: StudySession[], r: PeriodRange): { planned: number; done: number } {
  let planned = 0;
  let done = 0;
  for (const s of sessions) {
    if (s.date < r.from || s.date > r.elapsedTo) continue;
    planned += s.minutes;
    done += sessionMinutes(s);
  }
  return { planned, done };
}

export interface CourseTimeRow { courseId: string; name: string; color: string; value: number }

/** Minutos concluídos por cadeira no período, do maior para o menor (só cadeiras com tempo). */
export function minutesByCourse(sessions: StudySession[], courses: Course[], r: PeriodRange): CourseTimeRow[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (!s.done || s.date < r.from || s.date > r.to) continue;
    totals.set(s.courseId, (totals.get(s.courseId) ?? 0) + sessionMinutes(s));
  }
  return courses
    .map((c) => ({ courseId: c.id, name: c.shortName, color: courseColors[c.color].hex, value: totals.get(c.id) ?? 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}

export interface GradeRow { course: Course; current: number | null }

export function gradeRows(courses: Course[], assessments: Assessment[]): GradeRow[] {
  return courses.map((course) => ({ course, current: gradeSummary(course, assessments).current }));
}

export interface CompetenceRow {
  courseId: string;
  name: string;
  color: string;
  /** Matéria estudada, 0–100. */
  progress: number;
  /** Confiança média, 1–5. */
  confidence: number;
  /** Confiança em percentagem, 0–100. */
  confidencePct: number;
}

/** Só cadeiras com tópicos: sem tópicos não há nada para avaliar. */
export function competenceRows(courses: Course[]): CompetenceRow[] {
  return courses
    .filter((c) => c.topics.length > 0)
    .map((c) => {
      const confidence = c.topics.reduce((s, t) => s + t.confidence, 0) / c.topics.length;
      return {
        courseId: c.id,
        name: c.shortName,
        color: courseColors[c.color].hex,
        progress: Math.round(topicProgress(c) * 100),
        confidence,
        confidencePct: Math.round((confidence / 5) * 100),
      };
    });
}

/** Média simples de matéria e confiança; o valor mais baixo é a cadeira mais fraca. */
export const competenceScore = (r: CompetenceRow) => (r.progress + r.confidencePct) / 2;

export interface ReadinessPoint {
  id: string;
  title: string;
  courseName: string;
  color: string;
  /** Dias até à avaliação. */
  days: number;
  /** Preparação, 0–100. */
  readiness: number;
  weight: number;
  /** ISO datetime. */
  date: string;
}

export function readinessPoints(assessments: Assessment[], courses: Course[], withinDays = 45): ReadinessPoint[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  return upcomingAssessments(assessments, withinDays).flatMap((a): ReadinessPoint[] => {
    const course = byId.get(a.courseId);
    if (!course) return [];
    return [{
      id: a.id,
      title: a.title,
      courseName: course.name,
      color: courseColors[course.color].hex,
      days: Math.max(0, daysUntil(a.date)),
      readiness: Math.round(readiness(a, course) * 100),
      weight: a.weight,
      date: a.date,
    }];
  });
}

export interface HeatCell { date: string; minutes: number; future: boolean }

export interface Heatmap {
  /** columns[semana][dia], dia 0 = segunda … 6 = domingo. */
  columns: HeatCell[][];
  max: number;
  activeDays: number;
}

export function heatmap(sessions: StudySession[], now: Date, weeks = 12): Heatmap {
  const today = ymd(now);
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.done) continue;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + sessionMinutes(s));
  }
  const firstMonday = addDays(startOfWeek(now, { weekStartsOn: 1 }), -7 * (weeks - 1));
  const columns: HeatCell[][] = [];
  let max = 0;
  let activeDays = 0;
  for (let w = 0; w < weeks; w += 1) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = ymd(addDays(firstMonday, w * 7 + d));
      const minutes = byDay.get(date) ?? 0;
      column.push({ date, minutes, future: date > today });
      if (minutes > 0) activeDays += 1;
      max = Math.max(max, minutes);
    }
    columns.push(column);
  }
  return { columns, max, activeDays };
}

export interface CourseRetentionRow {
  courseId: string;
  name: string;
  fullName: string;
  color: string;
  retentionPct: number;
  hitRatePct: number | null;
  dueCount: number;
  studiedCount: number;
}

export interface FragileTopicRow {
  courseId: string;
  courseName: string;
  color: string;
  topicId: string;
  title: string;
  retentionPct: number;
  state: RetentionState;
  due: boolean;
  hitRatePct: number | null;
}

export interface FocusQualityStats {
  trackedCount: number;
  cleanFocusCount: number;
  cleanFocusPct: number | null;
  avgExits: number | null;
  practiceHits: number;
  practiceTotal: number;
  practiceHitRatePct: number | null;
}

export interface RetentionOverview {
  avgRetentionPct: number | null;
  dueCount: number;
  studiedTopicCount: number;
  courseRows: CourseRetentionRow[];
  fragileTopics: FragileTopicRow[];
  focusQuality: FocusQualityStats;
}

/** Calcula retenção estimada por cadeira/tópico, fila frágil e limpeza do modo foco. */
export function retentionOverview(
  courses: Course[],
  sessions: StudySession[],
  dayKey: string,
): RetentionOverview {
  const courseRows: CourseRetentionRow[] = [];
  const fragileTopics: FragileTopicRow[] = [];
  let totalRetention = 0;
  let studiedTopicCount = 0;
  let dueCount = 0;
  let topicRecallHits = 0;
  let topicRecallAttempts = 0;

  for (const course of courses) {
    const color = courseColors[course.color]?.hex ?? '#4a7c59';
    let courseRetSum = 0;
    let courseStudied = 0;
    let courseDue = 0;
    let courseHits = 0;
    let courseAttempts = 0;

    for (const topic of course.topics) {
      const est = estimateTopicRetention(topic, dayKey);
      const due = isTopicReviewDue(topic, dayKey);
      if (due) {
        dueCount += 1;
        courseDue += 1;
      }

      const attempts = topic.recallCount ?? 0;
      const hits =
        topic.recallSuccessCount ??
        (topic.lastRecallScore && topic.lastRecallScore >= 2 ? attempts : 0);
      courseAttempts += attempts;
      courseHits += hits;
      topicRecallAttempts += attempts;
      topicRecallHits += hits;

      if (est.state !== 'unstudied') {
        totalRetention += est.retentionPct;
        studiedTopicCount += 1;
        courseRetSum += est.retentionPct;
        courseStudied += 1;
      }

      if (due || est.state === 'at_risk' || est.state === 'review_soon') {
        fragileTopics.push({
          courseId: course.id,
          courseName: course.code || course.name,
          color,
          topicId: topic.id,
          title: topic.title,
          retentionPct: est.retentionPct,
          state: est.state,
          due,
          hitRatePct: est.hitRatePct,
        });
      }
    }

    if (courseStudied > 0 || courseAttempts > 0) {
      courseRows.push({
        courseId: course.id,
        name: course.code || course.name,
        fullName: course.name,
        color,
        retentionPct: courseStudied > 0 ? Math.round(courseRetSum / courseStudied) : 0,
        hitRatePct: courseAttempts > 0 ? Math.round((courseHits / courseAttempts) * 100) : null,
        dueCount: courseDue,
        studiedCount: courseStudied,
      });
    }
  }

  fragileTopics.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    return a.retentionPct - b.retentionPct;
  });

  const doneSessions = sessions.filter((s) => s.done);
  const trackedFocus = doneSessions.filter(
    (s) => s.focusDistractions !== undefined || s.focusShieldUsed,
  );
  const cleanFocusCount = trackedFocus.filter((s) => (s.focusDistractions ?? 0) === 0).length;
  const totalExits = trackedFocus.reduce((sum, s) => sum + (s.focusDistractions ?? 0), 0);

  let sessionHits = 0;
  let sessionTotal = 0;
  const topicsWithSessionPractice = new Set<string>();
  for (const s of doneSessions) {
    if ((s.practiceTotal ?? 0) > 0) {
      sessionTotal += s.practiceTotal ?? 0;
      sessionHits += Math.min(s.practiceTotal ?? 0, s.practiceHits ?? 0);
      if (s.topicId) topicsWithSessionPractice.add(s.topicId);
    }
  }

  let standaloneTopicHits = 0;
  let standaloneTopicAttempts = 0;
  for (const course of courses) {
    for (const topic of course.topics) {
      if (topicsWithSessionPractice.has(topic.id)) continue;
      const attempts = topic.recallCount ?? 0;
      if (attempts <= 0) continue;
      const hits =
        topic.recallSuccessCount ??
        (topic.lastRecallScore && topic.lastRecallScore >= 2 ? attempts : 0);
      standaloneTopicAttempts += attempts;
      standaloneTopicHits += hits;
    }
  }

  const practiceHits = sessionHits + standaloneTopicHits;
  const practiceTotal = sessionTotal + standaloneTopicAttempts;

  return {
    avgRetentionPct: studiedTopicCount > 0 ? Math.round(totalRetention / studiedTopicCount) : null,
    dueCount,
    studiedTopicCount,
    courseRows,
    fragileTopics,
    focusQuality: {
      trackedCount: trackedFocus.length,
      cleanFocusCount,
      cleanFocusPct:
        trackedFocus.length > 0 ? Math.round((cleanFocusCount / trackedFocus.length) * 100) : null,
      avgExits:
        trackedFocus.length > 0 ? Number((totalExits / trackedFocus.length).toFixed(1)) : null,
      practiceHits,
      practiceTotal,
      practiceHitRatePct:
        practiceTotal > 0 ? Math.round((practiceHits / practiceTotal) * 100) : null,
    },
  };
}
