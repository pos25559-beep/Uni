/** Utilitários para posicionar, limitar à janela e persistir janelas flutuantes móveis (PiP). */

export interface FloatingBoxSize {
  width: number;
  height: number;
}

export interface FloatingViewport {
  width: number;
  height: number;
  margin?: number;
  topSafe?: number;
  bottomSafe?: number;
}

export interface FloatingAnchorRatio {
  /** Posição horizontal normalizada entre 0 (esquerda) e 1 (direita). */
  rx: number;
  /** Posição vertical normalizada entre 0 (topo) e 1 (fundo). */
  ry: number;
}

export interface FloatingPoint {
  x: number;
  y: number;
}

const DEFAULT_MARGIN = 16;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function getViewportBounds(box: FloatingBoxSize, viewport: FloatingViewport) {
  const margin = viewport.margin ?? (viewport.width < 768 ? 12 : DEFAULT_MARGIN);
  const topSafe = viewport.topSafe ?? margin;
  const bottomSafe = viewport.bottomSafe ?? (viewport.width < 768 ? 84 : margin);

  const minX = margin;
  const maxX = Math.max(minX, viewport.width - box.width - margin);
  const minY = topSafe;
  const maxY = Math.max(minY, viewport.height - box.height - bottomSafe);

  return { minX, maxX, minY, maxY };
}

/** Garante que a janela flutuante nunca sai dos limites visíveis do ecrã. */
export function clampFloatingPosition(
  x: number,
  y: number,
  box: FloatingBoxSize,
  viewport: FloatingViewport,
): FloatingPoint {
  const { minX, maxX, minY, maxY } = getViewportBounds(box, viewport);
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, x))),
    y: Math.round(Math.min(maxY, Math.max(minY, y))),
  };
}

/** Posição inicial por omissão: canto inferior direito (sem tapar cabeçalhos no topo). */
export function defaultFloatingRatio(): FloatingAnchorRatio {
  return { rx: 1, ry: 1 };
}

export function ratiosToPosition(
  ratio: FloatingAnchorRatio,
  box: FloatingBoxSize,
  viewport: FloatingViewport,
): FloatingPoint {
  const { minX, maxX, minY, maxY } = getViewportBounds(box, viewport);
  const spanX = Math.max(0, maxX - minX);
  const spanY = Math.max(0, maxY - minY);
  return {
    x: Math.round(minX + clamp01(ratio.rx) * spanX),
    y: Math.round(minY + clamp01(ratio.ry) * spanY),
  };
}

export function positionToRatios(
  x: number,
  y: number,
  box: FloatingBoxSize,
  viewport: FloatingViewport,
): FloatingAnchorRatio {
  const { minX, maxX, minY, maxY } = getViewportBounds(box, viewport);
  const clamped = clampFloatingPosition(x, y, box, viewport);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  return {
    rx: spanX > 0 ? clamp01((clamped.x - minX) / spanX) : 1,
    ry: spanY > 0 ? clamp01((clamped.y - minY) / spanY) : 1,
  };
}

export function loadSavedFloatingRatio(storageKey: string): FloatingAnchorRatio | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FloatingAnchorRatio>;
    if (typeof parsed?.rx !== 'number' || typeof parsed?.ry !== 'number') return null;
    if (!Number.isFinite(parsed.rx) || !Number.isFinite(parsed.ry)) return null;
    return { rx: clamp01(parsed.rx), ry: clamp01(parsed.ry) };
  } catch {
    return null;
  }
}

export function saveFloatingRatio(storageKey: string, ratio: FloatingAnchorRatio): void {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ rx: clamp01(ratio.rx), ry: clamp01(ratio.ry) }),
    );
  } catch {
    // ignore storage quota
  }
}

export function clearSavedFloatingRatio(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage quota
  }
}
