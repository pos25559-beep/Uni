import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../ui';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Pedido de confirmação para ações destrutivas (não usa window.confirm). */
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const { t } = useTranslation('common');
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{t('actions.cancel')}</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel ?? t('actions.delete')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

interface DeleteButtonProps {
  message: string;
  onConfirm: () => void;
  /** Se definido, mostra texto ao lado do ícone. */
  label?: string;
  confirmLabel?: string;
}

/** Botão de apagar que abre primeiro o modal de confirmação. */
export function DeleteButton({ message, onConfirm, label, confirmLabel }: DeleteButtonProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const ariaLabel = label ?? t('actions.delete');
  return (
    <>
      <Button
        variant={label ? 'danger' : 'ghost'}
        size="sm"
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={14} />
        {label}
      </Button>
      {open && (
        <ConfirmModal
          title={t('actions.confirmTitle')}
          message={message}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
