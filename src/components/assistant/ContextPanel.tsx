import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildStudyContext } from '../../integrations/gemini';
import { useStore } from '../../store/useStore';
import { cx } from '../ui';

/** Mostra exatamente o texto que é enviado à Google em cada pergunta. */
export function ContextPanel() {
  const [open, setOpen] = useState(false);
  // Re-calcula quando os dados mudam, para o painel refletir o estado atual.
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);

  const context = useMemo(
    () => (open ? buildStudyContext(useStore.getState()) : ''),
    [open, courses, assessments, sessions, tasks, settings],
  );

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          O que o assistente sabe
        </span>
        <ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-xs text-muted">
            Este resumo é enviado à Google com cada pergunta. Não inclui a chave da API nem o conteúdo das tuas sebentas.
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-mono text-xs leading-relaxed text-fg">
            {context}
          </pre>
        </div>
      )}
    </div>
  );
}
