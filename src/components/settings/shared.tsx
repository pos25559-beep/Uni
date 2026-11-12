// Blocos partilhados pelos cartões de Definições.
import { formatDistanceToNow, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, ChevronDown, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { IntegrationStatus } from '../../types';
import { Badge, Button, Card, cx } from '../ui';

export function StatusBadge({ status }: { status: IntegrationStatus }) {
  if (status.error) return <Badge tone="danger">Erro</Badge>;
  if (status.connected) return <Badge tone="ok">Ligado</Badge>;
  return <Badge>Por ligar</Badge>;
}

export function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt });
}

/** Cartão de uma fonte de dados: ícone, estado, erro e conteúdo próprio. */
export function IntegrationCard({ icon, title, description, status, children }: {
  icon: ReactNode;
  title: string;
  description: string;
  status: IntegrationStatus;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      {status.lastSync && (
        <p className="-mt-2 text-xs text-muted">Última sincronização {relativeTime(status.lastSync)}</p>
      )}
      {status.error && (
        <p className="break-words rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{status.error}</p>
      )}
      {children}
    </Card>
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

export function errorMessage(e: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
