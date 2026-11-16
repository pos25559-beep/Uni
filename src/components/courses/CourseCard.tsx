import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { courseColors } from '../../lib/colors';
import { GRADE_SCALES, normalizeAppLanguage } from '../../lib/grading';
import { fmtGrade, topicProgress, type GradeSummary } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { AppLanguage, Assessment, Course, GradingScale } from '../../types';
import { Badge, Ring } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { dueLabel } from './helpers';

interface Props {
  course: Course;
  summary: GradeSummary;
  next?: Assessment;
}

/** Estado do objetivo: no caminho certo, precisa de X, ou fora de alcance. */
function TrackBadge({
  course,
  summary,
  scale,
  lang,
}: {
  course: Course;
  summary: GradeSummary;
  scale: GradingScale;
  lang: AppLanguage;
}) {
  const { t } = useTranslation('courses');
  const { current, needed } = summary;
  const maxGrade = GRADE_SCALES[scale]?.max ?? 20;
  if (current !== null && current >= course.targetGrade) {
    return <Badge tone="ok">{t('track.onTarget')}</Badge>;
  }
  if (needed === null) {
    return <Badge tone="danger">{t('track.targetMissed')}</Badge>;
  }
  if (needed <= 0) return <Badge tone="ok">{t('track.onTarget')}</Badge>;
  if (needed > maxGrade) {
    return <Badge tone="danger">{t('track.outOfReach')}</Badge>;
  }
  return (
    <Badge tone="warn">
      {t('track.needsRemaining', { grade: fmtGrade(needed, scale, lang) })}
    </Badge>
  );
}

export default function CourseCard({ course, summary, next }: Props) {
  const { t, i18n } = useTranslation('courses');
  const appLang: AppLanguage = normalizeAppLanguage(i18n.language);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const progress = topicProgress(course);
  const colors = courseColors[course.color];

  return (
    <Link
      to={`/cadeiras/${course.id}`}
      className="rise group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition duration-150 hover:-translate-y-0.5 hover:border-muted/50 hover:shadow-sm active:scale-[0.99]"
    >
      <div className={cx('flex items-center justify-between border-b border-line/70 px-5 py-2.5 text-xs font-semibold', colors.tint)}>
        <span className="inline-flex items-center gap-2">
          <span className={cx('size-2 rounded-full', colors.dot)} />
          <span className="font-mono tracking-tight text-fg">{course.shortName || course.code}</span>
        </span>
        <span className="font-mono text-xs tabular text-muted">{course.ects} ECTS</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold tracking-tight group-hover:text-accent">{course.name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted">
              {course.teacher || t('noInstructor')}
            </p>
          </div>
          <Ring value={progress} size={56} stroke={5} color={colors.hex}>
            <span>{Math.round(progress * 100)}%</span>
          </Ring>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">{t('currentGrade')}</p>
            <p className="mt-1 text-lg font-semibold tabular">
              {fmtGrade(summary.current, gradingScale, appLang)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">{t('targetLabel')}</p>
            <p className="mt-1 text-lg font-semibold tabular">
              {fmtGrade(course.targetGrade, gradingScale, appLang)}
            </p>
          </div>
        </div>

        <div>
          <TrackBadge course={course} summary={summary} scale={gradingScale} lang={appLang} />
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-line pt-3 text-xs text-muted">
          <CalendarClock size={14} className="shrink-0" />
          {next ? (
            <span className="truncate">
              {t('nextPrefix')} {t(`kinds.${next.kind}`)} · {next.title} ·{' '}
              <span className="font-medium text-fg">{dueLabel(next.date, appLang)}</span>
            </span>
          ) : (
            <span>{t('noAssessments')}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
