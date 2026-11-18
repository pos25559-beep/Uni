import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { toFriendlyError } from '../errorMessages';

describe('toFriendlyError', () => {
  it('translates browser quota exceeded errors into friendly storage guidance', () => {
    const err = new Error('QuotaExceededError: Failed to execute put on IDBObjectStore');
    const msg = toFriendlyError(err);
    expect(msg.toLowerCase()).toMatch(/espaço|storage|armazenamento|espacio/);
  });

  it('translates network failures into offline guidance', () => {
    const err = new TypeError('Failed to fetch');
    const msg = toFriendlyError(err);
    expect(msg.toLowerCase()).toMatch(/internet|ligação|conexão|connection|conexión/);
  });

  it('translates 401/403 and permission errors', () => {
    const err = new Error('Request failed with status 403 insufficient authentication scopes');
    const msg = toFriendlyError(err);
    expect(msg.toLowerCase()).toMatch(/permiss|autoriz|access|permis/);
  });

  it('preserves clean domain-specific human messages', () => {
    const err = new Error('O ficheiro excede o limite permitido.');
    expect(toFriendlyError(err, 'Fallback')).toBe('O ficheiro excede o limite permitido.');
  });

  it('hides raw technical TypeError stacks behind the provided fallback', () => {
    const err = new TypeError('Cannot read properties of undefined (reading "id")');
    expect(toFriendlyError(err, 'Não foi possível guardar agora.')).toBe(
      'Não foi possível guardar agora.',
    );
  });

  it('returns offline guidance immediately when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false });
    try {
      const msg = toFriendlyError(new Error('anything'));
      expect(msg.toLowerCase()).toMatch(/internet|ligação|conexão|connection|conexión/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
