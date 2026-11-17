import { describe, expect, it } from 'vitest';
import {
  activeLineAt,
  chunkPodcastLines,
  classifyNeuralAudioError,
  lineStartsInChunk,
  pcmDurationSeconds,
} from '../podcastAudio';

describe('podcast por partes', () => {
  it('divide o guião em partes pequenas sem perder falas', () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ text: 'x'.repeat(i % 2 ? 300 : 100) }));
    const chunks = chunkPodcastLines(lines, 900, 8);
    expect(chunks.flatMap((c) => c.lineIndexes)).toEqual(lines.map((_, i) => i));
    for (const c of chunks) {
      const chars = c.lineIndexes.reduce((s, i) => s + lines[i].text.length, 0);
      expect(chars <= 900 || c.lineIndexes.length === 1).toBe(true);
      expect(c.lineIndexes.length).toBeLessThanOrEqual(8);
    }
  });

  it('calcula a duração do PCM e onde começa cada fala', () => {
    expect(pcmDurationSeconds(48000, 24000)).toBe(1);
    const starts = lineStartsInChunk([100, 300], 10, 8);
    expect(starts[0]).toBe(10);
    expect(starts[1]).toBe(12);
    expect(activeLineAt([0, 4, 9], 5)).toBe(1);
    expect(activeLineAt([0, 4, 9], 30)).toBe(2);
  });

  it('explica a falha da voz neural em categorias simples', () => {
    expect(classifyNeuralAudioError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe('quota');
    expect(classifyNeuralAudioError(new Error('models/x is not found for API version v1beta'))).toBe('model');
    expect(classifyNeuralAudioError(new Error('The model is overloaded (503)'))).toBe('network');
    expect(classifyNeuralAudioError(new Error('outra coisa'))).toBe('other');
  });
});
