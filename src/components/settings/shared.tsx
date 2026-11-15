// Blocos partilhados pelos cartões de Definições.
import { Check, ChevronDown, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { IntegrationStatus } from '../../types';
import { Badge, Button } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { relativeTime } from './helpers';

export function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status.error) return <Badge tone="danger">Erro</Badge>;
  if (status.connected) return <Badge tone="ok">Ligado</Badge>;
  return <Badge>Por ligar</Badge>;
}

/** Cartão de uma fonte de dados: ícone, estado, erro e conteúdo próprio. */
export function IntegrationCard({ icon, title, description, status, children }: {
  icon: ReactNode;
  title: string;
  description: string;
  status: IntegrationStatus;
  children: ReactNode;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'rise flex flex-col gap-4 overflow-hidden shadow-card',
        isMinimal
          ? 'rounded-[22px] border border-line bg-surface p-5'
          : 'rounded-[26px] border border-line/70 bg-surface p-5',
      )}
    >
      <div
        className={cx(
          'flex items-start justify-between gap-3',
          !isMinimal && '-mx-5 -mt-5 border-b border-line/60 bg-pastel-sky/35 px-5 py-4 dark:bg-surface-2',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface text-accent-ink shadow-card dark:bg-black/25 dark:text-accent">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold text-fg">{title}</h3>
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      {status.lastSync && (
        <p className="-mt-1 text-xs text-muted">Última sincronização {relativeTime(status.lastSync)}</p>
      )}
      {status.error && (
        <p className="break-words rounded-2xl bg-coral-soft px-3.5 py-2.5 text-sm text-coral-ink">{status.error}</p>
      )}
      {children}
    </section>
  );
}

/** Passos numerados, recolhíveis. */
export function HowTo({ steps }: { steps: ReactNode[] }) {
  return (
    <details className="group rounded-xl border border-line bg-surface-2/60 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
        Como configurar
        <ChevronDown size={16} className="text-muted transition group-open:rotate-180" />
      </summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted marker:font-medium marker:text-fg">
        {steps.map((step, i) => (
          <li key={i} className="pl-1">{step}</li>
        ))}
      </ol>
    </details>
  );
}

/** Valor só de leitura (ex.: origem do site) com botão para copiar. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      <Button size="sm" variant="ghost" onClick={copy} aria-label={`Copiar ${label}`}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span className={cx(copied && 'text-ok')}>{copied ? 'Copiado' : 'Copiar'}</span>
      </Button>
    </div>
  );
}
