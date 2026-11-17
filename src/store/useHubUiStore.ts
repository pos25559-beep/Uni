import { create } from 'zustand';
import type { HubStepKey } from '../lib/studyHub';

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
  /** Muda quando um foco fecha, para quem mostra «Retomar foco» voltar a ler o estado guardado. */
  focusSnapshotNonce: number;
  openModal: (step?: HubStepKey | null) => void;
  closeModal: () => void;
  setFocusTimerOpen: (open: boolean) => void;
  setFocusShieldRunning: (running: boolean) => void;
  openFocus: (sessionId: string) => void;
  closeFocus: () => void;
  setFocusMinimized: (minimized: boolean) => void;
  bumpFocusSnapshot: () => void;
}

export const useHubUiStore = create<HubUiState>((set) => ({
  modalOpen: false,
  focusStep: null,
  focusTimerOpen: false,
  focusShieldRunning: false,
  focusSessionId: null,
  focusMinimized: false,
  focusSnapshotNonce: 0,
  openModal: (step = null) => set({ modalOpen: true, focusStep: step }),
  closeModal: () => set({ modalOpen: false, focusStep: null }),
  setFocusTimerOpen: (open) => set({ focusTimerOpen: open }),
  setFocusShieldRunning: (running) => set({ focusShieldRunning: running }),
  openFocus: (sessionId) => set({ focusSessionId: sessionId, focusMinimized: false }),
  closeFocus: () =>
    set((s) => ({ focusSessionId: null, focusMinimized: false, focusSnapshotNonce: s.focusSnapshotNonce + 1 })),
  setFocusMinimized: (minimized) => set({ focusMinimized: minimized }),
  bumpFocusSnapshot: () => set((s) => ({ focusSnapshotNonce: s.focusSnapshotNonce + 1 })),
}));
