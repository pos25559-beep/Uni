import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampFloatingPosition,
  clearSavedFloatingRatio,
  defaultFloatingRatio,
  loadSavedFloatingRatio,
  positionToRatios,
  ratiosToPosition,
  saveFloatingRatio,
} from '../floatingPosition';

describe('floatingPosition', () => {
  const box = { width: 280, height: 54 };
  const desktop = { width: 1440, height: 900, margin: 16, topSafe: 14, bottomSafe: 20 };
  const mobile = { width: 390, height: 844, margin: 12, topSafe: 14, bottomSafe: 84 };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posiciona por omissão no canto inferior direito dentro das margens seguras', () => {
    const def = defaultFloatingRatio();
    expect(def).toEqual({ rx: 1, ry: 1 });

    const desktopPos = ratiosToPosition(def, box, desktop);
    expect(desktopPos).toEqual({ x: 1440 - 280 - 16, y: 900 - 54 - 20 });

    const mobilePos = ratiosToPosition(def, box, mobile);
    expect(mobilePos).toEqual({ x: 390 - 280 - 12, y: 844 - 54 - 84 });
  });

  it('limita coordenadas negativas ou fora do ecrã aos limites visíveis', () => {
    expect(clampFloatingPosition(-100, -50, box, desktop)).toEqual({ x: 16, y: 14 });
    expect(clampFloatingPosition(9999, 9999, box, desktop)).toEqual({
      x: 1440 - 280 - 16,
      y: 900 - 54 - 20,
    });
  });

  it('preserva proporcionalmente o canto escolhido quando a janela é redimensionada', () => {
    const topLeft = positionToRatios(16, 14, box, desktop);
    expect(topLeft).toEqual({ rx: 0, ry: 0 });
    expect(ratiosToPosition(topLeft, box, mobile)).toEqual({ x: 12, y: 14 });

    const bottomRight = positionToRatios(1144, 826, box, desktop);
    expect(bottomRight).toEqual({ rx: 1, ry: 1 });
    expect(ratiosToPosition(bottomRight, box, { width: 1024, height: 700, margin: 16, topSafe: 14, bottomSafe: 20 })).toEqual({
      x: 1024 - 280 - 16,
      y: 700 - 54 - 20,
    });
  });

  it('guarda, lê e limpa a posição em localStorage de forma resiliente', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
      removeItem: (k: string) => mem.delete(k),
    });

    const key = 'test-floating-pill';
    expect(loadSavedFloatingRatio(key)).toBeNull();

    saveFloatingRatio(key, { rx: 0.25, ry: 0.8 });
    expect(loadSavedFloatingRatio(key)).toEqual({ rx: 0.25, ry: 0.8 });

    mem.set(key, '{corrupt');
    expect(loadSavedFloatingRatio(key)).toBeNull();

    clearSavedFloatingRatio(key);
    expect(loadSavedFloatingRatio(key)).toBeNull();
  });
});
