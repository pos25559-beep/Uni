import type { AppLanguage } from '../types';
import type { UniFormId } from './localDb';

/**
 * Acessórios e estilos temáticos do Uni por área do conhecimento.
 */
export type UniAccessoryId =
  | 'default'
  | 'math'
  | 'tech'
  | 'health'
  | 'arts'
  | 'science'
  | 'humanities';

export type UniAccessoryPreference = 'auto' | UniAccessoryId;

export type UniPersonaMode = 'amigo' | 'exigente' | 'calmo' | 'curioso' | 'treinador';

export interface UniPersonaMeta {
  id: UniPersonaMode;
  label: string;
  labelEn: string;
  hint: string;
  hintEn: string;
  example: string;
  exampleEn: string;
}

export const UNI_PERSONAS: UniPersonaMeta[] = [
  {
    id: 'amigo',
    label: 'Amigo',
    labelEn: 'Friend',
    hint: 'Caloroso, claro e com ritmo leve',
    hintEn: 'Warm, clear, everyday analogies first',
    example: 'Pensa num carro a travar: é isso que a derivada mede.',
    exampleEn: 'Think of a braking car: that rate of change is the derivative.',
  },
  {
    id: 'exigente',
    label: 'Exigente',
    labelEn: 'Strict',
    hint: 'Direto ao exame e sem rodeios',
    hintEn: 'Exam-focused, concise, zero fluff',
    example: 'Isto sai no teste. 3 minutos, resolve passo a passo.',
    exampleEn: 'This shows up on the exam. 3 minutes — walk me through it.',
  },
  {
    id: 'calmo',
    label: 'Anti-stress',
    labelEn: 'Calm',
    hint: 'Passo a passo para dias difíceis',
    hintEn: 'Step by step for overwhelming days',
    example: 'Vamos só ao primeiro passo. O resto espera.',
    exampleEn: "Let's tackle just the first step. Everything else can wait.",
  },
  {
    id: 'curioso',
    label: 'Curioso',
    labelEn: 'Curious',
    hint: 'Socrático: faz perguntas e entusiasma-se',
    hintEn: 'Socratic: asks probing questions',
    example: 'E se x fosse negativo? O que muda no sinal?',
    exampleEn: 'What if x were negative? What shifts in the sign?',
  },
  {
    id: 'treinador',
    label: 'Treinador',
    labelEn: 'Coach',
    hint: 'Enérgico, metas curtas por sessão',
    hintEn: 'Energetic, short session targets',
    example: 'Meta de hoje: 5 limites certos seguidos.',
    exampleEn: "Today's drill: 5 limits solved cleanly in a row.",
  },
];

export function getLocalizedPersonas(lang: AppLanguage | string = 'pt-PT'): Array<{
  id: UniPersonaMode;
  label: string;
  hint: string;
  example: string;
}> {
  const isEn = String(lang).toLowerCase().startsWith('en');
  return UNI_PERSONAS.map((p) => ({
    id: p.id,
    label: isEn ? p.labelEn : p.label,
    hint: isEn ? p.hintEn : p.hint,
    example: isEn ? p.exampleEn : p.example,
  }));
}

export interface UniAccessoryMeta {
  id: UniAccessoryId;
  label: string;
  shortLabel: string;
  tagline: string;
}

export const UNI_ACCESSORIES: UniAccessoryMeta[] = [
  {
    id: 'default',
    label: 'Clássico',
    shortLabel: 'Clássico',
    tagline: 'Marcador coral do caderno',
  },
  {
    id: 'math',
    label: 'Matemática',
    shortLabel: 'Mate',
    tagline: 'Chapéu π e óculos geométricos',
  },
  {
    id: 'tech',
    label: 'Engenharia & IT',
    shortLabel: 'Tech',
    tagline: 'Auscultadores de foco',
  },
  {
    id: 'health',
    label: 'Saúde & Bio',
    shortLabel: 'Saúde',
    tagline: 'Estetoscópio e rebento',
  },
  {
    id: 'arts',
    label: 'Artes & Design',
    shortLabel: 'Artes',
    tagline: 'Boina de ateliê',
  },
  {
    id: 'science',
    label: 'Ciências & Lab',
    shortLabel: 'Lab',
    tagline: 'Óculos de laboratório',
  },
  {
    id: 'humanities',
    label: 'Letras & Direito',
    shortLabel: 'Letras',
    tagline: 'Óculos de leitura clássicos',
  },
];

