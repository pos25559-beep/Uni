import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildStudyContext } from '../../integrations/gemini';
import { useStore } from '../../store/useStore';
import { cx } from '../../lib/uiHelpers';

/** Mostra exatamente o texto que é enviado à Google em cada pergunta. */
export function ContextPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation('assistant');
  const [open, setOpen] = useState(defaultOpen);
  const state = useStore();

  const context = useMemo(
    () => (open ? buildStudyContext(state) : ''),
    [open, state],
  );

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          {t('modals.knowsTitle')}
        </span>
        <ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-xs text-muted">
            {t('modals.knowsDesc')}
          </p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-mono text-xs leading-relaxed text-fg">
            {context}
          </pre>
        </div>
      )}
    </div>
  );
}
