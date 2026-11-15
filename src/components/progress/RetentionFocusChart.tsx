import { Brain, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Course, StudySession } from '../../types';
import { Button } from '../ui';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { animation, axisProps, barRadius, cursorFill, gridProps, legendStyle } from './chartStyle';
import { fmtPct, retentionOverview } from './data';

interface Props {
  courses: Course[];
  sessions: StudySession[];
  dayKey: string;
  onPracticeTopic?: (courseId: string, topicId: string) => void;
}

/**
 * Retenção estimada (SRS + recall real) por cadeira, até 3 tópicos frágeis acionáveis
 * e leitura compacta da limpeza do Modo Foco.
 */
export function RetentionFocusChart({ courses, sessions, dayKey, onPracticeTopic }: Props) {
  const overview = useMemo(
    () => retentionOverview(courses, sessions, dayKey),
    [courses, sessions, dayKey],
  );

  const chartData = useMemo(
    () =>
      overview.courseRows.map((row) => ({
        subject: row.name,
        retencao: row.retentionPct,
        acerto: row.hitRatePct,
      })),
    [overview.courseRows],
  );

  const topFragile = overview.fragileTopics.slice(0, 3);
  const { focusQuality } = overview;

  const isEmpty = chartData.length === 0 && focusQuality.trackedCount === 0;

  return (
    <ChartCard
      title="Retenção & Qualidade de Foco"
      isEmpty={isEmpty}
      emptyTitle="Ainda sem revisões registadas"
      emptyHint="Termina um bloco de foco ou pratica um tópico para medir a retenção real e a estabilidade SRS."
      emptyAction={
        <Link to="/plano" className="text-sm font-medium text-accent">
          Abrir Plano &amp; Foco
        </Link>
      }
      takeaway={
        overview.avgRetentionPct !== null ? (
          <>
            Retenção média: <span className="tabular">{fmtPct(overview.avgRetentionPct)}</span>
            {' · '}
            {overview.dueCount > 0 ? (
              <span className="tabular font-semibold text-warn">{overview.dueCount} por rever hoje</span>
            ) : (
              <span>Revisões em dia</span>
            )}
            {focusQuality.cleanFocusPct !== null && (
              <>
                {' · '}
                Foco limpo: <span className="tabular">{fmtPct(focusQuality.cleanFocusPct)}</span>
              </>
            )}
          </>
        ) : focusQuality.cleanFocusPct !== null ? (
          <>
            Foco limpo em <span className="tabular">{fmtPct(focusQuality.cleanFocusPct)}</span> das sessões
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {chartData.length > 0 && (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
                barGap={4}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="subject" {...axisProps} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  {...axisProps}
                />
                <Tooltip cursor={cursorFill} content={(p) => <ChartTooltip {...p} format={fmtPct} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
                <Bar
                  dataKey="retencao"
                  name="Retenção estimada"
                  fill="var(--accent)"
                  radius={barRadius}
                  barSize={18}
                  {...animation()}
                />
                <Bar
                  dataKey="acerto"
                  name="Acerto em prática"
                  fill="var(--warn)"
                  fillOpacity={0.85}
                  radius={barRadius}
                  barSize={18}
                  {...animation()}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {(focusQuality.trackedCount > 0 || focusQuality.practiceTotal > 0) && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-surface-2/60 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-fg">
              <ShieldCheck size={14} className="text-ok" />
              Qualidade de foco:
            </span>
            {focusQuality.cleanFocusPct !== null ? (
              <span className="text-muted tabular">
                <strong className="text-fg">{focusQuality.cleanFocusPct}%</strong> sem distrações (
                {focusQuality.cleanFocusCount}/{focusQuality.trackedCount})
                {focusQuality.avgExits !== null && ` · ${focusQuality.avgExits} saídas/sessão`}
              </span>
            ) : (
              <span className="text-muted">Sem saídas registadas no Modo Foco</span>
            )}
            {focusQuality.practiceHitRatePct !== null && (
              <span className="text-muted tabular">
                · Prática ativa: <strong className="text-fg">{focusQuality.practiceHitRatePct}%</strong> (
                {focusQuality.practiceHits}/{focusQuality.practiceTotal})
              </span>
            )}
          </div>
        )}

        {topFragile.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Prioridades de revisão
            </p>
            <ul className="space-y-1.5">
              {topFragile.map((item) => (
                <li
                  key={item.topicId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-xs font-medium text-fg">{item.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted tabular">
                      {item.courseName} · {item.retentionPct}% retenção
                      {item.due ? ' · revisão devida' : ''}
                    </p>
                  </div>
                  {onPracticeTopic && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onPracticeTopic(item.courseId, item.topicId)}
                    >
                      <Brain size={13} /> Praticar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
