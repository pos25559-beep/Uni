import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtMinutes } from '../../lib/selectors';
import type { StudySession } from '../../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { animation, axisProps, barRadius, cursorFill, gridProps, legendStyle } from './chartStyle';
import { fmtHours, planTotals, plannedByWeek, type PeriodRange } from './data';

interface Props {
  sessions: StudySession[];
  range: PeriodRange;
}

/** "Planeado vs. feito" — por semana, planeado (neutro) e feito (accent). */
export function PlannedDoneChart({ sessions, range }: Props) {
  const rows = useMemo(() => plannedByWeek(sessions, range), [sessions, range]);
  const totals = useMemo(() => planTotals(sessions, range), [sessions, range]);
  const isEmpty = rows.every((r) => r.planned === 0 && r.done === 0);
  const pctDone = totals.planned > 0 ? Math.round((totals.done / totals.planned) * 100) : null;

  return (
    <ChartCard
      title="Planeado vs. feito"
      isEmpty={isEmpty}
      emptyTitle="Sem sessões planeadas neste período"
      emptyHint="Gera um plano de estudo para comparar o que planeaste com o que fizeste."
      emptyAction={<Link to="/plano" className="text-sm font-medium text-accent">Gerar plano</Link>}
      takeaway={
        pctDone === null ? (
          'Ainda nada decorreu neste período.'
        ) : (
          <>
            Fizeste <span className="tabular">{pctDone}%</span> do planeado —{' '}
            <span className="tabular">{fmtMinutes(totals.done)}</span> de{' '}
            <span className="tabular">{fmtMinutes(totals.planned)}</span>
          </>
        )
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmtHours(v)} />
            <Tooltip cursor={cursorFill} content={(p) => <ChartTooltip {...p} format={fmtMinutes} />} />
            <Bar dataKey="planned" name="Planeado" fill="var(--muted)" fillOpacity={0.35} radius={barRadius} {...animation()} />
            <Bar dataKey="done" name="Feito" fill="var(--accent)" radius={barRadius} {...animation()} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
