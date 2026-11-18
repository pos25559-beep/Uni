import { beforeAll, describe, expect, it } from 'vitest';
import i18n, { I18N_NAMESPACES, initAppI18n, preloadAllLanguages, resources, SUPPORTED_LANGUAGES } from '../../i18n';
import { tr } from '../../i18n/tr';
import { fmtDec, fmtHours, periodRange, plannedByWeek, studyByBucket } from '../../components/progress/data';
import { buildStudyContext } from '../../integrations/gemini';
import { buildDemoPayload } from '../demoSeed';
import {
  defaultGradingScaleForLanguage,
  formatGradeByScale,
  gradeToPercent,
  normalizeAppLanguage,
  normalizeTargetGradeForScale,
  parseGradeByScale,
  percentToGradeByScale,
  resolveIntlLocale,
} from '../grading';
import { defaultScaleForUniversity, getUniversitiesByCountry } from '../portugalCurriculum';
import { formatSessionDisplay } from '../selectors';
import { getLocalizedAccessories, getLocalizedPersonas, suggestFormForCourse } from '../uniAccessories';
import { computeUniCompanionState, getUniCollectibleStates, getUniPetStates } from '../uniCollectibles';
import { useStore } from '../../store/useStore';

function flattenEntries(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flattenEntries(v as Record<string, unknown>, path));
    } else {
      entries.push([path, String(v ?? '')]);
    }
  }
  return entries.sort((a, b) => a[0].localeCompare(b[0]));
}

