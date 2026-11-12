// Predefinições visuais dos gráficos (DESIGN.md §6): só tokens CSS, sem gradientes nem sombras.

export const axisTick = { fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' };

/** Eixos sem linha nem marcas. */
export const axisProps = { tick: axisTick, axisLine: false, tickLine: false };

/** Só linhas horizontais. */
export const gridProps = { stroke: 'var(--line)', vertical: false };

export const cursorFill = { fill: 'var(--surface-2)' };

export const legendStyle = { fontSize: 11, color: 'var(--muted)' };

/** Cantos de 3px no topo das barras. */
export const barRadius: [number, number, number, number] = [3, 3, 0, 0];

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animação de entrada curta, desligada com prefers-reduced-motion. */
export const animation = () => ({ isAnimationActive: !prefersReducedMotion(), animationDuration: 350 });
