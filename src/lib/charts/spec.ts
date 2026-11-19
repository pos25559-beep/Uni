// Gráficos do Uni Tutor: o modelo descreve o gráfico em JSON (bloco ```uni-grafico) e a app
// valida e calcula tudo. O modelo nunca calcula pontos de curvas: dá expressões e a app amostra.
import { compileExpr, evalNumber, ExprError, type Scope } from './expr';

export type ChartColor = 'accent' | 'coral' | 'sky' | 'amber' | 'ink' | 'muted' | 'plum' | 'teal';
export const CHART_COLORS: ChartColor[] = ['accent', 'coral', 'sky', 'amber', 'teal', 'plum', 'ink'];

type Pt = [number, number];

interface StyleBase {
  label?: string;
  color: ChartColor;
  dashed: boolean;
}

/** Itens já validados e calculados, prontos a desenhar. */
export type ChartItem =
  | (StyleBase & { type: 'curve'; segments: Pt[][]; fill: boolean })
  | (StyleBase & { type: 'points'; points: Pt[]; pointLabels: (string | undefined)[] })
  | (StyleBase & { type: 'bars'; bars: Array<{ x: number; y: number; width: number }> })
  | (StyleBase & { type: 'circle'; center: Pt; r: number; fill: boolean })
  | (StyleBase & { type: 'arrow'; from: Pt; to: Pt })
  | (StyleBase & { type: 'text'; at: Pt; text: string })
  | (StyleBase & { type: 'hline'; y: number })
  | (StyleBase & { type: 'vline'; x: number });

export interface ChartAxis {
  label?: string;
  min: number;
  max: number;
}

export interface ChartModel {
  title?: string;
  caption?: string;
  x: ChartAxis;
  y: ChartAxis;
  equalAspect: boolean;
  grid: boolean;
  items: ChartItem[];
}

export class ChartSpecError extends Error {}

const MAX_ITEMS = 24;
const MAX_POINTS = 400;
const SAMPLES = 480;
const IMPLICIT_GRID = 140;

