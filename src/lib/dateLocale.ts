import type { Locale } from 'date-fns';
import { pt as ptLocale } from 'date-fns/locale';
import i18n from '../i18n';
import { resolveDateFnsLocale } from './grading';

/**
 * Locale do date-fns que segue a língua ativa da app. Substitui o `pt` fixo:
 * cada leitura de propriedade (localize, formatLong, …) vai ao locale da língua atual.
 */
export const appDateLocale: Locale = new Proxy(ptLocale, {
  get(_target, prop) {
    const active = resolveDateFnsLocale(i18n.language || 'pt-PT') as unknown as Record<PropertyKey, unknown>;
    return active[prop];
  },
}) as Locale;

/** Padrão de data longa com dia da semana, sem o «de» português noutras línguas. */
export function longDatePattern(withWeekday = true): string {
  const lang = i18n.language || 'pt-PT';
  if (lang === 'en') return withWeekday ? 'EEEE, d MMMM' : 'd MMMM';
  return withWeekday ? "EEEE, d 'de' MMMM" : "d 'de' MMMM";
}

/** Data longa com hora: «às» só em português; vírgula nas outras línguas. */
export function longDateTimePattern(withWeekday = true): string {
  const lang = i18n.language || 'pt-PT';
  const base = longDatePattern(withWeekday);
  return lang.startsWith('pt') ? `${base} 'às' HH:mm` : `${base}, HH:mm`;
}

/** Data completa com ano: «16 de novembro de 2026» / «16 November 2026». */
export function fullDatePattern(): string {
  const lang = i18n.language || 'pt-PT';
  return lang === 'en' ? 'd MMMM yyyy' : "d 'de' MMMM 'de' yyyy";
}
