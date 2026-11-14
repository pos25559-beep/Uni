import { useMemo } from 'react';
import { BookOpen, ExternalLink, Info } from 'lucide-react';
import { Card, EmptyState } from '../ui';
import { useStore } from '../../store/useStore';
import { safeHref } from './meta';

interface NotebookLink { key: string; title: string; href: string; sub: string }

export default function NotebookLMCard() {
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);

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
    <Card title={<span className="flex items-center gap-2"><BookOpen size={16} className="text-accent" /> Gemini Notebook</span>}>
      <div className="space-y-4 text-sm">
        <div className="flex gap-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
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
                  className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.title}</span>
                    <span className="block truncate text-xs text-muted">{l.sub}</span>
                  </span>
                  <ExternalLink size={14} className="shrink-0 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
