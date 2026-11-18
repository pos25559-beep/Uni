// Cartão de uma sessão no quadro semanal.
import { addDays, format, parseISO } from 'date-fns';
import {
  CalendarArrowUp,
  Check,
  FileText,
  Lock,
  LockOpen,
  Pencil,
  Play,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n/tr';
import { courseColors } from '../../lib/colors';
import { resolveDateFnsLocale } from '../../lib/grading';
import {
  daysUntil,
  formatSessionDisplay,
  formatSessionReason,
  sessionMinutes,
} from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Assessment, Course, Material, StudySession, Topic } from '../../types';
import { ActionSheet, Badge, Button, CourseChip } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface SessionCardProps {
  session: StudySession;
  course?: Course;
  topic?: Topic;
  assessment?: Assessment;
  material?: Material;
  weekDates?: string[];
  onFocus: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
  onToggleLock?: (session: StudySession) => void;
  onQuickMove?: (session: StudySession, targetDate: string) => void;
}

function deadlineLabel(a: Assessment): string {
  const n = daysUntil(a.date);
  if (n < 0) return tr('plan:session.past');
  if (n === 0) return tr('plan:session.today');
  if (n === 1) return tr('plan:session.tomorrow');
  return tr('plan:session.inDays', { n });
}

function cleanMaterialLabel(title: string): string {
  return title
    .replace(/\s*\[(slide_oficial|teste_antigo|exame_antigo|ficha|sebenta|relatorio|outro)\]/gi, '')
    .trim();
}

export default function SessionCard({
  session,
  course,
  topic,
  assessment,
  material,
  weekDates,
  onFocus,
  onEdit,
  onToggleLock,
  onQuickMove,
}: SessionCardProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const [moveOpen, setMoveOpen] = useState(false);

  const color = course ? courseColors[course.color].hex : undefined;
  const { title, badge, isPersonalized } = formatSessionDisplay(session, topic, i18n.language);
  const reasonText = formatSessionReason(session, assessment, i18n.language);

  const toggle = () => {
    if (session.done) patch('sessions', session.id, { done: false, actualMinutes: undefined });
    else patch('sessions', session.id, { done: true, actualMinutes: session.minutes });
  };

  const targetDays = (() => {
    const baseDates =
      weekDates && weekDates.length > 0
        ? weekDates
        : Array.from({ length: 7 }, (_, i) =>
            format(addDays(parseISO(session.date), i), 'yyyy-MM-dd'),
          );
    return baseDates.filter((d) => d !== session.date);
  })();

  return (
    <>
      <article
        className={cx(
          'overflow-hidden rounded-xl border border-line p-3 transition',
          session.done ? 'border-dashed bg-surface' : 'bg-surface-2/60',
          session.locked && !session.done && 'ring-1 ring-accent/45',
        )}
        style={{ borderLeftWidth: 4, borderLeftColor: color }}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <CourseChip course={course} className="max-w-full truncate" />
          <div className="flex items-center gap-1">
            {session.locked && (
              <span
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent"
                title={t('session.locked')}
              >
                <Lock size={12} aria-hidden="true" />
              </span>
            )}
            <span className="shrink-0 text-xs text-muted tabular">
              {session.start ?? '—'}
            </span>
          </div>
        </div>

        <p className={cx('mt-2 text-sm font-medium leading-snug', session.done && 'line-through')}>
          {title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted tabular">
            {session.done
              ? t('session.minStudied', { n: sessionMinutes(session) })
              : `${session.minutes} min`}
          </span>
          {badge && (
            <Badge
              tone={
                /(teste|prova|exam)/i.test(badge)
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

        {reasonText && !session.done && (
          <p className="mt-1.5 text-xs leading-snug text-muted">
            {reasonText}
          </p>
        )}

        {material && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-accent-ink dark:text-accent">
            <FileText size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{cleanMaterialLabel(material.title)}</span>
          </p>
        )}

        {assessment && (
          <p className="mt-1 truncate text-xs text-muted">
            {assessment.title} ·{' '}
            <span className={cx(daysUntil(assessment.date) <= 3 && 'text-warn')}>
              {deadlineLabel(assessment)}
            </span>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-0.5">
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onFocus(session)}
              aria-label={t('session.focusAria')}
            >
              <Play size={14} /> {t('session.focus')}
            </Button>
          )}
          <div className="ml-auto flex items-center">
            {!session.done && onToggleLock && (
              <button
                type="button"
                onClick={() => onToggleLock(session)}
                aria-label={session.locked ? t('session.unlock') : t('session.lock')}
                title={session.locked ? t('session.unlock') : t('session.lock')}
                className={cx(
                  'grid size-11 place-items-center rounded-full transition',
                  session.locked
                    ? 'text-accent hover:bg-accent-soft'
                    : 'text-muted hover:bg-surface hover:text-fg',
                )}
              >
                {session.locked ? <Lock size={15} /> : <LockOpen size={15} />}
              </button>
            )}
            {!session.done && onQuickMove && (
              <button
                type="button"
                onClick={() => setMoveOpen(true)}
                aria-label={t('session.moveDay')}
                title={t('session.moveDay')}
                className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              >
                <CalendarArrowUp size={15} />
              </button>
            )}
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

      {onQuickMove && (
        <ActionSheet
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          title={t('session.moveDay')}
          actions={targetDays.map((dateKey) => ({
            id: dateKey,
            label: format(parseISO(dateKey), 'EEEE, d MMM', { locale: dfLocale }),
            onSelect: () => onQuickMove(session, dateKey),
          }))}
        />
      )}
    </>
  );
}
