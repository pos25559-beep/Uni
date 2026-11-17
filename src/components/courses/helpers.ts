import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import i18n from '../../i18n';
import { normalizeAppLanguage, resolveDateFnsLocale } from '../../lib/grading';
import type { AppLanguage, Assessment, ClassSlot, TopicStatus } from '../../types';

const activeLang = (lang?: AppLanguage | string) => lang ?? i18n.language ?? 'pt-PT';

/** Dias até/desde uma data (yyyy-MM-dd ou ISO) em relação a hoje. */
const dayDiff = (iso: string) => differenceInCalendarDays(parseISO(iso), new Date());

/** Rótulo relativo para prazos: "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function dueLabel(iso: string, lang?: AppLanguage | string): string {
  const normalized = normalizeAppLanguage(activeLang(lang));
  const d = dayDiff(iso);
  if (normalized === 'en') {
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d === -1) return 'yesterday';
    if (d > 1) return `in ${d} days`;
    return `${-d} days ago`;
  }
  if (normalized === 'es') {
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d === -1) return 'ayer';
    if (d > 1) return `en ${d} días`;
    return `hace ${-d} días`;
  }
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  if (d > 1) return `em ${d} dias`;
  return `há ${-d} dias`;
}

/** Rótulo para "última vez estudada". */
export function lastStudiedLabel(iso?: string, lang?: AppLanguage | string): string {
  const normalized = normalizeAppLanguage(activeLang(lang));
  if (!iso) {
    return normalized === 'en'
      ? 'Never studied'
      : normalized === 'es'
        ? 'Nunca estudiada'
        : 'Nunca estudada';
  }
  const d = -dayDiff(iso);
  if (normalized === 'en') {
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    return `${d} days ago`;
  }
  if (normalized === 'es') {
    if (d <= 0) return 'hoy';
    if (d === 1) return 'ayer';
    return `hace ${d} días`;
  }
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

/** "3 dez · 14:00" para avaliações. */
export const fmtAssessmentDate = (iso: string, lang?: AppLanguage | string) =>
  format(parseISO(iso), 'd MMM yyyy · HH:mm', { locale: resolveDateFnsLocale(activeLang(lang)) });

/** "3 dez" para datas simples. */
export const fmtShortDate = (iso: string, lang?: AppLanguage | string) =>
  format(parseISO(iso), 'd MMM', { locale: resolveDateFnsLocale(activeLang(lang)) });

/** Valor no formato YYYY-MM-DDTHH:mm (DateTimeField). */
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
