import type { CourseColor } from '../types';

export interface CurriculumCourseTemplate {
  code: string;
  name: string;
  shortName: string;
  year: 1 | 2 | 3 | 4 | 5;
  semester: 1 | 2;
  ects: number;
  topics: string[];
  color?: CourseColor;
  optional?: boolean;
  eligibleYears?: (1 | 2 | 3 | 4 | 5)[];
}

export function compactCurriculumKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const COURSE_STOP_WORDS = new Set([
  'da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'com', 'a', 'o', 'as', 'os',
]);

const ROMAN_TO_DIGIT: Record<string, string> = {
  i: '1', ii: '2', iii: '3', iv: '4', v: '5', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
};

function normalizedWordTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function significantCourseWords(value: string): string[] {
  return normalizedWordTokens(value).filter((w) => !COURSE_STOP_WORDS.has(w) && !(w in ROMAN_TO_DIGIT));
}

function extractCourseLevelTokens(value: string): string[] {
  const levels: string[] = [];
  for (const token of normalizedWordTokens(value)) {
    if (token in ROMAN_TO_DIGIT) {
      levels.push(ROMAN_TO_DIGIT[token]!);
      continue;
    }
    const embedded = token.match(/[a-z]([1-5])(?:[a-z]+)?$/);
    if (embedded?.[1]) {
      levels.push(embedded[1]);
    }
  }
  return levels;
}

function courseLevelsCompatible(a: string, b: string): boolean {
  const levelsA = extractCourseLevelTokens(a);
  const levelsB = extractCourseLevelTokens(b);
  if (levelsA.length === 0 || levelsB.length === 0) return true;
  return levelsA.join(',') === levelsB.join(',');
}

function matchesConsecutiveWordPrefixes(
  codeKey: string,
  words: string[],
  codePos: number,
  wordIdx: number,
): boolean {
  if (codePos === codeKey.length) return wordIdx >= 2;
  if (wordIdx >= words.length) return false;

  const word = words[wordIdx]!;
  const maxTake = Math.min(word.length, codeKey.length - codePos);
  for (let len = 1; len <= maxTake; len++) {
    if (codeKey.slice(codePos, codePos + len) !== word.slice(0, len)) break;
    if (matchesConsecutiveWordPrefixes(codeKey, words, codePos + len, wordIdx + 1)) {
      return true;
    }
  }
  return false;
}

/** Verifica se `shortCode` corresponde a uma sigla/abreviatura válida do nome completo (ex.: "SNTI", "FabAd", "TEP"). */
export function isAcronymMatchForFullName(shortCode: string, fullName: string): boolean {
  const codeKey = compactCurriculumKey(shortCode);
  if (codeKey.length < 2 || codeKey.length > 10) return false;

  const fullWords = normalizedWordTokens(fullName);
  const sigWords = significantCourseWords(fullName);
  if (sigWords.length < 2 && fullWords.length < 2) return false;
  if (!courseLevelsCompatible(shortCode, fullName)) return false;

  const sigInitials = sigWords.map((w) => w[0]).join('');
  const allInitials = fullWords.map((w) => (w in ROMAN_TO_DIGIT ? ROMAN_TO_DIGIT[w] : w[0])).join('');
  const sigWithLevels = fullWords
    .filter((w) => !COURSE_STOP_WORDS.has(w))
    .map((w) => (w in ROMAN_TO_DIGIT ? ROMAN_TO_DIGIT[w] : w[0]))
    .join('');

  if (
    codeKey.length >= 3 &&
    (codeKey === sigInitials || codeKey === allInitials || codeKey === sigWithLevels)
  ) {
    return true;
  }

  if (codeKey.length >= 4 && sigWords.length >= 2) {
    const codeAlphaOnly = codeKey.replace(/[0-9]/g, '');
    if (codeAlphaOnly.length >= 4 && matchesConsecutiveWordPrefixes(codeAlphaOnly, sigWords, 0, 0)) {
      return true;
    }
  }
  return false;
}

