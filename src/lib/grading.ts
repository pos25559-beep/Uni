import type { AppLanguage, GradingScale } from '../types';

export interface GradeScaleMeta {
  id: GradingScale;
  label: string;
  labelEn: string;
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
    max: 20,
    passing: 9.5,
    decimals: 1,
    suffix: '/20',
  },
  scale10: {
    id: 'scale10',
    label: '0–10 (Espanha / Brasil)',
    labelEn: '0–10 (Spain / Brazil)',
    max: 10,
    passing: 5,
    decimals: 1,
    suffix: '/10',
  },
  pct100: {
    id: 'pct100',
    label: '0–100% (Percentagem)',
    labelEn: '0–100% (Percentage)',
    max: 100,
    passing: 50,
    decimals: 0,
    suffix: '%',
  },
};

export function resolveIntlLocale(language: AppLanguage = 'pt-PT'): string {
  return language === 'en' ? 'en-GB' : 'pt-PT';
}

export function formatAppNumber(
  value: number,
  language: AppLanguage = 'pt-PT',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(resolveIntlLocale(language), options).format(value);
}

export function formatAppDate(
  isoOrDate: string | Date,
  language: AppLanguage = 'pt-PT',
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
  language: AppLanguage = 'pt-PT',
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
