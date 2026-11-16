// Cartão de uma sessão no quadro semanal.
import { Check, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n/tr';
import { courseColors } from '../../lib/colors';
import { daysUntil, formatSessionDisplay, sessionMinutes } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course, StudySession, Topic } from '../../types';
import { Badge, Button, CourseChip } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface SessionCardProps {
  session: StudySession;
  course?: Course;
  topic?: Topic;
  assessment?: Assessment;
  onFocus: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
}

function deadlineLabel(a: Assessment): string {
  const n = daysUntil(a.date);
  if (n < 0) return tr('plan:session.past');
  if (n === 0) return tr('plan:session.today');
  if (n === 1) return tr('plan:session.tomorrow');
  return tr('plan:session.inDays', { n });
}

export default function SessionCard({ session, course, topic, assessment, onFocus, onEdit }: SessionCardProps) {
  const { t } = useTranslation('plan');
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const color = course ? courseColors[course.color].hex : undefined;
  const { title, badge, isPersonalized } = formatSessionDisplay(session, topic);

  const toggle = () => {
    if (session.done) patch('sessions', session.id, { done: false, actualMinutes: undefined });
    else patch('sessions', session.id, { done: true, actualMinutes: session.minutes });
  };

  return (
    <article
      className={cx(
        'overflow-hidden rounded-xl border border-line p-3 transition',
        session.done ? 'border-dashed bg-surface' : 'bg-surface-2/60',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <CourseChip course={course} className="max-w-full truncate" />
        <span className="shrink-0 text-xs text-muted tabular">
          {session.start ?? '—'}
        </span>
      </div>

      <p className={cx('mt-2 text-sm font-medium leading-snug', session.done && 'line-through')}>{title}</p>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted tabular">
          {session.done
            ? t('session.minStudied', { n: sessionMinutes(session) })
            : `${session.minutes} min`}
        </span>
        {badge && (
          <Badge
            tone={
              badge.includes('Teste')
                ? 'warn'
                : badge.includes('SRS') || isPersonalized
                  ? 'ok'
                  : 'accent'
            }
          >
            {badge}
          </Badge>
        )}
      </div>

      {assessment && (
        <p className="mt-1.5 truncate text-xs text-muted">
          {assessment.title} · <span className={cx(daysUntil(assessment.date) <= 3 && 'text-warn')}>{deadlineLabel(assessment)}</span>
        </p>
      )}

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={session.done ? t('session.markTodo') : t('session.markDone')}
          className="group -ml-1.5 grid size-11 place-items-center rounded-full"
        >
          <span
            className={cx(
              'grid size-8 place-items-center rounded-lg border transition',
              session.done
                ? 'border-ok/40 bg-ok/12 text-ok'
                : 'border-line text-muted group-hover:border-ok/50 group-hover:text-ok',
            )}
          >
            <Check size={15} />
          </span>
        </button>
        {!session.done && (
          <Button size="sm" variant="ghost" onClick={() => onFocus(session)} aria-label={t('session.focusAria')}>
            <Play size={14} /> {t('session.focus')}
          </Button>
        )}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => onEdit(session)}
            aria-label={t('session.edit')}
            className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => remove('sessions', session.id)}
            aria-label={t('session.delete')}
            className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-danger/12 hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
