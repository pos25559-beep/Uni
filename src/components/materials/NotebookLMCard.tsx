import { useMemo } from 'react';
import { BookOpen, ExternalLink, Info } from 'lucide-react';
import { EmptyState } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { safeHref } from './meta';

interface NotebookLink { key: string; title: string; href: string; sub: string }

export default function NotebookLMCard() {
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');
  const isMinimal = appTone === 'serio';

  const links = useMemo(() => {
    const out: NotebookLink[] = [];
    const seen = new Set<string>();
    const add = (key: string, title: string, raw: string, sub: string) => {
      const href = safeHref(raw);
      if (!href || seen.has(href)) return;
      seen.add(href);
      out.push({ key, title, href, sub });
    };
    for (const m of materials) {
      if (m.provider === 'notebooklm') add(`m:${m.id}`, m.title, m.url, 'Material guardado');
    }
    for (const c of courses) {
      if (c.notebookUrl) add(`c:${c.id}`, `Caderno de ${c.shortName}`, c.notebookUrl, c.name);
    }
    return out;
  }, [materials, courses]);

  return (
    <section
      className={cx(
        'rise space-y-4 p-5 shadow-card',
        isMinimal
          ? 'rounded-[22px] border border-line bg-surface text-fg'
          : 'rounded-[26px] bg-pastel-butter/65 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
          <BookOpen size={16} className="text-accent-ink dark:text-accent" /> Gemini Notebook
        </h2>
        {links.length > 0 && (
          <span className="rounded-full bg-white/70 px-2.5 py-0.5 font-mono text-xs font-semibold tabular dark:bg-black/25">
            {links.length}
          </span>
        )}
      </div>

      <div className="space-y-4 text-sm">
        <div
          className={cx(
            'flex gap-2 rounded-2xl p-3 text-xs leading-relaxed',
            isMinimal ? 'bg-surface-2 text-muted' : 'bg-white/65 opacity-90 dark:bg-black/20',
          )}
        >
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Os cadernos do Gemini Notebook / NotebookLM são guardados como ligações diretas.
            Cola o URL em «Adicionar link», no Hub inicial ou no formulário da cadeira.
          </p>
        </div>

        {links.length === 0 ? (
          <EmptyState
            title="Ainda sem cadernos"
            hint="Guarda o URL de um Gemini Notebook para o abrir daqui com um clique."
          />
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.key}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className={cx(
                    'flex min-h-11 items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 transition',
                    isMinimal
                      ? 'border border-line bg-surface-2 hover:border-accent'
                      : 'bg-white/80 hover:bg-white dark:bg-black/25 dark:hover:bg-black/35',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{l.title}</span>
                    <span className="block truncate text-xs opacity-75">{l.sub}</span>
                  </span>
                  <ExternalLink size={14} className="shrink-0 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
