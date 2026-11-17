import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState } from '../ui';

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
}

export function ChartCard({ title, takeaway, isEmpty = false, emptyTitle, emptyHint, emptyAction, children }: ChartCardProps) {
  const { t } = useTranslation('progress');
  return (
    <Card>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {isEmpty ? (
        <div className="mt-4">
          <EmptyState title={emptyTitle ?? t('charts.noDataPeriod')} hint={emptyHint} action={emptyAction} />
        </div>
      ) : (
        <>
          {takeaway && <p className="mt-1 text-sm text-fg">{takeaway}</p>}
          <div className="mt-4">{children}</div>
        </>
      )}
    </Card>
  );
}
