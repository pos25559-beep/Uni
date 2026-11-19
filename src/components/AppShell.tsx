import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { APP_VERSION_LABEL } from '../lib/appVersion';
import { auth, onAuthStateChanged, type User } from '../lib/firebase';
import { hapticTap, syncNativeTheme } from '../lib/nativeBridge';
import { initNotificationListeners, syncScheduledUniNotifications } from '../lib/notificationBridge';
import { UNI_CHECKIN_EVENT, type UniCheckInRequest } from '../lib/uniCheckInBus';
import { googleService } from '../services/googleService';
import { useAiConsentStore } from '../store/useAiConsentStore';
import { useHubUiStore } from '../store/useHubUiStore';
import { useStore } from '../store/useStore';
import type { StudyLogKind } from '../types';
import FocusHost from './planner/FocusHost';
import AuthStatus from './auth/AuthStatus';
import { UnipediaLogoMark } from './brand/UnipediaMarks';
import { UNIPEDIA_BOUNCE_SPRING, UNIPEDIA_SPRING } from '../lib/motionTokens';
import { ToastViewport } from './ui';
import { cx } from '../lib/uiHelpers';
import { useSheetSwipeDismiss } from '../lib/useSheetSwipeDismiss';

const AiConsentDialog = lazy(() => import('./AiConsentDialog'));
const UniCheckInModal = lazy(() => import('./assistant/UniCheckInModal'));
const PostOnboardingHubModal = lazy(() => import('./onboarding/PostOnboardingHubModal'));
const UniHubInviteOverlay = lazy(() => import('./onboarding/UniHubInviteOverlay'));
const UniLivingOverlay = lazy(() => import('./brand/UniLivingOverlay'));

