// Cartão de uma sessão no quadro semanal.
import { Check, Pencil, Play, Trash2 } from 'lucide-react';
import { courseColors } from '../../lib/colors';
import { daysUntil, sessionMinutes } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course, StudySession, Topic } from '../../types';
import { Button, CourseChip, cx } from '../ui';

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
  if (n < 0) return 'passou';
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n} dias`;
}

export default function SessionCard({ session, course, topic, assessment, onFocus, onEdit }: SessionCardProps) {
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const color = course ? courseColors[course.color].hex : undefined;
  const title = topic?.title ?? session.notes ?? 'Estudo';

  const toggle = () => {
    if (session.done) patch('sessions', session.id, { done: false, actualMinutes: undefined });
    else patch('sessions', session.id, { done: true, actualMinutes: session.minutes });
  };

  return (
    <article
      className={cx(
        'rounded-xl border border-line bg-surface-2/60 p-3 transition',
        session.done && 'opacity-60',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-2">
        <CourseChip course={course} />
        <span className="shrink-0 text-xs text-muted tabular">
          {session.start ?? '—'}
        </span>
      </div>

      <p className={cx('mt-2 text-sm font-medium leading-snug', session.done && 'line-through')}>{title}</p>

      <p className="mt-1 text-xs text-muted tabular">
        {session.done
          ? `${sessionMinutes(session)} min estudados`
          : `${session.minutes} min`}
      </p>

      {assessment && (
        <p className="mt-1.5 truncate text-xs text-muted">
          {assessment.title} · <span className={cx(daysUntil(assessment.date) <= 3 && 'text-warn')}>{deadlineLabel(assessment)}</span>
        </p>
      )}

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={session.done ? 'Marcar como por fazer' : 'Marcar como concluída'}
          className={cx(
            'grid size-8 place-items-center rounded-lg border transition',
            session.done
              ? 'border-ok/40 bg-ok/12 text-ok'
              : 'border-line text-muted hover:border-ok/50 hover:text-ok',
          )}
        >
          <Check size={15} />
        </button>
        {!session.done && (
          <Button size="sm" variant="ghost" onClick={() => onFocus(session)} aria-label="Focar nesta sessão">
            <Play size={14} /> Focar
          </Button>
        )}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => onEdit(session)}
            aria-label="Editar sessão"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => remove('sessions', session.id)}
            aria-label="Apagar sessão"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/12 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
