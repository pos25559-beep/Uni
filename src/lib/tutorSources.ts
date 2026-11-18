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
const ASSESSMENT_KINDS = '(mini teste|minitest|teste|exame|frequencia|test|exam|prova)';
const KIND_CONNECTOR = '(?:\\s+(?:e|ou|and|y)(?:\\s+(?:os?|as?))?)?';

function assessmentKindOf(k: string): string {
  return k.startsWith('exam') || k === 'exame' ? 'exame' : k.startsWith('freq') ? 'frequencia' : 'teste';
}

/**
 * Números de teste/exame/frequência → conjunto de chaves «N:tipo». Reconhece:
 * «2 teste», «2º teste», «2.º teste», «2.ª frequência», «segundo teste», «teste 2», «Teste 2 2011-2012»,
 * listas («1º e 2º teste», «1.º, 2.º e 3.º testes», «testes 1 e 2») e «T1 2021» (só com ano).
 * Serve para não confundir o 1.º com o 2.º teste do mesmo ano.
 */
export function ordinalAssessmentKeys(text: string): Set<string> {
  const norm = normalizeSourceText(text).replace(
    /\b(primeiro|primeira|segundo|segunda|terceiro|terceira|quarto|quarta|first|second|third)\b/g,
    (w) => ORDINAL_WORDS[w] ?? w,
  );
  const keys = new Set<string>();
  // Números antes do tipo: «1º e o 2º teste».
  const before = new RegExp(
    `\\b((?:[1-4](?:\\s*[oa])?${KIND_CONNECTOR}\\s+)+)${ASSESSMENT_KINDS}s?\\b`,
    'g',
  );
  for (const m of norm.matchAll(before)) {
    for (const d of m[1].matchAll(/[1-4]/g)) keys.add(`${d[0]}:${assessmentKindOf(m[2])}`);
  }
  // Números depois do tipo: «teste 2», «testes 1 e 2». Os anos («2011») nunca são um dígito isolado.
  const after = new RegExp(
    `\\b${ASSESSMENT_KINDS}s?\\s+((?:[1-4]\\b(?:\\s+(?:e|ou|and|y)(?=\\s+[1-4]\\b))?\\s*)+)`,
    'g',
  );
  for (const m of norm.matchAll(after)) {
    for (const d of m[2].matchAll(/[1-4]/g)) keys.add(`${d[0]}:${assessmentKindOf(m[1])}`);
  }
  // «T1 2021»: abreviatura de teste, só com um ano ao lado (senão «T1» é uma aula).
  if (/\b(19|20)\d{2}\b/.test(norm)) {
    for (const m of norm.matchAll(/\bt([1-4])\b/g)) keys.add(`${m[1]}:teste`);
  }
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

const KIND_WORDS = ['teste', 'exame', 'frequencia', 'recurso'];

/** Época da avaliação indicada num texto: recurso, especial ou normal (por omissão, nos títulos). */
function epochOf(norm: string): 'recurso' | 'especial' | 'normal' {
  if (/\brecurso\b/.test(norm)) return 'recurso';
  if (/\bespecial\b/.test(norm)) return 'especial';
  return 'normal';
}

/** Anos da pergunta/título como conjunto («2019/20», «2019-2020» e «2019 2020» dão {2019, 2020}). */
function yearSet(text: string): Set<string> {
  return new Set([...academicYearTokens(text), ...(normalizeSourceText(text).match(/\b20\d\d\b/g) ?? [])]);
}

/** Materiais de teste/exame que batem com a pergunta, usando só as chaves de número dadas. */
function matchAssessments<T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>>(
  materials: readonly T[],
  queryText: string,
  qKeys: ReadonlySet<string>,
): T[] {
  const norm = normalizeSourceText(queryText);
  const qYears = yearSet(queryText);
  const wantsNormalEpoch = /\bepoca normal\b/.test(norm);
  const wantsSpecialEpoch = /\bepoca especial\b/.test(norm);
  // «teste» não é «exame»: se a pergunta diz o tipo, só esse tipo conta.
  const kinds = KIND_WORDS.filter((k) => new RegExp(`\\b${k}`).test(norm));
  if (wantsNormalEpoch && !kinds.some((k) => k !== 'recurso')) kinds.push('exame');
  const matches = materials.filter((m) => {
    if (sourceGroupKey(m) !== 'tests') return false;
    const titleNorm = normalizeSourceText(m.title);
    if (kinds.length > 0 && !kinds.some((k) => new RegExp(`\\b${k}`).test(titleNorm))) return false;
    // «exame de recurso»: tem de ser mesmo o de recurso, não o da época normal.
    if (kinds.includes('recurso') && epochOf(titleNorm) !== 'recurso') return false;
    if (wantsNormalEpoch && epochOf(titleNorm) !== 'normal') return false;
    if (wantsSpecialEpoch && epochOf(titleNorm) !== 'especial') return false;
    if (qKeys.size > 0 && ![...ordinalAssessmentKeys(m.title)].some((k) => qKeys.has(k))) return false;
    const tYears = yearSet(m.title);
    return [...qYears].every((y) => tYears.has(y));
  });
  // Duplicados do mesmo ficheiro («… 2009 2010» e «… 2009 2010 (1)») contam como um.
  const distinct = new Map<string, T>();
  for (const m of matches) {
    const key = normalizeSourceText(stripExtension(m.title)).replace(/\s+1$/, '');
    if (!distinct.has(key)) distinct.set(key, m);
  }
  return [...distinct.values()];
}

const MENTIONS_ASSESSMENT = /\b(teste|exame|frequencia|recurso|prova|exam|test|epoca normal|epoca especial)\b/;

/**
 * Candidatos a «o teste/exame de que o estudante fala»: bate no tipo, na época, nos números
 * (qualquer um dos pedidos) e nos anos letivos. Vazio se a pergunta não nomeia número nem ano.
 */
export function findAssessmentCandidates<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string): T[] {
  const qKeys = ordinalAssessmentKeys(queryText);
  const norm = normalizeSourceText(queryText);
  if (!MENTIONS_ASSESSMENT.test(norm) || (qKeys.size === 0 && yearSet(queryText).size === 0)) return [];
  return matchAssessments(materials, queryText, qKeys);
}

