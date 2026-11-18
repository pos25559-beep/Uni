import { describe, expect, it } from 'vitest';
import { computePageSlices } from '../studyGuidePdf';

describe('computePageSlices', () => {
  it('devolve vazio sem blocos', () => {
    expect(computePageSlices([], 100)).toEqual([]);
  });

  it('uma página quando tudo cabe exatamente', () => {
    expect(computePageSlices([[0, 50], [50, 100]], 100)).toEqual([[0, 100]]);
  });

  it('quebra só entre blocos', () => {
    // 60 + 56 não cabem em 100: 3 páginas, cada uma a terminar na fronteira de um bloco
    expect(computePageSlices([[0, 60], [64, 120], [124, 180]], 100)).toEqual([[0, 60], [60, 120], [120, 180]]);
  });

  it('corta um bloco mais alto que a página em fatias', () => {
    expect(computePageSlices([[0, 250]], 100)).toEqual([[0, 100], [100, 200], [200, 250]]);
  });

  it('fecha a página antes do bloco alto e corta só esse', () => {
    expect(computePageSlices([[0, 40], [40, 300]], 100)).toEqual([[0, 40], [40, 140], [140, 240], [240, 300]]);
  });

  it('inclui o conteúdo depois do último bloco', () => {
    expect(computePageSlices([[0, 50]], 100, 80)).toEqual([[0, 80]]);
  });

  it('nunca parte um bloco que cabe numa página', () => {
    const blocks: [number, number][] = [];
    for (let i = 0; i < 20; i++) blocks.push([i * 45, i * 45 + 40]);
    const slices = computePageSlices(blocks, 100);
    for (const [s, e] of slices) {
      expect(e - s).toBeLessThanOrEqual(100);
      expect(blocks.some(([, b]) => Math.abs(b - e) < 1)).toBe(true);
    }
  });

  it('não cria uma página só com a margem de baixo do guia', () => {
    expect(computePageSlices([[0, 60], [64, 100]], 100, 102)).toEqual([[0, 100]]);
    // Um resto com conteúdo real continua a ter página.
    expect(computePageSlices([[0, 60], [64, 100], [100, 130]], 100, 132)).toEqual([[0, 100], [100, 132]]);
  });
});