const str = (v: unknown, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

function pickColor(v: unknown, idx: number): ChartColor {
  if (typeof v === 'string' && (CHART_COLORS as string[]).concat('muted').includes(v)) return v as ChartColor;
  return CHART_COLORS[idx % CHART_COLORS.length];
}

function readParams(raw: unknown): Scope {
  const out: Scope = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    if (!/^[A-Za-zα-ωΑ-Ω_][A-Za-z0-9_α-ωΑ-Ω]*$/.test(k) || ['x', 'y', 't'].includes(k)) continue;
    const n = evalNumber(v, out);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function readPoint(v: unknown, params: Scope): Pt | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const x = evalNumber(v[0], params);
  const y = evalNumber(v[1], params);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function readRange(v: unknown, params: Scope): [number, number] | null {
  const p = readPoint(v, params);
  if (!p || !(p[1] > p[0])) return null;
  return p;
}

/** Amostra y = f(x), partindo a curva onde não está definida ou dá saltos (assíntotas). */
function sampleFunction(f: (x: number) => number, x0: number, x1: number, yspan: number): Pt[][] {
  const segs: Pt[][] = [];
  let cur: Pt[] = [];
  let prevY: number | null = null;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / SAMPLES;
    const y = f(x);
    if (!Number.isFinite(y) || (prevY !== null && Math.abs(y - prevY) > yspan * 2.5)) {
      if (cur.length > 1) segs.push(cur);
      cur = Number.isFinite(y) ? [[x, y]] : [];
      prevY = Number.isFinite(y) ? y : null;
      continue;
    }
    cur.push([x, y]);
    prevY = y;
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function sampleParametric(fx: (t: number) => number, fy: (t: number) => number, t0: number, t1: number): Pt[][] {
  const segs: Pt[][] = [];
  let cur: Pt[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = t0 + ((t1 - t0) * i) / SAMPLES;
    const x = fx(t);
    const y = fy(t);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
      continue;
    }
    cur.push([x, y]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

/**
 * Curva implícita F(x, y) = 0 por «marching squares» numa grelha sobre a janela visível.
 * Devolve pequenos segmentos (suficiente para desenhar; não é preciso encadeá-los).
 */
export function sampleImplicit(
  F: (x: number, y: number) => number,
  xr: [number, number],
  yr: [number, number],
  n = IMPLICIT_GRID,
): Pt[][] {
  const nx = n;
  const ny = n;
  const dx = (xr[1] - xr[0]) / nx;
  const dy = (yr[1] - yr[0]) / ny;
  const val: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) row.push(F(xr[0] + i * dx, yr[0] + j * dy));
    val.push(row);
  }
  const segs: Pt[][] = [];
  const lerp = (a: number, b: number) => (Math.abs(a - b) < 1e-12 ? 0.5 : a / (a - b));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v0 = val[j][i];
      const v1 = val[j][i + 1];
      const v2 = val[j + 1][i + 1];
      const v3 = val[j + 1][i];
      if (![v0, v1, v2, v3].every(Number.isFinite)) continue;
      const x = xr[0] + i * dx;
      const y = yr[0] + j * dy;
      const edges: Pt[] = [];
      // arestas: baixo (v0-v1), direita (v1-v2), cima (v3-v2), esquerda (v0-v3)
      if (v0 > 0 !== v1 > 0) edges.push([x + lerp(v0, v1) * dx, y]);
      if (v1 > 0 !== v2 > 0) edges.push([x + dx, y + lerp(v1, v2) * dy]);
      if (v3 > 0 !== v2 > 0) edges.push([x + lerp(v3, v2) * dx, y + dy]);
      if (v0 > 0 !== v3 > 0) edges.push([x, y + lerp(v0, v3) * dy]);
      if (edges.length === 2) segs.push([edges[0], edges[1]]);
      else if (edges.length === 4) {
        segs.push([edges[0], edges[1]]);
        segs.push([edges[2], edges[3]]);
      }
    }
  }
  return chainSegments(segs, Math.min(dx, dy) * 1e-3);
}

/**
 * Junta os segmentos soltos do «marching squares» em linhas contínuas (para o tracejado e
 * os preenchimentos saírem certos). Liga pontas que coincidem (com tolerância `eps`).
 */
export function chainSegments(segs: Pt[][], eps: number): Pt[][] {
  const keyOf = (p: Pt) => `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)}`;
  const byEnd = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of [s[0], s[s.length - 1]]) {
      const k = keyOf(p);
      byEnd.set(k, [...(byEnd.get(k) ?? []), i]);
    }
  });
  const used = new Array(segs.length).fill(false);
  const lines: Pt[][] = [];
  const takeNext = (p: Pt): Pt[] | null => {
    for (const idx of byEnd.get(keyOf(p)) ?? []) {
      if (used[idx]) continue;
      used[idx] = true;
      const s = segs[idx];
      return keyOf(s[0]) === keyOf(p) ? s.slice(1) : [...s].reverse().slice(1);
    }
    return null;
  };
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let line: Pt[] = [...segs[i]];
    for (let next = takeNext(line[line.length - 1]); next; next = takeNext(line[line.length - 1])) line.push(...next);
    for (let prev = takeNext(line[0]); prev; prev = takeNext(line[0])) line = [...prev.reverse(), ...line];
    lines.push(line);
  }
  return lines;
}

