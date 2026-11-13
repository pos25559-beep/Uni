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
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UniBuddy, UnipediaLogoMark } from '../components/brand/UnipediaMarks';
import { LEGAL_INFO } from '../lib/legal';
import {
  AnimatedPage,
  StaggerContainer,
  StaggerItem,
  StickerBadge,
  UNIPEDIA_BOUNCE_SPRING,
  UNIPEDIA_SPRING,
} from '../components/motion/Primitives';
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
  completeMagicEmailLinkSignIn,
  getPendingMagicLinkEmail,
  isIncomingEmailSignInLink,
  loginWithEmail,
  loginWithGoogle,
  logoutFirebase,
  onAuthStateChanged,
  registerWithEmail,
  resetPasswordWithEmail,
  sendMagicEmailLink,
  type User,
} from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/firestoreSync';
import { hapticSuccess, hapticTap } from '../lib/nativeBridge';
import { googleService } from '../services/googleService';
import { useStore } from '../store/useStore';

const UNI_GREETINGS = [
  'Pronto para organizar o teu semestre!',
  'Aqui os prazos não apanham ninguém de surpresa.',
  'Pssst: o teu caderno fica guardado com segurança.',
  'Toca-me sempre que precisares de ajuda para estudar!',
];

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
      return 'Este método de entrada precisa de estar ativo no Firebase Auth (tenta novamente ou usa o link mágico por email).';
    default:
      return fallback || 'Não foi possível entrar neste momento. Tenta novamente.';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const guestMode = Boolean(useStore((s) => s.settings.guestMode));
  const ageAlreadyConfirmed = Boolean(useStore((s) => s.settings.ageConfirmed13Plus));
  const onboardingCompleted = Boolean(useStore((s) => s.academicProfile?.onboardingCompleted));
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const updateSettings = useStore((s) => s.updateSettings);

  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [mode, setMode] = useState<'signin' | 'signup'>(
    () => (searchParams.get('mode') === 'signup' ? 'signup' : 'signin'),
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => getPendingMagicLinkEmail());
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>('password');
  const [magicLinkNeedsEmail, setMagicLinkNeedsEmail] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(ageAlreadyConfirmed);
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [uniTipIndex, setUniTipIndex] = useState(0);
  const [showUniBubble, setShowUniBubble] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();
  const showBack = Boolean(user || guestMode);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
    });
    if (isIncomingEmailSignInLink()) {
      const pendingEmail = getPendingMagicLinkEmail();
      if (!pendingEmail) {
        setMagicLinkNeedsEmail(true);
        setAuthMethod('magic');
      } else {
        setBusy(true);
        void completeMagicEmailLinkSignIn(pendingEmail)
          .then(async (u) => {
            if (!u) return;
            setUser(u);
            updateSettings({
              guestMode: false,
              hasSeenWelcome: true,
              ageConfirmed13Plus: true,
              gdprAcceptedAt: new Date().toISOString(),
              gdprPolicyVersion: LEGAL_INFO.policyVersion,
              ...(u.email ? { personalEmail: u.email } : {}),
            });
            await migrateLocalDataToCloud().catch(() => {});
            const done = Boolean(useStore.getState().academicProfile?.onboardingCompleted);
            void hapticSuccess();
            showToast('Sessão iniciada por link no email!');
            navigate(done ? '/' : '/configurar');
          })
          .catch((err: unknown) => {
            const eObj = err as { code?: string; message?: string };
            setError(friendlyAuthError(eObj?.code, eObj?.message));
          })
          .finally(() => setBusy(false));
      }
    }
    return unsub;
  }, [navigate, updateSettings]);

  const uniMood = user
    ? 'celebrate'
    : passFocused
      ? showPass
        ? 'peek'
        : 'shy'
      : emailFocused || name.length > 0
        ? 'curious'
        : 'happy';

  const handleUniTap = () => {
    void hapticTap();
    if (showUniBubble) {
      setUniTipIndex((i) => (i + 1) % UNI_GREETINGS.length);
    } else {
      setShowUniBubble(true);
    }
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Insere um email válido.');
      return;
    }

    if (authMethod === 'magic') {
      if (mode === 'signup' && !ageConfirmed) {
        setError('Confirma a idade mínima e a Política de Privacidade para criar conta.');
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      void hapticTap();
      try {
        if (magicLinkNeedsEmail && isIncomingEmailSignInLink()) {
          const u = await completeMagicEmailLinkSignIn(email);
          if (u) {
            setUser(u);
            updateSettings({
              guestMode: false,
              hasSeenWelcome: true,
              ageConfirmed13Plus: true,
              gdprAcceptedAt: new Date().toISOString(),
              gdprPolicyVersion: LEGAL_INFO.policyVersion,
              ...(u.email ? { personalEmail: u.email } : {}),
            });
            await migrateLocalDataToCloud().catch(() => {});
            const done = Boolean(useStore.getState().academicProfile?.onboardingCompleted);
            void hapticSuccess();
            showToast('Sessão iniciada!');
            navigate(done ? '/' : '/configurar');
            return;
          }
        }
        await sendMagicEmailLink(email);
        void hapticSuccess();
        setInfo(`Enviámos um link mágico para ${email.trim()}. Abre esse email neste dispositivo para entrar sem palavra-passe.`);
      } catch (err: unknown) {
        const eObj = err as { code?: string; message?: string };
        setError(friendlyAuthError(eObj?.code, eObj?.message));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Insere uma palavra-passe com pelo menos 6 caracteres.');
      return;
    }
    if (mode === 'signup' && !ageConfirmed) {
      setError('Confirma a idade mínima e a Política de Privacidade para criar conta.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    void hapticTap();
    try {
      const cleanName = name.trim();
      const u =
        mode === 'signup'
          ? await registerWithEmail(cleanName || 'Estudante', email, password)
          : await loginWithEmail(email, password);
      setUser(u);
      updateSettings({
        guestMode: false,
        hasSeenWelcome: true,
        ...(mode === 'signup' || ageConfirmed
          ? {
              ageConfirmed13Plus: true,
              gdprAcceptedAt: new Date().toISOString(),
              gdprPolicyVersion: LEGAL_INFO.policyVersion,
            }
          : {}),
        ...(u.displayName ? { userName: u.displayName } : cleanName ? { userName: cleanName } : {}),
      });
      await migrateLocalDataToCloud().catch(() => {});
      const done = Boolean(useStore.getState().academicProfile?.onboardingCompleted);
      void hapticSuccess();
      showToast(mode === 'signup' ? 'Conta criada! Vamos configurar o teu curso.' : 'Sessão iniciada!');
      navigate(done ? '/' : '/configurar');
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
      updateSettings({
        guestMode: false,
        hasSeenWelcome: true,
        ageConfirmed13Plus: true,
        gdprAcceptedAt: new Date().toISOString(),
        gdprPolicyVersion: LEGAL_INFO.policyVersion,
        ...(u.displayName ? { userName: u.displayName } : {}),
        ...(u.email ? { personalEmail: u.email } : {}),
      });
      const st = useStore.getState();
      st.setIntegration('google', {
        connected: true,
        account: u.email ?? undefined,
        lastSync: new Date().toISOString(),
        error: undefined,
      });
      void googleService.syncGoogleEcosystemAfterLogin(st.courses).catch(() => {});
      void hapticSuccess();
      showToast('Bem-vindo! Conta Google e serviços associados.');
      navigate(st.academicProfile?.onboardingCompleted ? '/' : '/configurar');
    } catch (err: unknown) {
      const eObj = err as { code?: string; message?: string };
      if (eObj?.code !== 'auth/popup-closed-by-user') {
        setError(friendlyAuthError(eObj?.code, eObj?.message));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleContinueOffline = () => {
    void hapticTap();
    updateSettings({
      guestMode: true,
      hasSeenWelcome: true,
      ...(ageConfirmed
        ? {
            ageConfirmed13Plus: true,
            gdprAcceptedAt: new Date().toISOString(),
            gdprPolicyVersion: LEGAL_INFO.policyVersion,
          }
        : {}),
    });
    navigate(onboardingCompleted ? '/' : '/configurar');
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutFirebase();
      setUser(null);
      updateSettings({ guestMode: false, userName: '' });
      showToast('Sessão terminada.', 'neutral');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedPage className="mx-auto max-w-md space-y-4 pb-8">
      {showBack ? (
        <SubpageHeader title="A tua conta" subtitle="Inicia sessão ou gere o teu acesso" />
      ) : (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <motion.div whileHover={{ rotate: -6, scale: 1.05 }} transition={UNIPEDIA_BOUNCE_SPRING}>
              <UnipediaLogoMark size={34} />
            </motion.div>
            <span className="font-display text-lg font-extrabold tracking-tight text-fg">
              Unipedia
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/bem-vindo"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <Sparkles size={13} className="text-accent" />
              Apresentação
            </Link>
            <Link
              to="/privacidade"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <ShieldCheck size={14} className="text-ok" />
              Privacidade
            </Link>
          </div>
        </div>
      )}

      <StaggerContainer className="space-y-4">
        {/* Bloco Hero vivo com formas em movimento e o Uni interativo com balão sobreposto (sem cortar o rodapé) */}
        <StaggerItem>
          <div className="relative rounded-[28px] bg-[#FCE99F] p-5 text-[#141312] shadow-card dark:bg-[#352D14] dark:text-[#FAF6EC]">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden="true">
              <motion.div
                className="absolute -top-6 -right-6 size-24 rounded-full bg-[#C9DC9F]/55 dark:bg-[#157F58]/25"
                animate={{ y: [0, 10, 0], x: [0, -6, 0], scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 6.5, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -bottom-5 left-12 size-16 rotate-12 rounded-2xl bg-[#FAD6BA]/60 dark:bg-[#E04F33]/20"
                animate={{ y: [0, -8, 0], rotate: [12, 24, 12] }}
                transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut' }}
              />
            </div>

            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <StickerBadge tone="mint" tilt={-2}>
                  Olá! Eu sou o Uni
                </StickerBadge>
                <h1 className="font-display text-[25px] font-extrabold leading-[1.12] tracking-tight">
                  O teu semestre{' '}
                  <span className="font-serif font-normal italic">sempre em dia</span>
                </h1>
                <p className="text-xs leading-relaxed opacity-85">
                  Organiza cadeiras, horários e sessões de estudo numa só conta ou começa já no teu telemóvel.
                </p>
              </div>

              <div className="relative -mb-2 shrink-0 self-end">
                <UniBuddy
                  mood={uniMood}
                  accessory={uniPreference && uniPreference !== 'auto' ? uniPreference : 'default'}
                  size={74}
                  onClick={handleUniTap}
                  ariaLabel="Interagir com o Uni, o companheiro de estudo"
                />
              </div>
            </div>

            {/* Balão sobreposto acima do formulário: nunca desloca a altura da página nem corta o rodapé */}
            <AnimatePresence>
              {showUniBubble && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.94 }}
                  transition={UNIPEDIA_BOUNCE_SPRING}
                  className="absolute inset-x-4 top-[calc(100%-6px)] z-30 flex items-center justify-between gap-2 rounded-2xl border border-[#141312]/10 bg-[#FAF8F2] px-3.5 py-2.5 text-xs font-medium text-[#141312] shadow-float dark:border-white/15 dark:bg-[#23201B] dark:text-[#FAF6EC]"
                >
                  <span className="leading-snug">
                    “{passFocused && !showPass ? 'Prometo que não estou a espreitar a tua palavra-passe!' : UNI_GREETINGS[uniTipIndex]}”
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUniBubble(false)}
                    aria-label="Fechar mensagem do Uni"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </StaggerItem>

        <StaggerItem>
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
                  <Cloud size={13} /> Sincronizada
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="primary" className="flex-1" onClick={() => navigate('/')}>
                  Ir para o meu dia <ArrowRight size={16} />
                </Button>
                <Button variant="danger" loading={busy} onClick={handleLogout}>
                  <LogOut size={16} /> Sair
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="space-y-5">
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

              <form onSubmit={submitEmail} className="space-y-4">
                <AnimatePresence initial={false}>
                  {mode === 'signup' && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={UNIPEDIA_SPRING}
                      className="overflow-hidden"
                    >
                      <Field label="Como queres ser chamado?">
                        <div className="relative">
                          <UserIcon
                            size={16}
                            className="pointer-events-none absolute top-3.5 left-3.5 text-muted"
                          />
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="O teu primeiro nome"
                            autoComplete="name"
                            className="pl-10"
                          />
                        </div>
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field label="Email">
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@email.com"
                      autoComplete="email"
                      className="pl-10"
                    />
                  </div>
                </Field>

                {/* Seletor discreto: Palavra-passe vs. Só Email (Link Mágico) */}
                <div className="flex items-center justify-between gap-2 rounded-[14px] bg-surface-2/65 px-3 py-2 text-xs">
                  <span className="text-muted">
                    {authMethod === 'magic'
                      ? 'Entrada direta por link no email (sem passe)'
                      : 'Usar palavra-passe normal'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod((v) => (v === 'password' ? 'magic' : 'password'));
                      setError(null);
                      setInfo(null);
                      void hapticTap();
                    }}
                    className="font-semibold text-accent hover:underline"
                  >
                    {authMethod === 'magic' ? 'Usar palavra-passe' : 'Entrar só com email'}
                  </button>
                </div>

                {authMethod === 'password' && (
                  <Field label="Palavra-passe">
                    <div className="relative">
                      <Lock size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-muted" />
                      <Input
                        type={showPass ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onFocus={() => setPassFocused(true)}
                        onBlur={() => setPassFocused(false)}
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
                )}

                {authMethod === 'password' && mode === 'signin' && (
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

                {mode === 'signup' && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-[16px] border border-line bg-bg px-3.5 py-2.5 text-xs leading-relaxed text-fg">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => {
                        setAgeConfirmed(e.target.checked);
                        setError(null);
                        void hapticTap();
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-accent"
                    />
                    <span>
                      Confirmo ter pelo menos <strong>{LEGAL_INFO.minimumAgePT} anos</strong> (ou autorização) e aceito a{' '}
                      <Link to="/privacidade" className="inline-link font-semibold text-accent underline">
                        Privacidade
                      </Link>{' '}
                      e os{' '}
                      <Link to="/termos" className="inline-link font-semibold text-accent underline">
                        Termos
                      </Link>
                      .
                    </span>
                  </label>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-[14px] bg-coral-soft px-3.5 py-2.5 text-xs font-medium text-coral"
                    >
                      {error}
                    </motion.div>
                  )}
                  {info && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-xs font-medium text-accent"
                    >
                      {info}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div whileTap={{ scale: 0.98 }} transition={UNIPEDIA_BOUNCE_SPRING}>
                  <Button type="submit" variant="primary" loading={busy} className="w-full">
                    {authMethod === 'magic'
                      ? magicLinkNeedsEmail
                        ? 'Confirmar email do link'
                        : 'Enviar link de entrada para o email'
                      : mode === 'signup'
                        ? 'Criar a minha conta'
                        : 'Entrar'}
                    <ArrowRight size={16} />
                  </Button>
                </motion.div>
              </form>

              {!isNative && (
                <div className="space-y-3 border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    loading={googleBusy}
                    onClick={() => void handleOptionalGoogle()}
                    className="w-full"
                  >
                    Continuar com Google
                  </Button>
                </div>
              )}
            </Card>
          )}
        </StaggerItem>

        {!user && (
          <StaggerItem>
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <Button variant="ghost" onClick={handleContinueOffline}>
                Usar só neste telemóvel por agora
              </Button>
              <p className="text-xs text-muted">
                Ao continuar, concordas com a nossa{' '}
                <Link to="/privacidade" className="inline-link font-semibold text-accent underline">
                  Política de Privacidade
                </Link>{' '}
                e os{' '}
                <Link to="/termos" className="inline-link font-semibold text-accent underline">
                  Termos
                </Link>
                .
              </p>
            </div>
          </StaggerItem>
        )}
      </StaggerContainer>
    </AnimatedPage>
  );
}
