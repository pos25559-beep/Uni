import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('progress');
  const rows = useMemo(() => minutesByCourse(sessions, courses, range), [sessions, courses, range]);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const top = rows[0];

  return (
    <ChartCard
      title={t('charts.courseTime.title')}
      isEmpty={rows.length === 0}
      emptyTitle={t('charts.courseTime.emptyTitle')}
      emptyHint={t('charts.courseTime.emptyHint')}
      emptyAction={<Link to="/plano" className="text-sm font-medium text-accent">{t('charts.courseTime.emptyAction')}</Link>}
      takeaway={
        top && (
          <span className="tabular">
            {t('charts.courseTime.takeaway', { course: top.name, time: fmtMinutes(top.value) })}
            {total > 0 && t('charts.courseTime.takeawayPct', { pct: Math.round((top.value / total) * 100) })}
          </span>
        )
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={84} {...axisProps} />
            <Bar dataKey="value" name={t('charts.courseTime.seriesName')} fill="var(--accent)" radius={[0, 10, 10, 0]} {...animation()} barSize={20}>
              {rows.map((r) => <Cell key={r.courseId} fill={r.color} />)}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => fmtMinutes(Number(v))}
                style={{ fontSize: 12, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
