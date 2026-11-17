// Converte matemática escrita em texto simples pelo modelo («sigma_y», «tau_xy», «sqrt(3)»,
// «integral(...)») em LaTeX, para o KaTeX a desenhar. Só mexe fora de trechos já em $...$.

// Sem «beta», «eta», «nu», «xi», «chi»: aparecem como palavras normais em texto corrido.
const GREEK = [
  'alpha', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'theta', 'kappa',
  'lambda', 'mu', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'psi', 'omega',
  'Delta', 'Sigma', 'Omega', 'Phi', 'Gamma', 'Lambda',
];

const UNICODE_GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'varepsilon', η: 'eta', θ: 'theta', κ: 'kappa',
  λ: 'lambda', μ: 'mu', ν: 'nu', ρ: 'rho', σ: 'sigma', τ: 'tau', φ: 'phi', ω: 'omega', Δ: 'Delta', Σ: 'Sigma',
};

// Índice com «_» pode ter letras (sigma_xy); sem «_» só algarismos (sigma1), para não apanhar «mutação».
const GREEK_WORD = new RegExp(
  `(?<![\\p{L}\\\\])(${GREEK.join('|')})(?:_(\\{[^}]{1,12}\\}|[A-Za-z0-9]{1,4})|([0-9]{1,2}))?(?![\\p{L}0-9])`,
  'gu',
);
const GREEK_CHAR_SUB = new RegExp(`([${Object.keys(UNICODE_GREEK).join('')}])_(\\{[^}]{1,12}\\}|[A-Za-z0-9]{1,4})`, 'g');
const SQRT = /\bsqrt\(([^()]{1,20})\)/g;

function sub(s: string): string {
  if (!s) return '';
  const inner = s.startsWith('{') ? s.slice(1, -1) : s;
  return `_{${inner}}`;
}

/** Aplica fn só aos trechos fora de $...$ / $$...$$ / `código`. */
function outsideMath(text: string, fn: (plain: string) => string): string {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`]*`)/g);
  return parts.map((part, i) => (i % 2 === 1 ? part : fn(part))).join('');
}

/** Texto corrido: «tau = sigma_y / sqrt(3)» → «$\tau$ = $\sigma_{y}$ / $\sqrt{3}$». */
export function normalizePlainMathText(text: string): string {
  if (!text) return text;
  return outsideMath(text, (plain) =>
    plain
      .replace(GREEK_WORD, (_m, name: string, s?: string, digits?: string) => `$\\${name}${sub(s ?? digits ?? '')}$`)
      .replace(GREEK_CHAR_SUB, (_m, ch: string, s: string) => `$\\${UNICODE_GREEK[ch]}${sub(s)}$`)
      .replace(SQRT, (_m, inner: string) => `$\\sqrt{${inner}}$`),
  );
}

/** Campo que já devia ser LaTeX: «integral(sigma_y * d_epsilon_p) dV» → «\int(\sigma_{y} \cdot d\varepsilon_{p}) dV». */
export function normalizeLatexFormula(formula: string): string {
  if (!formula) return formula;
  let f = formula.trim().replace(/^\$+|\$+$/g, '').trim();
  if (/\\[a-zA-Z]+/.test(f) && !/\b(sigma|tau|epsilon|sqrt|integral)\b/.test(f)) return f;
  f = f
    .replace(/\bintegral\s*\(/g, '\\int(')
    .replace(/\bd_(epsilon|varepsilon)(?:_([A-Za-z0-9]{1,4}))?\b/g, (_m, _e: string, s?: string) => `d\\varepsilon${sub(s ?? '')}`)
    .replace(/(^|[^\\\p{L}])(alpha|beta|gamma|delta|epsilon|varepsilon|eta|theta|kappa|lambda|mu|nu|rho|sigma|tau|phi|omega)(?:_(\{[^}]{1,12}\}|[A-Za-z0-9]{1,4})|([0-9]{1,2}))?(?![\p{L}0-9])/gu,
      (_m, pre: string, name: string, s?: string, digits?: string) =>
        `${pre}\\${name === 'epsilon' ? 'varepsilon' : name}${sub(s ?? digits ?? '')}`)
    .replace(/(^|[^\\])\bsqrt\(([^()]{1,30})\)/g, (_m, pre: string, inner: string) => `${pre}\\sqrt{${inner}}`)
    .replace(/\s\*\s/g, ' \\cdot ')
    .replace(/\b([A-Za-z])_(ext|int|max|min|eq|y|w|p)\b/g, (_m, v: string, s: string) => `${v}_{\\text{${s}}}`);
  return f;
}
