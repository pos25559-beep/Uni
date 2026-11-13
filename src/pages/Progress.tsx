import { useMemo, useState } from 'react';
import { AnimatedPage } from '../components/motion/Primitives';
import { CourseTimeChart } from '../components/progress/CourseTimeChart';
import { GradeBullets } from '../components/progress/GradeBullets';
import { PlannedDoneChart } from '../components/progress/PlannedDoneChart';
import { PERIODS, periodRange, type Period } from '../components/progress/data';
import { ReadinessChart } from '../components/progress/ReadinessChart';
import { StreakHeatmap } from '../components/progress/StreakHeatmap';
import { StudyByDayChart } from '../components/progress/StudyByDayChart';
import { WeaknessChart } from '../components/progress/WeaknessChart';
import { PageHeader, Ring, SegmentedControl } from '../components/ui';
import { fmtGrade, fmtMinutes, semesterAverage, sessionMinutes, studyStreak } from '../lib/selectors';
import { useStore } from '../store/useStore';

export default function ProgressPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => periodRange(period, settings, now), [period, settings, now]);

  const summary = useMemo(() => {
    const allTopics = courses.flatMap((c) => c.topics);
    const covered = allTopics.filter((t) => t.status === 'done' || t.status === 'review').length;
    const pct = allTopics.length > 0 ? covered / allTopics.length : 0;
    const totalDoneMin = sessions.filter((s) => s.done).reduce((sum, s) => sum + sessionMinutes(s), 0);
    return {
      pct,
      pctLabel: `${Math.round(pct * 100)}%`,
      covered,
      totalTopics: allTopics.length,
      totalDoneMin,
      avg: semesterAverage(courses, assessments),
      streak: studyStreak(sessions),
    };
  }, [courses, assessments, sessions]);

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow="Análise"
        title="O teu"
        accentTitle="progresso"
        subtitle={settings.semesterName}
        actions={
          <SegmentedControl
            layoutId="progress-period-pill"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            items={PERIODS.map((p) => ({ id: p.value, label: p.label }))}
          />
        }
      />

      {/* Cartão Hero Bento "Progresso Geral" com anel estilo papelaria */}
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-[26px] bg-pastel-sky/75 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Progresso geral do semestre</p>
          <p className="font-display text-4xl font-bold tracking-tight tabular">{summary.pctLabel}</p>
          <p className="text-xs opacity-80">
            {summary.totalTopics > 0
              ? `${summary.covered} de ${summary.totalTopics} tópicos concluídos ou revistos`
              : 'Adiciona tópicos nas cadeiras para acompanhar a preparação'}
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium">
            <span className="tabular">Média: <strong>{fmtGrade(summary.avg)}</strong></span>
            <span className="tabular">Estudado: <strong>{fmtMinutes(summary.totalDoneMin)}</strong></span>
            <span className="tabular">Sequência: <strong>{summary.streak}d</strong></span>
          </div>
        </div>
        <Ring value={summary.pct} size={88} stroke={8} color="#157F58">
          <span className="font-display text-base font-bold tabular">{summary.pctLabel}</span>
        </Ring>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StudyByDayChart courses={courses} sessions={sessions} settings={settings} range={range} />
        <PlannedDoneChart sessions={sessions} range={range} />
        <CourseTimeChart courses={courses} sessions={sessions} range={range} />
        <GradeBullets courses={courses} assessments={assessments} />
        <WeaknessChart courses={courses} />
        <ReadinessChart assessments={assessments} courses={courses} />
        <StreakHeatmap sessions={sessions} now={now} />
      </div>
    </AnimatedPage>
  );
}
