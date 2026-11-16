import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { courseColors } from '../../lib/colors';
import { formatGradeByScale, GRADE_SCALES, gradeToPercent } from '../../lib/grading';
import { semesterAverage } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course } from '../../types';
import { ChartCard } from './ChartCard';
import { gradeRows } from './data';

interface Props {
  courses: Course[];
  assessments: Assessment[];
}

/** "Como estão as notas face ao objetivo?" — lista de barras (bullet) por cadeira normalizada na escala ativa. */
export function GradeBullets({ courses, assessments }: Props) {
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const appLang = useStore((s) => s.settings.language) ?? 'pt-PT';
  const scaleMeta = GRADE_SCALES[gradingScale] ?? GRADE_SCALES.pt20;
  const passingGrade = scaleMeta.passing;
  const scale = (grade: number) => `${gradeToPercent(grade, gradingScale)}%`;
  const fmt = (g: number | null | undefined) => formatGradeByScale(g, gradingScale, appLang);

  const rows = useMemo(() => gradeRows(courses, assessments), [courses, assessments]);
  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);
  const graded = rows.filter((r) => r.current !== null).length;
  const below = rows.filter((r) => r.current !== null && r.current < r.course.targetGrade).length;

  return (
    <ChartCard
      title="Como estão as notas face ao objetivo?"
      isEmpty={courses.length === 0}
      emptyTitle="Ainda não tens cadeiras"
      emptyHint="Adiciona cadeiras para acompanhar as notas face ao objetivo."
      emptyAction={<Link to="/cadeiras" className="text-sm font-medium text-accent">Ir para as cadeiras</Link>}
      takeaway={
        average === null ? (
          'Ainda sem notas lançadas.'
        ) : (
          <>
            Média ponderada <span className="tabular">{fmt(average)}</span> — <span className="tabular">{below}</span> de{' '}
            <span className="tabular">{graded}</span> {below === 1 ? 'cadeira abaixo' : 'cadeiras abaixo'} do objetivo
          </>
        )
      }
    >
      <ul className="space-y-4">
        {rows.map(({ course, current }) => (
          <li key={course.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-fg">{course.shortName}</span>
              {current === null ? (
                <span className="shrink-0 text-muted">sem notas</span>
              ) : (
                <span className="shrink-0 tabular text-fg">
                  {fmt(current)} <span className="text-muted">/ objetivo {fmt(course.targetGrade)}</span>
                </span>
              )}
            </div>
            <div className="relative h-2 rounded-full bg-surface-2">
              {current !== null && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: scale(current), background: courseColors[course.color].hex }}
                />
              )}
              <div
                className="absolute -inset-y-1 w-0.5 bg-fg"
                style={{ left: scale(course.targetGrade) }}
                title={`Objetivo ${fmt(course.targetGrade)}`}
              />
              <div
                className="absolute -inset-y-1 border-l border-dotted border-muted"
                style={{ left: scale(passingGrade) }}
                title={`Nota mínima ${fmt(passingGrade)}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        Traço escuro: objetivo. Pontilhado: nota mínima de aprovação ({fmt(passingGrade)}).
      </p>
    </ChartCard>
  );
}
