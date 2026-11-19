// Bloco ```uni-grafico do chat: valida e desenha; durante a escrita mostra «a desenhar»;
// se o JSON for inválido, avisa e mostra o texto original (nunca rebenta a conversa).
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartSpecError, parseChartBlock } from '../../../lib/charts/spec';
import { UniChart } from './UniChart';

export const CHART_LANGS = new Set(['uni-grafico', 'uni-gráfico', 'uni-chart', 'grafico', 'chart']);

export function ChartBlock({ source, complete }: { source: string; complete: boolean }) {
  const { t } = useTranslation('assistant');
  const result = useMemo(() => {
    if (!complete) return null;
    try {
      return { model: parseChartBlock(source) };
    } catch (err) {
      return { error: err instanceof ChartSpecError ? err.message : '' };
    }
  }, [source, complete]);

  if (!result) {
    return (
      <div className="my-2 flex h-40 items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2/40 text-xs text-muted" aria-busy="true">
        {t('chart.drawing')}
      </div>
    );
  }
  if ('model' in result && result.model) return <UniChart model={result.model} />;
  return (
    <details className="my-2 rounded-xl border border-line bg-surface-2/40 px-3 py-2 text-xs text-muted">
      <summary className="cursor-pointer">{t('chart.failed')}</summary>
      <pre className="mt-2 overflow-x-auto font-mono leading-relaxed">{source}</pre>
    </details>
  );
}
