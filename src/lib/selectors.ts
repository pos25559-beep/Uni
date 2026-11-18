// Cálculos partilhados (funções puras). Usar estes em vez de recalcular nas páginas.
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns';
import type { AppLanguage, Assessment, Course, GradingScale, StudySession, Topic } from '../types';
import { formatGradeByScale, normalizeAppLanguage, parseGradeByScale } from './grading';

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
  return course.topics.reduce((s, t) => s + (topicValue[t.status] ?? 0), 0) / course.topics.length;
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
  return (
    ts.reduce(
      (s, t) => s + ((topicValue[t.status] ?? 0) * 0.6 + ((t.confidence ?? 3) / 5) * 0.4),
      0,
    ) / ts.length
  );
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

export const fmtGrade = (
  g: number | null | undefined,
  scale: GradingScale = 'pt20',
  lang: AppLanguage = 'pt-PT',
) => formatGradeByScale(g, scale, lang);

/** Capitaliza apenas a primeira letra, preservando preposições portuguesas ("Sábado, 14 de novembro"). */
export const capitalizeFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** Lê nota em formato português ou decimal ("12,5" ou "12.5") dentro da escala configurada. */
export function parsePtGrade(
  raw: string,
  scale: GradingScale = 'pt20',
): number | null | 'invalid' {
  return parseGradeByScale(raw, scale);
}

const SYSTEM_SESSION_NOTES = new Set([
  'Foco Modo Teste',
  'Equilíbrio Modo Teste',
  'Prática para teste',
  'Revisão para teste',
  'Revisão total para teste',
  'Reforço pós-aula',
  'Reforçar dúvidas',
  'Reforço escolhido',
  'Bloco focado curto (reforço)',
  'Prática guiada',
  'Revisão espaçada (SRS)',
  'Revisão espaçada',
  'Revisão ativa',
  'Revisão geral',
  'Revisão rápida',
  'Estudar base',
  'Consolidação',
  'Praticar exercícios',
  'Manutenção · ritmo contínuo',
  'Reforço pós-aula · consolidação',
  'Reforço · consolidação',
  'Arranque contínuo · consolidação',
]);

