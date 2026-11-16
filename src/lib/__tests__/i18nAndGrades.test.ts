import { describe, expect, it } from 'vitest';
import { I18N_NAMESPACES, resources, SUPPORTED_LANGUAGES } from '../../i18n';
import {
  defaultGradingScaleForLanguage,
  formatGradeByScale,
  gradeToPercent,
  normalizeAppLanguage,
  parseGradeByScale,
  percentToGradeByScale,
  resolveIntlLocale,
} from '../grading';
import { defaultScaleForUniversity, getUniversitiesByCountry } from '../portugalCurriculum';
import { getLocalizedPersonas, suggestFormForCourse } from '../uniAccessories';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('i18n parity, regional vocabulary, curriculum packs, and grading scales', () => {
  it('maintains 100% key parity across pt-PT, pt-BR, es, and en in all namespaces', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['pt-PT', 'pt-BR', 'es', 'en']);
    for (const ns of I18N_NAMESPACES) {
      const baseKeys = flattenKeys(resources['pt-PT'][ns] as unknown as Record<string, unknown>);
      for (const lang of SUPPORTED_LANGUAGES) {
        const langKeys = flattenKeys(resources[lang][ns] as unknown as Record<string, unknown>);
        expect(langKeys, `Key mismatch in namespace "${ns}" for "${lang}"`).toEqual(baseKeys);
      }
    }
  });

  it('uses distinct native academic vocabulary per region (cadeira / disciplina / asignatura)', () => {
    expect(resources['pt-PT'].common.nav.courses).toBe('Cadeiras');
    expect(resources['pt-BR'].common.nav.courses).toBe('Disciplinas');
    expect(resources.es.common.nav.courses).toBe('Asignaturas');
    expect(resources.en.common.nav.courses).toBe('Courses');
  });

  it('normalizes language tags and resolves Intl locales accurately', () => {
    expect(normalizeAppLanguage('pt_br')).toBe('pt-BR');
    expect(normalizeAppLanguage('es-ES')).toBe('es');
    expect(normalizeAppLanguage('en-US')).toBe('en');
    expect(normalizeAppLanguage('pt-PT')).toBe('pt-PT');

    expect(resolveIntlLocale('pt-PT')).toBe('pt-PT');
    expect(resolveIntlLocale('pt-BR')).toBe('pt-BR');
    expect(resolveIntlLocale('es')).toBe('es-ES');
    expect(resolveIntlLocale('en')).toBe('en-GB');

    expect(defaultGradingScaleForLanguage('pt-PT')).toBe('pt20');
    expect(defaultGradingScaleForLanguage('pt-BR')).toBe('scale10');
    expect(defaultGradingScaleForLanguage('es')).toBe('scale10');
  });

  it('converts, validates, and formats grades across pt20, scale10, and pct100 scales', () => {
    expect(gradeToPercent(15, 'pt20')).toBe(75);
    expect(gradeToPercent(7.5, 'scale10')).toBe(75);
    expect(gradeToPercent(75, 'pct100')).toBe(75);

    expect(percentToGradeByScale(75, 'scale10')).toBe(7.5);
    expect(percentToGradeByScale(82.4, 'pct100')).toBe(82);

    expect(parseGradeByScale('9,5', 'scale10')).toBe(9.5);
    expect(parseGradeByScale('11', 'scale10')).toBe('invalid');
    expect(parseGradeByScale('88', 'pct100')).toBe(88);
    expect(parseGradeByScale('105', 'pct100')).toBe('invalid');

    expect(formatGradeByScale(88, 'pct100', 'en')).toBe('88%');
    expect(formatGradeByScale(16.5, 'pt20', 'en')).toBe('16.5');
    expect(formatGradeByScale(16.5, 'pt20', 'pt-PT')).toBe('16,5');
    expect(formatGradeByScale(8.5, 'scale10', 'pt-BR')).toBe('8,5');
    expect(formatGradeByScale(8.5, 'scale10', 'es')).toBe('8,5');
  });

  it('exposes multi-country curriculum packs with appropriate default grading scales', () => {
    expect(getUniversitiesByCountry('PT').length).toBeGreaterThanOrEqual(5);
    expect(getUniversitiesByCountry('ES').length).toBeGreaterThanOrEqual(2);
    expect(getUniversitiesByCountry('BR').length).toBeGreaterThanOrEqual(2);

    expect(defaultScaleForUniversity('fct-nova')).toBe('pt20');
    expect(defaultScaleForUniversity('upm-es')).toBe('scale10');
    expect(defaultScaleForUniversity('usp-br')).toBe('scale10');
  });

  it('exposes localized personas across all 4 languages and suggests course forms', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const personas = getLocalizedPersonas(lang);
      expect(personas.map((p) => p.id)).toEqual(['amigo', 'exigente', 'calmo', 'curioso', 'treinador']);
    }
    expect(getLocalizedPersonas('en')[3]?.label).toBe('Curious');
    expect(getLocalizedPersonas('es')[0]?.label).toBe('Cercano');
    expect(getLocalizedPersonas('pt-BR')[0]?.label).toBe('Parceiro');

    expect(suggestFormForCourse({ name: 'Análise Matemática II', shortName: 'AM2' })).toBe('cristal');
    expect(suggestFormForCourse({ name: 'Engenharia de Software', shortName: 'ES' })).toBe('estrela');
    expect(suggestFormForCourse({ name: 'Fisiologia Humana', shortName: 'FH' })).toBe('gota');
    expect(suggestFormForCourse({ name: 'Química Orgânica', shortName: 'QO' })).toBe('folha');
  });
});
