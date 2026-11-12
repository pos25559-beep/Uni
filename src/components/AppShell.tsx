import {
  BookOpen, CalendarDays, ChartNoAxesColumn, FolderOpen, GraduationCap, LayoutDashboard, Moon, Settings, Sparkles, Sun, Target,
} from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { cx } from './ui';

const nav = [
  { to: '/', label: 'Hoje', icon: LayoutDashboard, end: true },
  { to: '/cadeiras', label: 'Cadeiras', icon: BookOpen },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/plano', label: 'Plano de estudo', icon: Target },
  { to: '/progresso', label: 'Progresso', icon: ChartNoAxesColumn },
  { to: '/materiais', label: 'Materiais', icon: FolderOpen },
  { to: '/assistente', label: 'Assistente', icon: Sparkles },
  { to: '/definicoes', label: 'Definições', icon: Settings },
];

export default function AppShell() {
  const theme = useStore((s) => s.settings.theme);
  const semesterName = useStore((s) => s.settings.semesterName);
  const updateSettings = useStore((s) => s.updateSettings);
  const isDemo = useStore((s) => s.isDemo);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-fg">
            <GraduationCap size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Campus</div>
            <div className="text-xs text-muted">{semesterName}</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        {isDemo && (
          <NavLink to="/definicoes" className="mb-3 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted hover:text-fg">
            A mostrar dados de demonstração. Liga as tuas fontes nas Definições.
          </NavLink>
        )}
        <button
          type="button"
          onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface/95 px-1 py-1.5 backdrop-blur md:hidden">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end} aria-label={label}
            className={({ isActive }) => cx('rounded-xl p-2.5', isActive ? 'bg-accent-soft text-accent' : 'text-muted')}
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
