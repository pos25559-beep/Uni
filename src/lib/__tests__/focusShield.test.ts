import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearActiveFocusSnapshot,
  createDistractionTracker,
  DEFAULT_FOCUS_SHIELD_PREFS,
  DISTRACTION_THRESHOLD_MS,
  engageWebFocusShield,
  loadActiveFocusSnapshot,
  loadFocusShieldPrefs,
  resolveRecoveredFocusState,
  saveActiveFocusSnapshot,
  saveFocusShieldPrefs,
} from '../focusShield';

function installMockWindowStorage() {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('window', { localStorage: mockLocalStorage });
  return { store, mockLocalStorage };
}

describe('focusShield', () => {
  beforeEach(() => {
    installMockWindowStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mantém tudo opt-in por defeito e memoriza preferências do dispositivo', () => {
    expect(loadFocusShieldPrefs()).toEqual(DEFAULT_FOCUS_SHIELD_PREFS);
    expect(DEFAULT_FOCUS_SHIELD_PREFS).toEqual({
      fullscreen: false,
      wakeLock: false,
      androidDnd: false,
      androidPinning: false,
      soundPreset: 'none',
      soundVolume: 0.35,
    });

    saveFocusShieldPrefs({
      fullscreen: true,
      wakeLock: true,
      androidDnd: false,
      androidPinning: true,
      soundPreset: 'rain',
      soundVolume: 0.5,
    });

    expect(loadFocusShieldPrefs()).toEqual({
      fullscreen: true,
      wakeLock: true,
      androidDnd: false,
      androidPinning: true,
      soundPreset: 'rain',
      soundVolume: 0.5,
    });
  });

  it('ignora saídas breves (< 2s) e contabiliza apenas distrações reais sem punição', () => {
    const tracker = createDistractionTracker();

    // Saída curta de 800 ms (ex.: toque rápido) -> ignorada.
    expect(tracker.onVisibilityChange(true, 10_000)).toBeNull();
    expect(tracker.onVisibilityChange(false, 10_800)).toBeNull();
    expect(tracker.getState()).toMatchObject({ distractionCount: 0, awaySeconds: 0 });

    // Saída real exatamente no limiar (>= 2000 ms) -> contabilizada.
    expect(tracker.onVisibilityChange(true, 20_000)).toBeNull();
    expect(tracker.onVisibilityChange(false, 20_000 + DISTRACTION_THRESHOLD_MS)).toEqual({
      distractionCount: 1,
      awaySeconds: 2,
      deltaSeconds: 2,
    });

    // Segunda saída de 12.6 s -> acumula.
    tracker.onVisibilityChange(true, 30_000);
    expect(tracker.onVisibilityChange(false, 42_600)).toEqual({
      distractionCount: 2,
      awaySeconds: 15,
      deltaSeconds: 13,
    });
  });

  it('guarda, recupera após reload e expira snapshots antigos (>12h)', () => {
    const t0 = 1_700_000_000_000;
    saveActiveFocusSnapshot({
      sessionId: 'sess-1',
      phase: 'running',
      budgetMs: 25 * 60_000,
      accumulatedMs: 5 * 60_000,
      startedAt: t0 - 30_000,
      distractionCount: 1,
      awaySeconds: 8,
      awayStartedAt: null,
      shieldUsed: true,
      updatedAt: t0,
    });

    const loaded = loadActiveFocusSnapshot(t0 + 4_000);
    expect(loaded?.sessionId).toBe('sess-1');

    const recovered = resolveRecoveredFocusState(loaded!, t0 + 4_000);
    expect(recovered.accumulatedMs).toBe(5 * 60_000 + 34_000);
    expect(recovered.distractionCount).toBe(1);
    expect(recovered.awaySeconds).toBe(8);
    expect(recovered.shieldUsed).toBe(true);

    // Só limpa a sessão correspondente.
    clearActiveFocusSnapshot('outra-sessao');
    expect(loadActiveFocusSnapshot(t0 + 4_000)).not.toBeNull();

    // Expiração após 12h.
    expect(loadActiveFocusSnapshot(t0 + 13 * 3600 * 1000)).toBeNull();
  });

  it('lida em segurança com falha ou ausência de Fullscreen e WakeLock', async () => {
    vi.stubGlobal('document', {
      fullscreenElement: null,
      documentElement: {
        requestFullscreen: vi.fn().mockRejectedValue(new Error('Not allowed')),
      },
      exitFullscreen: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      wakeLock: {
        request: vi.fn().mockRejectedValue(new Error('Battery saver')),
      },
    });

    const handle = await engageWebFocusShield({ fullscreen: true, wakeLock: true });
    expect(handle.fullscreenActive).toBe(false);
    expect(handle.wakeLockActive).toBe(false);
    await expect(handle.release()).resolves.toBeUndefined();
  });
});
