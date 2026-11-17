// Metadados visuais partilhados pelas vistas do calendário.
import { BookOpen, Brain, CalendarDays, CheckSquare, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tr } from '../../i18n/tr';
import { courseColors } from '../../lib/colors';
import type { Course, Source } from '../../types';
import { cx } from '../../lib/uiHelpers';
import type { CalItem, CalKind } from './items';

const kindMeta = (kind: CalKind, icon: LucideIcon, dot: string) => ({
  get label() {
    return tr(`plan:cal.kind.${kind}`);
  },
  get plural() {
    return tr(`plan:cal.kind.${kind}Plural`);
  },
  icon,
  dot,
});

export const KIND_META: Record<CalKind, { label: string; plural: string; icon: LucideIcon; dot: string }> = {
  aula: kindMeta('aula', BookOpen, 'bg-accent'),
  avaliacao: kindMeta('avaliacao', GraduationCap, 'bg-danger'),
  estudo: kindMeta('estudo', Brain, 'bg-ok'),
  evento: kindMeta('evento', CalendarDays, 'bg-warn'),
  tarefa: kindMeta('tarefa', CheckSquare, 'bg-muted'),
};

export const KIND_ORDER: CalKind[] = ['aula', 'avaliacao', 'estudo', 'evento', 'tarefa'];

export const SOURCE_LABEL: Record<Source, string> = {
  get local() { return tr('plan:cal.source.local'); },
  get clip() { return tr('plan:cal.source.clip'); },
  get google() { return tr('plan:cal.source.google'); },
  get outlook() { return tr('plan:cal.source.outlook'); },
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
  if (item.kind === 'tarefa') return tr('plan:cal.dueLabel');
  return tr('plan:cal.allDay');
}

export const isImported = (item: CalItem) => item.source !== undefined && item.source !== 'local';
