import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Download, KeyRound, LogOut, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const [confirmWord, setConfirmWord] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const user = auth.currentUser;
  const requiresWord = t('del.word');
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
    localStorage.removeItem('uni-checkin-drafts-v1');
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
          setError(t('del.needPassword'));
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
        setError(t('del.googleClosed'));
      } else if (errObj?.code === 'auth/wrong-password' || errObj?.code === 'auth/invalid-credential') {
        setNeedsReauth(true);
        setError(t('del.wrongPassword'));
      } else {
        setError(errObj?.message || t('del.failed'));
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
      title={user ? t('del.titleAccount') : t('del.titleLocal')}
      footer={
        done ? (
          <Button variant="primary" onClick={handleFinishClose}>
            {t('del.finish')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t('del.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={handleDelete}
              disabled={!canConfirm || busy}
            >
              <Trash2 size={15} />
              {sessionStale && hasGoogleProvider
                ? t('del.confirmGoogle')
                : user
                  ? t('del.deleteForever')
                  : t('del.deleteLocal')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3 rounded-[18px] bg-accent-soft p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-ok">
            <CheckCircle2 size={18} />
            {t('del.done')}
          </div>
          <p className="text-muted">
            {t('del.doneBody')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-2.5 rounded-[18px] bg-coral-soft p-3.5 text-coral">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs leading-relaxed">
              <p className="font-bold">{t('del.irreversible')}</p>
              <p>
                {user
                  ? t('del.accountBody', { email: user.email ?? '—' })
                  : t('del.localBody')}
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={exportFirst} className="w-full">
            <Download size={15} />
            {t('del.export')}
          </Button>

          {sessionStale && user && (
            <div className="space-y-2.5 rounded-[16px] border border-accent/30 bg-accent-soft/35 p-3 text-xs">
              <p className="font-semibold text-fg">
                {t('del.reauthTitle')}
              </p>
              {hasPasswordProvider && !hasGoogleProvider ? (
                <div className="space-y-1.5">
                  <p className="text-muted">
                    {t('del.reauthPassword')}
                  </p>
                  <div className="relative">
                    <KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      type="password"
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder={t('del.currentPassword')}
                      className="pl-9"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-muted">
                  {t('del.googleHint')}
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
              {t('del.typeBefore')} <span className="font-mono font-bold text-fg">{requiresWord}</span> {t('del.typeAfter')}
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
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg hover:underline"
            >
              <LogOut size={13} />
              {t('del.signOutOnly')}
            </button>
          )}

          <p className="text-xs text-muted">
            {t('del.gdprContact')}{' '}
            <a
              href={`mailto:${LEGAL_INFO.contactEmail}`}
              className="inline-flex min-h-11 items-center font-semibold text-accent underline"
            >
              {LEGAL_INFO.contactEmail}
            </a>
          </p>
        </div>
      )}
    </Modal>
  );
}