const SESSION_NOTE_TRANSLATIONS: Record<string, Record<'pt-BR' | 'es' | 'en', string>> = {
  'Foco Modo Teste': { 'pt-BR': 'Foco Modo Prova', es: 'Foco Modo Examen', en: 'Exam Mode Focus' },
  'Equilíbrio Modo Teste': { 'pt-BR': 'Equilíbrio Modo Prova', es: 'Equilibrio Modo Examen', en: 'Balanced Exam Mode' },
  'Prática para teste': { 'pt-BR': 'Prática para prova', es: 'Práctica para examen', en: 'Exam practice' },
  'Revisão para teste': { 'pt-BR': 'Revisão para prova', es: 'Repaso para examen', en: 'Exam review' },
  'Revisão total para teste': { 'pt-BR': 'Revisão total para prova', es: 'Repaso completo para examen', en: 'Full exam review' },
  'Reforço pós-aula': { 'pt-BR': 'Reforço pós-aula', es: 'Refuerzo post-clase', en: 'After-class boost' },
  'Reforçar dúvidas': { 'pt-BR': 'Reforçar dúvidas', es: 'Reforzar dudas', en: 'Clarify tricky concepts' },
  'Reforço escolhido': { 'pt-BR': 'Reforço escolhido', es: 'Refuerzo elegido', en: 'Chosen boost' },
  'Bloco focado curto (reforço)': { 'pt-BR': 'Bloco curto focado (reforço)', es: 'Bloque corto enfocado (refuerzo)', en: 'Short focused boost' },
  'Prática guiada': { 'pt-BR': 'Prática guiada', es: 'Práctica guiada', en: 'Guided practice' },
  'Revisão espaçada (SRS)': { 'pt-BR': 'Revisão espaçada (SRS)', es: 'Repaso espaciado (SRS)', en: 'Spaced repetition (SRS)' },
  'Revisão espaçada': { 'pt-BR': 'Revisão espaçada', es: 'Repaso espaciado', en: 'Spaced review' },
  'Revisão ativa': { 'pt-BR': 'Revisão ativa', es: 'Repaso activo', en: 'Active review' },
  'Revisão geral': { 'pt-BR': 'Revisão geral', es: 'Repaso general', en: 'Full review' },
  'Revisão rápida': { 'pt-BR': 'Revisão rápida', es: 'Repaso rápido', en: 'Quick review' },
  'Estudar base': { 'pt-BR': 'Estudar base', es: 'Estudiar base', en: 'Core fundamentals' },
  Consolidação: { 'pt-BR': 'Consolidação', es: 'Consolidación', en: 'Consolidation' },
  'Praticar exercícios': { 'pt-BR': 'Praticar exercícios', es: 'Practicar ejercicios', en: 'Practice problems' },
  'Manutenção · ritmo contínuo': { 'pt-BR': 'Manutenção · ritmo contínuo', es: 'Mantenimiento · ritmo continuo', en: 'Maintenance · steady pace' },
  'Reforço pós-aula · consolidação': { 'pt-BR': 'Reforço pós-aula · consolidação', es: 'Refuerzo post-clase · consolidación', en: 'After-class boost · consolidation' },
  'Reforço · consolidação': { 'pt-BR': 'Reforço · consolidação', es: 'Refuerzo · consolidación', en: 'Boost · consolidation' },
  'Arranque contínuo · consolidação': { 'pt-BR': 'Início contínuo · consolidação', es: 'Inicio continuo · consolidación', en: 'Steady start · consolidation' },
  'Refazer testes antigos': { 'pt-BR': 'Refazer provas antigas', es: 'Hacer exámenes anteriores', en: 'Redo past tests' },
  'Resolver exames antigos': { 'pt-BR': 'Resolver provas anteriores', es: 'Resolver exámenes pasados', en: 'Solve past exams' },
  'Resolver exercícios práticos': { 'pt-BR': 'Resolver exercícios práticos', es: 'Resolver ejercicios prácticos', en: 'Solve practice problems' },
  'Rever resumos e slides': { 'pt-BR': 'Revisar resumos e slides', es: 'Repasar resúmenes y diapositivas', en: 'Review summaries & slides' },
  'Rever slides, apontamentos das aulas e livro': {
    'pt-BR': 'Revisar slides, anotações das aulas e livro',
    es: 'Repasar diapositivas, apuntes de clase y libro',
    en: 'Review slides, lecture notes & textbook',
  },
};

function localizeSessionNote(note: string, lang: AppLanguage): string {
  if (lang === 'pt-PT') return note;
  const exact = SESSION_NOTE_TRANSLATIONS[note]?.[lang];
  if (exact) return exact;
  const lower = note.toLowerCase();
  if (lower.startsWith('rever slides')) {
    return SESSION_NOTE_TRANSLATIONS['Rever slides, apontamentos das aulas e livro'][lang];
  }
  return note;
}

/** Formata o título e a etiqueta realistas de uma sessão de estudo (priorizando o foco alinhado pelo aluno). */
export function formatSessionDisplay(
  session: StudySession,
  topic?: { title: string },
  lang: AppLanguage | string = 'pt-PT',
): { title: string; badge?: string; isPersonalized: boolean } {
  const normalizedLang = normalizeAppLanguage(lang);
  const rawNote = session.notes?.trim();
  const note = rawNote ? localizeSessionNote(rawNote, normalizedLang) : undefined;
  const topicName = topic?.title.trim();
  const testModeBadge =
    normalizedLang === 'en'
      ? 'Exam Mode'
      : normalizedLang === 'es'
        ? 'Modo Examen'
        : normalizedLang === 'pt-BR'
          ? 'Modo Prova'
          : 'Modo Teste';
  const syncedBadge =
    normalizedLang === 'en'
      ? 'Synced w/ Uni'
      : normalizedLang === 'es'
        ? 'Alineado c/ Uni'
        : 'Alinhado c/ Uni';
  const freeStudyFallback =
    normalizedLang === 'en'
      ? 'Free study'
      : normalizedLang === 'es'
        ? 'Estudio libre'
        : 'Estudo livre';

  if (rawNote && !SYSTEM_SESSION_NOTES.has(rawNote) && note) {
    const redundant =
      topicName &&
      (note.toLowerCase().includes(topicName.toLowerCase()) ||
        topicName.toLowerCase().includes(note.toLowerCase()));
    return {
      title: topicName && !redundant ? `${note} · ${topicName}` : note,
      badge: session.assessmentId ? testModeBadge : syncedBadge,
      isPersonalized: true,
    };
  }
  return {
    title: topicName || note || freeStudyFallback,
    badge: topicName && note ? note : undefined,
    isPersonalized: false,
  };
}

