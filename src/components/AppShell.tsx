import {
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
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { syncNativeTheme, hapticTap } from '../lib/nativeBridge';
import { useStore } from '../store/useStore';
import { UnipediaLogoMark } from './brand/UnipediaMarks';
import { UNIPEDIA_SPRING } from './motion/Primitives';
import { cx } from './ui';
import AuthStatus from './auth/AuthStatus';
import OnboardingModal from './onboarding/OnboardingModal';

const desktopNav = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard, end: true, tour: 'nav-today' },
  { to: '/cadeiras', label: 'Cadeiras', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/plano', label: 'Plano de estudo', icon: Target, tour: 'nav-plano' },
  { to: '/progresso', label: 'Progresso', icon: ChartNoAxesColumn },
  { to: '/materiais', label: 'Materiais', icon: FolderOpen },
  { to: '/assistente', label: 'Tutor IA', icon: Sparkles, tour: 'nav-assistente' },
  { to: '/definicoes', label: 'Definições', icon: Settings },
];

const mobilePrimaryNav = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard, end: true, tour: 'nav-today' },
  { to: '/cadeiras', label: 'Cadeiras', icon: BookOpen, tour: 'nav-cadeiras' },
  { to: '/plano', label: 'Plano', icon: Target, tour: 'nav-plano' },
  { to: '/assistente', label: 'Tutor', icon: Sparkles, tour: 'nav-assistente' },
];

const mobileMoreRoutes = [
  { to: '/calendario', label: 'Calendário', hint: 'Datas de avaliações e aulas', icon: CalendarDays },
  { to: '/progresso', label: 'Progresso', hint: 'Consistência, horas e médias', icon: ChartNoAxesColumn },
  { to: '/materiais', label: 'Materiais', hint: 'Apontamentos, PDFs e ligações', icon: FolderOpen },
  { to: '/definicoes', label: 'Definições', hint: 'Conta, tema, IA e backup JSON', icon: Settings },
];

const LEGAL_PATHS = ['/privacidade', '/termos', '/eliminar-conta'];

export default function AppShell() {
  const theme = useStore((s) => s.settings.theme);
  const semesterName = useStore((s) => s.settings.semesterName);
  const updateSettings = useStore((s) => s.updateSettings);
  const isDemo = useStore((s) => s.isDemo);
  const academicProfile = useStore((s) => s.academicProfile);
  const saveAcademicProfile = useStore((s) => s.saveAcademicProfile);

  const location = useLocation();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isLegalRoute = LEGAL_PATHS.includes(location.pathname);
  const onboardingOpen =
    !isLegalRoute && !onboardingDismissed && !academicProfile?.onboardingCompleted;

  const isMoreRouteActive = mobileMoreRoutes.some((r) => location.pathname.startsWith(r.to));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    void syncNativeTheme(theme);
  }, [theme]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    void hapticTap();
    updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <div className="flex min-h-dvh h-dvh bg-bg text-fg">
      {/* Navegação lateral (Desktop & Tablet) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <UnipediaLogoMark size={36} />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-sm font-bold tracking-tight">Unipedia</div>
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
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <AuthStatus />

        {isDemo && (
          <NavLink
            to="/definicoes"
            className="mb-3 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
          >
            Modo demonstração ativo. Configura o teu curso nas Definições.
          </NavLink>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>

        <div className="mt-3 flex items-center justify-between border-t border-line/70 px-3 pt-3 text-[11px] text-muted">
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

      {/* Conteúdo principal com respeito por Safe Area e teclado virtual */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[calc(5.25rem+env(safe-area-inset-bottom)+var(--keyboard-height,0px))] md:pt-0 md:pb-6">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Barra inferior móvel: exatamente 5 separadores com rótulo e layoutId elástico */}
      <nav
        aria-label="Barra de navegação"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-line bg-surface/95 px-1.5 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
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
                'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition',
                isActive ? 'text-accent' : 'text-muted hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={UNIPEDIA_SPRING}
                    className="absolute inset-x-1.5 inset-y-0.5 -z-10 rounded-xl bg-accent-soft"
                  />
                )}
                <Icon size={19} aria-hidden="true" />
                <span className="leading-none">{label}</span>
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
            'relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition',
            moreOpen || isMoreRouteActive ? 'text-accent' : 'text-muted hover:text-fg',
          )}
        >
          {(moreOpen || isMoreRouteActive) && (
            <span className="absolute inset-x-1.5 inset-y-0.5 -z-10 rounded-xl bg-accent-soft" />
          )}
          <MoreHorizontal size={19} aria-hidden="true" />
          <span className="leading-none">Mais</span>
        </button>
      </nav>

      {/* Gaveta móvel "Mais" (Calendário, Progresso, Materiais, Definições, Conta e RGPD) */}
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
              className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <UnipediaLogoMark size={30} />
                  <div>
                    <p className="font-display text-sm font-bold text-fg">Mais ferramentas</p>
                    <p className="text-xs text-muted">{semesterName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMoreOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
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
                        'flex flex-col gap-1.5 rounded-2xl border p-3.5 transition',
                        isActive
                          ? 'border-accent bg-accent-soft/60 text-accent'
                          : 'border-line bg-bg text-fg hover:bg-surface-2',
                      )
                    }
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="font-display text-sm font-bold">{label}</span>
                    <span className="text-[11px] leading-snug text-muted">{hint}</span>
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                <AuthStatus />

                <div className="flex items-center justify-between rounded-2xl border border-line bg-bg px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center gap-2 text-xs font-medium text-fg"
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
                  </button>
                  <NavLink
                    to="/privacidade"
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent"
                  >
                    <ShieldCheck size={14} /> RGPD & Ajuda
                  </NavLink>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Onboarding em ecrã completo na primeira execução */}
      <OnboardingModal
        open={onboardingOpen}
        fullScreen
        onClose={() => {
          setOnboardingDismissed(true);
          if (!academicProfile?.onboardingCompleted) {
            saveAcademicProfile({ onboardingCompleted: true });
          }
        }}
      />
    </div>
  );
}
