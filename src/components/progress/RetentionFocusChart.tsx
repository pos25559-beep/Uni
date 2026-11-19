import { Brain, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('progress');
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
      tone="sage"
      title={t('retention.title')}
      isEmpty={isEmpty}
      emptyTitle={t('retention.emptyTitle')}
      emptyHint={t('retention.emptyHint')}
      emptyAction={
        <Link to="/plano" className="text-sm font-medium text-accent">
          {t('retention.openPlan')}
        </Link>
      }
      takeaway={
        overview.avgRetentionPct !== null ? (
          <>
            {t('retention.avg')} <span className="tabular">{fmtPct(overview.avgRetentionPct)}</span>
            {' · '}
            {overview.dueCount > 0 ? (
              <span className="tabular font-semibold text-warn">{t('retention.due', { n: overview.dueCount })}</span>
            ) : (
              <span>{t('retention.upToDate')}</span>
            )}
            {focusQuality.cleanFocusPct !== null && (
              <>
                {' · '}
                {t('retention.clean')} <span className="tabular">{fmtPct(focusQuality.cleanFocusPct)}</span>
              </>
            )}
          </>
        ) : focusQuality.cleanFocusPct !== null ? (
          <>
            {t('retention.cleanOf', { pct: fmtPct(focusQuality.cleanFocusPct) })}
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
                  name={t('retention.estimated')}
                  fill="var(--accent)"
                  radius={barRadius}
                  barSize={18}
                  {...animation()}
                />
                <Bar
                  dataKey="acerto"
                  name={t('retention.hitRate')}
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
              {t('retention.quality')}
            </span>
            {focusQuality.cleanFocusPct !== null ? (
              <span className="text-muted tabular">
                <strong className="text-fg">{focusQuality.cleanFocusPct}%</strong> {t('retention.noDistractions')} (
                {focusQuality.cleanFocusCount}/{focusQuality.trackedCount})
                {focusQuality.avgExits !== null && ` · ${t('retention.exits', { n: focusQuality.avgExits })}`}
              </span>
            ) : (
              <span className="text-muted">{t('retention.noExits')}</span>
            )}
            {focusQuality.practiceHitRatePct !== null && (
              <span className="text-muted tabular">
                · {t('retention.active')} <strong className="text-fg">{focusQuality.practiceHitRatePct}%</strong> (
                {focusQuality.practiceHits}/{focusQuality.practiceTotal})
              </span>
            )}
          </div>
        )}

        {topFragile.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('retention.priorities')}
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
                      {item.courseName} · {t('retention.pct', { n: item.retentionPct })}
                      {item.due ? ` · ${t('retention.dueOne')}` : ''}
                    </p>
                  </div>
                  {onPracticeTopic && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onPracticeTopic(item.courseId, item.topicId)}
                    >
                      <Brain size={13} /> {t('retention.practice')}
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
