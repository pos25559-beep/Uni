import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { courseColors } from '../../lib/colors';
import {
  formatGradeByScale,
  GRADE_SCALES,
  gradeToPercent,
  normalizeTargetGradeForScale,
} from '../../lib/grading';
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
  const { t } = useTranslation('progress');
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const appLang = useStore((s) => s.settings.language) ?? 'pt-PT';
  const scaleMeta = GRADE_SCALES[gradingScale] ?? GRADE_SCALES.pt20;
  const passingGrade = scaleMeta.passing;
  const scale = (grade: number) => `${gradeToPercent(grade, gradingScale)}%`;
  const fmt = (g: number | null | undefined) => formatGradeByScale(g, gradingScale, appLang);

  const rows = useMemo(
    () =>
      gradeRows(courses, assessments).map((r) => ({
        ...r,
        normalizedTarget: normalizeTargetGradeForScale(r.course.targetGrade, gradingScale),
      })),
    [courses, assessments, gradingScale],
  );
  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);
  const graded = rows.filter((r) => r.current !== null).length;
  const below = rows.filter((r) => r.current !== null && r.current < r.normalizedTarget).length;

  return (
    <ChartCard
      title={t('charts.gradeBullets.title')}
      isEmpty={courses.length === 0}
      emptyTitle={t('charts.gradeBullets.emptyTitle')}
      emptyHint={t('charts.gradeBullets.emptyHint')}
      emptyAction={<Link to="/cadeiras" className="text-sm font-medium text-accent">{t('charts.gradeBullets.emptyAction')}</Link>}
      takeaway={
        average === null ? (
          t('charts.gradeBullets.noGrades')
        ) : (
          <span className="tabular">
            {t(below === 1 ? 'charts.gradeBullets.takeawayOne' : 'charts.gradeBullets.takeawayMany', {
              avg: fmt(average),
              below,
              graded,
            })}
          </span>
        )
      }
    >
      <ul className="space-y-4">
        {rows.map(({ course, current, normalizedTarget }) => (
          <li key={course.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-fg">{course.shortName}</span>
              {current === null ? (
                <span className="shrink-0 text-muted">{t('charts.gradeBullets.noGradesShort')}</span>
              ) : (
                <span className="shrink-0 tabular text-fg">
                  {fmt(current)}{' '}
                  <span className="text-muted">
                    {t('charts.gradeBullets.targetShort', { grade: fmt(normalizedTarget) })}
                  </span>
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
                style={{ left: scale(normalizedTarget) }}
                title={t('charts.gradeBullets.targetTitle', { grade: fmt(normalizedTarget) })}
              />
              <div
                className="absolute -inset-y-1 border-l border-dotted border-muted"
                style={{ left: scale(passingGrade) }}
                title={t('charts.gradeBullets.minTitle', { grade: fmt(passingGrade) })}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        {t('charts.gradeBullets.legend', { grade: fmt(passingGrade) })}
      </p>
    </ChartCard>
  );
}
