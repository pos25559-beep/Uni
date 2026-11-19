import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../ui';
import { cx } from '../../lib/uiHelpers';

/** Tons do Caderno Vivo para o modo claro (o escuro mantém a superfície neutra). */
export type ChartTone = 'sky' | 'mint' | 'butter' | 'sage' | 'peach' | 'blush';

const TONE_CLASS: Record<ChartTone, string> = {
  sky: 'bg-pastel-sky/45 border-[#A9CBEF]/70',
  mint: 'bg-pastel-mint/45 border-[#9ED9C8]/70',
  butter: 'bg-pastel-butter/45 border-[#E8D27A]/70',
  sage: 'bg-pastel-sage/45 border-[#B2C982]/70',
  peach: 'bg-pastel-peach/45 border-[#EDBE9A]/70',
  blush: 'bg-pastel-blush/40 border-[#EAAEA6]/70',
};

interface ChartCardProps {
  /** Título em frase (a pergunta que o gráfico responde). */
  title: string;
  /** Uma linha em texto simples com o valor principal. */
  takeaway?: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
  /** Tom do Caderno Vivo do cartão (modo claro). */
  tone?: ChartTone;
}

export function ChartCard({ title, takeaway, isEmpty = false, emptyTitle, emptyHint, emptyAction, children, tone = 'sky' }: ChartCardProps) {
  const { t } = useTranslation('progress');
  return (
    <section
      className={cx(
        'rise min-w-0 rounded-3xl border p-5 shadow-card dark:border-line dark:bg-surface',
        TONE_CLASS[tone],
      )}
    >
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {isEmpty ? (
        <div className="mt-4 rounded-2xl bg-white/55 p-2 dark:bg-surface-2/40">
          <EmptyState title={emptyTitle ?? t('charts.noDataPeriod')} hint={emptyHint} action={emptyAction} />
        </div>
      ) : (
        <>
          {takeaway && <p className="mt-1 text-sm text-fg">{takeaway}</p>}
          <div className="mt-4">{children}</div>
        </>
      )}
    </section>
  );
}
