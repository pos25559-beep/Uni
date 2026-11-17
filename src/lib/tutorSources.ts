import type { Material } from '../types';

/** Normaliza para comparar: sem acentos, minúsculas, só letras e números separados por espaço. */
export function normalizeSourceText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripExtension(title: string): string {
  return title.replace(/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|heic|webp)$/i, '');
}

export type SourceGroupKey = 'lessons' | 'tests' | 'problems' | 'images' | 'other';

export const SOURCE_GROUP_ORDER: SourceGroupKey[] = ['lessons', 'tests', 'problems', 'images', 'other'];

export interface SourceGroup<T> {
  key: SourceGroupKey;
  items: T[];
}

type GroupableMaterial = Pick<Material, 'title'> & Partial<Pick<Material, 'mimeType' | 'category'>>;

const YEAR = /\b(19|20)\d{2}\b/;

export function sourceGroupKey(m: GroupableMaterial): SourceGroupKey {
  const title = normalizeSourceText(stripExtension(m.title));
  if (m.mimeType?.toLowerCase().startsWith('image/') || /^(img|imagem|image|foto)\b/.test(title)) {
    return 'images';
  }
  if (/\b(teste|exame|frequencia|recurso)s?\b/.test(title)) return 'tests';
  if (/\b(problemas?|fichas?|exercicios?|tp|tps)\b/.test(title)) return 'problems';
  if (/\b(aulas?|slides?|teorica|teoricas|apresentacao)\b/.test(title)) return 'lessons';
  if (/\bt\d{1,2}[a-z]?\b/.test(title)) {
    // "T1 2021" é um teste; "T08" é uma aula teórica.
    return YEAR.test(title) ? 'tests' : 'lessons';
  }
  if (m.category === 'teste_antigo' || m.category === 'exame_antigo') return 'tests';
  if (m.category === 'ficha') return 'problems';
  if (m.category === 'slide_oficial') return 'lessons';
  return 'other';
}

/** Agrupa materiais por tipo, pela ordem fixa dos grupos; grupos vazios são omitidos. */
export function groupSources<T extends GroupableMaterial>(materials: T[]): SourceGroup<T>[] {
  const buckets = new Map<SourceGroupKey, T[]>();
  for (const m of materials) {
    const key = sourceGroupKey(m);
    const list = buckets.get(key);
    if (list) list.push(m);
    else buckets.set(key, [m]);
  }
  return SOURCE_GROUP_ORDER.filter((k) => buckets.has(k)).map((key) => ({
    key,
    items: buckets.get(key) ?? [],
  }));
}

/** Prefixo mais curto (2 a 4 palavras) que identifica o título sem ambiguidade. */
function distinctiveKeys(norms: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const norm of new Set(norms)) {
    const tokens = norm.split(' ');
    const keys = [norm];
    for (let n = Math.min(2, tokens.length); n < tokens.length && n <= 4; n++) {
      const prefix = tokens.slice(0, n).join(' ');
      if (prefix.length < 4) continue;
      const clash = norms.some((o) => o !== norm && (o === prefix || o.startsWith(`${prefix} `)));
      if (!clash) {
        keys.push(prefix);
        break;
      }
    }
    out.set(norm, keys);
  }
  return out;
}

const CITATION_PATTERNS = [
  /\[\s*(?:fontes?|sources?|fuentes?)\s*:\s*([^\]]+)\]/gi,
  /\(([^()]{2,200})\)/g,
  /(?:fontes?|sources?|fuentes?)\s*:\s*([^\n\]]+)/gi,
];

/**
 * Devolve só os títulos que a resposta citou, pela ordem da primeira menção.
 * Reconhece "[Fonte: …]", "(Aula T08)" e "Fonte: …", por título completo ou prefixo distintivo.
 */
