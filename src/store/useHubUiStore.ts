import { create } from 'zustand';
import type { HubStepKey } from '../lib/studyHub';

export type FocusBubbleMode = 'floating' | 'sidebar';

const BUBBLE_MODE_KEY = 'unipedia-focus-bubble-mode-v1';
const BUBBLE_COMPACT_KEY = 'unipedia-focus-bubble-compact-v1';
const SIDEBAR_COLLAPSED_KEY = 'unipedia-sidebar-collapsed-v1';

function readStoredFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredBubbleMode(): FocusBubbleMode {
  try {
    return localStorage.getItem(BUBBLE_MODE_KEY) === 'sidebar' ? 'sidebar' : 'floating';
  } catch {
    return 'floating';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage quota
  }
}

interface HubUiState {
  modalOpen: boolean;
  focusStep: HubStepKey | null;
  /** Ecrã de foco em ecrã inteiro visível (esconde sobreposições do Uni). */
  focusTimerOpen: boolean;
  focusShieldRunning: boolean;
  /** Sessão em foco, montada globalmente no AppShell para continuar a correr entre ecrãs. */
  focusSessionId: string | null;
  /** Foco a correr em segundo plano (pílula pequena), por exemplo enquanto se fala com o Uni. */
  focusMinimized: boolean;
  /** Onde mostrar o foco minimizado em ecrãs largos: flutuante livre ou encaixado na barra lateral. */
  focusBubbleMode: FocusBubbleMode;
  /** Modo ultra-compacto da bolha flutuante (apenas ponto + relógio + expandir). */
  focusBubbleCompact: boolean;
  /** Barra lateral esquerda recolhida para fila vertical de ícones (desktop). */
  sidebarCollapsed: boolean;
  /** Muda quando um foco fecha, para quem mostra «Retomar foco» voltar a ler o estado guardado. */
  focusSnapshotNonce: number;
  openModal: (step?: HubStepKey | null) => void;
  closeModal: () => void;
  setFocusTimerOpen: (open: boolean) => void;
  setFocusShieldRunning: (running: boolean) => void;
  openFocus: (sessionId: string) => void;
  closeFocus: () => void;
  setFocusMinimized: (minimized: boolean) => void;
  setFocusBubbleMode: (mode: FocusBubbleMode) => void;
  setFocusBubbleCompact: (compact: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  bumpFocusSnapshot: () => void;
}

export const useHubUiStore = create<HubUiState>((set) => ({
  modalOpen: false,
  focusStep: null,
  focusTimerOpen: false,
  focusShieldRunning: false,
  focusSessionId: null,
  focusMinimized: false,
  focusBubbleMode: readStoredBubbleMode(),
  focusBubbleCompact: readStoredFlag(BUBBLE_COMPACT_KEY, false),
  sidebarCollapsed: readStoredFlag(SIDEBAR_COLLAPSED_KEY, false),
  focusSnapshotNonce: 0,
  openModal: (step = null) => set({ modalOpen: true, focusStep: step }),
  closeModal: () => set({ modalOpen: false, focusStep: null }),
  setFocusTimerOpen: (open) => set({ focusTimerOpen: open }),
  setFocusShieldRunning: (running) => set({ focusShieldRunning: running }),
  openFocus: (sessionId) => set({ focusSessionId: sessionId, focusMinimized: false }),
  closeFocus: () =>
    set((s) => ({ focusSessionId: null, focusMinimized: false, focusSnapshotNonce: s.focusSnapshotNonce + 1 })),
  setFocusMinimized: (minimized) => set({ focusMinimized: minimized }),
  setFocusBubbleMode: (mode) => {
    writeStorage(BUBBLE_MODE_KEY, mode);
    set({ focusBubbleMode: mode });
  },
  setFocusBubbleCompact: (compact) => {
    writeStorage(BUBBLE_COMPACT_KEY, compact ? '1' : '0');
    set({ focusBubbleCompact: compact });
  },
  setSidebarCollapsed: (collapsed) => {
    writeStorage(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    set({ sidebarCollapsed: collapsed });
  },
  toggleSidebarCollapsed: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      writeStorage(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return { sidebarCollapsed: next };
    }),
  bumpFocusSnapshot: () => set((s) => ({ focusSnapshotNonce: s.focusSnapshotNonce + 1 })),
}));
