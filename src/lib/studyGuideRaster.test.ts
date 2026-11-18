import { describe, expect, it } from 'vitest';
import { computePageSlices, PAGE_CONTENT_H_PX, PAGE_CONTENT_W_PX } from './studyGuidePdf';
import {
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  PIXEL_RATIO,
  groupSlicesForCapture,
  pageCaptureRatio,
} from './studyGuideRaster';

/** Guia sintético: `pages` páginas de blocos de 100 px. */
function slicesFor(pages: number) {
  const total = pages * PAGE_CONTENT_H_PX;
  const blocks: [number, number][] = [];
  for (let t = 0; t < total; t += 100) blocks.push([t, t + 100]);
  return computePageSlices(blocks, PAGE_CONTENT_H_PX, total);
}

describe('pageCaptureRatio', () => {
  it('guia curto mantém o PIXEL_RATIO completo', () => {
    expect(pageCaptureRatio(PAGE_CONTENT_W_PX, PAGE_CONTENT_H_PX) / 0.999).toBeCloseTo(PIXEL_RATIO, 5);
    expect(pageCaptureRatio(PAGE_CONTENT_W_PX, 400)).toBeGreaterThan(1.99);
  });

  it.each([25, 60])('guia de %i páginas: nenhuma captura passa os limites', (n) => {
    const slices = slicesFor(n);
    expect(slices.length).toBeGreaterThanOrEqual(n);
    for (const [s, e] of slices) {
      const h = Math.ceil(e - s);
      const r = pageCaptureRatio(PAGE_CONTENT_W_PX, h);
      expect(r).toBeGreaterThan(1.9);
      const cw = Math.ceil(PAGE_CONTENT_W_PX * r);
      const ch = Math.ceil(h * r);
      expect(cw * ch).toBeLessThanOrEqual(MAX_CANVAS_AREA);
      expect(Math.max(cw, ch)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    }
  });

  it('captura gigante desce abaixo de 1 e respeita os limites', () => {
    const w = PAGE_CONTENT_W_PX;
    const h = 60 * PAGE_CONTENT_H_PX;
    const r = pageCaptureRatio(w, h);
    expect(r).toBeLessThan(1);
    expect(Math.ceil(w * r) * Math.ceil(h * r)).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    expect(Math.ceil(h * r)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });

  it('medidas inválidas dão 0', () => {
    expect(pageCaptureRatio(0, 100)).toBe(0);
    expect(pageCaptureRatio(100, NaN)).toBe(0);
  });

  it('agrupa páginas em poucas capturas, sem nunca passar os limites', () => {
    const slices = Array.from({ length: 60 }, (_, i) => [i * 1000, (i + 1) * 1000] as const);
    const groups = groupSlicesForCapture(slices, PAGE_CONTENT_W_PX);
    expect(groups.flat()).toEqual(slices);
    expect(groups.length).toBeLessThan(20);
    for (const g of groups) {
      const h = g[g.length - 1][1] - g[0][0];
      const r = pageCaptureRatio(PAGE_CONTENT_W_PX, h);
      expect(r).toBeGreaterThan(1.9);
      expect(Math.ceil(PAGE_CONTENT_W_PX * r) * Math.ceil(h * r)).toBeLessThanOrEqual(MAX_CANVAS_AREA);
      expect(Math.ceil(h * r)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    }
  });
});
