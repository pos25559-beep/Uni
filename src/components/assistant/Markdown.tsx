// Renderização segura de Markdown e equações científicas LaTeX com KaTeX (+ proteção de preços).
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ReactNode } from 'react';
import { formatInlineLatexToText } from '../../lib/latexText';
import { ChartBlock, CHART_LANGS } from './charts/ChartBlock';

const FENCE = /^\s*```/;
const BLOCK_MATH_START = /^\s*(\$\$|\\\[)/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const UL_ITEM = /^\s*[-*]\s+(.*)$/;
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/;

function renderKatexHtml(expr: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(expr.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return null;
  }
}

function renderMathNodes(raw: string, keyPrefix: string, displayMode = false): ReactNode {
  const html = renderKatexHtml(raw, displayMode);
  if (html) {
    return (
      <span
        key={keyPrefix}
        className={
          displayMode
            ? 'block text-center text-fg [&_.katex-display]:my-0 [&_.katex]:text-[1.15em]'
            : 'inline-block align-baseline text-fg [&_.katex]:text-[1.08em]'
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  const formatted = formatInlineLatexToText(raw);
  return (
    <span key={keyPrefix} className="font-serif italic tracking-tight text-fg">
      {formatted}
    </span>
  );
}

// Ordem importa: código, matemática em bloco inline ($$...$$ / \[...\]), matemática inline ($...$ / \(...\)), ligações, negrito, itálico.
const INLINE =
  /(`[^`\n]+`)|(\$\$[^$\n]+?\$\$)|(\\\[[^\]\n]+?\\\])|(\\\([^)\n]+\\\))|(\$(?!\s)(?!\d+(?:[.,]\d+)?(?:\s+(?![=+\-*/^_\\<>×÷≈≤≥±(])|$))([^$\n]+?)(?<!\s)\$(?!\d))|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

const DISPLAY_MATH_BOX =
  'my-1.5 overflow-x-auto rounded-xl border border-line/80 bg-surface-2/75 px-4 py-3 text-center text-base sm:text-[1.08rem]';

function renderInline(text: string, keyPrefix: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  const matches = Array.from(text.matchAll(INLINE));
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const token = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('$$') || token.startsWith('\\[')) {
      out.push(
        <span key={key} className={`block ${DISPLAY_MATH_BOX}`}>
          {renderMathNodes(token.slice(2, -2), key, true)}
        </span>,
      );
    } else if (token.startsWith('\\(')) {
      out.push(<span key={key}>{renderMathNodes(token.slice(2, -2), key)}</span>);
    } else if (token.startsWith('$')) {
      out.push(<span key={key}>{renderMathNodes(token.slice(1, -1), key)}</span>);
    } else if (token.startsWith('[')) {
      const sep = token.indexOf('](');
      const label = token.slice(1, sep);
      const url = token.slice(sep + 2, -1);
      out.push(
        isSafeUrl(url)
          ? <a key={key} href={url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{label}</a>
          : label,
      );
    } else if (token.startsWith('**')) {
      const inner = token.slice(2, -2);
      out.push(
        <strong key={key} className="font-semibold">
          {depth < 4 ? renderInline(inner, `${key}-b`, depth + 1) : inner}
        </strong>,
      );
    } else {
      const inner = token.slice(1, -1);
      out.push(
        <em key={key}>
          {depth < 4 ? renderInline(inner, `${key}-i`, depth + 1) : inner}
        </em>,
      );
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;

    if (FENCE.test(line)) {
      const lang = line.trim().slice(3).trim().toLowerCase();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) { code.push(lines[i]); i++; }
      const closed = i < lines.length;
      i++; // fecho da cerca (ou fim do texto)
      if (CHART_LANGS.has(lang)) {
        blocks.push(<ChartBlock key={key} source={code.join('\n')} complete={closed} />);
        continue;
      }
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded-xl border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('$$') || trimmedLine.startsWith('\\[')) {
      const endDelim = trimmedLine.startsWith('$$') ? '$$' : '\\]';
      const innerFirst = trimmedLine.slice(2);
      const sameLineClose = innerFirst.indexOf(endDelim);
      if (sameLineClose !== -1) {
        const expr = innerFirst.slice(0, sameLineClose);
        const trailing = innerFirst.slice(sameLineClose + endDelim.length).trim();
        if (!trailing || /^[.,;:!?)]+$/.test(trailing)) {
          blocks.push(
            <div key={key} className={DISPLAY_MATH_BOX}>
              {renderMathNodes(expr, key, true)}
            </div>,
          );
          i++;
          continue;
        }
        // Linha contém texto adicional ou outra equação depois do bloco (ex.: $$a$$ e $$b$$).
        blocks.push(<p key={key}>{renderInline(line, key)}</p>);
        i++;
        continue;
      }
      const mathLines = [innerFirst];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith(endDelim)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        mathLines.push(lines[i].trim().slice(0, -2));
        i++;
      }
      blocks.push(
        <div key={key} className={DISPLAY_MATH_BOX}>
          {renderMathNodes(mathLines.join('\n'), key, true)}
        </div>,
      );
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], key);
      blocks.push(
        level === 1
          ? <h3 key={key} className="text-base font-semibold tracking-tight">{content}</h3>
          : level === 2
            ? <h4 key={key} className="text-sm font-semibold">{content}</h4>
            : <h5 key={key} className="text-sm font-medium text-muted">{content}</h5>,
      );
      i++;
      continue;
    }

    const isUl = UL_ITEM.test(line);
    const isOl = OL_ITEM.test(line);
    if (isUl || isOl) {
      const pattern = isUl ? UL_ITEM : OL_ITEM;
      const items: ReactNode[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        const m = pattern.exec(lines[i]);
        items.push(<li key={`i${items.length}`} className="pl-1">{renderInline(m?.[1] ?? '', `${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        isUl
          ? <ul key={key} className="list-disc space-y-1 pl-5">{items}</ul>
          : <ol key={key} className="list-decimal space-y-1 pl-5">{items}</ol>,
      );
      continue;
    }

    // Parágrafo: junta linhas consecutivas até um bloco novo (incluindo matemática em bloco $$ / \[).
    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() !== '' && !FENCE.test(lines[i]) &&
      !BLOCK_MATH_START.test(lines[i]) && !HEADING.test(lines[i]) &&
      !UL_ITEM.test(lines[i]) && !OL_ITEM.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key}>
        {para.map((p, idx) => (
          <span key={`l${idx}`}>
            {idx > 0 && <br />}
            {renderInline(p, `${key}-${idx}`)}
          </span>
        ))}
      </p>,
    );
  }

  return <div className="space-y-3 break-words text-sm leading-relaxed">{blocks}</div>;
}
