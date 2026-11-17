import { tr } from '../i18n/tr';
import type { ExtraActivity, ThemePalette } from '../types';

export interface PaletteOption {
  id: ThemePalette;
  name: string;
  tagline: string;
  bgHex: string;
  accentHex: string;
  secondaryHex: string;
  seriousFriendly?: boolean;
}

export const APP_PALETTES: PaletteOption[] = [
  {
    id: 'caderno',
    get name() { return tr('common:palettes.caderno.name'); },
    get tagline() { return tr('common:palettes.caderno.tagline'); },
    bgHex: '#FAF8F2',
    accentHex: '#157F58',
    secondaryHex: '#E04F33',
  },
  {
    id: 'ardosia',
    get name() { return tr('common:palettes.ardosia.name'); },
    get tagline() { return tr('common:palettes.ardosia.tagline'); },
    bgHex: '#F6F7F9',
    accentHex: '#334155',
    secondaryHex: '#94A3B8',
    seriousFriendly: true,
  },
  {
    id: 'botanico',
    get name() { return tr('common:palettes.botanico.name'); },
    get tagline() { return tr('common:palettes.botanico.tagline'); },
    bgHex: '#F6F9F5',
    accentHex: '#2D6A4F',
    secondaryHex: '#D8F3DC',
  },
  {
    id: 'terracota',
    get name() { return tr('common:palettes.terracota.name'); },
    get tagline() { return tr('common:palettes.terracota.tagline'); },
    bgHex: '#FBF7F2',
    accentHex: '#C2410C',
    secondaryHex: '#FFEDD5',
  },
  {
    id: 'oceano',
    get name() { return tr('common:palettes.oceano.name'); },
    get tagline() { return tr('common:palettes.oceano.tagline'); },
    bgHex: '#F5F8FC',
    accentHex: '#1D4ED8',
    secondaryHex: '#DBEAFE',
    seriousFriendly: true,
  },
  {
    id: 'cafe',
    get name() { return tr('common:palettes.cafe.name'); },
    get tagline() { return tr('common:palettes.cafe.tagline'); },
    bgHex: '#FAF5EE',
    accentHex: '#7C4D34',
    secondaryHex: '#EFE0D4',
  },
  {
    id: 'menta',
    get name() { return tr('common:palettes.menta.name'); },
    get tagline() { return tr('common:palettes.menta.tagline'); },
    bgHex: '#F4FAF7',
    accentHex: '#0F766E',
    secondaryHex: '#CCFBF1',
  },
];

export const CHALLENGE_OPTIONS: ReadonlyArray<{ id: string; readonly label: string }> = [
  { id: 'tempo', get label() { return tr('common:challenge.tempo'); } },
  { id: 'procrastinacao', get label() { return tr('common:challenge.procrastinacao'); } },
  { id: 'exercicios', get label() { return tr('common:challenge.exercicios'); } },
  { id: 'teoria', get label() { return tr('common:challenge.teoria'); } },
  { id: 'ansiedade', get label() { return tr('common:challenge.ansiedade'); } },
  { id: 'organizacao', get label() { return tr('common:challenge.organizacao'); } },
];

export const EXTRA_ACTIVITY_PRESETS: Array<Omit<ExtraActivity, 'id'>> = [
  { get label() { return tr('common:extra.trabalho'); }, kind: 'trabalho', hoursPerWeek: 12, weekdays: [2, 4, 6] },
  { get label() { return tr('common:extra.desporto'); }, kind: 'desporto', hoursPerWeek: 4, weekdays: [1, 3, 5] },
  { get label() { return tr('common:extra.nucleo'); }, kind: 'nucleo', hoursPerWeek: 3, weekdays: [3] },
  { get label() { return tr('common:extra.musica'); }, kind: 'musica', hoursPerWeek: 3, weekdays: [6] },
];

export const ECTS_TARGETS: ReadonlyArray<{ total: 180 | 120 | 300; readonly label: string; shortLabel: string }> = [
  { total: 180, get label() { return tr('common:ectsTargets.180'); }, shortLabel: '180 ECTS' },
  { total: 120, get label() { return tr('common:ectsTargets.120'); }, shortLabel: '120 ECTS' },
  { total: 300, get label() { return tr('common:ectsTargets.300'); }, shortLabel: '300 ECTS' },
];

