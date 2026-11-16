import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { courseColors } from '../../lib/colors';
import { normalizeAppLanguage } from '../../lib/grading';
import { daysUntil, fmtMinutes, sessionMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { Assessment, Course, StudySession, Task } from '../../types';
import { Badge, CourseChip, Progress } from '../ui';
import { capitalize, dayWord, fmtDateTime, fmtDay, pct } from './useDashboardAgenda';

const PRIORITY_DOT: Record<Task['priority'], string> = {
  1: 'bg-danger',
  2: 'bg-warn',
  3: 'bg-muted',
};

export interface Scored {
  a: Assessment;
  course: Course | undefined;
  score: number;
  ready: number;
}

export interface AgendaItem {
  key: string;
  start: string;
  end: string;
  allDay: boolean;
  title: string;
  sub?: string;
  dot: string;
}

export function SessionRow({
  session,
  course,
  topic,
  onToggle,
}: {
  session: StudySession;
  course: Course | undefined;
  topic: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation('today');
  const isPartial =
    session.done &&
    session.actualMinutes !== undefined &&
    session.actualMinutes < session.minutes * 0.8;

  return (
    <li
      className={cx(
        'flex min-h-[54px] items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 transition',
        session.done && 'border border-dashed border-line bg-surface',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={session.done ? t('rows.markUndone') : t('rows.markDone')}
        className="group -ml-1.5 grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span
          className={cx(
            'grid size-8 place-items-center rounded-full border-2 transition',
            session.done
              ? 'border-ok bg-ok text-white'
              : 'border-muted/50 bg-surface group-hover:border-accent',
          )}
        >
          {session.done && <Check size={15} strokeWidth={3} />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CourseChip course={course} />
          <span className="text-xs tabular text-muted">{session.start ?? t('rows.anyTime')}</span>
          {isPartial && <Badge tone="warn">{t('rows.partial')}</Badge>}
        </div>
        <p className={cx('mt-1 truncate text-sm font-medium', session.done && 'text-muted line-through')}>
          {topic}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular text-muted">
        {session.done ? fmtMinutes(sessionMinutes(session)) : `${session.minutes} min`}
      </span>
    </li>
  );
}

export function AssessmentRow({
  assessment,
  course,
  ready,
}: {
  assessment: Assessment;
  course: Course | undefined;
  ready: number;
}) {
  const { t, i18n } = useTranslation(['today', 'courses']);
  const appLang = normalizeAppLanguage(i18n.language);
  const days = daysUntil(assessment.date);
  const tone = days <= 3 ? 'danger' : days <= 7 ? 'warn' : 'neutral';
  const bar = course ? courseColors[course.color].dot : 'bg-accent';
  return (
    <li>
      <Link
        to={`/cadeiras/${assessment.courseId}`}
        className="-mx-2 block rounded-xl px-2 py-3 transition hover:bg-surface-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{capitalize(dayWord(days, appLang))}</Badge>
          <span className="text-xs text-muted">{t(`courses:kinds.${assessment.kind}`)}</span>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">{assessment.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <CourseChip course={course} />
          <span className="tabular">{fmtDateTime(assessment.date, appLang)}</span>
          <span className="tabular">{t('today:rows.weightPct', { weight: assessment.weight })}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={ready} color={bar} label={t('today:rows.prepAria', { title: assessment.title })} className="flex-1" />
          <span className="w-10 text-right text-xs font-medium tabular">{pct(ready)}</span>
        </div>
      </Link>
    </li>
  );
}

export function TaskRow({
  task,
  course,
  today,
  onToggle,
}: {
  task: Task;
  course: Course | undefined;
  today: string;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation('today');
  const appLang = normalizeAppLanguage(i18n.language);
  const priorityLabels: Record<Task['priority'], string> = {
    1: t('rows.priorityHigh'),
    2: t('rows.priorityMedium'),
    3: t('rows.priorityLow'),
  };
  const overdue = !!task.due && task.due < today;
  const dueLabel = task.due
    ? task.due === today
      ? t('rows.todayWord')
      : overdue
        ? `${dayWord(daysUntil(task.due), appLang)} · ${fmtDay(task.due, appLang)}`
        : fmtDay(task.due, appLang)
    : null;
  return (
    <li className="flex min-h-[48px] items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={t('rows.completeAria', { title: task.title })}
        className="group -ml-2 grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span className="size-7 rounded-full border-2 border-muted/50 bg-surface transition group-hover:border-accent" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        {(course || dueLabel) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {course && <span>{course.shortName}</span>}
            {dueLabel && <span className={cx('tabular', overdue && 'font-medium text-danger')}>{dueLabel}</span>}
          </p>
        )}
      </div>
      <span
        role="img"
        title={priorityLabels[task.priority]}
        aria-label={priorityLabels[task.priority]}
        className={cx('size-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
      />
    </li>
  );
}
