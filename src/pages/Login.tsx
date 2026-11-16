import { Capacitor } from '@capacitor/core';
import { useTranslation } from 'react-i18next';
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
} from '../components/motion/Primitives';
import { UNIPEDIA_BOUNCE_SPRING, UNIPEDIA_SPRING } from '../lib/motionTokens';
import { Button, Card, Field, Input, SegmentedControl, SubpageHeader } from '../components/ui';
import { showToast } from '../lib/uiHelpers';
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
import i18n from '../i18n';

const UNI_GREETING_KEYS = ['auth.greet1', 'auth.greet2', 'auth.greet3', 'auth.greet4'] as const;

function friendlyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return i18n.t('auth.err.invalid');
    case 'auth/email-already-in-use':
      return i18n.t('auth.err.inUse');
    case 'auth/weak-password':
      return i18n.t('auth.err.weak');
    case 'auth/too-many-requests':
      return i18n.t('auth.err.tooMany');
    case 'auth/operation-not-allowed':
      return i18n.t('auth.err.notAllowed');
    default:
      return fallback || i18n.t('auth.err.generic');
  }
}

export default function LoginPage() {
  const { t } = useTranslation();
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
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>(() =>
    isIncomingEmailSignInLink() && !getPendingMagicLinkEmail() ? 'magic' : 'password',
  );
  const [magicLinkNeedsEmail] = useState(
    () => isIncomingEmailSignInLink() && !getPendingMagicLinkEmail(),
  );
  const [ageConfirmed, setAgeConfirmed] = useState(ageAlreadyConfirmed);
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [uniTipIndex, setUniTipIndex] = useState(0);
  const [showUniBubble, setShowUniBubble] = useState(false);
  const [busy, setBusy] = useState(
    () => isIncomingEmailSignInLink() && Boolean(getPendingMagicLinkEmail()),
  );
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const rawNext = searchParams.get('next');
  const safeNext =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const isManageMode = searchParams.get('manage') === '1';
  const postLoginTarget = (done: boolean) => (done ? (safeNext ?? '/') : '/configurar');

  const isNative = Capacitor.isNativePlatform();
  const showBack = Boolean(user || guestMode);

  useEffect(() => {
    const incomingLink = isIncomingEmailSignInLink();
    const resolveTarget = (done: boolean) => (done ? (safeNext ?? '/') : '/configurar');
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
      if (u && !incomingLink && !isManageMode) {
        const done = Boolean(useStore.getState().academicProfile?.onboardingCompleted);
        if (safeNext || done) {
          navigate(resolveTarget(done), { replace: true });
        }
      }
    });
    if (incomingLink) {
      const pendingEmail = getPendingMagicLinkEmail();
      if (pendingEmail) {
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
            showToast(i18n.t('auth.toast.linkSignedIn'));
            navigate(resolveTarget(done));
          })
          .catch((err: unknown) => {
            const eObj = err as { code?: string; message?: string };
            setError(friendlyAuthError(eObj?.code, eObj?.message));
          })
          .finally(() => setBusy(false));
      }
    }
    return unsub;
  }, [isManageMode, navigate, safeNext, updateSettings]);

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
      setUniTipIndex((i) => (i + 1) % UNI_GREETING_KEYS.length);
    } else {
      setShowUniBubble(true);
    }
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t('auth.err.email'));
      return;
    }

    if (authMethod === 'magic') {
      if (mode === 'signup' && !ageConfirmed) {
        setError(t('auth.err.consent'));
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
            showToast(t('auth.toast.signedIn'));
            navigate(postLoginTarget(done));
            return;
          }
        }
        await sendMagicEmailLink(email);
        void hapticSuccess();
        setInfo(t('auth.info.magicSent', { email: email.trim() }));
      } catch (err: unknown) {
        const eObj = err as { code?: string; message?: string };
        setError(friendlyAuthError(eObj?.code, eObj?.message));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setError(t('auth.err.password'));
      return;
    }
    if (mode === 'signup' && !ageConfirmed) {
      setError(t('auth.err.consent'));
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
      showToast(mode === 'signup' ? t('auth.toast.created') : t('auth.toast.signedIn'));
      navigate(postLoginTarget(done));
    } catch (err: unknown) {
      const eObj = err as { code?: string; message?: string };
      setError(friendlyAuthError(eObj?.code, eObj?.message));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(t('auth.err.resetNeedsEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPasswordWithEmail(email);
      setInfo(t('auth.info.resetSent'));
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
      void googleService
        .syncGoogleEcosystemAfterLogin(st.courses, st.settings.sharedHubDriveUrls ?? [])
        .catch(() => {});
      void hapticSuccess();
      showToast(t('auth.toast.google'));
      navigate(postLoginTarget(Boolean(st.academicProfile?.onboardingCompleted)));
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
      showToast(t('auth.toast.signedOut'), 'neutral');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedPage className={`mx-auto max-w-md ${showBack ? 'space-y-4 pb-8' : 'space-y-3 pb-2'}`}>
      {showBack ? (
        <SubpageHeader title={t('auth.header.title')} subtitle={t('auth.header.subtitle')} />
      ) : (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <motion.div whileHover={{ rotate: -6, scale: 1.05 }} transition={UNIPEDIA_BOUNCE_SPRING}>
              <UnipediaLogoMark size={32} />
            </motion.div>
            <span className="font-display text-lg font-extrabold tracking-tight text-fg">
              Unipedia
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/bem-vindo"
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <Sparkles size={13} className="shrink-0 text-accent" />
              <span>{t('auth.nav.home')}</span>
            </Link>
            <Link
              to="/privacidade"
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <ShieldCheck size={14} className="shrink-0 text-ok" />
              <span>{t('auth.nav.privacy')}</span>
            </Link>
          </div>
        </div>
      )}

      <StaggerContainer className="space-y-3.5">
        {/* Bloco Hero vivo com formas em movimento e o Uni interativo com balão sobreposto (sem cortar o rodapé) */}
        <StaggerItem>
          <div className="relative rounded-[26px] bg-[#FCE99F] p-4 text-[#141312] shadow-card dark:bg-[#352D14] dark:text-[#FAF6EC] sm:p-5">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" aria-hidden="true">
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

            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <StickerBadge tone="mint" tilt={-2}>
                  {t('auth.hero.badge')}
                </StickerBadge>
                <h1 className="font-display text-[22px] font-extrabold leading-[1.12] tracking-tight sm:text-[25px]">
                  {t('auth.hero.title')}{' '}
                  <span className="font-serif font-normal italic">{t('auth.hero.titleAccent')}</span>
                </h1>
                <p className="text-xs leading-snug opacity-85">
                  {t('auth.hero.body')}
                </p>
              </div>

              <div className="relative -mb-1 shrink-0 self-end">
                <UniBuddy
                  mood={uniMood}
                  accessory={uniPreference && uniPreference !== 'auto' ? uniPreference : 'default'}
                  size={68}
                  onClick={handleUniTap}
                  ariaLabel={t('auth.hero.uniAria')}
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
                    “{passFocused && !showPass ? t('auth.peek') : t(UNI_GREETING_KEYS[uniTipIndex])}”
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUniBubble(false)}
                    aria-label={t('auth.hero.closeBubble')}
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
                    {user.displayName || t('auth.account.student')}
                  </p>
                  <p className="truncate text-xs text-muted">{user.email || t('auth.account.active')}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  <Cloud size={13} /> {t('auth.account.synced')}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="primary" className="flex-1" onClick={() => navigate('/')}>
                  {t('auth.account.goToday')} <ArrowRight size={16} />
                </Button>
                <Button variant="danger" loading={busy} onClick={handleLogout}>
                  <LogOut size={16} /> {t('auth.account.signOut')}
                </Button>
              </div>
            </Card>
          ) : (
            <Card padded={false} className="space-y-4 p-4 sm:p-5">
              <SegmentedControl
                layoutId="login-mode-pill"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                items={[
                  { id: 'signin', label: t('auth.tabs.signin') },
                  { id: 'signup', label: t('auth.tabs.signup') },
                ]}
              />

              <form onSubmit={submitEmail} className="space-y-3">
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
                      <Field label={t('auth.form.nameLabel')}>
                        <div className="relative">
                          <UserIcon
                            size={16}
                            className="pointer-events-none absolute top-3.5 left-3.5 text-muted"
                          />
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('auth.form.namePlaceholder')}
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
                      placeholder={t('auth.form.emailPlaceholder')}
                      autoComplete="email"
                      className="pl-10"
                    />
                  </div>
                </Field>

                {/* Banner quando está no modo Link Direto (sem palavra-passe) */}
                {authMethod === 'magic' && (
                  <div className="flex items-center justify-between gap-2 rounded-[14px] bg-surface-2/65 px-3 py-2 text-xs">
                    <span className="text-muted">{t('auth.form.magicBanner')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('password');
                        setError(null);
                        setInfo(null);
                        void hapticTap();
                      }}
                      className="font-semibold text-accent hover:underline"
                    >
                      {t('auth.form.usePassword')}
                    </button>
                  </div>
                )}

                {authMethod === 'password' && (
                  <Field label={t('auth.form.passwordLabel')}>
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
                        placeholder={t('auth.form.passwordPlaceholder')}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        className="pr-12 pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        aria-label={showPass ? t('auth.form.hidePassword') : t('auth.form.showPassword')}
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
                      {t('auth.form.forgot')}
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
                      {t('auth.form.ageBefore')} <strong>{t('auth.form.years', { age: LEGAL_INFO.minimumAgePT })}</strong> {t('auth.form.ageAfter')}{' '}
                      <Link to="/privacidade" className="inline-link font-semibold text-accent underline">
                        {t('auth.form.privacy')}
                      </Link>{' '}
                      {t('auth.form.and')}{' '}
                      <Link to="/termos" className="inline-link font-semibold text-accent underline">
                        {t('auth.form.terms')}
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
                        ? t('auth.form.confirmMagic')
                        : t('auth.form.sendMagic')
                      : mode === 'signup'
                        ? t('auth.form.createMine')
                        : t('auth.tabs.signin')}
                    <ArrowRight size={16} />
                  </Button>
                </motion.div>
              </form>

              {!isNative && (
                <div className="border-t border-line pt-3">
                  <Button
                    variant="secondary"
                    loading={googleBusy}
                    onClick={() => void handleOptionalGoogle()}
                    className="w-full"
                  >
                    {t('auth.form.google')}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </StaggerItem>

        {!user && (
          <StaggerItem>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex flex-wrap items-center justify-center gap-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod((v) => (v === 'password' ? 'magic' : 'password'));
                    setError(null);
                    setInfo(null);
                    void hapticTap();
                  }}
                  className="min-h-[36px] rounded-xl px-2 text-xs font-semibold text-accent hover:underline"
                >
                  {authMethod === 'password' ? t('auth.footer.magicLink') : t('auth.form.usePassword')}
                </button>
                <span aria-hidden="true" className="text-xs text-muted">·</span>
                <button
                  type="button"
                  onClick={handleContinueOffline}
                  className="min-h-11 rounded-xl px-3 text-xs font-semibold text-fg hover:underline"
                >
                  {t('auth.footer.localOnly')}
                </button>
              </div>
              <p className="text-xs text-muted">
                {t('auth.footer.acceptBefore')}{' '}
                <Link to="/privacidade" className="inline-link font-semibold text-accent underline">
                  {t('auth.form.privacy')}
                </Link>{' '}
                {t('auth.form.and')}{' '}
                <Link to="/termos" className="inline-link font-semibold text-accent underline">
                  {t('auth.form.terms')}
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
