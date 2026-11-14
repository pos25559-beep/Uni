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
    name: 'Caderno Vivo',
    tagline: 'Folha creme, verde floresta e marcador coral',
    bgHex: '#FAF8F2',
    accentHex: '#157F58',
    secondaryHex: '#E04F33',
  },
  {
    id: 'ardosia',
    name: 'Ardósia Minimal',
    tagline: 'Visual sério e sobriedade editorial em grafite',
    bgHex: '#F6F7F9',
    accentHex: '#334155',
    secondaryHex: '#94A3B8',
    seriousFriendly: true,
  },
  {
    id: 'botanico',
    name: 'Verde Botânico',
    tagline: 'Tom orgânico calmo para sessões longas sem cansar a vista',
    bgHex: '#F6F9F5',
    accentHex: '#2D6A4F',
    secondaryHex: '#D8F3DC',
  },
  {
    id: 'terracota',
    name: 'Linho & Terracota',
    tagline: 'Quente e acolhedor com notas de barro e âmbar',
    bgHex: '#FBF7F2',
    accentHex: '#C2410C',
    secondaryHex: '#FFEDD5',
  },
  {
    id: 'oceano',
    name: 'Oceano Académico',
    tagline: 'Foco clássico em branco técnico e azul marinho',
    bgHex: '#F5F8FC',
    accentHex: '#1D4ED8',
    secondaryHex: '#DBEAFE',
    seriousFriendly: true,
  },
];

export const CHALLENGE_OPTIONS = [
  { id: 'tempo', label: 'Gerir o tempo e conciliar prazos' },
  { id: 'procrastinacao', label: 'Começar sem adiar blocos' },
  { id: 'exercicios', label: 'Resolução de exercícios & cálculo' },
  { id: 'teoria', label: 'Memorizar matéria muito teórica' },
  { id: 'ansiedade', label: 'Pressão / ansiedade antes de testes' },
  { id: 'organizacao', label: 'Apontamentos e links espalhados' },
] as const;

export const EXTRA_ACTIVITY_PRESETS: Array<Omit<ExtraActivity, 'id'>> = [
  { label: 'Trabalho / Part-time', kind: 'trabalho', hoursPerWeek: 12, weekdays: [2, 4, 6] },
  { label: 'Desporto / Ginásio', kind: 'desporto', hoursPerWeek: 4, weekdays: [1, 3, 5] },
  { label: 'Núcleo / Associação', kind: 'nucleo', hoursPerWeek: 3, weekdays: [3] },
  { label: 'Voluntariado / Música', kind: 'musica', hoursPerWeek: 3, weekdays: [6] },
];

export const ECTS_TARGETS = [
  { total: 180, label: '180 ECTS · Licenciatura (3 anos)', shortLabel: '180 ECTS' },
  { total: 120, label: '120 ECTS · Mestrado isolado (2 anos)', shortLabel: '120 ECTS' },
  { total: 300, label: '300 ECTS · Licenciatura + Mestrado (5 anos)', shortLabel: '300 ECTS' },
] as const;

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
  let stageSummary = '1.º Ano · Início do percurso';

  if (targetTotalEcts === 120) {
    recommendedCycle = 'mestrado';
    estimatedYear = completedEcts >= 60 ? 5 : 4;
    stageSummary =
      estimatedYear === 4
        ? '1.º Ano de Mestrado (base de 120 ECTS)'
        : '2.º Ano de Mestrado · Reta final para Dissertação';
  } else if (targetTotalEcts === 300) {
    if (completedEcts < 60) {
      estimatedYear = 1;
      recommendedCycle = 'licenciatura';
      stageSummary = '1.º Ano de 300 ECTS (início da Licenciatura)';
    } else if (completedEcts < 120) {
      estimatedYear = 2;
      recommendedCycle = 'licenciatura';
      stageSummary = '2.º Ano de 300 ECTS (metade da Licenciatura)';
    } else if (completedEcts < 180) {
      estimatedYear = 3;
      recommendedCycle = completedEcts >= 144 ? 'misto' : 'licenciatura';
      stageSummary =
        recommendedCycle === 'misto'
          ? 'Fim da Licenciatura (pode já antecipar cadeiras de Mestrado)'
          : '3.º Ano de 300 ECTS (conclusão do 1.º Ciclo)';
    } else if (completedEcts < 240) {
      estimatedYear = 4;
      recommendedCycle = 'mestrado';
      stageSummary = '4.º Ano · 1.º Ano de Mestrado (180+ ECTS concluídos)';
    } else {
      estimatedYear = 5;
      recommendedCycle = 'mestrado';
      stageSummary = '5.º Ano · 2.º Ano de Mestrado e Dissertação';
    }
  } else {
    recommendedCycle = 'licenciatura';
    if (completedEcts < 60) {
      estimatedYear = 1;
      stageSummary = '1.º Ano de 180 ECTS';
    } else if (completedEcts < 120) {
      estimatedYear = 2;
      stageSummary = '2.º Ano de 180 ECTS';
    } else {
      estimatedYear = 3;
      stageSummary =
        remainingEcts <= 30
          ? 'Finalista de Licenciatura (últimos créditos de 180 ECTS)'
          : '3.º Ano de 180 ECTS';
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
