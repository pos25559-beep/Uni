import type { AppLanguage } from '../types';
import { normalizeAppLanguage } from './grading';
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
  labelEs: string;
  labelPtBr: string;
  hint: string;
  hintEn: string;
  hintEs: string;
  hintPtBr: string;
  example: string;
  exampleEn: string;
  exampleEs: string;
  examplePtBr: string;
}

export const UNI_PERSONAS: UniPersonaMeta[] = [
  {
    id: 'amigo',
    label: 'Amigo',
    labelEn: 'Friend',
    labelEs: 'Cercano',
    labelPtBr: 'Parceiro',
    hint: 'Caloroso, claro e com ritmo leve',
    hintEn: 'Warm, clear, everyday analogies first',
    hintEs: 'Cercano, claro y con ejemplos cotidianos',
    hintPtBr: 'Leve, próximo e com exemplos do dia a dia',
    example: 'Pensa num carro a travar: é isso que a derivada mede.',
    exampleEn: 'Think of a braking car: that rate of change is the derivative.',
    exampleEs: 'Piensa en un coche al frenar: eso mismo mide la derivada.',
    examplePtBr: 'Pensa num carro freando: é exatamente essa taxa que a derivada mede.',
  },
  {
    id: 'exigente',
    label: 'Exigente',
    labelEn: 'Strict',
    labelEs: 'Exigente',
    labelPtBr: 'Direto',
    hint: 'Direto ao exame e sem rodeios',
    hintEn: 'Exam-focused, concise, zero fluff',
    hintEs: 'Directo al examen y sin rodeos',
    hintPtBr: 'Foco total na prova, sem enrolação',
    example: 'Isto sai no teste. 3 minutos, resolve passo a passo.',
    exampleEn: 'This shows up on the exam. 3 minutes — walk me through it.',
    exampleEs: 'Esto entra seguro en el examen. Tienes 3 minutos, resuélvelo paso a paso.',
    examplePtBr: 'Isso cai na prova. 3 minutos — resolve passo a passo agora.',
  },
  {
    id: 'calmo',
    label: 'Anti-stress',
    labelEn: 'Calm',
    labelEs: 'Sin estrés',
    labelPtBr: 'Calmo',
    hint: 'Passo a passo para dias difíceis',
    hintEn: 'Step by step for overwhelming days',
    hintEs: 'Paso a paso para días intensos',
    hintPtBr: 'Um passo de cada vez para dias puxados',
    example: 'Vamos só ao primeiro passo. O resto espera.',
    exampleEn: "Let's tackle just the first step. Everything else can wait.",
    exampleEs: 'Vamos solo con el primer paso. Todo lo demás puede esperar.',
    examplePtBr: 'Bora focar só no primeiro passo. O resto fica para depois.',
  },
  {
    id: 'curioso',
    label: 'Curioso',
    labelEn: 'Curious',
    labelEs: 'Curioso',
    labelPtBr: 'Curioso',
    hint: 'Socrático: faz perguntas e entusiasma-se',
    hintEn: 'Socratic: asks probing questions',
    hintEs: 'Socrático: pregunta e investiga contigo',
    hintPtBr: 'Socrático: puxa o seu raciocínio com perguntas',
    example: 'E se x fosse negativo? O que muda no sinal?',
    exampleEn: 'What if x were negative? What shifts in the sign?',
    exampleEs: '¿Y si x fuera negativo? ¿Qué cambia en el signo?',
    examplePtBr: 'E se x fosse negativo? O que mudaria no sinal aqui?',
  },
  {
    id: 'treinador',
    label: 'Treinador',
    labelEn: 'Coach',
    labelEs: 'Entrenador',
    labelPtBr: 'Treinador',
    hint: 'Enérgico, metas curtas por sessão',
    hintEn: 'Energetic, short session targets',
    hintEs: 'Enérgico y orientado a objetivos cortos',
    hintPtBr: 'Energia alta e metas curtas por bloco',
    example: 'Meta de hoje: 5 limites certos seguidos.',
    exampleEn: "Today's drill: 5 limits solved cleanly in a row.",
    exampleEs: 'Meta de hoy: 5 límites resueltos seguidos sin fallo.',
    examplePtBr: 'Meta de hoje: acertar 5 limites seguidos sem erro.',
  },
];

