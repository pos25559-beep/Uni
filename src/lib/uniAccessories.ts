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

export type UniPersonaMode = 'amigo' | 'exigente' | 'calmo';

export interface UniPersonaMeta {
  id: UniPersonaMode;
  label: string;
  hint: string;
}

export const UNI_PERSONAS: UniPersonaMeta[] = [
  { id: 'amigo', label: 'Amigo', hint: 'Caloroso, claro e com ritmo leve' },
  { id: 'exigente', label: 'Exigente', hint: 'Direto ao exame e sem rodeios' },
  { id: 'calmo', label: 'Anti-stress', hint: 'Passo a passo para dias difíceis' },
];

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
