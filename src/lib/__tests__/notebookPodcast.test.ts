import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSheetPodcast, podcastScriptToMarkdown, saveSheetPodcast, deleteSheetPodcast, type PodcastScript } from '../uniVoice';

const LOCALES = ['pt-PT', 'pt-BR', 'es', 'en'] as const;

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k));
}

function load(locale: string): Record<string, any> {
  const file = path.resolve(process.cwd(), 'src/locales', locale, 'assistant.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

describe('notebook podcast and voice notes strings', () => {
  it('has identical key sets for podcast, voiceNotes and the podcast mode labels in all locales', () => {
    const ref = load('pt-PT');
    const refKeys = [
      ...flatKeys(ref.notebook.podcast, 'podcast'),
      ...flatKeys(ref.notebook.voiceNotes, 'voiceNotes'),
    ].sort();
    expect(refKeys.length).toBeGreaterThan(20);
    for (const locale of LOCALES) {
      const data = load(locale);
      const keys = [
        ...flatKeys(data.notebook.podcast, 'podcast'),
        ...flatKeys(data.notebook.voiceNotes, 'voiceNotes'),
      ].sort();
      expect(keys, locale).toEqual(refKeys);
      expect(typeof data.notebook.mode.podcast, locale).toBe('string');
      expect(typeof data.notebook.short.podcast, locale).toBe('string');
    }
  });

  it('uses no em dashes and keeps interpolation placeholders aligned across locales', () => {
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');
    const ref = load('pt-PT');
    for (const locale of LOCALES) {
      const data = load(locale);
      for (const group of ['podcast', 'voiceNotes'] as const) {
        for (const [key, value] of Object.entries(data.notebook[group] as Record<string, string>)) {
          expect(value, `${locale}.${group}.${key}`).not.toContain('—');
          expect(placeholders(value), `${locale}.${group}.${key}`).toBe(placeholders(ref.notebook[group][key]));
        }
      }
    }
  });
});

describe('podcast sheet storage round trip', () => {
  it('saves, reloads and deletes a script, and renders markdown with speakers', () => {
    const store = new Map<string, string>();
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    try {
      const script: PodcastScript = {
        title: 'Limites em 5 minutos',
        hostName: 'Uni',
        coHostName: 'Alex',
        lines: [
          { speaker: 'Uni', text: 'Vamos falar de limites.' },
          { speaker: 'Alex', text: 'Por onde começamos?' },
        ],
      };
      saveSheetPodcast('sheet-1', script);
      expect(loadSheetPodcast('sheet-1')).toEqual(script);
      expect(podcastScriptToMarkdown(script)).toContain('**Alex:** Por onde começamos?');
      deleteSheetPodcast('sheet-1');
      expect(loadSheetPodcast('sheet-1')).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });
});