export function citedSources(text: string, titles: string[]): string[] {
  if (!text || titles.length === 0) return [];
  const raw: { at: number; seg: string }[] = [];
  for (const re of CITATION_PATTERNS) {
    for (const match of text.matchAll(re)) {
      const seg = normalizeSourceText(match[1] ?? '');
      if (seg) raw.push({ at: match.index ?? 0, seg });
    }
  }
  if (raw.length === 0) return [];
  const haystack = ` ${raw
    .sort((a, b) => a.at - b.at)
    .map((r) => r.seg)
    .join(' | ')} `;

  const norms = titles.map((t) => normalizeSourceText(stripExtension(t)));
  const keysByNorm = distinctiveKeys(norms.filter(Boolean));
  const found: { title: string; pos: number }[] = [];
  const seen = new Set<string>();
  titles.forEach((title, i) => {
    const norm = norms[i];
    if (!norm || seen.has(norm)) return;
    let best = -1;
    for (const key of keysByNorm.get(norm) ?? []) {
      const at = haystack.indexOf(` ${key} `);
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    if (best >= 0) {
      seen.add(norm);
      found.push({ title, pos: best });
    }
  });
  return found.sort((a, b) => a.pos - b.pos).map((f) => f.title);
}

/** Pesquisa insensível a acentos e maiúsculas. */
export function matchesSourceQuery(title: string, query: string): boolean {
  const q = normalizeSourceText(query);
  if (!q) return true;
  return normalizeSourceText(title).includes(q);
}

const STOP_WORDS = new Set([
  'para', 'como', 'este', 'esta', 'isso', 'aqui', 'mais', 'muito', 'sobre', 'pelo', 'pela',
  'com', 'sem', 'que', 'dos', 'das', 'nos', 'nas', 'uma', 'uns', 'umas', 'por', 'the', 'and',
  'for', 'with', 'from', 'that', 'this', 'vamos', 'quero', 'fazer', 'agora', 'grupo', 'alinea',
]);

function queryTokens(text: string): string[] {
  return normalizeSourceText(text)
    .split(' ')
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}


const ORDINAL_WORDS: Record<string, string> = {
  primeiro: '1', primeira: '1', segundo: '2', segunda: '2', terceiro: '3', terceira: '3', quarto: '4', quarta: '4',
  first: '1', second: '2', third: '3', primer: '1', segundo_es: '2',
};
const ASSESSMENT_KINDS = '(teste|exame|frequencia|mini teste|minitest|test|exam|prova)';

/**
 * «2 teste», «2º teste», «2.º teste», «segundo teste», «teste 2» → {"2:teste"}.
 * Serve para não confundir o 1.º com o 2.º teste do mesmo ano.
 */
export function ordinalAssessmentKeys(text: string): Set<string> {
  const norm = normalizeSourceText(text)
    .replace(/\b(primeiro|primeira|segundo|segunda|terceiro|terceira|quarto|quarta|first|second|third)\b/g, (w) => ORDINAL_WORDS[w] ?? w);
  const keys = new Set<string>();
  const kindOf = (k: string) => (k.startsWith('exam') || k === 'exame' ? 'exame' : k.startsWith('freq') ? 'frequencia' : 'teste');
  for (const m of norm.matchAll(new RegExp(`\\b([1-4])\\s*o?\\s+${ASSESSMENT_KINDS}\\b`, 'g'))) keys.add(`${m[1]}:${kindOf(m[2])}`);
  for (const m of norm.matchAll(new RegExp(`\\b${ASSESSMENT_KINDS}\\s+([1-4])\\b(?!\\s*\\d)`, 'g'))) keys.add(`${m[2]}:${kindOf(m[1])}`);
  return keys;
}

/** «2009-10», «09/10», «2009/2010» → ["2009", "2010"]. */
export function academicYearTokens(text: string): string[] {
  const norm = normalizeSourceText(text);
  const out = new Set<string>();
  for (const m of norm.matchAll(/\b(20\d\d)\s+(\d\d)\b/g)) {
    out.add(m[1]);
    out.add(`20${m[2]}`);
  }
  for (const m of norm.matchAll(/\b(\d\d)\s+(\d\d)\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b === (a + 1) % 100) {
      out.add(`20${m[1]}`);
      out.add(`20${m[2]}`);
    }
  }
  for (const m of norm.matchAll(/\b(20\d\d)\b/g)) out.add(m[1]);
  return [...out];
}

/**
 * Ordena materiais por relevância para a mensagem atual (e contexto recente) para que,
 * com dezenas de fontes ligadas, os anexos mais prováveis entrem nos primeiros slots binários.
 */
export function prioritizeMaterialsForQuery<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'pinned' | 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string, recentText = ''): T[] {
  if (materials.length <= 1) return [...materials];
  const currentNorm = normalizeSourceText(queryText);
  const recentNorm = normalizeSourceText(recentText);
  const combinedNorm = `${currentNorm} ${recentNorm}`.trim();
  if (!combinedNorm) {
    return [...materials].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }

  const qTokens = queryTokens(queryText);
  const qYears = academicYearTokens(queryText);
  const qOrdinals = ordinalAssessmentKeys(queryText);
  const rTokens = queryTokens(recentText).filter((t) => !qTokens.includes(t));
  const wantsTests = /\b(teste|exame|frequencia|recurso|grupo|alinea|prova|exam|test)\b/.test(combinedNorm);
  const wantsProblems = /\b(ficha|problema|exercicio|folha|tp|homework|problem)\b/.test(combinedNorm);
  const wantsLessons = /\b(aula|slide|teorica|sebenta|apontamento|materia|resumo|lecture|notes)\b/.test(combinedNorm);

  return materials
    .map((m, idx) => {
      const titleNorm = normalizeSourceText(stripExtension(m.title)).replace(/\s+1$/, '');
      const group = sourceGroupKey(m);
      let score = m.pinned ? 1 : 0;

      for (const tok of qTokens) {
        if (titleNorm.includes(tok)) score += /^\d{4}$/.test(tok) ? 10 : 6;
      }
      // «2009-10» também conta como 2010.
      for (const year of qYears) {
        if (!qTokens.includes(year) && titleNorm.includes(year)) score += 8;
      }
      // Ordinal + tipo («2.º teste»): o certo sobe muito, o do mesmo tipo com outro número desce.
      if (qOrdinals.size > 0) {
        const tOrdinals = ordinalAssessmentKeys(m.title);
        for (const key of tOrdinals) {
          if (qOrdinals.has(key)) score += 25;
          else if ([...qOrdinals].some((q) => q.split(':')[1] === key.split(':')[1])) score -= 10;
        }
      }
      // O estudante escreveu o nome do ficheiro: entra de certeza.
      if (titleNorm.length >= 6 && currentNorm.includes(titleNorm)) score += 60;
      for (const tok of rTokens) {
        if (titleNorm.includes(tok)) score += /^\d{4}$/.test(tok) ? 5 : 2;
      }

      if (wantsTests) {
        if (group === 'tests') score += 4;
        else if (group === 'images') score += 2;
      }
      if (wantsProblems && group === 'problems') score += 4;
      if (wantsLessons && group === 'lessons') score += 4;

      return { m, idx, score };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((entry) => entry.m);
}

/**
 * O estudante refere-se a um teste/exame concreto («alínea c do grupo 1 do teste 2 de 2009-2010»)?
 * Devolve esse material só quando há exatamente um que bate no tipo, no número e nos anos.
 * Com vários testes quase iguais anexados, o modelo confunde-os e resolve o enunciado errado.
 */
export function findAssessmentCandidates<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string): T[] {
  const qKeys = ordinalAssessmentKeys(queryText);
  const qYears = new Set([
    ...academicYearTokens(queryText),
    ...(normalizeSourceText(queryText).match(/\b20\d\d\b/g) ?? []),
  ]);
  const norm = normalizeSourceText(queryText);
  const mentionsAssessment = /\b(teste|exame|frequencia|recurso|prova|exam|test)\b/.test(norm);
  if (!mentionsAssessment || (qKeys.size === 0 && qYears.size === 0)) return [];
  // «teste» não é «exame»: se a pergunta diz o tipo, só esse tipo conta.
  const kinds = ['teste', 'exame', 'frequencia', 'recurso'].filter((k) => new RegExp(`\\b${k}`).test(norm));
  const matches = materials.filter((m) => {
    if (sourceGroupKey(m) !== 'tests') return false;
    const titleKindNorm = normalizeSourceText(m.title);
    if (kinds.length > 0 && !kinds.some((k) => new RegExp(`\\b${k}`).test(titleKindNorm))) return false;
    if (qKeys.size > 0 && ![...ordinalAssessmentKeys(m.title)].some((k) => qKeys.has(k))) return false;
    const titleNorm = normalizeSourceText(m.title);
    return [...qYears].every((y) => titleNorm.includes(y));
  });
  // Duplicados do mesmo ficheiro («… 2009 2010» e «… 2009 2010 (1)») contam como um.
  const distinct = new Map<string, T>();
  for (const m of matches) {
    const key = normalizeSourceText(stripExtension(m.title)).replace(/\s+1$/, '');
    if (!distinct.has(key)) distinct.set(key, m);
  }
  return [...distinct.values()];
}

/**
 * O estudante refere-se a um teste/exame concreto («alínea c do grupo 1 do teste 2 de 2009-2010»)?
 * Devolve esse material só quando há exatamente um que bate no tipo, no número e nos anos.
 * Com vários testes quase iguais anexados, o modelo confunde-os e resolve o enunciado errado.
 */
export function findTargetAssessmentDocument<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string): T | null {
  if (ordinalAssessmentKeys(queryText).size === 0) return null;
  const candidates = findAssessmentCandidates(materials, queryText);
  return candidates.length === 1 ? candidates[0] : null;
}

/** Quando há um documento-alvo, tira os outros testes/exames (as aulas e fichas ficam). */
export function focusMaterialsOnTarget<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], target: T): T[] {
  return [target, ...materials.filter((m) => m !== target && sourceGroupKey(m) !== 'tests')];
}
