// Limites de canvas para a rasterização do Guia de Estudo (puro, testável).
// Cada página é capturada à parte; o pixelRatio de cada uma é limitado para nunca
// ultrapassar os máximos de canvas do Safari/iOS (que falha em silêncio: página em branco).

/** Resolução desejada (pixels do ecrã por px CSS). */
export const PIXEL_RATIO = 2;
/** Área máxima de um canvas: o iOS/Safari aceita ~16,7 M px (4096 x 4096); fica margem. */
export const MAX_CANVAS_AREA = 16_000_000;
/** Lado máximo de um canvas, abaixo dos 16384 px dos navegadores móveis mais restritivos. */
export const MAX_CANVAS_SIDE = 8192;

/**
 * pixelRatio de uma captura de `widthPx` x `heightPx` (px CSS): o desejado, reduzido só o
 * necessário para respeitar o lado e a área máximos. Sem mínimo artificial: só desce abaixo
 * de 1 se uma única captura for enorme. Devolve 0 se as medidas forem inválidas.
 */
export function pageCaptureRatio(
  widthPx: number,
  heightPx: number,
  desired: number = PIXEL_RATIO,
  maxSide: number = MAX_CANVAS_SIDE,
  maxArea: number = MAX_CANVAS_AREA,
): number {
  if (!(widthPx > 0) || !(heightPx > 0) || !(desired > 0)) return 0;
  const bySide = maxSide / Math.max(widthPx, heightPx);
  const byArea = Math.sqrt(maxArea / (widthPx * heightPx));
  // Folga de 0,1 % para o arredondamento do canvas (ceil das dimensões) nunca passar o limite.
  return Math.min(desired, bySide, byArea) * 0.999;
}

/**
 * Junta páginas seguidas em grupos que cabem num só canvas com a resolução desejada,
 * para fazer poucas capturas (cada captura clona o guia inteiro e é lenta) sem nunca
 * passar os limites. Uma página que sozinha não cabe fica num grupo próprio
 * (e `pageCaptureRatio` baixa-lhe a resolução).
 */
export function groupSlicesForCapture(
  slices: ReadonlyArray<readonly [number, number]>,
  widthPx: number,
  desired: number = PIXEL_RATIO,
  maxSide: number = MAX_CANVAS_SIDE,
  maxArea: number = MAX_CANVAS_AREA,
): Array<Array<readonly [number, number]>> {
  const maxHeight = Math.min(maxSide / desired, maxArea / (widthPx * desired * desired)) * 0.999;
  const groups: Array<Array<readonly [number, number]>> = [];
  let current: Array<readonly [number, number]> = [];
  for (const slice of slices) {
    const groupStart = current.length > 0 ? current[0][0] : slice[0];
    if (current.length > 0 && Math.ceil(slice[1] - groupStart) > maxHeight) {
      groups.push(current);
      current = [];
    }
    current.push(slice);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
