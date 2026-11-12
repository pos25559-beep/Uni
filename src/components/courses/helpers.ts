import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Assessment, ClassSlot, TopicStatus } from '../../types';

/** Dias até/desde uma data (yyyy-MM-dd ou ISO) em relação a hoje. */
const dayDiff = (iso: string) => differenceInCalendarDays(parseISO(iso), new Date());

/** Rótulo relativo para prazos: "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function dueLabel(iso: string): string {
  const d = dayDiff(iso);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  if (d > 1) return `em ${d} dias`;
  return `há ${-d} dias`;
}

/** Rótulo para "última vez estudada". */
export function lastStudiedLabel(iso?: string): string {
  if (!iso) return 'Nunca estudada';
  const d = -dayDiff(iso);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

/** "3 dez · 14:00" para avaliações. */
export const fmtAssessmentDate = (iso: string) =>
  format(parseISO(iso), "d MMM yyyy 'às' HH:mm", { locale: pt });

/** "3 dez" para datas simples. */
export const fmtShortDate = (iso: string) => format(parseISO(iso), 'd MMM', { locale: pt });

/** Valor para <input type="datetime-local">. */
export const toDatetimeLocal = (iso: string) => iso.slice(0, 16);

/** Converte o valor de datetime-local para ISO sem fuso (yyyy-MM-ddTHH:mm:ss). */
export const fromDatetimeLocal = (value: string) => (value.length === 16 ? `${value}:00` : value);

export const topicStatuses: TopicStatus[] = ['todo', 'learning', 'review', 'done'];

/** Ordem de apresentação dos dias: segunda a domingo. */
export const weekOrder = [1, 2, 3, 4, 5, 6, 0];

/** Ordena avaliações por data (cópia; não muta o array de entrada). */
export const sortAssessments = (list: Assessment[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

export const sortSlots = (list: ClassSlot[]) =>
  [...list].sort((a, b) => a.start.localeCompare(b.start));

/** Converte um texto de URL para uma URL absoluta, acrescentando https:// se faltar o protocolo. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return null;
  }
}
