import { Cloud, ChevronRight, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { auth, onAuthStateChanged, type User } from '../../lib/firebase';
import { migrateLocalDataToCloud, performFullLogout } from '../../lib/firestoreSync';
import { showToast } from '../../lib/uiHelpers';

/**
 * Cartão compacto de estado da conta para sidebar e folha "Mais":
 * direciona para o ecrã dedicado `/entrar` sem esmagar inputs no telemóvel.
 */
export default function AuthStatus({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('common');
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogout = async () => {
    await performFullLogout();
    showToast(t('auth.toast.signedOut'), 'neutral');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await migrateLocalDataToCloud();
      showToast(t('authStatus.syncedOk'));
    } catch {
      showToast(t('authStatus.syncError'), 'danger');
    } finally {
      setSyncing(false);
    }
  };

  if (compact) {
    if (!user) {
      return (
        <Link
          to="/entrar"
          aria-label={t('authStatus.signInOrCreate')}
          title={t('authStatus.signInOrCreate')}
          className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full border border-line bg-bg text-accent-ink transition hover:bg-surface-2"
        >
          <Cloud size={18} aria-hidden="true" />
        </Link>
      );
    }
    const label = user.displayName || t('authStatus.userFallback');
    return (
      <Link
        to="/entrar?manage=1"
        aria-label={label}
        title={`${label} · ${t('authStatus.cloudActive')}`}
        className="mx-auto mb-1 flex size-11 items-center justify-center rounded-full border border-line bg-bg transition hover:bg-surface-2"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
            {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>
    );
  }

  if (!user) {
    return (
      <Link
        to="/entrar"
        className="mb-3 flex min-h-[54px] items-center justify-between gap-3 rounded-[18px] border border-line bg-bg px-3.5 py-2.5 transition hover:bg-surface-2"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Cloud size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-fg">{t('authStatus.signInOrCreate')}</p>
            <p className="truncate text-xs text-muted">{t('authStatus.saveAndSync')}</p>
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="mb-3 rounded-[18px] border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-2">
        <Link to="/entrar?manage=1" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
              {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-fg">
              {user.displayName || t('authStatus.userFallback')}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <ShieldCheck size={12} className="shrink-0 text-ok" />
              <span className="truncate">{t('authStatus.cloudActive')}</span>
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void handleManualSync()}
            disabled={syncing}
            aria-label={t('authStatus.syncNowAria')}
            className="flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label={t('authStatus.signOutAria')}
            className="flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-coral-soft hover:text-coral-ink"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