/** Gera sigla legível para uma cadeira quando o portal não fornece sigla explícita (ex.: "Sociologia das Novas Tecnologias de Informação" → "SNTI"). */
export function deriveCourseAcronym(name: string, explicitCode?: string): string {
  const cleanedCode = explicitCode?.trim();
  if (cleanedCode && cleanedCode.length <= 12) return cleanedCode.toUpperCase();

  const words = normalizedWordTokens(name).filter((w) => !COURSE_STOP_WORDS.has(w));
  if (words.length >= 2) {
    return words
      .slice(0, 5)
      .map((w) => (w in ROMAN_TO_DIGIT ? ROMAN_TO_DIGIT[w] : w[0]!.toUpperCase()))
      .join('');
  }
  return (words[0] ?? name).slice(0, 6).toUpperCase();
}

/**
 * Compara dois identificadores de cadeira (`{ code?, name }`) com tolerância a espaços/acentos,
 * shortName do catálogo, siglas de iniciais ("SNTI" ↔ "Sociologia das Novas Tecnologias..."),
 * abreviações sílaba-a-sílaba ("FabAd" ↔ "Fabrico Aditivo") e pequenas variações OCR.
 */
export function isCourseIdentityMatch(
  a: { code?: string; name: string },
  b: { code?: string; name: string },
  templates: CurriculumCourseTemplate[] = [],
): boolean {
  const codeA = a.code ? compactCurriculumKey(a.code) : '';
  const nameA = compactCurriculumKey(a.name);
  const codeB = b.code ? compactCurriculumKey(b.code) : '';
  const nameB = compactCurriculumKey(b.name);

  if ((!codeA && !nameA) || (!codeB && !nameB)) return false;

  const tpl = templates.find(
    (t) =>
      compactCurriculumKey(t.code) === codeB ||
      compactCurriculumKey(t.code) === codeA ||
      compactCurriculumKey(t.name) === nameB ||
      compactCurriculumKey(t.name) === nameA,
  );
  const shortB = tpl && b.code && compactCurriculumKey(tpl.code) === codeB ? compactCurriculumKey(tpl.shortName) : '';

  if (
    (codeA && (codeB === codeA || shortB === codeA || nameB === codeA)) ||
    (nameA && (nameB === nameA || codeB === nameA || (shortB && shortB === nameA)))
  ) {
    return true;
  }

  const labelA = `${a.code ?? ''} ${a.name}`.trim();
  const labelB = `${b.code ?? ''} ${b.name}`.trim();
  if (!courseLevelsCompatible(labelA, labelB)) return false;

  const shortCandidatesA = [a.code, normalizedWordTokens(a.name).length <= 1 ? a.name : undefined].filter(
    (x): x is string => Boolean(x),
  );
  const shortCandidatesB = [b.code, normalizedWordTokens(b.name).length <= 1 ? b.name : undefined].filter(
    (x): x is string => Boolean(x),
  );
  for (const s of shortCandidatesA) {
    if (isAcronymMatchForFullName(s, b.name)) return true;
  }
  for (const s of shortCandidatesB) {
    if (isAcronymMatchForFullName(s, a.name)) return true;
  }

  if (nameA.length >= 5 && nameB.length >= 5 && (nameB.includes(nameA) || nameA.includes(nameB))) {
    return true;
  }

  const stemA = new Set(significantCourseWords(a.name).filter((w) => w.length >= 3).map((w) => w.replace(/s$/, '')));
  const stemB = new Set(significantCourseWords(b.name).filter((w) => w.length >= 3).map((w) => w.replace(/s$/, '')));
  if (stemA.size >= 3 && stemB.size >= 3) {
    let intersection = 0;
    for (const t of stemA) if (stemB.has(t)) intersection++;
    const union = stemA.size + stemB.size - intersection;
    if (union > 0 && intersection / union >= 0.78) {
      return true;
    }
  }

  return false;
}
