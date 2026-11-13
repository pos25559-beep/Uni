// Cálculos partilhados (funções puras). Usar estes em vez de recalcular nas páginas.
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import type { Assessment, Course, StudySession, Topic } from '../types';

export const todayStr = () => format(new Date(), 'yyyy-MM-dd');
export const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');

/** Dias de calendário até uma data ISO (negativo = já passou). À prova de nulos ou strings inválidas. */
export const daysUntil = (iso?: string | null) => {
  if (!iso || typeof iso !== 'string') return -999;
  try {
    const d = parseISO(iso);
    return isNaN(d.getTime()) ? -999 : differenceInCalendarDays(d, new Date());
  } catch {
    return -999;
  }
};

export interface GradeSummary {
  /** Média ponderada só do que já foi avaliado (0–20) ou null. */
  current: number | null;
  /** % do peso total já avaliado. */
  gradedWeight: number;
  /** % do peso total registado em avaliações. */
  totalWeight: number;
  /** Nota média necessária no que falta para atingir o objetivo; null se nada falta. */
  needed: number | null;
  /** Nota final se tirar exatamente `needed`/a média atual no resto — útil para previsões. */
  projected: number | null;
}

export function gradeSummary(course: Course, assessments: Assessment[]): GradeSummary {
  const mine = assessments.filter((a) => a.courseId === course.id);
  const graded = mine.filter((a) => a.grade !== undefined);
  const totalWeight = mine.reduce((s, a) => s + a.weight, 0);
  const gradedWeight = graded.reduce((s, a) => s + a.weight, 0);
  const points = graded.reduce((s, a) => s + (a.grade as number) * a.weight, 0);
  const current = gradedWeight > 0 ? points / gradedWeight : null;
  const base = Math.max(totalWeight, 100);
  const remaining = base - gradedWeight;
  const needed = remaining > 0 ? (course.targetGrade * base - points) / remaining : null;
  const projected = current === null ? null : (points + current * remaining) / base;
  return { current, gradedWeight, totalWeight, needed, projected };
}

/** Média do semestre ponderada por ECTS (só cadeiras com notas). */
export function semesterAverage(courses: Course[], assessments: Assessment[]): number | null {
  let ects = 0;
  let sum = 0;
  for (const c of courses) {
    const g = gradeSummary(c, assessments).current;
    if (g !== null) { ects += c.ects; sum += g * c.ects; }
  }
  return ects > 0 ? sum / ects : null;
}

const topicValue: Record<Topic['status'], number> = { todo: 0, learning: 0.35, review: 0.75, done: 1 };

/** Progresso da matéria de uma cadeira, 0–1. */
export function topicProgress(course: Course): number {
  if (course.topics.length === 0) return 0;
  return course.topics.reduce((s, t) => s + topicValue[t.status], 0) / course.topics.length;
}

/** Avaliações futuras (ainda sem nota), ordenadas por data. */
export function upcomingAssessments(assessments: Assessment[], withinDays = Infinity): Assessment[] {
  return assessments
    .filter((a) => a.grade === undefined && daysUntil(a.date) >= 0 && daysUntil(a.date) <= withinDays)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Preparação para uma avaliação: progresso médio dos tópicos que ela cobre, 0–1. */
export function readiness(assessment: Assessment, course: Course | undefined): number {
  if (!course) return 0;
  const ts = course.topics.filter((t) => assessment.topicIds.includes(t.id));
  if (ts.length === 0) return topicProgress(course);
  return ts.reduce((s, t) => s + (topicValue[t.status] * 0.6 + (t.confidence / 5) * 0.4), 0) / ts.length;
}

/** Urgência 0–100: sobe com a proximidade, o peso e a falta de preparação. */
export function urgency(assessment: Assessment, course: Course | undefined): number {
  const days = Math.max(daysUntil(assessment.date), 0);
  const time = 1 / (1 + days / 7);
  const gap = 1 - readiness(assessment, course);
  const weight = 0.5 + assessment.weight / 200;
  return Math.round(Math.min(100, time * gap * weight * 160));
}

export const sessionMinutes = (s: StudySession) => (s.done ? s.actualMinutes ?? s.minutes : 0);

/** Minutos estudados (sessões concluídas) entre duas datas yyyy-MM-dd, inclusive. */
export function minutesStudied(sessions: StudySession[], from: string, to: string): number {
  return sessions.filter((s) => s.date >= from && s.date <= to).reduce((sum, s) => sum + sessionMinutes(s), 0);
}

export function minutesThisWeek(sessions: StudySession[]): number {
  const start = toDateStr(startOfWeek(new Date(), { weekStartsOn: 1 }));
  return minutesStudied(sessions, start, todayStr());
}

/** Dias seguidos (até hoje ou ontem) com pelo menos uma sessão concluída. */
export function studyStreak(sessions: StudySession[]): number {
  const days = new Set(sessions.filter((s) => s.done).map((s) => s.date));
  let cursor = new Date();
  if (!days.has(toDateStr(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(toDateStr(cursor))) { streak += 1; cursor = addDays(cursor, -1); }
  return streak;
}

export const fmtMinutes = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
};

export const fmtGrade = (g: number | null | undefined) =>
  g === null || g === undefined ? '—' : g.toFixed(1).replace('.', ',');
