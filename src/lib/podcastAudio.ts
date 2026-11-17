// Ajudas puras para sintetizar o podcast por partes e acompanhar quem fala no áudio final.

export interface PodcastChunk {
  /** Índices das falas (no guião) que vão nesta parte. */
  lineIndexes: number[];
}

/**
 * Divide o guião em partes pequenas para a voz neural: um pedido com o episódio inteiro
 * excede o que o modelo de voz devolve de uma vez e falha (ou corta o fim).
 */
export function chunkPodcastLines(
  lines: Array<{ text: string }>,
  maxChars = 900,
  maxLines = 8,
): PodcastChunk[] {
  const chunks: PodcastChunk[] = [];
  let current: number[] = [];
  let chars = 0;
  lines.forEach((line, idx) => {
    const len = line.text.length;
    if (current.length > 0 && (chars + len > maxChars || current.length >= maxLines)) {
      chunks.push({ lineIndexes: current });
      current = [];
      chars = 0;
    }
    current.push(idx);
    chars += len;
  });
  if (current.length > 0) chunks.push({ lineIndexes: current });
  return chunks;
}

/** Duração em segundos de PCM 16 bits mono. */
export function pcmDurationSeconds(byteLength: number, sampleRate: number): number {
  return byteLength / (sampleRate * 2);
}

/**
 * Início estimado de cada fala dentro de uma parte, repartindo a duração da parte
 * pelo comprimento do texto de cada fala.
 */
export function lineStartsInChunk(lengths: number[], chunkStart: number, chunkDuration: number): number[] {
  const total = lengths.reduce((a, b) => a + Math.max(1, b), 0);
  let acc = 0;
  return lengths.map((len) => {
    const start = chunkStart + (acc / total) * chunkDuration;
    acc += Math.max(1, len);
    return start;
  });
}

/** Índice da fala que está a tocar no segundo indicado. */
export function activeLineAt(lineStarts: number[], seconds: number): number {
  if (lineStarts.length === 0) return -1;
  let idx = 0;
  for (let i = 0; i < lineStarts.length; i++) {
    if (lineStarts[i] <= seconds) idx = i;
    else break;
  }
  return idx;
}

export type NeuralAudioFailure = 'quota' | 'model' | 'network' | 'other';

/** Motivo simples da falha da voz neural, para explicar ao estudante. */
export function classifyNeuralAudioError(err: unknown): NeuralAudioFailure {
  const lower = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'quota';
  }
  if (lower.includes('404') || lower.includes('not found') || lower.includes('not supported') || lower.includes('does not support')) {
    return 'model';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout') || lower.includes('deadline') || lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return 'network';
  }
  return 'other';
}
