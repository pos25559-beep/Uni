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
