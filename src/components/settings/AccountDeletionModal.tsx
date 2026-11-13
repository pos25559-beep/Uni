import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Download, KeyRound, LogOut, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildBackupPayload } from '../../lib/backup';
import {
  auth,
  logoutFirebase,
  reauthenticateCurrentUser,
  sessionNeedsRecentLogin,
} from '../../lib/firebase';
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
  const navigate = useNavigate();
  const [confirmWord, setConfirmWord] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const user = auth.currentUser;
  const requiresWord = 'ELIMINAR';
  const canConfirm = confirmWord.trim().toUpperCase() === requiresWord;
  const hasGoogleProvider = Boolean(user?.providerData.some((p) => p.providerId === 'google.com'));
  const hasPasswordProvider = Boolean(user?.providerData.some((p) => p.providerId === 'password'));
  const sessionStale = Boolean(user && (needsReauth || sessionNeedsRecentLogin()));

  const finishLocalReset = () => {
    useStore.getState().clearAll();
    useStore.getState().updateSettings({
      gdprAcceptedAt: undefined,
      aiConsent: false,
      cloudSyncConsent: false,
      tourCompleted: false,
    });
    localStorage.removeItem('uni-erp-v5');
    localStorage.removeItem('unipedia-onboarding-v1');
    sessionStorage.clear();
  };

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
      if (sessionStale && user) {
        if (hasPasswordProvider && !hasGoogleProvider && !reauthPassword.trim()) {
          setNeedsReauth(true);
          setError('Introduz a tua palavra-passe atual abaixo para confirmar a eliminação.');
          return;
        }
        await reauthenticateCurrentUser(reauthPassword.trim() || undefined);
      }
      await deleteCurrentAccountAndCloudData();
      finishLocalReset();
      setDone(true);
    } catch (e: unknown) {
      const errObj = e as { code?: string; message?: string } | null;
      if (errObj?.code === 'auth/requires-recent-login') {
        setNeedsReauth(true);
        setError(null);
      } else if (errObj?.code === 'auth/popup-closed-by-user') {
        setNeedsReauth(true);
        setError('Fechaste a janela da Google antes de confirmar. Podes tentar novamente sem risco, ou usar a limpeza local.');
      } else if (errObj?.code === 'auth/wrong-password' || errObj?.code === 'auth/invalid-credential') {
        setNeedsReauth(true);
        setError('Palavra-passe incorreta. Tenta novamente.');
      } else {
        setError(errObj?.message || 'Não foi possível concluir a eliminação.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLocalSignOutWipe = async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutFirebase();
      finishLocalReset();
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  const handleFinishClose = () => {
    onClose();
    if (done) {
      navigate('/bem-vindo', { replace: true });
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleFinishClose}
      title={user ? 'Eliminar conta e dados' : 'Apagar todos os dados locais'}
      footer={
        done ? (
          <Button variant="primary" onClick={handleFinishClose}>
            Concluir e recomeçar
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
              {sessionStale && hasGoogleProvider
                ? 'Confirmar no Google e apagar'
                : user
                  ? 'Eliminar definitivamente'
                  : 'Apagar dados locais'}
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
            Os teus registos locais, perfil e conta Cloud foram removidos. Podes começar de novo quando quiseres.
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

          {sessionStale && user && (
            <div className="space-y-2.5 rounded-[16px] border border-accent/30 bg-accent-soft/35 p-3 text-xs">
              <p className="font-semibold text-fg">
                Confirmação rápida de segurança (sessão aberta há mais de 4 min)
              </p>
              {hasPasswordProvider && !hasGoogleProvider ? (
                <div className="space-y-1.5">
                  <p className="text-muted">
                    Introduz a tua palavra-passe atual para confirmar que és mesmo tu:
                  </p>
                  <div className="relative">
                    <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      type="password"
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="Palavra-passe atual"
                      className="pl-9"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-muted">
                  Por segurança, ao clicar abaixo vais confirmar rapidamente quem és na janela da Google (só identidade básica, sem pedir acesso a Drive ou Agenda e sem risco de bloqueio).
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="space-y-2 rounded-[16px] bg-coral-soft p-3 text-xs text-coral">
              <p>{error}</p>
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

          {user && (
            <button
              type="button"
              onClick={handleLocalSignOutWipe}
              disabled={busy}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg hover:underline"
            >
              <LogOut size={13} />
              Prefiro apenas terminar sessão e limpar este dispositivo
            </button>
          )}

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
