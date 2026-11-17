// Ajudantes puros para as páginas de leitura de Markdown (quiz e resumo): índice a partir dos
// títulos, divisão em secções e separação das respostas do quiz.

export interface MarkdownHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

export interface MarkdownSection {
  /** Título (## ou ###) ou null no texto antes do primeiro título. */
  heading: MarkdownHeading | null;
  /** Corpo em Markdown, sem a linha do título. */
  body: string;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

/** Tira a marcação inline simples de um título para o mostrar como texto. */
export function plainHeadingText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Percorre as linhas ignorando blocos de código; devolve só os títulos de nível 1 a 3. */
function scanHeadings(md: string): Array<{ line: number; level: 1 | 2 | 3; text: string }> {
  const out: Array<{ line: number; level: 1 | 2 | 3; text: string }> = [];
  let inFence = false;
  md.split('\n').forEach((line, i) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = HEADING.exec(line);
    if (!m) return;
    const text = plainHeadingText(m[2]);
    if (text) out.push({ line: i, level: m[1].length as 1 | 2 | 3, text });
  });
  return out;
}

/** Títulos ## e ### (fora de blocos de código), com ids estáveis `mr-<ordem>-<slug>`. */
export function markdownHeadings(md: string): MarkdownHeading[] {
  const result: MarkdownHeading[] = [];
  for (const h of scanHeadings(md || '')) {
    if (h.level === 1) continue;
    result.push({ level: h.level as 2 | 3, text: h.text, id: `mr-${result.length}-${slugify(h.text) || 'sec'}` });
  }
  return result;
}

/**
 * Divide o Markdown em secções por ##/###. O primeiro título de nível 1 é o título do
 * documento e não entra no corpo (o cabeçalho da página já o mostra).
 */
export function splitMarkdownSections(md: string): MarkdownSection[] {
  const lines = (md || '').split('\n');
  const headings = scanHeadings(md || '');
  const withIds = markdownHeadings(md || '');
  const sections: MarkdownSection[] = [];
  let cursor = 0;
  let current: MarkdownSection = { heading: null, body: '' };
  let hi = 0;
  const flush = (end: number) => {
    current.body = lines.slice(cursor, end).join('\n').trim();
    if (current.heading || current.body) sections.push(current);
  };
  for (const h of headings) {
    if (h.level === 1) {
      // Título do documento: sai do corpo.
      flush(h.line);
      current = { heading: null, body: '' };
      cursor = h.line + 1;
      continue;
    }
    flush(h.line);
    current = { heading: withIds[hi++], body: '' };
    cursor = h.line + 1;
  }
  flush(lines.length);
  return sections;
}

/** Título do documento: o primeiro `# ` fora de código. */
export function markdownTitle(md: string): string | null {
  return scanHeadings(md || '').find((h) => h.level === 1)?.text ?? null;
}

const ANSWERS_TITLE = /respost|answer|solu[cç]|gabarito|corre[cç]|key\b|chave/i;

/** A secção é a das respostas do quiz? (pelo título) */
export function isAnswersHeading(text: string): boolean {
  return ANSWERS_TITLE.test(text);
}

export interface AnswerItem {
  /** Número da pergunta a que responde (1, 2, ...). */
  n: number;
  /** Markdown da resposta, sem o prefixo numérico. */
  text: string;
}

const ANSWER_START = /^\s*(?:\*\*)?(\d{1,2})[.):]?(?:\*\*)?(?:[.):])?\s+(.*)$/;

/**
 * Divide o corpo da secção de respostas em itens numerados (`1. ...`, `**1.** ...`).
 * Devolve null quando não há pelo menos 2 itens numerados em sequência (estrutura incerta).
 */
export function splitAnswerItems(body: string): AnswerItem[] | null {
  const items: AnswerItem[] = [];
  let inFence = false;
  for (const line of (body || '').split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const m = !inFence && !FENCE.test(line) ? ANSWER_START.exec(line) : null;
    if (m) {
      items.push({ n: Number(m[1]), text: m[2] });
    } else if (items.length > 0) {
      items[items.length - 1].text += `\n${line}`;
    } else if (line.trim()) {
      return null; // texto solto antes do primeiro item: não arriscar
    }
  }
  if (items.length < 2) return null;
  if (!items.every((it, i) => it.n === items[0].n + i)) return null;
  return items.map((it) => ({ ...it, text: it.text.trim() }));
}