const RULES: Array<{ id: UniAccessoryId; re: RegExp }> = [
  {
    id: 'math',
    re: /\b(mat|matem[aá]tica|c[aá]lculo|an[aá]lise|[aá]lgebra|geometria|estat[ií]stica|probabilidade|am\d*|eq\.?\s*dif)/i,
  },
  {
    id: 'tech',
    re: /\b(inf|inform[aá]tica|programa[çc][aã]o|algoritmo|software|computa[çc][aã]o|redes|sistemas|dados|eng\.?\s*inf|engenharia|electr[oó]|rob[oó]tica|ia)\b/i,
  },
  {
    id: 'health',
    re: /\b(med|medicina|anatomia|fisiologia|sa[uú]de|enfermagem|farm[aá]cia|cl[ií]nica|nutri[çc][aã]o|terapia|veterin[aá]ria|odonto)\b/i,
  },
  {
    id: 'arts',
    re: /\b(arte|artes|design|arquitetura|desenho|m[uú]sica|cinema|ilustra[çc][aã]o|moda|multimedia|multim[eé]dia|fotografia|teatro)\b/i,
  },
  {
    id: 'science',
    re: /\b(qu[ií]mica|f[ií]sica|biologia|bioqu[ií]mica|gen[eé]tica|laborat[oó]rio|term|termodin[aâ]mica|mec[aâ]nica|fluidos|materiais)\b/i,
  },
  {
    id: 'humanities',
    re: /\b(direito|economia|gest[aã]o|hist[oó]ria|filosofia|psicologia|sociologia|letras|portugu[eê]s|ingl[eê]s|l[ií]nguas|comunica[çc][aã]o|contabilidade|finan[çc]as)\b/i,
  },
];

/** Infere o visual do Uni a partir do nome da cadeira ou curso, ou usa preferência explícita. */
export function resolveUniAccessory(
  preference: UniAccessoryPreference | undefined,
  ...contextLabels: Array<string | undefined | null>
): UniAccessoryId {
  if (preference && preference !== 'auto') {
    return preference;
  }
  const combined = contextLabels.filter(Boolean).join(' ');
  if (!combined.trim()) return 'default';
  for (const rule of RULES) {
    if (rule.re.test(combined)) return rule.id;
  }
  return 'default';
}

/** Infere o acessório de área do Uni a partir de uma ou mais cadeiras. */
export function inferAccessoryFromCourses(
  courses: Array<{ shortName?: string; name?: string; code?: string }>,
): UniAccessoryId {
  return resolveUniAccessory(
    'auto',
    ...courses.flatMap((c) => [c.shortName, c.name, c.code]),
  );
}

const AREA_DEFAULT_FORM: Record<UniAccessoryId, UniFormId> = {
  default: 'nuvem',
  math: 'cristal',
  tech: 'estrela',
  health: 'gota',
  arts: 'nuvem',
  science: 'folha',
  humanities: 'nuvem',
};

/** Sugere a forma base do Uni de acordo com a área da cadeira. */
export function suggestFormForCourse(course?: {
  shortName?: string;
  name?: string;
  code?: string;
}): UniFormId {
  if (!course) return 'nuvem';
  const accessory = inferAccessoryFromCourses([course]);
  return AREA_DEFAULT_FORM[accessory] ?? 'nuvem';
}
