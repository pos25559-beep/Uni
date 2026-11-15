// Renderização segura de Markdown simples e fórmulas matemáticas sem LaTeX cru.
import type { ReactNode } from 'react';

const FENCE = /^\s*```/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const UL_ITEM = /^\s*[-*]\s+(.*)$/;
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/;

const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\infty\b/g, '∞'],
  [/\\approx\b/g, '≈'],
  [/\\neq\b/g, '≠'],
  [/\\leq?\b/g, '≤'],
  [/\\geq?\b/g, '≥'],
  [/\\times\b/g, '×'],
  [/\\cdot\b/g, '·'],
  [/\\pm\b/g, '±'],
  [/\\div\b/g, '÷'],
  [/\\rightarrow\b|\\to\b/g, '→'],
  [/\\leftarrow\b/g, '←'],
  [/\\leftrightarrow\b/g, '↔'],
  [/\\Rightarrow\b/g, '⇒'],
  [/\\partial\b/g, '∂'],
  [/\\nabla\b/g, '∇'],
  [/\\forall\b/g, '∀'],
  [/\\exists\b/g, '∃'],
  [/\\in\b/g, '∈'],
  [/\\notin\b/g, '∉'],
  [/\\subset\b/g, '⊂'],
  [/\\subseteq\b/g, '⊆'],
  [/\\cup\b/g, '∪'],
  [/\\cap\b/g, '∩'],
  [/\\int\b/g, '∫'],
  [/\\sum\b/g, '∑'],
  [/\\prod\b/g, '∏'],
  [/\\degree\b/g, '°'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\delta\b/g, 'δ'],
  [/\\epsilon\b|\\varepsilon\b/g, 'ε'],
  [/\\zeta\b/g, 'ζ'],
  [/\\eta\b/g, 'η'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\nu\b/g, 'ν'],
  [/\\xi\b/g, 'ξ'],
  [/\\pi\b/g, 'π'],
  [/\\rho\b/g, 'ρ'],
  [/\\sigma\b/g, 'σ'],
  [/\\tau\b/g, 'τ'],
  [/\\phi\b|\\varphi\b/g, 'φ'],
  [/\\chi\b/g, 'χ'],
  [/\\psi\b/g, 'ψ'],
  [/\\omega\b/g, 'ω'],
  [/\\Delta\b/g, 'Δ'],
  [/\\Gamma\b/g, 'Γ'],
  [/\\Theta\b/g, 'Θ'],
  [/\\Lambda\b/g, 'Λ'],
  [/\\Pi\b/g, 'Π'],
  [/\\Sigma\b/g, 'Σ'],
  [/\\Phi\b/g, 'Φ'],
  [/\\Psi\b/g, 'Ψ'],
  [/\\Omega\b/g, 'Ω'],
  [/\\left\(/g, '('],
  [/\\right\)/g, ')'],
  [/\\left\[/g, '['],
  [/\\right\]/g, ']'],
  [/\\left\|/g, '|'],
  [/\\right\|/g, '|'],
  [/\\,/g, ' '],
];

/** Converte expressões LaTeX simples (ex.: `\pi`, `\frac{a}{b}`, `\sqrt{x}`) em notação legível Unicode. */
export function formatInlineLatexToText(raw: string): string {
  let out = raw.trim();
  out = out.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]+)\}/g, '$1');
  // Resolve frações simples aninhadas até 2 níveis.
  for (let pass = 0; pass < 2; pass++) {
    out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  }
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    out = out.replace(pattern, replacement);
  }
  // Remove delimitadores {} residuais simples.
  out = out.replace(/\{([^{}\s]{1,12})\}/g, '$1');
  return out.replace(/\s{2,}/g, ' ').trim();
}

function renderMathNodes(raw: string, keyPrefix: string): ReactNode {
  const formatted = formatInlineLatexToText(raw);
  const parts: ReactNode[] = [];
  const scriptRe = /(\^\{[^}]+\}|\^[A-Za-z0-9+π∞-]+|_\{[^}]+\}|_[A-Za-z0-9+-]+)|(\\[a-zA-Z]+)/g;
  let last = 0;
  let idx = 0;

  for (const m of formatted.matchAll(scriptRe)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(formatted.slice(last, start));
    const tok = m[0];
    const key = `${keyPrefix}-m-${idx++}`;
    if (tok.startsWith('^')) {
      const inner = tok.startsWith('^{') ? tok.slice(2, -1) : tok.slice(1);
      parts.push(<sup key={key} className="text-[0.75em]">{inner}</sup>);
    } else if (tok.startsWith('_')) {
      const inner = tok.startsWith('_{') ? tok.slice(2, -1) : tok.slice(1);
      parts.push(<sub key={key} className="text-[0.75em]">{inner}</sub>);
    } else {
      parts.push(tok.slice(1));
    }
    last = start + tok.length;
  }
  if (last < formatted.length) parts.push(formatted.slice(last));

  return (
    <span className="font-serif italic tracking-tight text-fg">
      {parts.length > 0 ? parts : formatted}
    </span>
  );
}

// Ordem importa: código, matemática inline ($...$ / \(...\)), ligações, negrito, itálico.
const INLINE =
  /(`[^`\n]+`)|(\\\([^)\n]+\\\))|(\$(?!\s)(?!\d+(?:[.,]\d+)?(?:\s|$))([^$\n]+?)(?<!\s)\$)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;

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

    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('$$') || trimmedLine.startsWith('\\[')) {
      const endDelim = trimmedLine.startsWith('$$') ? '$$' : '\\]';
      const innerFirst = trimmedLine.slice(2);
      if (innerFirst.endsWith(endDelim) && innerFirst.length >= 2) {
        blocks.push(
          <div
            key={key}
            className="overflow-x-auto rounded-xl border border-line/70 bg-surface-2/65 px-3.5 py-2.5 text-center text-base"
          >
            {renderMathNodes(innerFirst.slice(0, -2), key)}
          </div>,
        );
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
        <div
          key={key}
          className="overflow-x-auto rounded-xl border border-line/70 bg-surface-2/65 px-3.5 py-2.5 text-center text-base"
        >
          {renderMathNodes(mathLines.join(' '), key)}
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
