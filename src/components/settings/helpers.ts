import { formatDistanceToNow, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt });
}

export function errorMessage(e: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
