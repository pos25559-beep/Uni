import { formatDistanceToNow, parseISO } from 'date-fns';
import { tr } from '../../i18n/tr';
import { appDateLocale as pt } from '../../lib/dateLocale';

export function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt });
}

export function errorMessage(e: unknown, fallback = tr('settings:shared.unexpectedError')): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
