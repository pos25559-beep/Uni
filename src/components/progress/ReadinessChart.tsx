import { format, parseISO } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
  type TooltipContentProps,
} from 'recharts';
import { resolveDateFnsLocale } from '../../lib/grading';
import type { Assessment, Course } from '../../types';
import { ChartCard } from './ChartCard';
import { animation, axisProps, gridProps } from './chartStyle';
import { plural, readinessPoints, type ReadinessPoint } from './data';

const COMFORT = 60;

function ReadinessTooltip({ active, payload }: TooltipContentProps) {
  const { t, i18n } = useTranslation('progress');
  const point = active ? (payload?.[0]?.payload as ReadinessPoint | undefined) : undefined;
  if (!point) return null;
  return (
    <div className="max-w-56 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
      <p className="font-medium text-fg">{point.title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-muted">
        <span className="size-2 shrink-0 rounded-full" style={{ background: point.color }} />
        {point.courseName}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 tabular">
        <dt className="text-muted">{t('charts.readiness.date')}</dt>
        <dd className="text-right text-fg">
          {format(parseISO(point.date), 'EEE d MMM', { locale: resolveDateFnsLocale(i18n.language) })}
        </dd>
        <dt className="text-muted">{t('charts.readiness.weight')}</dt>
        <dd className="text-right text-fg">{point.weight}%</dd>
        <dt className="text-muted">{t('charts.readiness.readiness')}</dt>
        <dd className="text-right text-fg">{point.readiness}%</dd>
      </dl>
    </div>
  );
}

interface Props {
  assessments: Assessment[];
  courses: Course[];
}

/** "Estou preparado para o que aí vem?" — avaliações sem nota nos próximos 45 dias. */
export function ReadinessChart({ assessments, courses }: Props) {
  const { t } = useTranslation('progress');
  const points = useMemo(() => readinessPoints(assessments, courses, 45), [assessments, courses]);
  const risky = points.filter((p) => p.days <= 14 && p.readiness < COMFORT).length;
  const riskLabel = plural(
    risky,
    t('charts.plural.assessmentOne'),
    t('charts.plural.assessmentMany'),
  );

  return (
    <ChartCard
      tone="mint"
      title={t('charts.readiness.title')}
      isEmpty={points.length === 0}
      emptyTitle={t('charts.readiness.emptyTitle')}
      emptyHint={t('charts.readiness.emptyHint')}
      takeaway={
        <span className="tabular">
          {risky > 0
            ? t('charts.readiness.takeawayRisk', { count: riskLabel, pct: COMFORT })
            : t('charts.readiness.takeawaySafe', { pct: COMFORT })}
        </span>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              type="number" dataKey="days" domain={[0, 45]} ticks={[0, 7, 14, 21, 30, 45]}
              tickFormatter={(v: number) => (v === 0 ? t('charts.readiness.today') : t('charts.readiness.dayShort', { n: v }))} {...axisProps}
            />
            <YAxis
              type="number" dataKey="readiness" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={44}
              tickFormatter={(v: number) => `${v}%`} {...axisProps}
            />
            <ZAxis type="number" dataKey="weight" range={[60, 360]} />
            <ReferenceLine
              y={COMFORT}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: t('charts.readiness.minComfort'), position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 12 }}
            />
            <Tooltip cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} content={(p) => <ReadinessTooltip {...p} />} />
            <Scatter data={points} fillOpacity={0.85} {...animation()}>
              {points.map((p) => <Cell key={p.id} fill={p.color} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
