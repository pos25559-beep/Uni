import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  Cloud,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NotebookBuddy, UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import { AnimatedPage, StickerBadge } from '../components/motion/Primitives';
import {
  Button,
  Card,
  Field,
  Input,
  SegmentedControl,
  SubpageHeader,
  showToast,
} from '../components/ui';
import {
  auth,
  loginWithEmail,
  loginWithGoogle,
  logoutFirebase,
  onAuthStateChanged,
  registerWithEmail,
  resetPasswordWithEmail,
  type User,
} from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/firestoreSync';
import { hapticSuccess, hapticTap } from '../lib/nativeBridge';

function friendlyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email ou palavra-passe incorretos. Verifica os dados ou cria uma conta nova.';
    case 'auth/email-already-in-use':
      return 'Este email já tem conta. Experimenta entrar no separador "Entrar".';
    case 'auth/weak-password':
      return 'Escolhe uma palavra-passe com pelo menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarda um pouco ou repõe a tua palavra-passe.';
    case 'auth/operation-not-allowed':
      return 'O método Email/Palavra-passe precisa de estar ativo no Firebase Console.';
    default:
      return fallback || 'Não foi possível concluir a autenticação neste momento.';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
    });
  }, []);

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError('Insere um email válido e uma palavra-passe com pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    void hapticTap();
    try {
      const u =
        mode === 'signup'
          ? await registerWithEmail(name || 'Estudante', email, password)
          : await loginWithEmail(email, password);
      setUser(u);
      await migrateLocalDataToCloud().catch(() => {});
      void hapticSuccess();
      showToast(mode === 'signup' ? 'Conta criada e sincronizada!' : 'Sessão iniciada!');
      navigate('/');
    } catch (err: unknown) {
      const eObj = err as { code?: string; message?: string };
      setError(friendlyAuthError(eObj?.code, eObj?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Escreve primeiro o teu email em cima para receberes o link de reposição.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPasswordWithEmail(email);
      setInfo('Enviámos um email para redefinir a palavra-passe. Verifica também o spam.');
    } catch (err: unknown) {
      const eObj = err as { code?: string; message?: string };
      setError(friendlyAuthError(eObj?.code, eObj?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleOptionalGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      const u = await loginWithGoogle();
      setUser(u);
      void hapticSuccess();
      showToast('Sessão Google ativa!');
      navigate('/');
    } catch (err: unknown) {
      const eObj = err as { code?: string; message?: string };
      if (eObj?.code !== 'auth/popup-closed-by-user') {
        setError(friendlyAuthError(eObj?.code, eObj?.message));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutFirebase();
      setUser(null);
      showToast('Sessão terminada. Os dados continuam no dispositivo.', 'neutral');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedPage className="mx-auto max-w-md space-y-5 pb-10">
      <SubpageHeader title="A tua conta" subtitle="Sincronização opcional na nuvem" />

      {/* Cabeçalho acolhedor em bloco pastel */}
      <div className="relative overflow-hidden rounded-[26px] bg-[#FCE99F] p-5 text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <StickerBadge tone="mint" tilt={-2}>
              Email primeiro · Sem bloqueios
            </StickerBadge>
            <h2 className="font-display text-2xl font-extrabold leading-tight">
              Guarda o teu semestre <span className="font-editorial font-normal">em segurança</span>
            </h2>
            <p className="text-xs leading-relaxed opacity-80">
              Inicia sessão com email e palavra-passe ou continua a estudar 100% offline só neste telemóvel.
            </p>
          </div>
          <NotebookBuddy mood={user ? 'celebrate' : 'happy'} size={64} className="shrink-0" />
        </div>
      </div>

      {user ? (
        <Card className="space-y-4">
          <div className="flex items-center gap-3.5">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-bold text-accent">
                {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-fg">
                {user.displayName || 'Estudante'}
              </p>
              <p className="truncate text-xs text-muted">{user.email || 'Sessão ativa'}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              <Cloud size={13} /> Cloud ativa
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="primary" className="flex-1" onClick={() => navigate('/')}>
              Voltar ao meu dia <ArrowRight size={16} />
            </Button>
            <Button variant="danger" loading={busy} onClick={handleLogout}>
              <LogOut size={16} /> Terminar sessão
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-5">
          <div className="flex items-center gap-2.5">
            <UnipediaLogoMark size={30} />
            <div className="min-w-0 flex-1">
              <SegmentedControl
                layoutId="login-mode-pill"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                items={[
                  { id: 'signin', label: 'Entrar' },
                  { id: 'signup', label: 'Criar conta' },
                ]}
              />
            </div>
          </div>

          <form onSubmit={submitEmail} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Como queres ser chamado?">
                <div className="relative">
                  <UserIcon size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Mariana Costa"
                    autoComplete="name"
                    className="pl-10"
                  />
                </div>
              </Field>
            )}

            <Field label="Email">
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="estudante@exemplo.pt"
                  autoComplete="email"
                  className="pl-10"
                />
              </div>
            </Field>

            <Field label="Palavra-passe">
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                <Input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="pr-12 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-full text-muted hover:text-fg"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="inline-link text-xs font-semibold text-accent underline underline-offset-2"
                >
                  Esqueci-me da palavra-passe
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-[14px] bg-coral-soft px-3.5 py-2.5 text-xs font-medium text-coral">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-xs font-medium text-accent">
                {info}
              </div>
            )}

            <Button type="submit" variant="primary" loading={busy} className="w-full">
              {mode === 'signup' ? 'Criar conta Unipedia' : 'Entrar com Email'}
              <ArrowRight size={16} />
            </Button>
          </form>

          {/* Opção Google estritamente opcional e nunca disparada automaticamente */}
          {!isNative && (
            <div className="space-y-3 border-t border-line pt-4">
              <p className="text-center text-xs text-muted">
                Ou em alternativa no browser (opcional)
              </p>
              <Button
                variant="secondary"
                loading={googleBusy}
                onClick={() => void handleOptionalGoogle()}
                className="w-full"
              >
                Continuar com conta Google
              </Button>
            </div>
          )}

          {isNative && (
            <div className="rounded-[14px] bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              No telemóvel Android recomendamos iniciar sessão por <strong className="text-fg">Email e Palavra-passe</strong> para proteger a tua conta Google contra bloqueios de WebView. Podes ligar o Google Drive opcionalmente nas Definições.
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <Button variant="ghost" onClick={() => navigate('/')}>
          Continuar sem conta (só neste dispositivo)
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} className="text-ok" />
          <span>
            Lê a nossa{' '}
            <Link to="/privacidade" className="inline-link font-semibold text-accent underline">
              Privacidade em 30s
            </Link>
          </span>
        </p>
      </div>
    </AnimatedPage>
  );
}
