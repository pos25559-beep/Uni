import { create } from 'zustand';
import type { HubStepKey } from '../lib/studyHub';

interface HubUiState {
  modalOpen: boolean;
  focusStep: HubStepKey | null;
  focusTimerOpen: boolean;
  openModal: (step?: HubStepKey | null) => void;
  closeModal: () => void;
  setFocusTimerOpen: (open: boolean) => void;
}

export const useHubUiStore = create<HubUiState>((set) => ({
  modalOpen: false,
  focusStep: null,
  focusTimerOpen: false,
  openModal: (step = null) => set({ modalOpen: true, focusStep: step }),
  closeModal: () => set({ modalOpen: false, focusStep: null }),
  setFocusTimerOpen: (open) => set({ focusTimerOpen: open }),
}));
