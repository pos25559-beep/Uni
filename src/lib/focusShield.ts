import {
  activateNativeFocusShield,
  deactivateNativeFocusShield,
  getNativeFocusShieldCapabilities,
  isNativeAndroid,
  type NativeFocusShieldCapabilities,
} from './nativeBridge';

export type FocusSoundPreset = 'none' | 'rain' | 'white';
export type FocusTimerPhase = 'idle' | 'running' | 'paused' | 'finished';

export interface FocusShieldDevicePrefs {
  fullscreen: boolean;
  wakeLock: boolean;
  androidDnd: boolean;
  androidPinning: boolean;
  soundPreset: FocusSoundPreset;
  soundVolume: number;
}

export const DEFAULT_FOCUS_SHIELD_PREFS: FocusShieldDevicePrefs = {
  fullscreen: false,
  wakeLock: false,
  androidDnd: false,
  androidPinning: false,
  soundPreset: 'none',
  soundVolume: 0.35,
};

export interface ActiveFocusSnapshot {
  sessionId: string;
  phase: FocusTimerPhase;
  budgetMs: number;
  accumulatedMs: number;
  startedAt: number | null;
  distractionCount: number;
  awaySeconds: number;
  awayStartedAt: number | null;
  shieldUsed: boolean;
  updatedAt: number;
}

export interface DistractionReturnEvent {
  distractionCount: number;
  awaySeconds: number;
  deltaSeconds: number;
}

export const FOCUS_SHIELD_PREFS_KEY = 'unipedia_focus_shield_prefs_v1';
export const FOCUS_ACTIVE_SNAPSHOT_KEY = 'unipedia_focus_active_session_v1';
export const DISTRACTION_THRESHOLD_MS = 2000;
const SNAPSHOT_MAX_AGE_MS = 12 * 3600 * 1000;

export function loadFocusShieldPrefs(): FocusShieldDevicePrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_FOCUS_SHIELD_PREFS };
  try {
    const raw = window.localStorage.getItem(FOCUS_SHIELD_PREFS_KEY);
    if (!raw) return { ...DEFAULT_FOCUS_SHIELD_PREFS };
    const parsed = JSON.parse(raw) as Partial<FocusShieldDevicePrefs>;
    const soundPreset: FocusSoundPreset =
      parsed.soundPreset === 'rain' || parsed.soundPreset === 'white' ? parsed.soundPreset : 'none';
    const vol =
      typeof parsed.soundVolume === 'number' && Number.isFinite(parsed.soundVolume)
        ? Math.min(1, Math.max(0, parsed.soundVolume))
        : DEFAULT_FOCUS_SHIELD_PREFS.soundVolume;
    return {
      fullscreen: Boolean(parsed.fullscreen),
      wakeLock: Boolean(parsed.wakeLock),
      androidDnd: Boolean(parsed.androidDnd),
      androidPinning: Boolean(parsed.androidPinning),
      soundPreset,
      soundVolume: vol,
    };
  } catch {
    return { ...DEFAULT_FOCUS_SHIELD_PREFS };
  }
}

export function saveFocusShieldPrefs(prefs: FocusShieldDevicePrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOCUS_SHIELD_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Armazenamento indisponível (modo privado/quota).
  }
}

export function saveActiveFocusSnapshot(snapshot: ActiveFocusSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      FOCUS_ACTIVE_SNAPSHOT_KEY,
      JSON.stringify({ ...snapshot, updatedAt: snapshot.updatedAt || Date.now() }),
    );
  } catch {
    // noop
  }
}

