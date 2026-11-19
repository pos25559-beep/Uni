import { describe, expect, it } from 'vitest';
import { compileExpr, ExprError, parseExpr } from '../charts/expr';
import { buildChart, ChartSpecError, niceTicks, parseChartBlock } from '../charts/spec';

describe('leitor de expressões (sem eval)', () => {
  it('calcula com precedência, potência à direita, menos unário e funções', () => {
    const f = compileExpr('2 + 3*x^2^1 - -1 + sin(pi/2) + max(abs(-4), 2)', ['x']);
    expect(f({ x: 2 })).toBeCloseTo(2 + 12 + 1 + 1 + 4);
    expect(compileExpr('2^3^2', [])({})).toBe(512);
    expect(compileExpr('2x + 3(x+1)', ['x'])({ x: 1 })).toBe(8);
    expect(compileExpr('y = 2*x', ['x'])({ x: 3 })).toBe(6);
    expect(compileExpr('x^2 = 4', ['x'], { allowEquation: true })({ x: 2 })).toBe(0);
  });

  it('recusa código, variáveis e funções desconhecidas', () => {
    expect(() => compileExpr('alert(1)', ['x'])).toThrow(ExprError);
    expect(() => compileExpr('x + z', ['x'])).toThrow(/variável desconhecida/);
    expect(() => parseExpr('constructor.prototype')).toThrow(ExprError);
    expect(() => parseExpr('x;y')).toThrow(ExprError);
    expect(() => parseExpr('(x')).toThrow(ExprError);
  });

  it('valores impossíveis dão NaN em vez de rebentar', () => {
    expect(compileExpr('sqrt(-1)', [])({})).toBeNaN();
    expect(compileExpr('1/x', ['x'])({ x: 0 })).toBeNaN();
  });
});

describe('gráficos do Uni', () => {
  const vonMisesTresca = {
    title: 'Critérios no plano das tensões principais',
    x: { label: 'σ1', min: -300, max: 300 },
    y: { label: 'σ2', min: -300, max: 300 },
    equalAspect: true,
    params: { sy: 250 },
    items: [
      { type: 'implicit', expr: 'x^2 - x*y + y^2 = sy^2', label: 'von Mises' },
      { type: 'implicit', expr: 'max(abs(x), abs(y), abs(x - y)) = sy', label: 'Tresca', dashed: true },
      { type: 'points', points: [[150, -80]], labels: ['A'] },
    ],
  };

  it('von Mises: todos os pontos da curva implícita estão na elipse', () => {
    const chart = buildChart(vonMisesTresca);
    const vm = chart.items[0];
    expect(vm.type).toBe('curve');
    if (vm.type !== 'curve') return;
    // A elipse inteira sai numa só linha contínua (tracejados e preenchimentos funcionam).
    expect(vm.segments.length).toBeLessThanOrEqual(2);
    expect(vm.segments.flat().length).toBeGreaterThan(100);
    for (const seg of vm.segments) {
      for (const [x, y] of seg) {
        const eq = Math.sqrt(x * x - x * y + y * y);
        expect(Math.abs(eq - 250)).toBeLessThan(250 * 0.03);
      }
    }
  });

  it('Tresca: o hexágono passa nos vértices (σy, σy) e (σy, 0)', () => {
    const chart = buildChart(vonMisesTresca);
    const tr = chart.items[1];
    if (tr.type !== 'curve') throw new Error('esperava curva');
    const pts = tr.segments.flat();
    const near = (px: number, py: number) => pts.some(([x, y]) => Math.hypot(x - px, y - py) < 10);
    expect(near(250, 250)).toBe(true);
    expect(near(250, 0)).toBe(true);
    expect(near(-250, -250)).toBe(true);
    expect(tr.dashed).toBe(true);
  });

  it('paramétrica, função com assíntota e círculo de Mohr com parâmetros', () => {
    const chart = buildChart({
      x: { min: -5, max: 5 },
      y: { min: -5, max: 5 },
      params: { sx: 80, sy2: -20, txy: 30 },
      items: [
        { type: 'parametric', x: '2*cos(t)', y: 'sin(t)', t: [0, 'pi'] },
        { type: 'function', expr: '1/x' },
        { type: 'circle', center: ['(sx+sy2)/2', 0], r: 'sqrt(((sx-sy2)/2)^2 + txy^2)' },
      ],
    });
    const [ellipse, hyper, mohr] = chart.items;
    if (ellipse.type !== 'curve' || hyper.type !== 'curve' || mohr.type !== 'circle') throw new Error('tipos');
    expect(ellipse.segments[0][0][0]).toBeCloseTo(2);
    // 1/x parte em dois troços (assíntota em x = 0)
    expect(hyper.segments.length).toBeGreaterThanOrEqual(2);
    expect(mohr.center[0]).toBe(30);
    expect(mohr.r).toBeCloseTo(Math.sqrt(50 * 50 + 30 * 30));
  });

  it('limites automáticos quando o modelo não os dá', () => {
    const chart = buildChart({ items: [{ type: 'points', points: [[0, 0], [10, 200]] }] });
    expect(chart.x.min).toBeLessThan(0);
    expect(chart.x.max).toBeGreaterThan(10);
    expect(chart.y.max).toBeGreaterThan(200);
  });

  it('JSON mal formado ou sem nada desenhável dá um erro curto, nunca rebenta', () => {
    expect(() => parseChartBlock('{"items": [')).toThrow(ChartSpecError);
    expect(() => buildChart({ items: [] })).toThrow(ChartSpecError);
    expect(() => buildChart({ items: [{ type: 'function', expr: 'require(1)' }] })).toThrow(ChartSpecError);
  });

  it('marcas de eixo arredondadas', () => {
    expect(niceTicks(-300, 300)).toEqual([-300, -200, -100, 0, 100, 200, 300]);
    expect(niceTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
});
