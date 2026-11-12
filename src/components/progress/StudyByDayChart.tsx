import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtMinutes } from '../../lib/selectors';
import type { Course, Settings, StudySession } from '../../types';
import { ChartCard } from './ChartCard';
import { ChartTooltip } from './ChartTooltip';
import { animation, axisProps, barRadius, cursorFill, gridProps, legendStyle } from './chartStyle';
import { bucketGoal, fmtHours, studyByBucket, studyGoalMinutes, type PeriodRange } from './data';

interface Props {
  courses: Course[];
  sessions: StudySession[];
  settings: Settings;
  range: PeriodRange;
}

/** "Quanto estudei por dia?" — minutos concluídos por cadeira, empilhados. */
export function StudyByDayChart({ courses, sessions, settings, range }: Props) {
  const { rows, series } = useMemo(() => studyByBucket(sessions, courses, range), [sessions, courses, range]);
  const active = useMemo(
    () => series.filter((s) => rows.some((r) => Number(r[s.key]) > 0)),
    [series, rows],
  );
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const goal = studyGoalMinutes(range, settings);
  const barGoal = bucketGoal(range, settings);
  const pctGoal = goal > 0 ? Math.round((total / goal) * 100) : null;

  return (
    <ChartCard
      title="Quanto estudei por dia?"
      isEmpty={total === 0}
      emptyTitle="Ainda sem sessões concluídas neste período"
      emptyHint="Marca sessões como concluídas no plano de estudo para veres aqui quanto estudaste."
      emptyAction={<Link to="/plano" className="text-sm font-medium text-accent">Abrir o plano de estudo</Link>}
      takeaway={
        <>
          Estudaste <span className="tabular">{fmtMinutes(total)}</span>
          {pctGoal !== null && <> — <span className="tabular">{pctGoal}%</span> da meta</>}
        </>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmtHours(v)} />
            <Tooltip cursor={cursorFill} content={(p) => <ChartTooltip {...p} format={fmtMinutes} />} />
            {barGoal > 0 && (
              <ReferenceLine
                y={barGoal}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{ value: `Meta ${fmtMinutes(barGoal)}`, position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }}
              />
            )}
            {active.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="estudo" fill={s.color} radius={barRadius} {...animation()} />
            ))}
            {active.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
