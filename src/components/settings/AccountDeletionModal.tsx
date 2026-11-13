import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildBackupPayload } from '../../lib/backup';
import { auth } from '../../lib/firebase';
import { deleteCurrentAccountAndCloudData } from '../../lib/firestoreSync';
import { LEGAL_INFO } from '../../lib/legal';
import { hapticTap } from '../../lib/nativeBridge';
import { useStore } from '../../store/useStore';
import { Button, Input, Modal } from '../ui';

interface AccountDeletionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AccountDeletionModal({ open, onClose }: AccountDeletionModalProps) {
  const [confirmWord, setConfirmWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const user = auth.currentUser;
  const requiresWord = 'ELIMINAR';
  const canConfirm = confirmWord.trim().toUpperCase() === requiresWord;

  const exportFirst = () => {
    const payload = buildBackupPayload(useStore.getState());
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unipedia-copia-${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    await hapticTap('medium');
    try {
      await deleteCurrentAccountAndCloudData();
      setDone(true);
      useStore.getState().updateSettings({
        gdprAcceptedAt: undefined,
        aiConsent: false,
        cloudSyncConsent: false,
        tourCompleted: false,
      });
    } catch (e: unknown) {
      const errObj = e as { code?: string; message?: string } | null;
      if (errObj?.code === 'auth/requires-recent-login') {
        setError(
          'Por segurança, entra novamente na tua conta (/entrar) antes de confirmar a eliminação permanente.',
        );
      } else {
        setError(errObj?.message || 'Não foi possível concluir a eliminação.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Eliminar conta e dados' : 'Apagar todos os dados locais'}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={handleDelete}
              disabled={!canConfirm || busy}
            >
              <Trash2 size={15} />
              {user ? 'Eliminar definitivamente' : 'Apagar dados locais'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3 rounded-[18px] bg-accent-soft p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-ok">
            <CheckCircle2 size={18} />
            Eliminação concluída
          </div>
          <p className="text-muted">
            Os teus registos locais, perfil e conta Cloud foram removidos.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-2.5 rounded-[18px] bg-coral-soft p-3.5 text-coral">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs leading-relaxed">
              <p className="font-bold">Esta ação não tem retorno.</p>
              <p>
                {user
                  ? `Apaga a tua conta (${user.email ?? 'ativa'}), todos os dados na nuvem e os dados guardados neste telemóvel.`
                  : 'Apaga todas as cadeiras, avaliações, sessões, materiais e definições guardadas neste dispositivo.'}
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={exportFirst} className="w-full">
            <Download size={15} />
            Exportar cópia JSON antes de apagar
          </Button>

          {error && (
            <div className="space-y-2 rounded-[16px] bg-coral-soft p-3 text-xs text-coral">
              <p>{error}</p>
              {error.includes('/entrar') && (
                <Link
                  to="/entrar"
                  onClick={onClose}
                  className="inline-block font-bold underline"
                >
                  Ir para Entrar e re-autenticar
                </Link>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="delete-confirm-input" className="block text-xs font-semibold text-muted">
              Escreve <span className="font-mono font-bold text-fg">{requiresWord}</span> para confirmar:
            </label>
            <Input
              id="delete-confirm-input"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={requiresWord}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <p className="text-xs text-muted">
            Contacto RGPD:{' '}
            <a href={`mailto:${LEGAL_INFO.contactEmail}`} className="font-semibold text-accent underline">
              {LEGAL_INFO.contactEmail}
            </a>
          </p>
        </div>
      )}
    </Modal>
  );
}
