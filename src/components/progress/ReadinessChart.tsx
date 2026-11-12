import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useMemo } from 'react';
import {
  Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
  type TooltipContentProps,
} from 'recharts';
import type { Assessment, Course } from '../../types';
import { ChartCard } from './ChartCard';
import { animation, axisProps, gridProps } from './chartStyle';
import { plural, readinessPoints, type ReadinessPoint } from './data';

const COMFORT = 60;

function ReadinessTooltip({ active, payload }: TooltipContentProps) {
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
        <dt className="text-muted">Data</dt>
        <dd className="text-right text-fg">{format(parseISO(point.date), 'EEE d MMM', { locale: pt })}</dd>
        <dt className="text-muted">Peso</dt>
        <dd className="text-right text-fg">{point.weight}%</dd>
        <dt className="text-muted">Preparação</dt>
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
  const points = useMemo(() => readinessPoints(assessments, courses, 45), [assessments, courses]);
  const risky = points.filter((p) => p.days <= 14 && p.readiness < COMFORT).length;

  return (
    <ChartCard
      title="Estou preparado para o que aí vem?"
      isEmpty={points.length === 0}
      emptyTitle="Sem avaliações nos próximos 45 dias"
      emptyHint="Quando houver datas de testes, trabalhos ou exames, aparecem aqui."
      takeaway={
        risky > 0 ? (
          <>
            <span className="tabular">{plural(risky, 'avaliação', 'avaliações')}</span> nos próximos 14 dias com menos de{' '}
            <span className="tabular">{COMFORT}%</span> de preparação
          </>
        ) : (
          <>Nenhuma avaliação nos próximos 14 dias está abaixo de <span className="tabular">{COMFORT}%</span> de preparação.</>
        )
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              type="number" dataKey="days" domain={[0, 45]} ticks={[0, 7, 14, 21, 30, 45]}
              tickFormatter={(v: number) => (v === 0 ? 'hoje' : `${v} d`)} {...axisProps}
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
              label={{ value: 'mínimo confortável', position: 'insideTopLeft', fill: 'var(--muted)', fontSize: 11 }}
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
