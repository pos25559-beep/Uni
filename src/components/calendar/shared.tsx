// Metadados visuais partilhados pelas vistas do calendário.
import { BookOpen, Brain, CalendarDays, CheckSquare, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { courseColors } from '../../lib/colors';
import type { Course, Source } from '../../types';
import { cx } from '../ui';
import type { CalItem, CalKind } from './items';

export const KIND_META: Record<CalKind, { label: string; plural: string; icon: LucideIcon; dot: string }> = {
  aula: { label: 'Aula', plural: 'Aulas', icon: BookOpen, dot: 'bg-accent' },
  avaliacao: { label: 'Avaliação', plural: 'Avaliações', icon: GraduationCap, dot: 'bg-danger' },
  estudo: { label: 'Estudo', plural: 'Estudo', icon: Brain, dot: 'bg-ok' },
  evento: { label: 'Evento', plural: 'Eventos', icon: CalendarDays, dot: 'bg-warn' },
  tarefa: { label: 'Tarefa', plural: 'Tarefas', icon: CheckSquare, dot: 'bg-muted' },
};

export const KIND_ORDER: CalKind[] = ['aula', 'avaliacao', 'estudo', 'evento', 'tarefa'];

export const SOURCE_LABEL: Record<Source, string> = {
  local: 'Local', clip: 'CLIP', google: 'Google', outlook: 'Outlook',
};

/** Classes visuais de um item: cor da cadeira; avaliações com borda forte; tarefas tracejadas. */
export function itemTone(item: CalItem, course?: Course): string {
  if (item.kind === 'tarefa') return 'border border-dashed border-muted/50 bg-surface-2 text-fg';
  if (!course) return 'border border-line bg-surface-2 text-fg';
  const c = courseColors[course.color];
  if (item.kind === 'avaliacao') return cx('border-2 bg-surface font-semibold', c.border, c.text);
  return c.soft;
}

/** Cor sólida (bolinha) de um item. */
export function itemDot(item: CalItem, course?: Course): string {
  return course ? courseColors[course.color].dot : KIND_META[item.kind].dot;
}

export function timeLabel(item: CalItem): string {
  if (item.start && item.end) return `${item.start}–${item.end}`;
  if (item.start) return item.start;
  if (item.kind === 'estudo' && item.minutes) return `${item.minutes} min`;
  if (item.kind === 'tarefa') return 'Prazo';
  return 'Dia todo';
}

export const isImported = (item: CalItem) => item.source !== undefined && item.source !== 'local';
