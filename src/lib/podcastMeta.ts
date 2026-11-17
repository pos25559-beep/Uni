import type { PodcastScript } from './uniVoice';

/** Duração estimada do episódio em minutos inteiros (≈2,5 palavras por segundo, mínimo 1). */
export function estimatePodcastMinutes(script: PodcastScript): number {
  const words = script.lines.reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0);
  // Arredonda para cima, para bater certo com o relógio do leitor (1:28 → ~2 min).
  return Math.max(1, Math.ceil(words / 2.5 / 60));
}
