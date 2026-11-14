import { create } from 'zustand';
import type { HubStepKey } from '../lib/studyHub';

interface HubUiState {
  modalOpen: boolean;
  focusStep: HubStepKey | null;
  openModal: (step?: HubStepKey | null) => void;
  closeModal: () => void;
}

export const useHubUiStore = create<HubUiState>((set) => ({
  modalOpen: false,
  focusStep: null,
  openModal: (step = null) => set({ modalOpen: true, focusStep: step }),
  closeModal: () => set({ modalOpen: false, focusStep: null }),
}));