/** Limites automáticos a partir do que foi desenhado (com margem), se o modelo não os deu. */
function autoRange(values: number[], fallback: [number, number]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return fallback;
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

/**
 * Valida o JSON do modelo e calcula o gráfico. Lança ChartSpecError com uma razão curta
 * quando não dá para desenhar (o chat mostra então o texto normal).
 */
export function buildChart(raw: unknown): ChartModel {
  if (!raw || typeof raw !== 'object') throw new ChartSpecError('o gráfico não é um objeto JSON');
  const spec = raw as Record<string, unknown>;
  const params = readParams(spec.params);
  const paramNames = Object.keys(params);
  const xs = (spec.x ?? {}) as Record<string, unknown>;
  const ys = (spec.y ?? {}) as Record<string, unknown>;
  let xr: [number, number] | null =
    Number.isFinite(evalNumber(xs.min, params)) && Number.isFinite(evalNumber(xs.max, params))
      ? [evalNumber(xs.min, params), evalNumber(xs.max, params)]
      : null;
  let yr: [number, number] | null =
    Number.isFinite(evalNumber(ys.min, params)) && Number.isFinite(evalNumber(ys.max, params))
      ? [evalNumber(ys.min, params), evalNumber(ys.max, params)]
      : null;
  if (xr && !(xr[1] > xr[0])) xr = null;
  if (yr && !(yr[1] > yr[0])) yr = null;

  const rawItems = Array.isArray(spec.items) ? spec.items.slice(0, MAX_ITEMS) : [];
  if (rawItems.length === 0) throw new ChartSpecError('o gráfico não tem elementos');

  // 1.ª passagem: itens com coordenadas explícitas (para limites automáticos).
  const explicitX: number[] = [];
  const explicitY: number[] = [];
  for (const it of rawItems as Array<Record<string, unknown>>) {
    const pts: unknown[] = [];
    if (Array.isArray(it.points)) pts.push(...it.points);
    if (it.center) pts.push(it.center);
    if (it.from) pts.push(it.from);
    if (it.to) pts.push(it.to);
    if (it.at) pts.push(it.at);
    for (const p of pts) {
      const q = readPoint(p, params);
      if (q) {
        explicitX.push(q[0]);
        explicitY.push(q[1]);
      }
    }
    if (it.type === 'circle') {
      const c = readPoint(it.center, params);
      const r = evalNumber(it.r, params);
      if (c && r > 0) {
        explicitX.push(c[0] - r, c[0] + r);
        explicitY.push(c[1] - r, c[1] + r);
      }
    }
  }
  const xRange: [number, number] = xr ?? autoRange(explicitX, [-10, 10]);

  const items: ChartItem[] = [];
  const curveYs: number[] = [];
  const errors: string[] = [];

  rawItems.forEach((value, idx) => {
    const it = (value ?? {}) as Record<string, unknown>;
    const base: StyleBase = {
      label: str(it.label, 60),
      color: pickColor(it.color, idx),
      dashed: it.dashed === true,
    };
    try {
      switch (it.type) {
        case 'function': {
          const f = compileExpr(String(it.expr ?? ''), ['x', ...paramNames]);
          const dom = readRange(it.domain, params) ?? xRange;
          const lo = Math.max(dom[0], xRange[0]);
          const hi = Math.min(dom[1], xRange[1]);
          if (!(hi > lo)) break;
          const ySpan = yr ? yr[1] - yr[0] : 1e9;
          const segs = sampleFunction((x) => f({ ...params, x }), lo, hi, ySpan);
          segs.forEach((s) => s.forEach((p) => curveYs.push(p[1])));
          items.push({ ...base, type: 'curve', segments: segs, fill: false });
          break;
        }
        case 'parametric': {
          const fx = compileExpr(String(it.x ?? ''), ['t', ...paramNames]);
          const fy = compileExpr(String(it.y ?? ''), ['t', ...paramNames]);
          const tr = readRange(it.t, params) ?? [0, 2 * Math.PI];
          const segs = sampleParametric((t) => fx({ ...params, t }), (t) => fy({ ...params, t }), tr[0], tr[1]);
          segs.forEach((s) =>
            s.forEach((p) => {
              explicitX.push(p[0]);
              curveYs.push(p[1]);
            }),
          );
          items.push({ ...base, type: 'curve', segments: segs, fill: it.fill === true });
          break;
        }
        case 'implicit': {
          // Calculada depois de fixar os limites (precisa da janela visível).
          compileExpr(String(it.expr ?? ''), ['x', 'y', ...paramNames], { allowEquation: true });
          items.push({ ...base, type: 'curve', segments: [], fill: false, __implicit: String(it.expr) } as ChartItem);
          break;
        }
        case 'points': {
          const raws = Array.isArray(it.points) ? it.points.slice(0, MAX_POINTS) : [];
          const pts = raws.map((p) => readPoint(p, params)).filter((p): p is Pt => Boolean(p));
          if (pts.length === 0) break;
          const labels = Array.isArray(it.labels) ? it.labels.map((l) => str(l, 30)) : [];
          items.push({ ...base, type: 'points', points: pts, pointLabels: pts.map((_, i) => labels[i]) });
          break;
        }
        case 'line':
        case 'polygon': {
          const raws = Array.isArray(it.points) ? it.points.slice(0, MAX_POINTS) : [];
          const pts = raws.map((p) => readPoint(p, params)).filter((p): p is Pt => Boolean(p));
          if (pts.length < 2) break;
          const closed = it.type === 'polygon' || it.closed === true;
          items.push({
            ...base,
            type: 'curve',
            segments: [closed ? [...pts, pts[0]] : pts],
            fill: it.fill === true && closed,
          });
          break;
        }
        case 'bars': {
          const raws = Array.isArray(it.bars) ? it.bars.slice(0, 60) : [];
          const width = evalNumber(it.width, params);
          const bars = raws
            .map((b) => readPoint(b, params))
            .filter((p): p is Pt => Boolean(p))
            .map(([x, y]) => ({ x, y, width: width > 0 ? width : 0 }));
          if (bars.length === 0) break;
          bars.forEach((b) => {
            explicitX.push(b.x);
            curveYs.push(b.y, 0);
          });
          items.push({ ...base, type: 'bars', bars });
          break;
        }
        case 'circle': {
          const c = readPoint(it.center, params);
          const r = evalNumber(it.r, params);
          if (!c || !(r > 0)) break;
          items.push({ ...base, type: 'circle', center: c, r, fill: it.fill === true });
          break;
        }
        case 'arrow': {
          const from = readPoint(it.from, params);
          const to = readPoint(it.to, params);
          if (!from || !to) break;
          items.push({ ...base, type: 'arrow', from, to });
          break;
        }
        case 'text': {
          const at = readPoint(it.at, params);
          const text = str(it.text, 60);
          if (!at || !text) break;
          items.push({ ...base, type: 'text', at, text });
          break;
        }
        case 'hline': {
          const y = evalNumber(it.y, params);
          if (Number.isFinite(y)) items.push({ ...base, type: 'hline', y });
          break;
        }
        case 'vline': {
          const x = evalNumber(it.x, params);
          if (Number.isFinite(x)) items.push({ ...base, type: 'vline', x });
          break;
        }
        default:
          break;
      }
    } catch (err) {
      errors.push(err instanceof ExprError ? err.message : 'elemento inválido');
    }
  });

  const finalX: [number, number] = xr ?? autoRange(explicitX, xRange);
  const finalY: [number, number] =
    yr ?? autoRange([...explicitY, ...curveYs.filter((v) => Math.abs(v) < 1e12)], [-10, 10]);

  // Curvas implícitas: precisam da janela final.
  for (const item of items) {
    const implicitExpr = (item as { __implicit?: string }).__implicit;
    if (implicitExpr === undefined || item.type !== 'curve') continue;
    const F = compileExpr(implicitExpr, ['x', 'y', ...paramNames], { allowEquation: true });
    item.segments = sampleImplicit((x, y) => F({ ...params, x, y }), finalX, finalY);
    delete (item as { __implicit?: string }).__implicit;
  }

  const drawable = items.filter((it) => (it.type === 'curve' ? it.segments.length > 0 : true));
  if (drawable.length === 0) {
    throw new ChartSpecError(errors[0] ?? 'nenhum elemento ficou visível');
  }

  return {
    title: str(spec.title, 90),
    caption: str(spec.caption, 200),
    x: { label: str(xs.label, 40), min: finalX[0], max: finalX[1] },
    y: { label: str(ys.label, 40), min: finalY[0], max: finalY[1] },
    equalAspect: spec.equalAspect === true,
    grid: spec.grid !== false,
    items: drawable,
  };
}

/** Lê o texto de um bloco ```uni-grafico; lança ChartSpecError se não for JSON válido. */
export function parseChartBlock(text: string): ChartModel {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ChartSpecError('o JSON do gráfico está mal formado');
  }
  return buildChart(raw);
}

/** Marcas «bonitas» para um eixo (1, 2, 5 × 10^n). */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-9 && out.length < 50; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}
