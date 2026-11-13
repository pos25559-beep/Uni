import type { AssessmentKind, CourseColor, MaterialProvider, TopicStatus } from '../types';

// Classes completas e estáticas (o Tailwind precisa de as ver por extenso).
export const courseColors: Record<
  CourseColor,
  { dot: string; soft: string; text: string; border: string; tint: string; hex: string }
> = {
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-500/35',
    tint: 'bg-violet-50/85 dark:bg-violet-950/35 border-violet-200/80 dark:border-violet-800/45',
    hex: '#8b5cf6',
  },
  sky: {
    dot: 'bg-sky-500',
    soft: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/35',
    tint: 'bg-sky-50/85 dark:bg-sky-950/35 border-sky-200/80 dark:border-sky-800/45',
    hex: '#0ea5e9',
  },
  emerald: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/35',
    tint: 'bg-emerald-50/85 dark:bg-emerald-950/35 border-emerald-200/80 dark:border-emerald-800/45',
    hex: '#10b981',
  },
  amber: {
    dot: 'bg-amber-500',
    soft: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-500/35',
    tint: 'bg-amber-50/85 dark:bg-amber-950/35 border-amber-200/80 dark:border-amber-800/45',
    hex: '#f59e0b',
  },
  rose: {
    dot: 'bg-rose-500',
    soft: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/35',
    tint: 'bg-rose-50/85 dark:bg-rose-950/35 border-rose-200/80 dark:border-rose-800/45',
    hex: '#f43f5e',
  },
  cyan: {
    dot: 'bg-cyan-500',
    soft: 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-500/35',
    tint: 'bg-cyan-50/85 dark:bg-cyan-950/35 border-cyan-200/80 dark:border-cyan-800/45',
    hex: '#06b6d4',
  },
  orange: {
    dot: 'bg-orange-500',
    soft: 'bg-orange-500/12 text-orange-800 dark:text-orange-300',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-500/35',
    tint: 'bg-orange-50/85 dark:bg-orange-950/35 border-orange-200/80 dark:border-orange-800/45',
    hex: '#f97316',
  },
  lime: {
    dot: 'bg-lime-500',
    soft: 'bg-lime-500/12 text-lime-800 dark:text-lime-300',
    text: 'text-lime-800 dark:text-lime-300',
    border: 'border-lime-500/35',
    tint: 'bg-lime-50/85 dark:bg-lime-950/35 border-lime-200/80 dark:border-lime-800/45',
    hex: '#84cc16',
  },
};

export const colorNames = Object.keys(courseColors) as CourseColor[];

export const kindLabel: Record<AssessmentKind, string> = {
  exame: 'Exame', teste: 'Teste', trabalho: 'Trabalho', projeto: 'Projeto', quiz: 'Quiz',
};

export const statusLabel: Record<TopicStatus, string> = {
  todo: 'Por estudar', learning: 'A aprender', review: 'Em revisão', done: 'Dominado',
};

export const providerLabel: Record<MaterialProvider, string> = {
  gdrive: 'Google Drive', onedrive: 'OneDrive', notebooklm: 'NotebookLM', clip: 'CLIP', link: 'Link', upload: 'Ficheiro',
};

export const weekdayShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const weekdayLong = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
