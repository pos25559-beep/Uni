import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { courseColors } from '../../lib/colors';
import { fmtGrade, semesterAverage } from '../../lib/selectors';
import type { Assessment, Course } from '../../types';
import { ChartCard } from './ChartCard';
import { gradeRows } from './data';

const PASSING_GRADE = 9.5;
const scale = (grade: number) => `${Math.min(100, Math.max(0, (grade / 20) * 100))}%`;

interface Props {
  courses: Course[];
  assessments: Assessment[];
}

/** "Como estão as notas face ao objetivo?" — lista de barras (bullet) por cadeira, escala 0–20. */
export function GradeBullets({ courses, assessments }: Props) {
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
            Média ponderada <span className="tabular">{fmtGrade(average)}</span> — <span className="tabular">{below}</span> de{' '}
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
                  {fmtGrade(current)} <span className="text-muted">/ objetivo {fmtGrade(course.targetGrade)}</span>
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
                title={`Objetivo ${fmtGrade(course.targetGrade)}`}
              />
              <div
                className="absolute -inset-y-1 border-l border-dotted border-muted"
                style={{ left: scale(PASSING_GRADE) }}
                title={`Nota mínima ${fmtGrade(PASSING_GRADE)}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">Traço escuro: objetivo. Pontilhado: nota mínima de aprovação ({fmtGrade(PASSING_GRADE)}).</p>
    </ChartCard>
  );
}
