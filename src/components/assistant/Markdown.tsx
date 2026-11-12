// Renderização segura de Markdown simples. Faz parse para elementos React (sem HTML bruto).
import type { ReactNode } from 'react';

const FENCE = /^\s*```/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const UL_ITEM = /^\s*[-*]\s+(.*)$/;
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/;

// Ordem importa: código, ligações, negrito, itálico.
const INLINE = /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  INLINE.lastIndex = 0;
  for (const m of text.matchAll(INLINE)) {
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
      out.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
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
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) { code.push(lines[i]); i++; }
      i++; // fecho da cerca (ou fim do texto)
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded-xl border border-line bg-bg p-3 font-mono text-xs leading-relaxed">
          <code>{code.join('\n')}</code>
        </pre>,
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

    // Parágrafo: junta linhas consecutivas até um bloco novo.
    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() !== '' && !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) && !UL_ITEM.test(lines[i]) && !OL_ITEM.test(lines[i])
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
