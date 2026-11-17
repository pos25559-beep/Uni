import { create } from 'zustand';

interface AiConsentState {
  open: boolean;
  onGranted: (() => void) | null;
  /** Abre o pedido de consentimento de IA (18+ e texto sobre a Google). */
  request: (onGranted?: () => void) => void;
  close: () => void;
}

export const useAiConsentStore = create<AiConsentState>((set) => ({
  open: false,
  onGranted: null,
  request: (onGranted) => set({ open: true, onGranted: onGranted ?? null }),
  close: () => set({ open: false, onGranted: null }),
}));

/** Atalho para código fora de componentes React. */
export function requestAiConsent(onGranted?: () => void) {
  useAiConsentStore.getState().request(onGranted);
}