/** Explica de forma transparente e localizada o "Porquê" de cada sessão agendada. */
export function formatSessionReason(
  session: StudySession,
  assessment: Assessment | undefined,
  lang: AppLanguage | string = 'pt-PT',
): string | undefined {
  const code = session.reason?.code;
  if (!code) return undefined;
  const l = normalizeAppLanguage(lang);
  const days = session.reason?.examDays;
  const weight = session.reason?.weight ?? assessment?.weight;
  const testTitle = assessment?.title;
  const examWord = l === 'pt-BR' ? 'prova' : l === 'es' ? 'examen' : l === 'en' ? 'exam' : 'teste';

  switch (code) {
    case 'exam_marathon': {
      const when =
        days === 0
          ? l === 'en' ? 'today' : l === 'es' ? 'hoy' : 'hoje'
          : days === 1
            ? l === 'en' ? 'tomorrow' : l === 'es' ? 'mañana' : 'amanhã'
            : days !== undefined
              ? l === 'en' ? `in ${days}d` : l === 'es' ? `en ${days}d` : `em ${days}d`
              : '';
      if (l === 'en') return `Pre-exam marathon${when ? ` (${examWord} ${when})` : ''}`;
      if (l === 'es') return `Maratón pre-examen${when ? ` (${examWord} ${when})` : ''}`;
      return `Maratona pré-${examWord}${when ? ` (${when})` : ''}`;
    }
    case 'exam_eve': {
      const label = testTitle || examWord;
      if (l === 'en') return `Final review · ${label} tomorrow`;
      if (l === 'es') return `Repaso general · ${label} mañana`;
      return `Revisão final · ${label} amanhã`;
    }
    case 'exam_prep': {
      const weightPart = weight ? ` (${weight}%)` : '';
      if (days !== undefined) {
        if (l === 'en') return `${testTitle || 'Exam'} in ${days}d${weightPart}`;
        if (l === 'es') return `${testTitle || 'Examen'} en ${days}d${weightPart}`;
        return `${testTitle || (l === 'pt-BR' ? 'Prova' : 'Teste')} em ${days}d${weightPart}`;
      }
      if (l === 'en') return `Priority exam prep${weightPart}`;
      if (l === 'es') return `Prioridad por evaluación${weightPart}`;
      return `Prioridade de avaliação${weightPart}`;
    }
    case 'srs_due':
      if (l === 'en') return 'Spaced recall due';
      if (l === 'es') return 'Repaso espaciado pendiente';
      return 'Revisão espaçada vencida';
    case 'weak_topic':
      if (l === 'en') return 'Reinforce low-confidence topic';
      if (l === 'es') return 'Reforzar tema con dudas';
      return 'Reforçar tópico com dúvidas';
    case 'briefing':
      if (session.reason?.label) return session.reason.label;
      if (l === 'en') return 'Based on your Uni briefing';
      if (l === 'es') return 'Según tus indicaciones al Uni';
      return l === 'pt-BR' ? 'Pelo seu pedido ao Uni' : 'Pelo teu pedido ao Uni';
    case 'overdue':
      if (l === 'en') return 'Rescheduled overdue block';
      if (l === 'es') return 'Reprogramado de días anteriores';
      return 'Recuperação de sessão em atraso';
    case 'starter':
      if (l === 'en') return 'Steady semester rhythm';
      if (l === 'es') return 'Ritmo continuo del semestre';
      return 'Ritmo contínuo do semestre';
    case 'coverage':
    default:
      if (l === 'en') return 'Syllabus progression';
      if (l === 'es') return 'Avance de temario';
      return 'Avanço da matéria';
  }
}

