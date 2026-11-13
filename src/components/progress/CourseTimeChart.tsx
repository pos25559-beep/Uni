import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { fmtMinutes } from '../../lib/selectors';
import type { Course, StudySession } from '../../types';
import { ChartCard } from './ChartCard';
import { animation, axisProps } from './chartStyle';
import { minutesByCourse, type PeriodRange } from './data';

interface Props {
  courses: Course[];
  sessions: StudySession[];
  range: PeriodRange;
}

/** "Onde é que o tempo foi?" — minutos concluídos por cadeira, na cor da cadeira. */
export function CourseTimeChart({ courses, sessions, range }: Props) {
  const rows = useMemo(() => minutesByCourse(sessions, courses, range), [sessions, courses, range]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const top = rows[0];

  return (
    <ChartCard
      title="Onde é que o tempo foi?"
      isEmpty={rows.length === 0}
      emptyTitle="Ainda sem tempo registado neste período"
      emptyHint="Assim que concluíres sessões de estudo, vês aqui o tempo por cadeira."
      emptyAction={<Link to="/plano" className="text-sm font-medium text-accent">Abrir o plano de estudo</Link>}
      takeaway={
        top && (
          <>
            Mais tempo em {top.name} — <span className="tabular">{fmtMinutes(top.value)}</span>
            {total > 0 && <> (<span className="tabular">{Math.round((top.value / total) * 100)}%</span> do total)</>}
          </>
        )
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={84} {...axisProps} />
            <Bar dataKey="value" name="Estudo" fill="var(--accent)" radius={[0, 10, 10, 0]} {...animation()} barSize={20}>
              {rows.map((r) => <Cell key={r.courseId} fill={r.color} />)}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => fmtMinutes(Number(v))}
                style={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
