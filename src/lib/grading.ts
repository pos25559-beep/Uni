import { enGB, es as esLocale, pt as ptLocale, ptBR, type Locale } from 'date-fns/locale';
import type { AppLanguage, GradingScale } from '../types';

export interface GradeScaleMeta {
  id: GradingScale;
  label: string;
  labelEn: string;
  labelEs: string;
  labelPtBr: string;
  max: number;
  passing: number;
  decimals: number;
  suffix: string;
}

export const GRADE_SCALES: Record<GradingScale, GradeScaleMeta> = {
  pt20: {
    id: 'pt20',
    label: '0–20 (Portugal)',
    labelEn: '0–20 (Portugal)',
    labelEs: '0–20 (Portugal)',
    labelPtBr: '0–20 (Portugal)',
    max: 20,
    passing: 9.5,
    decimals: 1,
    suffix: '/20',
  },
  scale10: {
    id: 'scale10',
    label: '0–10 (Espanha / Brasil)',
    labelEn: '0–10 (Spain / Brazil)',
    labelEs: '0–10 (España / Brasil)',
    labelPtBr: '0–10 (Brasil / Espanha)',
    max: 10,
    passing: 5,
    decimals: 1,
    suffix: '/10',
  },
  pct100: {
    id: 'pct100',
    label: '0–100% (Percentagem)',
    labelEn: '0–100% (Percentage)',
    labelEs: '0–100% (Porcentaje)',
    labelPtBr: '0–100% (Porcentagem)',
    max: 100,
    passing: 50,
    decimals: 0,
    suffix: '%',
  },
};

export function normalizeAppLanguage(language?: string | null): AppLanguage {
  const lower = String(language ?? '').trim().toLowerCase();
  if (lower === 'pt-br' || lower === 'pt_br') return 'pt-BR';
  if (lower === 'es' || lower.startsWith('es-') || lower.startsWith('es_')) return 'es';
  if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_')) return 'en';
  return 'pt-PT';
}

/**
 * Língua do sistema (telemóvel ou navegador). Percorre `navigator.languages` por ordem de
 * preferência e devolve a primeira suportada; qualquer variante de português que não seja
 * do Brasil (pt, pt-PT, pt-AO, pt-MZ…) fica em pt-PT. Sem navegador (testes), pt-PT.
 */
export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'pt-PT';
  const list = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean);
  for (const raw of list) {
    const lower = raw.toLowerCase();
    if (lower === 'pt-br') return 'pt-BR';
    if (lower === 'pt' || lower.startsWith('pt-')) return 'pt-PT';
    if (lower === 'es' || lower.startsWith('es-')) return 'es';
    if (lower === 'en' || lower.startsWith('en-')) return 'en';
  }
  return 'pt-PT';
}

export function resolveIntlLocale(language: AppLanguage | string = 'pt-PT'): string {
  const normalized = normalizeAppLanguage(language);
  if (normalized === 'en') return 'en-GB';
  if (normalized === 'pt-BR') return 'pt-BR';
  if (normalized === 'es') return 'es-ES';
  return 'pt-PT';
}

export function resolveDateFnsLocale(language: AppLanguage | string = 'pt-PT'): Locale {
  const normalized = normalizeAppLanguage(language);
  if (normalized === 'en') return enGB;
  if (normalized === 'pt-BR') return ptBR;
  if (normalized === 'es') return esLocale;
  return ptLocale;
}

export function getLocalizedScaleLabel(
  scale: GradingScale,
  language: AppLanguage | string = 'pt-PT',
): string {
  const meta = GRADE_SCALES[scale] ?? GRADE_SCALES.pt20;
  const lang = normalizeAppLanguage(language);
  if (lang === 'en') return meta.labelEn;
  if (lang === 'es') return meta.labelEs;
  if (lang === 'pt-BR') return meta.labelPtBr;
  return meta.label;
}

export function defaultGradingScaleForLanguage(language: AppLanguage | string = 'pt-PT'): GradingScale {
  const lang = normalizeAppLanguage(language);
  if (lang === 'pt-BR' || lang === 'es') return 'scale10';
  if (lang === 'en') return 'pct100';
  return 'pt20';
}

export function formatAppNumber(
  value: number,
  language: AppLanguage | string = 'pt-PT',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(resolveIntlLocale(language), options).format(value);
}

export function formatAppDate(
  isoOrDate: string | Date,
  language: AppLanguage | string = 'pt-PT',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return typeof isoOrDate === 'string' ? isoOrDate : '';
  return new Intl.DateTimeFormat(resolveIntlLocale(language), options).format(date);
}

/** Converte qualquer nota na escala configurada para percentagem normalizada (0–100). */
export function gradeToPercent(grade: number, scale: GradingScale = 'pt20'): number {
  const meta = GRADE_SCALES[scale] ?? GRADE_SCALES.pt20;
  return Math.max(0, Math.min(100, (grade / meta.max) * 100));
}

/** Converte percentagem (0–100) para a escala configurada. */
export function percentToGradeByScale(pct: number, scale: GradingScale = 'pt20'): number {
  const meta = GRADE_SCALES[scale] ?? GRADE_SCALES.pt20;
  const raw = (Math.max(0, Math.min(100, pct)) / 100) * meta.max;
  const factor = Math.pow(10, meta.decimals);
  return Math.round(raw * factor) / factor;
}

/** Formata uma nota na escala ativa usando `Intl.NumberFormat`. */
export function formatGradeByScale(
  grade: number | null | undefined,
  scale: GradingScale = 'pt20',
  language: AppLanguage | string = 'pt-PT',
): string {
  if (grade === null || grade === undefined || Number.isNaN(grade)) return '—';
  const meta = GRADE_SCALES[scale] ?? GRADE_SCALES.pt20;
  const formatted = formatAppNumber(grade, language, {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return scale === 'pct100' ? `${formatted}%` : formatted;
}

/** Faz parse flexível de uma nota (com vírgula ou ponto) respeitando o máximo da escala ativa. */
export function parseGradeByScale(
  raw: string,
  scale: GradingScale = 'pt20',
): number | null | 'invalid' {
  const clean = raw.trim().replace(/\s+/g, '');
  if (clean === '') return null;
  const normalized = clean.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 'invalid';
  const n = Number(normalized);
  const meta = GRADE_SCALES[scale] ?? GRADE_SCALES.pt20;
  if (!Number.isFinite(n) || n < 0 || n > meta.max) return 'invalid';
  return Math.round(n * 100) / 100;
}
