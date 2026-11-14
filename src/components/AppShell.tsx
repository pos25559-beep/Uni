import {
  Award,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { auth, onAuthStateChanged, type User } from '../lib/firebase';
import { hapticTap, resolveIsDark, syncNativeTheme } from '../lib/nativeBridge';
import { getUniCollectibleStates, readCollectibleTelemetry } from '../lib/uniCollectibles';
import { googleService } from '../services/googleService';
import { useStore } from '../store/useStore';
import AuthStatus from './auth/AuthStatus';
import UniCollectiblesModal from './brand/UniCollectiblesModal';
import UniLivingOverlay from './brand/UniLivingOverlay';
import { UnipediaLogoMark } from './brand/UnipediaMarks';
import { UNIPEDIA_BOUNCE_SPRING, UNIPEDIA_SPRING } from './motion/Primitives';
import { ToastViewport, cx } from './ui';

const desktopNav = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard, end: true, tour: 'nav-today' },
  { to: '/cadeiras', label: 'Cadeiras', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/plano', label: 'Plano', icon: Target, tour: 'nav-plano' },
  { to: '/progresso', label: 'Progresso', icon: ChartNoAxesColumn },
  { to: '/materiais', label: 'Materiais', icon: FolderOpen },
  { to: '/assistente', label: 'Tutor', icon: Sparkles, tour: 'nav-assistente' },
  { to: '/definicoes', label: 'Definições', icon: Settings },
];

const mobilePrimaryNav = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard, end: true, tour: 'nav-today' },
  { to: '/cadeiras', label: 'Cadeiras', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/plano', label: 'Plano', icon: Target, tour: 'nav-plano' },
  { to: '/assistente', label: 'Tutor', icon: Sparkles, tour: 'nav-assistente' },
];

const mobileMoreRoutes = [
  { to: '/calendario', label: 'Calendário', hint: 'Datas de provas e aulas', icon: CalendarDays },
  { to: '/progresso', label: 'Progresso', hint: 'Consistência e médias', icon: ChartNoAxesColumn },
  { to: '/materiais', label: 'Materiais', hint: 'Sebentas, PDFs e pastas', icon: FolderOpen },
  { to: '/definicoes', label: 'Definições', hint: 'Conta, tema, IA e dados', icon: Settings },
];

const BYPASS_ONBOARDING_PATHS = [
  '/bem-vindo',
  '/entrar',
  '/configurar',
  '/onboarding',
  '/privacidade',
  '/termos',
  '/eliminar-conta',
];

