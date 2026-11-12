import { useMemo, useState } from 'react';
import { PageHeader, cx } from '../components/ui';
import { CourseTimeChart } from '../components/progress/CourseTimeChart';
import { GradeBullets } from '../components/progress/GradeBullets';
import { PlannedDoneChart } from '../components/progress/PlannedDoneChart';
import { PERIODS, periodRange, type Period } from '../components/progress/data';
import { ReadinessChart } from '../components/progress/ReadinessChart';
import { StreakHeatmap } from '../components/progress/StreakHeatmap';
import { StudyByDayChart } from '../components/progress/StudyByDayChart';
import { WeaknessChart } from '../components/progress/WeaknessChart';
import { useStore } from '../store/useStore';

export default function ProgressPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => periodRange(period, settings, now), [period, settings, now]);

  return (
    <>
      <PageHeader
        title="Progresso"
        subtitle={settings.semesterName}
        actions={
          <div role="group" aria-label="Período" className="inline-flex rounded-xl border border-line bg-surface p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={p.value === period}
                onClick={() => setPeriod(p.value)}
                className={cx(
                  'h-8 rounded-[9px] px-3 text-xs font-medium transition',
                  p.value === period ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <StudyByDayChart courses={courses} sessions={sessions} settings={settings} range={range} />
        <PlannedDoneChart sessions={sessions} range={range} />
        <CourseTimeChart courses={courses} sessions={sessions} range={range} />
        <GradeBullets courses={courses} assessments={assessments} />
        <WeaknessChart courses={courses} />
        <ReadinessChart assessments={assessments} courses={courses} />
        <StreakHeatmap sessions={sessions} now={now} />
      </div>
    </>
  );
}
