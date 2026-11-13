// Funções puras que preparam os dados dos gráficos de Progresso. Sem React.
import { addDays, format, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { courseColors } from '../../lib/colors';
import {
  daysUntil, gradeSummary, readiness, sessionMinutes, toDateStr, topicProgress, upcomingAssessments,
} from '../../lib/selectors';
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

export const fmtShortDate = (d: string) => format(parseISO(d), 'd MMM', { locale: pt });
const fmtDay = (d: string, period: Period) => format(parseISO(d), period === '7d' ? 'EEE d' : 'd MMM', { locale: pt });

/** Horas no eixo Y (ex.: 1,5 h). */
export const fmtHours = (m: number) => `${(m / 60).toFixed(Number.isInteger(m / 60) ? 0 : 1).replace('.', ',')} h`;
export const fmtDec = (n: number) => n.toFixed(1).replace('.', ',');
export const fmtPct = (n: number) => `${Math.round(n)}%`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Minutos de meta no período: dias de estudo já decorridos × minutos diários. */
export function studyGoalMinutes(r: PeriodRange, settings: Pick<Settings, 'studyDays' | 'dailyStudyMinutes'>): number {
  const allowedDays = Array.isArray(settings.studyDays) ? settings.studyDays : [1, 2, 3, 4, 5];
  const dailyMin = settings.dailyStudyMinutes ?? 120;
  const studyDays = r.days.filter((d) => d <= r.elapsedTo && allowedDays.includes(parseISO(d).getDay()));
  return studyDays.length * dailyMin;
}

/** Meta por barra: diária, ou semanal (× dias de estudo) quando agregado por semana. */
export function bucketGoal(r: PeriodRange, settings: Pick<Settings, 'studyDays' | 'dailyStudyMinutes'>): number {
  const allowedDays = Array.isArray(settings.studyDays) ? settings.studyDays : [1, 2, 3, 4, 5];
  const dailyMin = settings.dailyStudyMinutes ?? 120;
  return r.byWeek ? dailyMin * allowedDays.length : dailyMin;
}

export interface SeriesDef { key: string; name: string; color: string }

/** Linha de um gráfico empilhado: `total` e uma chave `s<i>` por cadeira. */
export interface StudyRow { key: string; label: string; total: number; [series: string]: string | number }

export function studyByBucket(
  sessions: StudySession[],
  courses: Course[],
  r: PeriodRange,
): { rows: StudyRow[]; series: SeriesDef[] } {
  const series: SeriesDef[] = courses.map((c, i) => ({
    key: `s${i}`, name: c.shortName, color: courseColors[c.color].hex,
  }));
  const index = new Map(courses.map((c, i) => [c.id, i]));
  const rows = new Map<string, StudyRow>();
  for (const k of r.byWeek ? r.weeks : r.days) {
    const row: StudyRow = { key: k, label: r.byWeek ? fmtShortDate(k) : fmtDay(k, r.period), total: 0 };
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
export function plannedByWeek(sessions: StudySession[], r: PeriodRange): PlanRow[] {
  const rows = new Map<string, PlanRow>(
    r.weeks.map((w) => [w, { key: w, label: fmtShortDate(w), planned: 0, done: 0 }]),
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
