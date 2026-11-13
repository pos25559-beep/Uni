import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, loginWithGoogle } from '../../lib/firebase';
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
  const requiresWord = 'APAGAR';
  const canConfirm = confirmWord.trim().toUpperCase() === requiresWord;

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
          'Por segurança (Firebase Auth), inicia sessão novamente antes de confirmar a eliminação permanente da conta.',
        );
      } else {
        setError(errObj?.message || 'Não foi possível concluir a eliminação.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReauthGoogle = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Erro ao re-autenticar.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Eliminar conta e dados (RGPD Art. 17.º)' : 'Apagar todos os dados locais'}
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
              onClick={handleDelete}
              disabled={!canConfirm || busy}
            >
              <Trash2 size={15} />
              {busy ? 'A eliminar…' : user ? 'Eliminar conta definitivamente' : 'Apagar dados locais'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3 rounded-2xl border border-ok/30 bg-ok/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-ok">
            <CheckCircle2 size={18} />
            Eliminação concluída
          </div>
          <p className="text-muted">
            Os teus registos locais, perfil académico, sessões e conta Cloud foram removidos. Podes recomeçar o onboarding a qualquer momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-danger">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs leading-relaxed">
              <p className="font-semibold">Esta ação é irreversível.</p>
              <p>
                {user
                  ? `Vai apagar permanentemente a conta (${user.email ?? user.uid}), todas as coleções no Cloud Firestore (/users/${user.uid}) e todo o armazenamento local deste dispositivo.`
                  : 'Vai apagar todas as cadeiras, avaliações, sessões, materiais e preferências guardadas neste dispositivo.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <p>{error}</p>
              {error.includes('re-autentic') || error.includes('inicia sessão novamente') ? (
                <Button size="sm" variant="secondary" onClick={handleReauthGoogle}>
                  Re-autenticar com Google
                </Button>
              ) : null}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="delete-confirm-input" className="block text-xs font-medium text-muted">
              Escreve <span className="font-mono font-semibold text-fg">{requiresWord}</span> para confirmar:
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
            Dúvidas ou pedidos ao abrigo do RGPD: <a href={`mailto:${LEGAL_INFO.contactEmail}`} className="text-accent underline">{LEGAL_INFO.contactEmail}</a> ·{' '}
            <Link to="/privacidade" onClick={onClose} className="text-accent underline">
              Política de Privacidade
            </Link>
          </p>
        </div>
      )}
    </Modal>
  );
}