const desktopNav = [
  { to: '/', key: 'nav.today', icon: LayoutDashboard, end: true, tour: 'nav-today' },
  { to: '/cadeiras', key: 'nav.courses', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/calendario', key: 'nav.calendar', icon: CalendarDays },
  { to: '/plano', key: 'nav.plan', icon: Target, tour: 'nav-plano' },
  { to: '/progresso', key: 'nav.progress', icon: ChartNoAxesColumn },
  { to: '/materiais', key: 'nav.materials', icon: FolderOpen },
  { to: '/assistente', key: 'nav.tutor', icon: Sparkles, tour: 'nav-assistente' },
  { to: '/definicoes', key: 'nav.settings', icon: Settings },
];

const mobilePrimaryNav = [
  { to: '/cadeiras', key: 'nav.courses', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/plano', key: 'nav.plan', icon: Target, tour: 'nav-plano' },
  { to: '/', key: 'nav.today', icon: LayoutDashboard, end: true, tour: 'nav-today', center: true },
  { to: '/assistente', key: 'nav.tutor', icon: Sparkles, tour: 'nav-assistente' },
];

const mobileMoreRoutes = [
  {
    to: '/calendario',
    key: 'nav.calendar',
    hintKey: 'moreSheet.calendarHint',
    icon: CalendarDays,
    tileClass: 'bg-pastel-sky/80 text-[#141312] dark:bg-[#192A3D] dark:text-[#FAF6EC]',
    iconClass: 'text-[#1D5FAD] dark:text-[#93C5FD]',
  },
  {
    to: '/progresso',
    key: 'nav.progress',
    hintKey: 'moreSheet.progressHint',
    icon: ChartNoAxesColumn,
    tileClass: 'bg-pastel-butter/85 text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]',
    iconClass: 'text-[#9A5B00] dark:text-[#FCD34D]',
  },
  {
    to: '/materiais',
    key: 'nav.materials',
    hintKey: 'moreSheet.materialsHint',
    icon: FolderOpen,
    tileClass: 'bg-pastel-mint/80 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]',
    iconClass: 'text-[#157F58] dark:text-[#4ADE80]',
  },
  {
    to: '/definicoes',
    key: 'nav.settings',
    hintKey: 'moreSheet.settingsHint',
    icon: Settings,
    tileClass: 'bg-pastel-peach/80 text-[#141312] dark:bg-[#382317] dark:text-[#FAF6EC]',
    iconClass: 'text-[#C24124] dark:text-[#FCA58E]',
  },
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
  const { t } = useTranslation('common');
  const theme = useStore((s) => s.settings.theme);
  const semesterName = useStore((s) => s.settings.semesterName);
  const guestMode = Boolean(useStore((s) => s.settings.guestMode));
  const hasSeenWelcome = Boolean(useStore((s) => s.settings.hasSeenWelcome));
  const academicProfile = useStore((s) => s.academicProfile);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const fullSettings = useStore((s) => s.settings);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const studyLogs = useStore((s) => s.studyLogs);

  const location = useLocation();
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(() => Boolean(auth.currentUser));
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
  const moreOpen = moreOpenPath === location.pathname;
  const setMoreOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(moreOpen) : next;
    setMoreOpenPath(resolved ? location.pathname : null);
  };
  const moreSheetRef = useRef<HTMLDivElement>(null);
  useSheetSwipeDismiss({
    ref: moreSheetRef,
    open: moreOpen,
    onClose: () => setMoreOpen(false),
    maxViewportWidth: 768,
  });
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpenPath(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);
  const hubModalOpen = useHubUiStore((s) => s.modalOpen);
  const hubModalStep = useHubUiStore((s) => s.focusStep);
  const closeHubModal = useHubUiStore((s) => s.closeModal);
  const sidebarCollapsed = useHubUiStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useHubUiStore((s) => s.toggleSidebarCollapsed);
  const tutorTabsOpenRaw = useHubUiStore((s) => s.tutorTabsOpen);
  const setTutorTabsOpen = useHubUiStore((s) => s.setTutorTabsOpen);
  const aiConsentOpen = useAiConsentStore((s) => s.open);

  const isBypassRoute = BYPASS_ONBOARDING_PATHS.some((p) => location.pathname.startsWith(p));
  const isFullBleedRoute =
    location.pathname.startsWith('/bem-vindo') ||
    location.pathname.startsWith('/configurar') ||
    location.pathname.startsWith('/onboarding');
  const isTutorRoute = location.pathname.startsWith('/assistente');
  const isPlannerRoute = location.pathname.startsWith('/plano');
  // Móvel, em todas as abas com a dock: a barra recolhe para dar espaço ao conteúdo.
  // Fonte única: `tutorTabsOpen` (store) → variável CSS `--tutor-bar-space`, lida aqui (padding)
  // e em Assistant.tsx (altura do chat).
  const isCollapsibleRoute = !isBypassRoute && !isFullBleedRoute;
  const tabsCollapsed = isCollapsibleRoute && !tutorTabsOpenRaw;
  const openBarSpace = isTutorRoute ? '4.75rem' : '6.25rem';
  const tabBarRef = useRef<HTMLDivElement>(null);
  const needsLoginGate = !isBypassRoute && !guestMode && !firebaseUser;
  const needsOnboardingSetup =
    !isBypassRoute && !needsLoginGate && !academicProfile?.onboardingCompleted;

  // Comportamento igual em todas as abas: recolhe ao focar um campo e ao deslizar para baixo;
  // volta com o puxador ou ao deslizar para cima. Ao entrar numa aba a barra aparece, exceto
  // no Tutor, que abre recolhido (a conversa precisa do espaço e desliza sozinha para o fim,
  // por isso aí só o puxador a volta a mostrar).
  useEffect(() => {
    setTutorTabsOpen(!isTutorRoute);
  }, [location.pathname, isTutorRoute, setTutorTabsOpen]);

  useEffect(() => {
    if (!isCollapsibleRoute) return;
    const lastTop = new WeakMap<EventTarget, number>();
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
        setTutorTabsOpen(false);
      }
    };
    const onScroll = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.closest('#main-content')) return;
      const prev = lastTop.get(el) ?? el.scrollTop;
      lastTop.set(el, el.scrollTop);
      const delta = el.scrollTop - prev;
      if (delta > 12) setTutorTabsOpen(false);
      else if (delta < -12 && !isTutorRoute) setTutorTabsOpen(true);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [isCollapsibleRoute, isTutorRoute, setTutorTabsOpen]);

  // Abas recolhidas ficam fora do foco e da árvore de acessibilidade.
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    if (tabsCollapsed) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [tabsCollapsed, isBypassRoute]);

  const isMoreRouteActive = mobileMoreRoutes.some((r) => location.pathname.startsWith(r.to));
  const [checkInModal, setCheckInModal] = useState<(UniCheckInRequest & { open: boolean })>({
    open: false,
    kind: 'day',
  });

  const urlCheckInRequest = useMemo<(UniCheckInRequest & { hasQuery: boolean }) | null>(() => {
    const params = new URLSearchParams(location.search);
    const logKind = params.get('uniLog');
    if (logKind === 'class' || logKind === 'day' || logKind === 'week' || logKind === 'exam_prep') {
      return {
        hasQuery: true,
        kind: logKind as StudyLogKind,
        courseId: params.get('courseId') || undefined,
        classSlotId: params.get('classSlotId') || undefined,
        assessmentId: params.get('assessmentId') || undefined,
      };
    }
    return null;
  }, [location.search]);

  const effectiveCheckInModal = urlCheckInRequest
    ? { open: true, ...urlCheckInRequest }
    : checkInModal;

  const closeCheckInModal = () => {
    setCheckInModal((prev) => ({ ...prev, open: false }));
    if (urlCheckInRequest) {
      const params = new URLSearchParams(location.search);
      params.delete('uniLog');
      params.delete('courseId');
      params.delete('classSlotId');
      params.delete('assessmentId');
      const nextSearch = params.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true },
      );
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<UniCheckInRequest>).detail ?? {};
      setCheckInModal({
        open: true,
        kind: detail.kind ?? 'day',
        courseId: detail.courseId,
        classSlotId: detail.classSlotId,
        assessmentId: detail.assessmentId,
      });
    };
    window.addEventListener(UNI_CHECKIN_EVENT, handler);
    return () => window.removeEventListener(UNI_CHECKIN_EVENT, handler);
  }, []);

  useEffect(() => {
    let active = true;
    const fallbackTimer = window.setTimeout(() => {
      if (active) setAuthReady(true);
    }, 3500);

    // Espera determinística pela hidratação da sessão IndexedDB antes de aplicar o gate de login.
    if (typeof auth.authStateReady === 'function') {
      void auth
        .authStateReady()
        .then(() => {
          if (!active) return;
          window.clearTimeout(fallbackTimer);
          setFirebaseUser(auth.currentUser);
          setAuthReady(true);
        })
        .catch(() => {});
    }

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
            void googleService
              .syncGoogleEcosystemAfterLogin(st.courses, st.settings.sharedHubDriveUrls ?? [])
              .catch(() => {});
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
  const isMinimalTone = appTone === 'serio';

  useEffect(() => {
    void syncNativeTheme(theme, themePalette, appTone);
  }, [theme, themePalette, appTone]);

  useEffect(() => initNotificationListeners((route) => navigate(route)), [navigate]);

  // ADR-001: a IA só fica ligada com a confirmação de 18+. Consentimentos antigos
  // (ou vindos de outro dispositivo) sem essa confirmação voltam a ser pedidos.
  const aiConsentOn = useStore((s) => Boolean(s.settings.aiConsent));
  const aiAdultConfirmed = useStore((s) => Boolean(s.settings.aiAgeConfirmed18Plus));
  const updateSettingsForConsent = useStore((s) => s.updateSettings);
  useEffect(() => {
    if (aiConsentOn && !aiAdultConfirmed) updateSettingsForConsent({ aiConsent: false });
  }, [aiConsentOn, aiAdultConfirmed, updateSettingsForConsent]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncScheduledUniNotifications({
        courses,
        assessments,
        classes,
        sessions,
        studyLogs,
        weeklyCheckIns,
        settings: fullSettings,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [courses, assessments, classes, sessions, studyLogs, weeklyCheckIns, fullSettings]);

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
    if (!hasSeenWelcome) {
      return <Navigate to="/bem-vindo" replace />;
    }
    const returnTarget = `${location.pathname}${location.search}`;
    const loginUrl =
      returnTarget && returnTarget !== '/'
        ? `/entrar?next=${encodeURIComponent(returnTarget)}`
        : '/entrar';
    return <Navigate to={loginUrl} replace />;
  }

  if (needsOnboardingSetup && authReady) {
    return <Navigate to="/configurar" replace />;
  }

  return (
    <MotionConfig reducedMotion={isMinimalTone ? 'always' : 'user'}>
    <div className="flex min-h-dvh h-dvh bg-bg text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink-cta focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-ink-cta-fg focus:shadow-float"
      >
        {t('nav.skipToContent')}
      </a>
      <ToastViewport />
      {aiConsentOpen && (
        <Suspense fallback={null}>
          <AiConsentDialog />
        </Suspense>
      )}
      <FocusHost />

      {/* Navegação lateral (Desktop & Tablet) — expansível ou recolhida numa fila de ícones */}
      {!isBypassRoute && (
      <aside
        className={cx(
          'hidden shrink-0 flex-col border-r border-line bg-surface py-5 transition-[width,padding] duration-200 md:flex',
          sidebarCollapsed ? 'w-[88px] px-2' : 'w-64 px-3.5',
        )}
      >
        <div
          className={cx(
            'mb-5 flex items-center',
            sidebarCollapsed ? 'flex-col gap-2 px-0' : 'justify-between gap-2 px-1.5',
          )}
        >
          <div className={cx('flex min-w-0 items-center gap-2.5', sidebarCollapsed && 'justify-center')}>
            <UnipediaLogoMark size={sidebarCollapsed ? 32 : 36} />
            {!sidebarCollapsed && (
              <div className="min-w-0 leading-tight">
                <div className="font-display text-base font-extrabold tracking-tight">Unipedia</div>
                <div className="truncate text-xs text-muted">
                  {[
                    academicProfile?.onboardingCompleted && academicProfile.universityName
                      ? academicProfile.universityName.split('—')[0].trim()
                      : '',
                    semesterName.trim(),
                  ]
                    .filter(Boolean)
                    .join(' · ') || t('defaultSemester')}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            title={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label={t('nav.mainAria')}>
          {desktopNav.map(({ to, key, icon: Icon, end, tour }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tour={tour}
              aria-label={sidebarCollapsed ? t(key) : undefined}
              title={sidebarCollapsed ? t(key) : undefined}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-11 items-center rounded-full text-sm font-semibold transition',
                  sidebarCollapsed ? 'mx-auto size-11 justify-center px-0' : 'gap-3 px-3.5 py-2',
                  isActive ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{t(key)}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Espaço dedicado quando o estudante encaixa o temporizador de Foco na barra lateral. */}
        <div id="unipedia-sidebar-focus-slot" className="my-2 empty:hidden" />

        <AuthStatus compact={sidebarCollapsed} />

        {!sidebarCollapsed && (
          <>
            <div className="mt-3 flex items-center justify-between border-t border-line/70 px-3 pt-3 text-xs text-muted">
              <NavLink to="/privacidade" className="hover:text-fg hover:underline">
                {t('footer.privacy')}
              </NavLink>
              <span aria-hidden="true">·</span>
              <NavLink to="/termos" className="hover:text-fg hover:underline">
                {t('footer.terms')}
              </NavLink>
              <span aria-hidden="true">·</span>
              <NavLink to="/eliminar-conta" className="hover:text-fg hover:underline">
                {t('footer.data')}
              </NavLink>
            </div>
            <p className="px-3 pt-1.5 font-mono text-xs tabular-nums text-muted/70">
              Unipedia · {APP_VERSION_LABEL}
            </p>
          </>
        )}
      </aside>
      )}

      {/* Conteúdo principal com Safe Area e espaço para a dock flutuante */}
      <main
        id="main-content"
        tabIndex={-1}
        style={
          isCollapsibleRoute
            ? ({ '--tutor-bar-space': tabsCollapsed ? '2rem' : openBarSpace } as React.CSSProperties)
            : undefined
        }
        className={cx(
          'min-w-0 flex-1 overflow-x-hidden overflow-y-auto focus:outline-none md:pt-0',
          isFullBleedRoute
            ? 'pt-0 pb-0 md:pb-0'
            : location.pathname.startsWith('/entrar')
              ? 'pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom)+var(--keyboard-height,0px))] md:pb-6'
              : isBypassRoute
                ? 'pt-[env(safe-area-inset-top)] pb-[calc(1rem+env(safe-area-inset-bottom)+var(--keyboard-height,0px))] md:pb-6'
                : isTutorRoute
                  ? 'pt-[env(safe-area-inset-top)] pb-[calc(var(--tutor-bar-space,4.75rem)+env(safe-area-inset-bottom)+var(--keyboard-height,0px))] md:pb-6'
                  : 'pt-[env(safe-area-inset-top)] pb-[calc(var(--tutor-bar-space,6.25rem)+env(safe-area-inset-bottom)+var(--keyboard-height,0px))] md:pb-6',
        )}
      >
        <div
          className={cx(
            isFullBleedRoute
              ? 'w-full'
              : location.pathname.startsWith('/entrar')
                ? 'mx-auto w-full max-w-5xl px-3.5 py-2 md:px-8 md:py-6'
                : isTutorRoute
                  ? 'mx-auto w-full max-w-5xl px-3.5 py-2 md:px-8 md:py-6'
                  : isPlannerRoute
                    ? 'mx-auto w-full max-w-7xl px-4 py-4 md:px-8 md:py-8'
                    : 'mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-8',
          )}
        >
          <Outlet />
        </div>
      </main>

      {/* Dock flutuante em cápsula (Tinta Negra) estilo Estúdio Caderno Vivo */}
      {!isBypassRoute && (
        <>
        <motion.div
          ref={tabBarRef}
          initial={false}
          animate={tabsCollapsed ? { y: '170%', opacity: 0 } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3 md:hidden"
        >
        <nav
          aria-label={t('nav.barAria')}
          className="pointer-events-auto grid w-full max-w-md grid-cols-5 items-center gap-1 rounded-3xl bg-[#141312] p-1.5 text-[#FAF8F2] shadow-dock dark:border dark:border-white/10 dark:bg-[#23201B]"
        >
          {mobilePrimaryNav.map(({ to, key, icon: Icon, end, tour, center }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tour={tour}
              onClick={() => void hapticTap()}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-xs font-semibold tracking-tight transition-colors',
                  isActive
                    ? 'text-[#141312]'
                    : 'text-[#FAF8F2]/65 hover:text-[#FAF8F2]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="mobile-nav-pill"
                      transition={UNIPEDIA_BOUNCE_SPRING}
                      className="absolute inset-0 -z-0 rounded-2xl bg-[#FAF8F2]"
                    />
                  )}
                  <motion.span
                    animate={isActive ? { y: -1.5, scale: 1.12 } : { y: 0, scale: 1 }}
                    transition={UNIPEDIA_BOUNCE_SPRING}
                    className="relative z-10 inline-flex"
                  >
                    <Icon size={center ? 19 : 18} aria-hidden="true" />
                  </motion.span>
                  <span className="relative z-10 leading-none">{t(key)}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            data-tour="nav-more"
            aria-expanded={moreOpen}
            aria-label={t('nav.moreAria')}
            onClick={() => {
              void hapticTap();
              setMoreOpen((v) => !v);
            }}
            className={cx(
              'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-xs font-semibold tracking-tight transition-colors',
              moreOpen || isMoreRouteActive
                ? 'text-[#141312]'
                : 'text-[#FAF8F2]/65 hover:text-[#FAF8F2]',
            )}
          >
            {(moreOpen || isMoreRouteActive) && (
              <span className="absolute inset-0 rounded-2xl bg-[#FAF8F2]" />
            )}
            <MoreHorizontal size={18} className="relative z-10" aria-hidden="true" />
            <span className="relative z-10 leading-none">{t('nav.more')}</span>
          </button>
        </nav>
      </motion.div>
      {isCollapsibleRoute && (
        <button
          type="button"
          aria-expanded={!tabsCollapsed}
          aria-label={tabsCollapsed ? t('nav.showTabs') : t('nav.hideTabs')}
          onClick={() => {
            void hapticTap();
            setTutorTabsOpen(tabsCollapsed);
          }}
          className={cx(
            'fixed inset-x-0 bottom-0 z-40 mx-auto flex h-11 w-24 items-end justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden',
            tabsCollapsed ? '' : 'pointer-events-none opacity-0',
          )}
        >
          <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-muted/60" />
        </button>
      )}
      </>
      )}

      {/* Folha móvel "Mais" */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t('moreSheet.menuAria')}>
            <motion.button
              type="button"
              aria-label={t('moreSheet.closeMenuAria')}
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
              className="absolute inset-x-0 bottom-0"
            >
              <div
                ref={moreSheetRef}
                className="max-h-[84dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float"
              >
                <div
                  data-sheet-handle=""
                  className="-mx-4 -mt-3 mb-3 cursor-grab touch-none px-4 pt-3 pb-1 active:cursor-grabbing"
                >
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
                  <div className="flex items-center gap-2.5">
                    <UnipediaLogoMark size={32} />
                    <div>
                      <p className="font-display text-base font-bold text-fg">{t('moreSheet.title')}</p>
                      {semesterName.trim() && <p className="text-xs text-muted">{semesterName.trim()}</p>}
                    </div>
                  </div>
                </div>

              <div className="grid grid-cols-2 gap-2.5">
                {mobileMoreRoutes.map(({ to, key, hintKey, icon: Icon, tileClass, iconClass }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      cx(
                        'flex min-h-[92px] flex-col justify-between gap-2 rounded-[22px] p-3.5 shadow-card transition',
                        tileClass,
                        isActive && 'ring-2 ring-ink-cta/80 dark:ring-accent',
                      )
                    }
                  >
                    <span className="grid size-8 place-items-center rounded-xl bg-white/80 dark:bg-black/25">
                      <Icon size={17} className={iconClass} aria-hidden="true" />
                    </span>
                    <div>
                      <span className="block font-display text-sm font-bold">{t(key)}</span>
                      <span className="mt-0.5 block text-xs leading-snug opacity-80">
                        {t(hintKey)}
                      </span>
                    </div>
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <AuthStatus />

                <div className="flex items-center justify-between rounded-2xl bg-pastel-sage/55 px-3.5 py-2 text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]">
                  <NavLink
                    to="/definicoes"
                    className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold"
                  >
                    <Settings size={15} /> {t('moreSheet.openTheme')}
                  </NavLink>
                  <NavLink
                    to="/privacidade"
                    className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-accent-ink underline dark:text-accent"
                  >
                    <ShieldCheck size={14} /> {t('moreSheet.privacy')}
                  </NavLink>
                </div>

                <p className="pt-0.5 text-center font-mono text-xs tabular-nums text-muted/70">
                  Unipedia · {APP_VERSION_LABEL}
                </p>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diário & Check-in Guiado do Uni (Pós-aula, Fim do dia, Domingo, Modo Teste) */}
      {effectiveCheckInModal.open && (
        <Suspense fallback={null}>
          <UniCheckInModal
            open={effectiveCheckInModal.open}
            onClose={closeCheckInModal}
            initialKind={effectiveCheckInModal.kind}
            initialCourseId={effectiveCheckInModal.courseId}
            initialClassSlotId={effectiveCheckInModal.classSlotId}
            initialAssessmentId={effectiveCheckInModal.assessmentId}
          />
        </Suspense>
      )}

      {/* Companheiros Uni nómadas e discretos (+ Micropet equipado) */}
      {!isBypassRoute && (
        <Suspense fallback={null}>
          <UniLivingOverlay />
        </Suspense>
      )}

      {/* Convite flutuante do Uni após explorar + Hub global acessível em qualquer ecrã */}
      {!isBypassRoute && (
        <>
          {!fullSettings.hubSetupCompleted && !fullSettings.hubSetupDismissed && (
            <Suspense fallback={null}>
              <UniHubInviteOverlay />
            </Suspense>
          )}
          {hubModalOpen && (
            <Suspense fallback={null}>
              <PostOnboardingHubModal
                open={hubModalOpen}
                initialFocusStep={hubModalStep}
                onClose={closeHubModal}
              />
            </Suspense>
          )}
        </>
      )}
    </div>
    </MotionConfig>
  );
}