export function defaultTargetEctsForCycle(
  cycle: 'licenciatura' | 'mestrado' | 'misto',
  degreeId?: string,
): number {
  if (cycle === 'misto' || degreeId === 'lemc-memec') return 300;
  if (cycle === 'mestrado' || degreeId === 'memec') return 120;
  return 180;
}

export interface InferredAcademicStage {
  completedEcts: number;
  targetTotalEcts: number;
  remainingEcts: number;
  progressPct: number;
  estimatedYear: 1 | 2 | 3 | 4 | 5;
  recommendedCycle: 'licenciatura' | 'mestrado' | 'misto';
  stageSummary: string;
}

/**
 * Traduz créditos ECTS concluídos e meta (180, 120 ou 300) no ano letivo e carga em falta.
 * Em 300 ECTS: 0–179 correspondem à etapa de Licenciatura (1.º–3.º ano) e 180–300 à de Mestrado (4.º–5.º ano).
 */
export function inferAcademicStageFromEcts(
  completedRaw: number,
  targetRaw: number,
): InferredAcademicStage {
  const targetTotalEcts = targetRaw >= 240 ? 300 : targetRaw >= 150 ? 180 : 120;
  const completedEcts = Math.max(0, Math.min(targetTotalEcts, Math.round(completedRaw)));
  const remainingEcts = Math.max(0, targetTotalEcts - completedEcts);
  const progressPct =
    targetTotalEcts > 0 ? Math.min(100, Math.round((completedEcts / targetTotalEcts) * 100)) : 0;

  let estimatedYear: 1 | 2 | 3 | 4 | 5 = 1;
  let recommendedCycle: 'licenciatura' | 'mestrado' | 'misto' = 'licenciatura';
  let stageSummary = tr('common:stage.start');

  if (targetTotalEcts === 120) {
    recommendedCycle = 'mestrado';
    estimatedYear = completedEcts >= 60 ? 5 : 4;
    stageSummary =
      estimatedYear === 4
        ? tr('common:stage.m120y4')
        : tr('common:stage.m120y5');
  } else if (targetTotalEcts === 300) {
    if (completedEcts < 60) {
      estimatedYear = 1;
      recommendedCycle = 'licenciatura';
      stageSummary = tr('common:stage.i300y1');
    } else if (completedEcts < 120) {
      estimatedYear = 2;
      recommendedCycle = 'licenciatura';
      stageSummary = tr('common:stage.i300y2');
    } else if (completedEcts < 180) {
      estimatedYear = 3;
      recommendedCycle = completedEcts >= 144 ? 'misto' : 'licenciatura';
      stageSummary =
        recommendedCycle === 'misto'
          ? tr('common:stage.i300mixed')
          : tr('common:stage.i300y3');
    } else if (completedEcts < 240) {
      estimatedYear = 4;
      recommendedCycle = 'mestrado';
      stageSummary = tr('common:stage.i300y4');
    } else {
      estimatedYear = 5;
      recommendedCycle = 'mestrado';
      stageSummary = tr('common:stage.i300y5');
    }
  } else {
    recommendedCycle = 'licenciatura';
    if (completedEcts < 60) {
      estimatedYear = 1;
      stageSummary = tr('common:stage.b180y1');
    } else if (completedEcts < 120) {
      estimatedYear = 2;
      stageSummary = tr('common:stage.b180y2');
    } else {
      estimatedYear = 3;
      stageSummary =
        remainingEcts <= 30
          ? tr('common:stage.b180final')
          : tr('common:stage.b180y3');
    }
  }

  return {
    completedEcts,
    targetTotalEcts,
    remainingEcts,
    progressPct,
    estimatedYear,
    recommendedCycle,
    stageSummary,
  };
}

/**
 * Converte atividades extracurriculares declaradas em minutos ocupados por dia da semana (0..6),
 * para que o gerador do plano não agende sessões pesadas nos dias de trabalho ou treino.
 */
export function computeExtraActivityPenaltyByWeekday(
  activities: ExtraActivity[] | undefined,
): Map<number, number> {
  const map = new Map<number, number>();
  if (!activities || activities.length === 0) return map;

  for (const act of activities) {
    const activeDays = act.weekdays.length > 0 ? act.weekdays : [1, 3];
    const perDayMinutes = Math.round(((act.hoursPerWeek || 0) * 60) / activeDays.length);
    if (perDayMinutes <= 0) continue;
    for (const day of activeDays) {
      const clampedDay = ((day % 7) + 7) % 7;
      map.set(clampedDay, (map.get(clampedDay) ?? 0) + perDayMinutes);
    }
  }
  return map;
}