export function loadActiveFocusSnapshot(now = Date.now()): ActiveFocusSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FOCUS_ACTIVE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveFocusSnapshot>;
    if (!parsed || typeof parsed.sessionId !== 'string' || !parsed.sessionId) return null;
    if (typeof parsed.updatedAt !== 'number' || now - parsed.updatedAt > SNAPSHOT_MAX_AGE_MS) {
      clearActiveFocusSnapshot();
      return null;
    }
    if (parsed.phase !== 'running' && parsed.phase !== 'paused') {
      return null;
    }
    const budgetMs = typeof parsed.budgetMs === 'number' && parsed.budgetMs > 0 ? parsed.budgetMs : 0;
    const accumulatedMs =
      typeof parsed.accumulatedMs === 'number' && parsed.accumulatedMs >= 0 ? parsed.accumulatedMs : 0;
    if (budgetMs <= 0) return null;

    return {
      sessionId: parsed.sessionId,
      phase: parsed.phase,
      budgetMs,
      accumulatedMs,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      distractionCount:
        typeof parsed.distractionCount === 'number' && parsed.distractionCount >= 0
          ? parsed.distractionCount
          : 0,
      awaySeconds:
        typeof parsed.awaySeconds === 'number' && parsed.awaySeconds >= 0 ? parsed.awaySeconds : 0,
      awayStartedAt: typeof parsed.awayStartedAt === 'number' ? parsed.awayStartedAt : null,
      shieldUsed: Boolean(parsed.shieldUsed),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function clearActiveFocusSnapshot(onlySessionId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (onlySessionId) {
      const raw = window.localStorage.getItem(FOCUS_ACTIVE_SNAPSHOT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ActiveFocusSnapshot>;
      if (parsed?.sessionId && parsed.sessionId !== onlySessionId) return;
    }
    window.localStorage.removeItem(FOCUS_ACTIVE_SNAPSHOT_KEY);
  } catch {
    // noop
  }
}

/** Calcula o tempo acumulado seguro após um reload, pausando para respeitar gestos do utilizador. */
export function resolveRecoveredFocusState(
  snapshot: ActiveFocusSnapshot,
  now = Date.now(),
): {
  budgetMs: number;
  accumulatedMs: number;
  distractionCount: number;
  awaySeconds: number;
  shieldUsed: boolean;
} {
  let elapsed = snapshot.accumulatedMs;
  if (snapshot.phase === 'running' && snapshot.startedAt !== null) {
    // Limita saltos após suspensão longa para não contar horas fechadas como foco.
    const anchor = Math.max(snapshot.startedAt, snapshot.updatedAt - 60_000);
    const liveDelta = Math.max(0, Math.min(now - snapshot.startedAt, snapshot.updatedAt - snapshot.startedAt + 90_000));
    elapsed = Math.min(snapshot.budgetMs, snapshot.accumulatedMs + (now >= anchor ? liveDelta : 0));
  }
  return {
    budgetMs: snapshot.budgetMs,
    accumulatedMs: Math.min(snapshot.budgetMs, Math.max(0, elapsed)),
    distractionCount: snapshot.distractionCount,
    awaySeconds: snapshot.awaySeconds,
    shieldUsed: snapshot.shieldUsed,
  };
}

export function createDistractionTracker(initial?: {
  distractionCount?: number;
  awaySeconds?: number;
  awayStartedAt?: number | null;
}) {
  let distractionCount = initial?.distractionCount ?? 0;
  let awaySeconds = initial?.awaySeconds ?? 0;
  let awayStartedAt: number | null = initial?.awayStartedAt ?? null;

  return {
    onVisibilityChange(hidden: boolean, now = Date.now()): DistractionReturnEvent | null {
      if (hidden) {
        if (awayStartedAt === null) {
          awayStartedAt = now;
        }
        return null;
      }
      if (awayStartedAt === null) return null;
      const deltaMs = Math.max(0, now - awayStartedAt);
      awayStartedAt = null;
      if (deltaMs < DISTRACTION_THRESHOLD_MS) return null;
      const deltaSeconds = Math.max(1, Math.round(deltaMs / 1000));
      distractionCount += 1;
      awaySeconds += deltaSeconds;
      return { distractionCount, awaySeconds, deltaSeconds };
    },
    resetAwayAnchor() {
      awayStartedAt = null;
    },
    getState() {
      return { distractionCount, awaySeconds, awayStartedAt };
    },
  };
}

export function getWebFocusCapabilities(): {
  fullscreenSupported: boolean;
  wakeLockSupported: boolean;
} {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return { fullscreenSupported: false, wakeLockSupported: false };
  }
  const doc = document as Document & { fullscreenEnabled?: boolean };
  const fullscreenSupported =
    Boolean(doc.fullscreenEnabled) || typeof document.documentElement?.requestFullscreen === 'function';
  const nav = navigator as Navigator & { wakeLock?: { request?: (type: 'screen') => Promise<unknown> } };
  const wakeLockSupported = typeof nav.wakeLock?.request === 'function';
  return { fullscreenSupported, wakeLockSupported };
}