export function getLocalizedPersonas(lang: AppLanguage | string = 'pt-PT'): Array<{
  id: UniPersonaMode;
  label: string;
  hint: string;
  example: string;
}> {
  const normalized = normalizeAppLanguage(lang);
  return UNI_PERSONAS.map((p) => {
    if (normalized === 'en') {
      return { id: p.id, label: p.labelEn, hint: p.hintEn, example: p.exampleEn };
    }
    if (normalized === 'es') {
      return { id: p.id, label: p.labelEs, hint: p.hintEs, example: p.exampleEs };
    }
    if (normalized === 'pt-BR') {
      return { id: p.id, label: p.labelPtBr, hint: p.hintPtBr, example: p.examplePtBr };
    }
    return { id: p.id, label: p.label, hint: p.hint, example: p.example };
  });
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

const ACCESSORY_LOCALIZED_COPY: Record<
  UniAccessoryId,
  Record<'pt-BR' | 'es' | 'en', { label: string; shortLabel: string; tagline: string }>
> = {
  default: {
    'pt-BR': { label: 'Clássico', shortLabel: 'Clássico', tagline: 'Marcador coral do caderno' },
    es: { label: 'Clásico', shortLabel: 'Clásico', tagline: 'Marcapáginas coral del cuaderno' },
    en: { label: 'Classic', shortLabel: 'Classic', tagline: 'Coral notebook bookmark' },
  },
  math: {
    'pt-BR': { label: 'Matemática', shortLabel: 'Mat', tagline: 'Chapéu π e óculos geométricos' },
    es: { label: 'Matemáticas', shortLabel: 'Mates', tagline: 'Gorro π y gafas geométricas' },
    en: { label: 'Mathematics', shortLabel: 'Math', tagline: 'π cap and geometric glasses' },
  },
  tech: {
    'pt-BR': { label: 'Engenharia & TI', shortLabel: 'Tech', tagline: 'Fones de foco' },
    es: { label: 'Ingeniería y TI', shortLabel: 'Tech', tagline: 'Auriculares de enfoque' },
    en: { label: 'Engineering & IT', shortLabel: 'Tech', tagline: 'Focus headphones' },
  },
  health: {
    'pt-BR': { label: 'Saúde & Bio', shortLabel: 'Saúde', tagline: 'Estetoscópio e broto' },
    es: { label: 'Salud y Bio', shortLabel: 'Salud', tagline: 'Estetoscopio y brote' },
    en: { label: 'Health & Bio', shortLabel: 'Health', tagline: 'Stethoscope & sprout' },
  },
  arts: {
    'pt-BR': { label: 'Artes & Design', shortLabel: 'Artes', tagline: 'Boina de ateliê' },
    es: { label: 'Artes y Diseño', shortLabel: 'Artes', tagline: 'Boina de estudio' },
    en: { label: 'Arts & Design', shortLabel: 'Arts', tagline: 'Studio beret' },
  },
  science: {
    'pt-BR': { label: 'Ciências & Lab', shortLabel: 'Lab', tagline: 'Óculos de laboratório' },
    es: { label: 'Ciencias y Lab', shortLabel: 'Lab', tagline: 'Gafas de laboratorio' },
    en: { label: 'Science & Lab', shortLabel: 'Lab', tagline: 'Safety lab goggles' },
  },
  humanities: {
    'pt-BR': { label: 'Letras & Direito', shortLabel: 'Letras', tagline: 'Óculos clássicos de leitura' },
    es: { label: 'Letras y Derecho', shortLabel: 'Letras', tagline: 'Gafas clásicas de lectura' },
    en: { label: 'Humanities & Law', shortLabel: 'Arts & Law', tagline: 'Classic reading glasses' },
  },
};

export function getLocalizedAccessories(lang: AppLanguage | string = 'pt-PT'): UniAccessoryMeta[] {
  const normalized = normalizeAppLanguage(lang);
  if (normalized === 'pt-PT') return UNI_ACCESSORIES;
  return UNI_ACCESSORIES.map((acc) => {
    const localized = ACCESSORY_LOCALIZED_COPY[acc.id]?.[normalized];
    return localized ? { ...acc, ...localized } : acc;
  });
}

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