describe('i18n parity, regional vocabulary, curriculum packs, and grading scales', () => {
  beforeAll(async () => {
    await preloadAllLanguages();
  });

  it('maintains 100% key parity and non-empty translations across pt-PT, pt-BR, es, and en in all namespaces', () => {
    const OPTIONAL_EMPTY_KEYS = new Set([
      'settings:geminiGuide.compareBodyPrefix',
      'legal:common.translationNote',
    ]);
    expect(SUPPORTED_LANGUAGES).toEqual(['pt-PT', 'pt-BR', 'es', 'en']);
    for (const ns of I18N_NAMESPACES) {
      const baseEntries = flattenEntries(resources['pt-PT'][ns] as unknown as Record<string, unknown>);
      const baseKeys = baseEntries.map(([k]) => k);
      for (const lang of SUPPORTED_LANGUAGES) {
        const langEntries = flattenEntries(resources[lang][ns] as unknown as Record<string, unknown>);
        expect(langEntries.map(([k]) => k), `Key mismatch in namespace "${ns}" for "${lang}"`).toEqual(baseKeys);
        const emptyKeys = langEntries
          .filter(([k, v]) => !OPTIONAL_EMPTY_KEYS.has(`${ns}:${k}`) && v.trim().length === 0)
          .map(([k]) => k);
        expect(emptyKeys, `Empty translation in "${ns}" for "${lang}"`).toEqual([]);
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

    expect(normalizeTargetGradeForScale(14, 'pt20')).toBe(14);
    expect(normalizeTargetGradeForScale(14, 'scale10')).toBe(7);
    expect(normalizeTargetGradeForScale(7.5, 'scale10')).toBe(7.5);
    expect(normalizeTargetGradeForScale(14, 'pct100')).toBe(70);
    expect(normalizeTargetGradeForScale(80, 'pct100')).toBe(80);
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

  it('persists pt-PT, pt-BR, es, and en in useStore and syncs i18n.language without reverting', () => {
    initAppI18n('pt-PT');
    for (const lang of SUPPORTED_LANGUAGES) {
      useStore.getState().updateSettings({ language: lang });
      expect(useStore.getState().settings.language).toBe(lang);
      expect(i18n.language).toBe(lang);
      expect(getLocalizedAccessories(lang).length).toBeGreaterThan(0);
    }
    const sampleSession = {
      id: 's1',
      courseId: 'c1',
      date: '2026-11-16',
      minutes: 50,
      done: false,
      notes: 'Refazer testes antigos',
      generated: true,
    };
    const topic = { title: 'Plasticidade aplicada' };
    expect(formatSessionDisplay(sampleSession, topic, 'pt-PT').title).toBe('Refazer testes antigos · Plasticidade aplicada');
    expect(formatSessionDisplay(sampleSession, topic, 'pt-BR').title).toBe('Refazer provas antigas · Plasticidade aplicada');
    expect(formatSessionDisplay(sampleSession, topic, 'es').title).toBe('Hacer exámenes anteriores · Plasticidade aplicada');
    expect(formatSessionDisplay(sampleSession, topic, 'en').title).toBe('Redo past tests · Plasticidade aplicada');

    const spacedSession = { ...sampleSession, notes: 'Revisão espaçada' };
    expect(formatSessionDisplay(spacedSession, topic, 'en')).toEqual({
      title: 'Plasticidade aplicada',
      badge: 'Spaced review',
      isPersonalized: false,
    });
    expect(formatSessionDisplay({ ...sampleSession, notes: 'Revisão total para teste' }, topic, 'es').badge).toBe(
      'Repaso completo para examen',
    );
    useStore.getState().updateSettings({ language: 'pt-PT' });
  });

  it('resolves plurals, new service errors, and collectibles cleanly in all 4 languages', () => {
    const newErrorKeys = [
      'attUnsupported',
      'attTooLarge',
      'attReadFail',
      'aiEmptyReply',
      'aiConsentRequired',
      'notebookEmptySources',
      'notebookGenFail',
      'practiceCardsFail',
      'checkInFallbackReply',
      'sheetEmptySources',
      'sheetExtractFail',
      'nativeAiTimeout',
      'nativeAiQuota',
      'nativeAiUnavailable',
      'nativeAiGeneric',
      'restHttpError',
      'restBlocked',
      'restEmpty',
      'verifyKeyEmpty',
      'verifyKeyListErr',
      'verifyKeyProbeErr',
      'googleAuthCancelled',
      'reauthPasswordRequired',
      'reauthRequired',
      'cloudSignInToShare',
      'cloudSignInToSync',
    ] as const;

    for (const lang of SUPPORTED_LANGUAGES) {
      expect(tr('common:googleSvc.calSynced', { count: 1 }, lang)).not.toContain('calSynced');
      expect(tr('common:googleSvc.calSynced', { count: 3 }, lang)).toContain('3');
      for (const errKey of newErrorKeys) {
        const msg = tr(
          `common:errors.${errKey}`,
          { name: 'doc.pdf', seconds: 25, status: 500, reason: 'SAFETY' },
          lang,
        );
        expect(msg, `Missing/raw key ${errKey} in ${lang}`).not.toBe(`common:errors.${errKey}`);
        expect(msg.trim().length).toBeGreaterThan(0);
      }

      const skins = getUniCollectibleStates(
        { completedSessions: 0, totalRecalls: 0, streakDays: 0, checkInsCount: 0, mastered21dCount: 0 },
        lang,
      );
      const pets = getUniPetStates(
        { completedSessions: 0, totalRecalls: 0, streakDays: 0, checkInsCount: 0, mastered21dCount: 0 },
        lang,
      );
      const companion = computeUniCompanionState({
        sessions: [],
        tasks: [],
        weeklyCheckIns: [],
        today: '2026-11-17',
        lang,
      });
      expect(skins.find((s) => s.skin.id === 'classic')?.skin.name.length).toBeGreaterThan(0);
      expect(pets.find((p) => p.pet.id === 'cat')?.pet.species.length).toBeGreaterThan(0);
      expect(companion.stage.id).toBe('semente');
      expect(companion.stage.label.length).toBeGreaterThan(0);
    }
    expect(getUniCollectibleStates({ completedSessions: 0, totalRecalls: 0, streakDays: 0, checkInsCount: 0, mastered21dCount: 0 }, 'en')[0]?.skin.badgeText).toBe('Starter');
  });

  it('formats progress chart numbers, dates, demo seeds, and Gemini study context in each language', () => {
    expect(fmtHours(90, 'en')).toBe('1.5 h');
    expect(fmtHours(90, 'pt-PT')).toBe('1,5 h');
    expect(fmtHours(90, 'es')).toBe('1,5 h');
    expect(fmtDec(3.5, 'en')).toBe('3.5');
    expect(fmtDec(3.5, 'pt-BR')).toBe('3,5');

    const now = new Date('2026-11-17T12:00:00Z');
    const range = periodRange('7d', { semesterStart: '2026-09-14', semesterEnd: '2027-01-31' }, now);
    const demoEn = buildDemoPayload('en');
    const demoEs = buildDemoPayload('es');
    expect(demoEn.userName).toBe('Guest');
    expect(demoEn.courses[0]?.name).toBe('Calculus I');
    expect(demoEs.userName).toBe('Invitado');
    expect(demoEs.courses[1]?.name).toBe('Física General');

    const bucketEn = studyByBucket(demoEn.sessions, demoEn.courses, range, 'en');
    const weekEn = plannedByWeek(demoEn.sessions, range, 'en');
    expect(bucketEn.rows.length).toBe(7);
    expect(weekEn.length).toBeGreaterThan(0);

    const baseSettings = useStore.getState().settings;
    const enCtx = buildStudyContext({
      ...useStore.getState(),
      courses: demoEn.courses,
      assessments: demoEn.assessments,
      sessions: demoEn.sessions,
      tasks: demoEn.tasks,
      settings: { ...baseSettings, language: 'en', semesterName: demoEn.semesterName },
    });
    expect(enCtx).toContain('COURSES:');
    expect(enCtx).toContain('UPCOMING ASSESSMENTS:');
    expect(enCtx).toContain('topics covered:');

    const esCtx = buildStudyContext({
      ...useStore.getState(),
      courses: demoEs.courses,
      assessments: demoEs.assessments,
      sessions: demoEs.sessions,
      tasks: demoEs.tasks,
      settings: { ...baseSettings, language: 'es', semesterName: demoEs.semesterName },
    });
    expect(esCtx).toContain('ASIGNATURAS:');
    expect(esCtx).toContain('PRÓXIMOS EXÁMENES Y ENTREGAS:');
    expect(esCtx).toContain('temario incluido:');
  });
});
