import { Modal } from '../ui';
import OnboardingExperience, { type OnboardingStepId } from './OnboardingExperience';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  initialStepId?: OnboardingStepId;
  title?: string;
}

export default function OnboardingModal({
  open,
  onClose,
  fullScreen = false,
  initialStepId = 'identidade',
  title = 'Configurar percurso e ritmo',
}: OnboardingModalProps) {
  if (!open) return null;

  if (fullScreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuração inicial da Unipedia"
        className="fixed inset-0 z-50 overflow-y-auto bg-bg"
      >
        <OnboardingExperience onClose={onClose} fullScreen initialStepId={initialStepId} />
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="sm:max-w-3xl"
    >
      <OnboardingExperience onClose={onClose} fullScreen={false} initialStepId={initialStepId} />
    </Modal>
  );
}
