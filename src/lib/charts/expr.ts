// Leitor de expressões matemáticas SEGURO para os gráficos do Uni (sem eval nem new Function).
// Gramática: números, variáveis/parâmetros com nome, + − * / ^ (direita), menos unário,
// parênteses e chamadas de funções de uma lista fechada. Tudo o resto é recusado.

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Expr }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Expr; b: Expr }
  | { k: 'call'; fn: string; args: Expr[] };

export type Scope = Record<string, number>;
export type CompiledExpr = (scope: Scope) => number;

const MAX_LENGTH = 400;
const MAX_DEPTH = 60;

const FUNCTIONS: Record<string, { arity: [number, number]; fn: (...a: number[]) => number }> = {
  sin: { arity: [1, 1], fn: Math.sin },
  cos: { arity: [1, 1], fn: Math.cos },
  tan: { arity: [1, 1], fn: Math.tan },
  asin: { arity: [1, 1], fn: Math.asin },
  acos: { arity: [1, 1], fn: Math.acos },
  atan: { arity: [1, 1], fn: Math.atan },
  atan2: { arity: [2, 2], fn: Math.atan2 },
  sinh: { arity: [1, 1], fn: Math.sinh },
  cosh: { arity: [1, 1], fn: Math.cosh },
  tanh: { arity: [1, 1], fn: Math.tanh },
  sqrt: { arity: [1, 1], fn: Math.sqrt },
  cbrt: { arity: [1, 1], fn: Math.cbrt },
  exp: { arity: [1, 1], fn: Math.exp },
  ln: { arity: [1, 1], fn: Math.log },
  log: { arity: [1, 2], fn: (x, base) => (base === undefined ? Math.log10(x) : Math.log(x) / Math.log(base)) },
  log10: { arity: [1, 1], fn: Math.log10 },
  log2: { arity: [1, 1], fn: Math.log2 },
  abs: { arity: [1, 1], fn: Math.abs },
  sign: { arity: [1, 1], fn: Math.sign },
  floor: { arity: [1, 1], fn: Math.floor },
  ceil: { arity: [1, 1], fn: Math.ceil },
  round: { arity: [1, 1], fn: Math.round },
  min: { arity: [1, 8], fn: Math.min },
  max: { arity: [1, 8], fn: Math.max },
  pow: { arity: [2, 2], fn: Math.pow },
  hypot: { arity: [1, 8], fn: Math.hypot },
  deg: { arity: [1, 1], fn: (x) => (x * 180) / Math.PI },
  rad: { arity: [1, 1], fn: (x) => (x * Math.PI) / 180 },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, π: Math.PI };

export class ExprError extends Error {}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  if (src.length > MAX_LENGTH) throw new ExprError('expressão demasiado longa');
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-zπστεθα-ωΑ-Ω_][A-Za-z0-9_σταα-ωΑ-Ω]*/.exec(s.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      // «**» como potência
      if (c === '*' && s[i + 1] === '*') {
        out.push({ t: 'op', v: '^' });
        i += 2;
        continue;
      }
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new ExprError(`símbolo inesperado «${c}»`);
  }
  return out;
}

