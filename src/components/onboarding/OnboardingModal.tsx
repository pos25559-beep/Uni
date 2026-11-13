import { Modal } from '../ui';
import OnboardingExperience from './OnboardingExperience';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  fullScreen?: boolean;
}

export default function OnboardingModal({
  open,
  onClose,
  fullScreen = false,
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
        <OnboardingExperience onClose={onClose} fullScreen />
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configurar percurso e ritmo"
      maxWidthClass="sm:max-w-3xl"
    >
      <OnboardingExperience onClose={onClose} fullScreen={false} />
    </Modal>
  );
}