/**
 * O estudante refere-se a testes/exames concretos («alínea c do grupo 1 do teste 2 de 2009-2010»,
 * «compara o 1º e o 2º teste»)? Devolve um material por cada número pedido que bata sem dúvida.
 * Um número sem ficheiro é ignorado (os outros mantêm-se); um número com vários ficheiros possíveis
 * deixa tudo por decidir (devolve []), para o Uni perguntar. Sem número, só devolve o ficheiro se
 * tipo/época e ano o identificarem de forma única («exame de recurso 2019/20»).
 */
export function findTargetAssessmentDocuments<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string): T[] {
  const qKeys = ordinalAssessmentKeys(queryText);
  if (qKeys.size === 0) {
    const norm = normalizeSourceText(queryText);
    if (!MENTIONS_ASSESSMENT.test(norm) || yearSet(queryText).size === 0) return [];
    const only = matchAssessments(materials, queryText, qKeys);
    return only.length === 1 ? only : [];
  }
  const out: T[] = [];
  for (const key of qKeys) {
    const found = matchAssessments(materials, queryText, new Set([key]));
    if (found.length > 1) return [];
    if (found.length === 1 && !out.includes(found[0])) out.push(found[0]);
  }
  return out;
}

/** Versão de um só documento: só devolve quando o pedido aponta para exatamente um. */
export function findTargetAssessmentDocument<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], queryText: string): T | null {
  const targets = findTargetAssessmentDocuments(materials, queryText);
  return targets.length === 1 ? targets[0] : null;
}

/** Quando há documentos-alvo, tira os outros testes/exames (as aulas e fichas ficam). */
export function focusMaterialsOnTarget<
  T extends Pick<Material, 'title'> & Partial<Pick<Material, 'category' | 'mimeType'>>,
>(materials: readonly T[], target: T | readonly T[]): T[] {
  const targets: readonly T[] = Array.isArray(target) ? (target as readonly T[]) : [target as T];
  return [...targets, ...materials.filter((m) => !targets.includes(m) && sourceGroupKey(m) !== 'tests')];
}