/** Converte texto em árvore. Lança ExprError se a expressão não for válida. */
export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek()?.v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new ExprError(`falta «${v}»`);
    p++;
  };

  const parseSum = (d: number): Expr => {
    if (d > MAX_DEPTH) throw new ExprError('expressão demasiado profunda');
    let left = parseProduct(d + 1);
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: '+' | '-' }).v;
      left = { k: 'bin', op, a: left, b: parseProduct(d + 1) };
    }
    return left;
  };
  const parseProduct = (d: number): Expr => {
    let left = parseUnary(d + 1);
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: '*' | '/' }).v;
        left = { k: 'bin', op, a: left, b: parseUnary(d + 1) };
        continue;
      }
      // Multiplicação implícita: «2x», «2(x+1)», «2 sin(x)»
      const nx = peek();
      if (nx && (nx.t === 'num' || nx.t === 'id' || (nx.t === 'op' && nx.v === '('))) {
        left = { k: 'bin', op: '*', a: left, b: parseUnary(d + 1) };
        continue;
      }
      return left;
    }
  };
  const parseUnary = (d: number): Expr => {
    if (d > MAX_DEPTH) throw new ExprError('expressão demasiado profunda');
    if (isOp('-')) {
      p++;
      return { k: 'neg', a: parseUnary(d + 1) };
    }
    if (isOp('+')) {
      p++;
      return parseUnary(d + 1);
    }
    return parsePower(d + 1);
  };
  const parsePower = (d: number): Expr => {
    const base = parseAtom(d + 1);
    if (isOp('^')) {
      p++;
      return { k: 'bin', op: '^', a: base, b: parseUnary(d + 1) };
    }
    return base;
  };
  const parseAtom = (d: number): Expr => {
    const tk = peek();
    if (!tk) throw new ExprError('expressão incompleta');
    if (tk.t === 'num') {
      p++;
      return { k: 'num', v: tk.v };
    }
    if (tk.t === 'id') {
      p++;
      if (isOp('(')) {
        const fname = tk.v.toLowerCase();
        const def = FUNCTIONS[fname];
        if (!def) throw new ExprError(`função desconhecida «${tk.v}»`);
        p++;
        const args: Expr[] = [];
        if (!isOp(')')) {
          args.push(parseSum(d + 1));
          while (isOp(',')) {
            p++;
            args.push(parseSum(d + 1));
          }
        }
        expectOp(')');
        if (args.length < def.arity[0] || args.length > def.arity[1]) {
          throw new ExprError(`«${tk.v}» com número errado de argumentos`);
        }
        return { k: 'call', fn: fname, args };
      }
      return { k: 'var', name: tk.v };
    }
    if (tk.t === 'op' && tk.v === '(') {
      p++;
      const inner = parseSum(d + 1);
      expectOp(')');
      return inner;
    }
    throw new ExprError(`símbolo inesperado «${tk.v}»`);
  };

  const tree = parseSum(0);
  if (p !== toks.length) throw new ExprError('sobra texto no fim da expressão');
  return tree;
}

/** Variáveis livres usadas (para validar contra x, y, t e os parâmetros declarados). */
export function freeVariables(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.k) {
    case 'var':
      if (!(e.name.toLowerCase() in CONSTANTS) && !(e.name in CONSTANTS)) out.add(e.name);
      break;
    case 'neg':
      freeVariables(e.a, out);
      break;
    case 'bin':
      freeVariables(e.a, out);
      freeVariables(e.b, out);
      break;
    case 'call':
      e.args.forEach((a) => freeVariables(a, out));
      break;
    default:
      break;
  }
  return out;
}

function evaluate(e: Expr, scope: Scope): number {
  switch (e.k) {
    case 'num':
      return e.v;
    case 'var': {
      if (e.name in scope) return scope[e.name];
      const c = CONSTANTS[e.name] ?? CONSTANTS[e.name.toLowerCase()];
      return c ?? NaN;
    }
    case 'neg':
      return -evaluate(e.a, scope);
    case 'bin': {
      const a = evaluate(e.a, scope);
      const b = evaluate(e.b, scope);
      switch (e.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return Math.pow(a, b);
      }
      return NaN;
    }
    case 'call':
      return FUNCTIONS[e.fn].fn(...e.args.map((a) => evaluate(a, scope)));
  }
}

/**
 * Compila uma expressão, verificando que só usa as variáveis permitidas.
 * Aceita «lhs = rhs» quando `allowEquation` (devolve lhs − rhs, para curvas implícitas).
 */
export function compileExpr(
  src: string,
  allowed: Iterable<string>,
  opts: { allowEquation?: boolean } = {},
): CompiledExpr {
  let text = String(src ?? '').trim();
  if (!text) throw new ExprError('expressão vazia');
  const eqParts = text.split('=');
  if (eqParts.length > 2) throw new ExprError('mais de um «=»');
  if (eqParts.length === 2) {
    if (!opts.allowEquation) {
      // «y = 2x + 1» numa função: usa só o lado direito.
      if (/^\s*y\s*$/i.test(eqParts[0])) text = eqParts[1];
      else throw new ExprError('«=» não é permitido aqui');
    } else {
      text = `(${eqParts[0]}) - (${eqParts[1]})`;
    }
  }
  const tree = parseExpr(text);
  const ok = new Set(allowed);
  for (const v of freeVariables(tree)) {
    if (!ok.has(v)) throw new ExprError(`variável desconhecida «${v}»`);
  }
  return (scope) => {
    const r = evaluate(tree, scope);
    return Number.isFinite(r) ? r : NaN;
  };
}

/** Valor numérico de um campo que pode ser número ou expressão com parâmetros («sy/2»). */
export function evalNumber(value: unknown, params: Scope): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string' && value.trim()) {
    try {
      return compileExpr(value, Object.keys(params))(params);
    } catch {
      return NaN;
    }
  }
  return NaN;
}
