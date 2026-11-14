import { Cloud, ChevronRight, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, logoutFirebase, onAuthStateChanged, type User } from '../../lib/firebase';
import { migrateLocalDataToCloud } from '../../lib/firestoreSync';
import { useStore } from '../../store/useStore';
import { showToast } from '../ui';

/**
 * Cartão compacto de estado da conta para sidebar e folha "Mais":
 * direciona para o ecrã dedicado `/entrar` sem esmagar inputs no telemóvel.
 */
export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [syncing, setSyncing] = useState(false);
  const updateSettings = useStore((s) => s.updateSettings);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogout = async () => {
    await logoutFirebase();
    updateSettings({ guestMode: false, userName: '' });
    showToast('Sessão terminada.', 'neutral');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await migrateLocalDataToCloud();
      showToast('Dados sincronizados com a nuvem!');
    } catch {
      showToast('Erro ao sincronizar agora. Tenta mais tarde.', 'danger');
    } finally {
      setSyncing(false);
    }
  };

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
            <p className="truncate text-xs font-bold text-fg">Entrar ou criar conta</p>
            <p className="truncate text-xs text-muted">Guarda e sincroniza o teu caderno</p>
          </div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div className="mb-3 rounded-[18px] border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-2">
        <Link to="/entrar" className="flex min-w-0 flex-1 items-center gap-2.5">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">
              {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-fg">{user.displayName || 'Utilizador'}</p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <ShieldCheck size={12} className="shrink-0 text-ok" />
              <span className="truncate">Cloud ativa</span>
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void handleManualSync()}
            disabled={syncing}
            aria-label="Sincronizar agora"
            className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label="Terminar sessão"
            className="flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-coral-soft hover:text-coral-ink"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
