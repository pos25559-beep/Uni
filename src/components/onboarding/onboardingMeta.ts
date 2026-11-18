import type { OnboardingStep } from '@onboardjs/core';

export type OnboardingStepId = 'identidade' | 'curso' | 'cadeiras' | 'ritmo';

export type OnboardingContextData = {
  flowData: Record<string, unknown>;
  flowVersion: string;
};

export const ONBOARDING_STEPS: OnboardingStep<OnboardingContextData>[] = [
  { id: 'curso', type: 'INFORMATION', nextStep: 'cadeiras' },
  { id: 'cadeiras', type: 'INFORMATION', previousStep: 'curso', nextStep: 'identidade' },
  { id: 'identidade', type: 'INFORMATION', previousStep: 'cadeiras', nextStep: 'ritmo' },
  { id: 'ritmo', type: 'CONFIRMATION', previousStep: 'identidade', nextStep: null },
];

export const STEP_META: Array<{ id: OnboardingStepId; label: string }> = [
  { id: 'curso', label: 'Curso & Semestre' },
  { id: 'cadeiras', label: 'Cadeiras' },
  { id: 'identidade', label: 'Tu & Estilo' },
  { id: 'ritmo', label: 'Ritmo & Privacidade' },
];

export interface OnboardingExperienceProps {
  onClose: () => void;
  fullScreen?: boolean;
  initialStepId?: OnboardingStepId;
}
