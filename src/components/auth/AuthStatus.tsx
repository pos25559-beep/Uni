import { Capacitor } from '@capacitor/core';
import { Cloud, Eye, EyeOff, LogOut, Mail, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  auth,
  loginWithEmail,
  loginWithGoogle,
  logoutFirebase,
  onAuthStateChanged,
  registerWithEmail,
  type User,
} from '../../lib/firebase';
import { migrateLocalDataToCloud } from '../../lib/firestoreSync';
import { cx } from '../ui';

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<'none' | 'signin' | 'signup'>(
    () => (Capacitor.isNativePlatform() ? 'signin' : 'none'),
  );
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const u = await loginWithGoogle();
      setUser(u);
    } catch (err: any) {
      if (err.code === 'auth/configuration-not-found') {
        setError('O fornecedor Google precisa de ser ativado no Firebase Console para este projeto.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Erro ao iniciar sessão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || passwordInput.length < 6) {
      setError('Insere um email válido e palavra-passe com pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u =
        emailMode === 'signup'
          ? await registerWithEmail(nameInput || 'Estudante', emailInput, passwordInput)
          : await loginWithEmail(emailInput, passwordInput);
      setUser(u);
      setEmailMode('none');
      setPasswordInput('');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Ativa Email/Password em Authentication -> Sign-in method no Firebase Console.');
      } else {
        setError(err.message || 'Não foi possível autenticar com email.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutFirebase();
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao terminar sessão.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await migrateLocalDataToCloud();
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar dados para a cloud.');
    } finally {
      setSyncing(false);
    }
  };

  if (!user) {
    return (
      <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center gap-2 mb-2">
          <Cloud size={16} className="text-muted" />
          <span className="text-xs font-semibold">Conta Google / Cloud</span>
        </div>
        <p className="text-xs text-muted mb-2.5">
          Inicia sessão para sincronizar cadeiras, plano e conversas com a IA no Firebase.
        </p>
        {error && (
          <div className="mb-2.5 rounded-xl border border-danger/30 bg-danger/10 p-2 text-xs text-danger space-y-1">
            <p>{error}</p>
            <a
              href="https://console.firebase.google.com/project/campus-erp-84964/authentication/providers"
              target="_blank"
              rel="noreferrer"
              className="inline-block font-semibold underline hover:opacity-80"
            >
              Ativar Google no Console &rarr;
            </a>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50 transition"
        >
          <svg className="size-3.5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          {loading ? 'A ligar…' : 'Entrar com a Google'}
        </button>

        {emailMode === 'none' ? (
          <button
            type="button"
            onClick={() => setEmailMode('signin')}
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-muted hover:text-fg transition"
          >
            <Mail size={12} /> Entrar ou criar conta com Email
          </button>
        ) : (
          <form onSubmit={handleEmailAuth} className="mt-2.5 space-y-2 border-t border-line pt-2.5">
            {emailMode === 'signup' && (
              <label className="block">
                <span className="sr-only">Nome completo</span>
                <input
                  id="unipedia-auth-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent"
                />
              </label>
            )}
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                id="unipedia-auth-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="next"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Email universitário ou pessoal"
                required
                className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-fg outline-none focus:border-accent"
              />
            </label>
            <div className="relative">
              <label className="block">
                <span className="sr-only">Palavra-passe</span>
                {emailMode === 'signup' ? (
                  <input
                    id="unipedia-auth-new-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    enterKeyHint="done"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Palavra-passe (mín. 6)"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-2.5 pr-8 text-xs text-fg outline-none focus:border-accent"
                  />
                ) : (
                  <input
                    id="unipedia-auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Palavra-passe (mín. 6)"
                    required
                    minLength={6}
                    className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-2.5 pr-8 text-xs text-fg outline-none focus:border-accent"
                  />
                )}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute inset-y-0 right-1.5 flex items-center text-muted hover:text-fg"
              >
                {showPassword ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-surface-2 border border-line px-2.5 py-1.5 text-[11px] font-medium hover:border-accent transition disabled:opacity-50"
              >
                {emailMode === 'signup' ? 'Criar conta' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => setEmailMode(emailMode === 'signup' ? 'signin' : 'signup')}
                className="rounded-lg px-2 py-1.5 text-[11px] text-muted hover:text-fg"
              >
                {emailMode === 'signup' ? 'Já tenho conta' : 'Criar conta'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="size-7 rounded-full object-cover shrink-0" />
          ) : (
            <div className="grid size-7 place-items-center rounded-full bg-accent-soft text-accent text-xs font-semibold shrink-0">
              {user.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
            </div>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold">{user.displayName || 'Utilizador'}</div>
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <span className="size-1.5 rounded-full bg-ok inline-block" />
              <span className="truncate">Cloud ativa</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Terminar sessão"
          className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-danger transition"
        >
          <LogOut size={14} />
        </button>
      </div>

      <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-1.5 text-muted hover:text-fg transition disabled:opacity-50"
        >
          <RefreshCw size={12} className={cx(syncing && 'animate-spin')} />
          <span>{syncDone ? 'Sincronizado!' : syncing ? 'A sincronizar…' : 'Enviar dados para nuvem'}</span>
        </button>
      </div>
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
    </div>
  );
}