export interface WebShieldHandle {
  fullscreenActive: boolean;
  wakeLockActive: boolean;
  reacquireWakeLock: () => Promise<boolean>;
  release: () => Promise<void>;
}

export async function engageWebFocusShield(options: {
  fullscreen: boolean;
  wakeLock: boolean;
}): Promise<WebShieldHandle> {
  let fullscreenActive = false;
  let wakeLockSentinel: { release: () => Promise<void>; released?: boolean } | null = null;

  if (options.fullscreen && typeof document !== 'undefined' && !document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen?.();
      fullscreenActive = Boolean(document.fullscreenElement);
    } catch {
      fullscreenActive = false;
    }
  }

  const acquireWakeLock = async (): Promise<boolean> => {
    if (!options.wakeLock || typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; released?: boolean }> };
    };
    if (typeof nav.wakeLock?.request !== 'function') return false;
    if (wakeLockSentinel && !wakeLockSentinel.released) return true;
    try {
      wakeLockSentinel = await nav.wakeLock.request('screen');
      return true;
    } catch {
      wakeLockSentinel = null;
      return false;
    }
  };

  const wakeLockActive = await acquireWakeLock();

  return {
    fullscreenActive,
    wakeLockActive,
    reacquireWakeLock: acquireWakeLock,
    release: async () => {
      if (wakeLockSentinel) {
        try {
          await wakeLockSentinel.release();
        } catch {
          // Já libertado pelo browser ao mudar de separador.
        }
        wakeLockSentinel = null;
      }
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        try {
          await document.exitFullscreen?.();
        } catch {
          // Utilizador já saiu manualmente com Esc ou gesto do sistema.
        }
      }
    },
  };
}

export async function engagePlatformFocusShield(prefs: FocusShieldDevicePrefs): Promise<{
  webHandle: WebShieldHandle;
  nativeResult: { dndActivated: boolean; pinningRequested: boolean };
  shieldUsed: boolean;
}> {
  const webHandle = await engageWebFocusShield({
    fullscreen: prefs.fullscreen,
    wakeLock: prefs.wakeLock,
  });

  let nativeResult = { dndActivated: false, pinningRequested: false };
  if (isNativeAndroid() && (prefs.androidDnd || prefs.androidPinning)) {
    nativeResult = await activateNativeFocusShield({
      dnd: prefs.androidDnd,
      screenPinning: prefs.androidPinning,
    });
  }

  const shieldUsed =
    prefs.fullscreen ||
    prefs.wakeLock ||
    prefs.soundPreset !== 'none' ||
    nativeResult.dndActivated ||
    nativeResult.pinningRequested;

  return { webHandle, nativeResult, shieldUsed };
}

export async function releasePlatformFocusShield(webHandle: WebShieldHandle | null): Promise<void> {
  if (webHandle) {
    await webHandle.release();
  }
  if (isNativeAndroid()) {
    await deactivateNativeFocusShield({ restoreDnd: true, stopPinning: true });
  }
}

export async function readShieldCapabilities(): Promise<{
  nativeAndroid: boolean;
  native: NativeFocusShieldCapabilities;
  web: ReturnType<typeof getWebFocusCapabilities>;
}> {
  const nativeAndroid = isNativeAndroid();
  const [native, web] = await Promise.all([
    getNativeFocusShieldCapabilities(),
    Promise.resolve(getWebFocusCapabilities()),
  ]);
  return { nativeAndroid, native, web };
}
