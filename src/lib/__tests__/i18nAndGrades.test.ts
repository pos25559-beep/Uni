import { describe, expect, it } from 'vitest';
import { I18N_NAMESPACES, resources } from '../../i18n';
import {
  formatGradeByScale,
  gradeToPercent,
  parseGradeByScale,
  percentToGradeByScale,
} from '../grading';
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

describe('i18n parity and grading scales', () => {
  it('maintains identical translation keys between pt-PT and en across all namespaces', () => {
    for (const ns of I18N_NAMESPACES) {
      const ptKeys = flattenKeys(resources['pt-PT'][ns] as unknown as Record<string, unknown>);
      const enKeys = flattenKeys(resources.en[ns] as unknown as Record<string, unknown>);
      expect(enKeys).toEqual(ptKeys);
    }
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
  });

  it('exposes all 5 localized personas and recommends course base forms', () => {
    const ptPersonas = getLocalizedPersonas('pt-PT');
    const enPersonas = getLocalizedPersonas('en');
    expect(ptPersonas.map((p) => p.id)).toEqual(['amigo', 'exigente', 'calmo', 'curioso', 'treinador']);
    expect(enPersonas).toHaveLength(5);
    expect(enPersonas[3]?.label).toBe('Curious');

    expect(suggestFormForCourse({ name: 'Análise Matemática II', shortName: 'AM2' })).toBe('cristal');
    expect(suggestFormForCourse({ name: 'Engenharia de Software', shortName: 'ES' })).toBe('estrela');
    expect(suggestFormForCourse({ name: 'Fisiologia Humana', shortName: 'FH' })).toBe('gota');
    expect(suggestFormForCourse({ name: 'Química Orgânica', shortName: 'QO' })).toBe('folha');
  });
});