export default function AppShell() {
  const theme = useStore((s) => s.settings.theme);
  const semesterName = useStore((s) => s.settings.semesterName);
  const guestMode = Boolean(useStore((s) => s.settings.guestMode));
  const hasSeenWelcome = Boolean(useStore((s) => s.settings.hasSeenWelcome));
  const updateSettings = useStore((s) => s.updateSettings);
  const academicProfile = useStore((s) => s.academicProfile);
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);

  const location = useLocation();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(() => Boolean(auth.currentUser));
  const [moreOpen, setMoreOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);

  const isBypassRoute = BYPASS_ONBOARDING_PATHS.some((p) => location.pathname.startsWith(p));
  const isFullBleedRoute =
    location.pathname.startsWith('/bem-vindo') ||
    location.pathname.startsWith('/configurar') ||
    location.pathname.startsWith('/onboarding');
  const needsLoginGate = !isBypassRoute && !guestMode && !firebaseUser;
  const needsOnboardingSetup =
    !isBypassRoute && !needsLoginGate && !academicProfile?.onboardingCompleted;

  const isMoreRouteActive = mobileMoreRoutes.some((r) => location.pathname.startsWith(r.to));
  const isDarkNow = resolveIsDark(theme);

  const collectibleCounts = useMemo(() => {
    const items = getUniCollectibleStates(
      readCollectibleTelemetry(sessions, courses, weeklyCheckIns),
    );
    return {
      unlocked: items.filter((i) => i.unlocked).length,
      total: items.length,
    };
  }, [sessions, courses, weeklyCheckIns]);

  useEffect(() => {
    let active = true;
    const fallbackTimer = window.setTimeout(() => {
      if (active) setAuthReady(true);
    }, 350);

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!active) return;
      window.clearTimeout(fallbackTimer);
      setFirebaseUser(u);
      setAuthReady(true);
      if (u && u.providerData.some((p) => p.providerId === 'google.com')) {
        try {
          if (sessionStorage.getItem('unipedia_google_just_signed_in') === '1') {
            sessionStorage.removeItem('unipedia_google_just_signed_in');
            const st = useStore.getState();
            st.setIntegration('google', {
              connected: true,
              account: u.email ?? undefined,
              lastSync: new Date().toISOString(),
              error: undefined,
            });
            st.updateSettings({
              guestMode: false,
              hasSeenWelcome: true,
              ...(u.displayName && !st.settings.userName ? { userName: u.displayName } : {}),
              ...(u.email ? { personalEmail: u.email } : {}),
            });
            void googleService.syncGoogleEcosystemAfterLogin(st.courses).catch(() => {});
          }
        } catch {
          // ignore storage failure
        }
      }
    });
    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const themePalette = useStore((s) => s.settings.themePalette ?? 'caderno');
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');

  useEffect(() => {
    void syncNativeTheme(theme, themePalette, appTone);
  }, [theme, themePalette, appTone]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  if (!isBypassRoute && !guestMode && !authReady) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <motion.div
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >
          <UnipediaLogoMark size={48} />
        </motion.div>
      </div>
    );
  }

  if (needsLoginGate && authReady) {
    return <Navigate to={hasSeenWelcome ? '/entrar' : '/bem-vindo'} replace />;
  }

  if (needsOnboardingSetup && authReady) {
    return <Navigate to="/configurar" replace />;
  }

  const toggleTheme = () => {
    void hapticTap();
    updateSettings({ theme: isDarkNow ? 'light' : 'dark' });
  };

  return (
    <div className="flex min-h-dvh h-dvh bg-bg text-fg">
      <ToastViewport />

      {/* Navegação lateral (Desktop & Tablet) */}
      {!isBypassRoute && (
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-3.5 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <UnipediaLogoMark size={36} />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-base font-extrabold tracking-tight">Unipedia</div>
            <div className="truncate text-xs text-muted">
              {academicProfile?.onboardingCompleted && academicProfile.universityName
                ? `${academicProfile.universityName.split('—')[0].trim()} · ${semesterName}`
                : semesterName}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
          {desktopNav.map(({ to, label, icon: Icon, end, tour }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tour={tour}
              className={({ isActive }) =>
                cx(
                  'relative flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition',
                  isActive ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => {
            void hapticTap();
            setCollectiblesOpen(true);
          }}
          className="mb-2 flex min-h-[44px] items-center justify-between gap-2 rounded-2xl border border-accent/25 bg-accent-soft/45 px-3.5 py-2 text-xs font-semibold text-fg transition hover:bg-accent-soft"
        >
          <span className="inline-flex items-center gap-2">
            <Award size={15} className="text-accent" />
            Coleção do Uni
          </span>
          <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] font-bold text-accent">
            {collectibleCounts.unlocked}/{collectibleCounts.total}
          </span>
        </button>

        <AuthStatus />

        <button
          type="button"
          onClick={toggleTheme}
          className="flex min-h-[44px] items-center gap-3 rounded-full px-3.5 py-2 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          {isDarkNow ? <Sun size={18} /> : <Moon size={18} />}
          {isDarkNow ? 'Tema claro' : 'Tema escuro'}
        </button>

        <div className="mt-3 flex items-center justify-between border-t border-line/70 px-3 pt-3 text-xs text-muted">
          <NavLink to="/privacidade" className="hover:text-fg hover:underline">
            Privacidade
          </NavLink>
          <span aria-hidden="true">·</span>
          <NavLink to="/termos" className="hover:text-fg hover:underline">
            Termos
          </NavLink>
          <span aria-hidden="true">·</span>
          <NavLink to="/eliminar-conta" className="hover:text-fg hover:underline">
            Dados
          </NavLink>
        </div>
      </aside>
      )}

      {/* Conteúdo principal com Safe Area e espaço para a dock flutuante */}
      <main
        className={cx(
          'min-w-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)] md:pt-0 md:pb-6',
          isBypassRoute
            ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom)+var(--keyboard-height,0px))]'
            : 'pb-[calc(6.25rem+env(safe-area-inset-bottom)+var(--keyboard-height,0px))]',
        )}
      >
        <div
          className={cx(
            isFullBleedRoute
              ? 'w-full'
              : 'mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-8',
          )}
        >
          <Outlet />
        </div>
      </main>

      {/* Dock flutuante em cápsula (Tinta Negra) estilo Estúdio Caderno Vivo */}
      {!isBypassRoute && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:hidden">
        <nav
          aria-label="Barra de navegação"
          className="pointer-events-auto grid w-full max-w-md grid-cols-5 items-center gap-1 rounded-[28px] bg-[#141312] p-1.5 text-[#FAF8F2] shadow-dock dark:border dark:border-white/10 dark:bg-[#23201B]"
        >
          {mobilePrimaryNav.map(({ to, label, icon: Icon, end, tour }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tour={tour}
              onClick={() => void hapticTap()}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 py-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-[#141312]' : 'text-[#FAF8F2]/65 hover:text-[#FAF8F2]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      transition={UNIPEDIA_BOUNCE_SPRING}
                      className="absolute inset-0 -z-0 rounded-[22px] bg-[#FAF8F2]"
                    />
                  )}
                  <motion.span
                    animate={isActive ? { y: -1.5, scale: 1.12 } : { y: 0, scale: 1 }}
                    transition={UNIPEDIA_BOUNCE_SPRING}
                    className="relative z-10 inline-flex"
                  >
                    <Icon size={18} aria-hidden="true" />
                  </motion.span>
                  <span className="relative z-10 leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            data-tour="nav-more"
            aria-expanded={moreOpen}
            aria-label="Mais opções e definições"
            onClick={() => {
              void hapticTap();
              setMoreOpen((v) => !v);
            }}
            className={cx(
              'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 py-1 text-[11px] font-semibold transition-colors',
              moreOpen || isMoreRouteActive
                ? 'text-[#141312]'
                : 'text-[#FAF8F2]/65 hover:text-[#FAF8F2]',
            )}
          >
            {(moreOpen || isMoreRouteActive) && (
              <span className="absolute inset-0 rounded-[22px] bg-[#FAF8F2]" />
            )}
            <MoreHorizontal size={18} className="relative z-10" aria-hidden="true" />
            <span className="relative z-10 leading-none">Mais</span>
          </button>
        </nav>
      </div>
      )}

      {/* Folha móvel "Mais" */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu adicional">
            <motion.button
              type="button"
              aria-label="Fechar menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={UNIPEDIA_SPRING}
              className="absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <UnipediaLogoMark size={32} />
                  <div>
                    <p className="font-display text-base font-bold text-fg">Mais na Unipedia</p>
                    <p className="text-xs text-muted">{semesterName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMoreOpen(false)}
                  className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {mobileMoreRoutes.map(({ to, label, hint, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-[84px] flex-col justify-between gap-1.5 rounded-[20px] border p-3.5 transition',
                        isActive
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-bg text-fg hover:bg-surface-2',
                      )
                    }
                  >
                    <Icon size={18} aria-hidden="true" />
                    <div>
                      <span className="block font-display text-sm font-bold">{label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
                    </div>
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    setMoreOpen(false);
                    setCollectiblesOpen(true);
                  }}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-[18px] border border-accent/25 bg-accent-soft/50 px-3.5 py-2.5 text-left transition hover:bg-accent-soft"
                >
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-fg">
                    <Award size={16} className="text-accent" />
                    Coleção do Uni &amp; Mascotes
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 font-mono text-xs font-bold text-accent">
                    {collectibleCounts.unlocked}/{collectibleCounts.total}
                  </span>
                </button>

                <AuthStatus />

                <div className="flex items-center justify-between rounded-[18px] border border-line bg-bg px-3.5 py-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-fg"
                  >
                    {isDarkNow ? <Sun size={16} /> : <Moon size={16} />}
                    {isDarkNow ? 'Mudar para Claro' : 'Mudar para Escuro'}
                  </button>
                  <NavLink
                    to="/privacidade"
                    className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-accent underline"
                  >
                    <ShieldCheck size={14} /> Privacidade
                  </NavLink>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Galeria de Colecionáveis do Uni */}
      <UniCollectiblesModal
        open={collectiblesOpen}
        onClose={() => setCollectiblesOpen(false)}
      />

      {/* Companheiros discretos («Unis com vergonha») apenas nas abas principais */}
      {!isBypassRoute && <UniLivingOverlay />}
    </div>
  );
}
