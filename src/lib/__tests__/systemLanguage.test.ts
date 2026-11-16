import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectSystemLanguage } from '../grading';

function setLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] });
}

describe('detectSystemLanguage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps Brazilian Portuguese', () => {
    setLanguages(['pt-BR', 'en-US']);
    expect(detectSystemLanguage()).toBe('pt-BR');
  });

  it('maps other Portuguese variants to pt-PT', () => {
    setLanguages(['pt-AO']);
    expect(detectSystemLanguage()).toBe('pt-PT');
    setLanguages(['pt']);
    expect(detectSystemLanguage()).toBe('pt-PT');
  });

  it('uses the first supported language in order', () => {
    setLanguages(['fr-FR', 'es-MX', 'en-GB']);
    expect(detectSystemLanguage()).toBe('es');
  });

  it('falls back to pt-PT for unsupported languages', () => {
    setLanguages(['de-DE']);
    expect(detectSystemLanguage()).toBe('pt-PT');
  });
});
