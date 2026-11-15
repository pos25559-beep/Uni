// Conversão leve de expressões LaTeX para texto legível (fallback durante streaming e exportação PDF).
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
  [/\\iiint\b|\\iint\b|\\int\b/g, '∫'],
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
  for (let pass = 0; pass < 2; pass++) {
    out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  }
  for (const [pattern, replacement] of LATEX_SYMBOLS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\{([^{}\s]{1,12})\}/g, '$1');
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** Limpa delimitadores matemáticos ($...$, $$...$$, \(...\), \[...\]) para texto simples / exportação PDF. */
export function flattenMarkdownMathForText(text: string): string {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => formatInlineLatexToText(inner))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner: string) => formatInlineLatexToText(inner))
    .replace(/\\\(([^)\n]+?)\\\)/g, (_, inner: string) => formatInlineLatexToText(inner))
    .replace(
      /\$(?!\s)(?!\d+(?:[.,]\d+)?(?:\s|$))([^$\n]+?)(?<!\s)\$/g,
      (_, inner: string) => formatInlineLatexToText(inner),
    );
}
