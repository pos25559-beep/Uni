// Uma coluna do quadro semanal: um dia com as suas sessões e o orçamento.
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { weekdayShort } from '../../lib/colors';
import { resolveDateFnsLocale } from '../../lib/grading';
import { fmtMinutes, sessionMinutes } from '../../lib/selectors';
import type { Assessment, Course, StudySession, Topic } from '../../types';
import { Badge, Progress } from '../ui';
import { cx } from '../../lib/uiHelpers';
import SessionCard from './SessionCard';

interface DayColumnProps {
  date: Date;
  sessions: StudySession[];
  budget: number;
  isToday: boolean;
  isStudyDay: boolean;
  courseById: Map<string, Course>;
  topicById: Map<string, Topic>;
  assessmentById: Map<string, Assessment>;
  onFocus: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
  onAdd: (date: string) => void;
}

export default function DayColumn({
  date, sessions, budget, isToday, isStudyDay, courseById, topicById, assessmentById,
  onFocus, onEdit, onAdd,
}: DayColumnProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const planned = sessions.reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes), 0);
  const doneMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const over = budget > 0 && planned > budget;
  const ratio = budget > 0 ? planned / budget : 0;
  const dateKey = format(date, 'yyyy-MM-dd');

  return (
    <div
      className={cx(
        'flex flex-col rounded-2xl border p-3',
        isStudyDay ? 'bg-surface' : 'bg-surface-2/65',
        isToday ? 'border-accent ring-1 ring-accent' : 'border-line',
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted">
            {weekdayShort[date.getDay()]}
          </p>
          <button
            type="button"
            onClick={() => onAdd(dateKey)}
            aria-label={t('dayCol.addAria', { date: format(date, 'd MMM', { locale: dfLocale }) })}
            className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="whitespace-nowrap text-base font-semibold tracking-tight tabular">
            {format(date, 'd MMM', { locale: dfLocale })}
          </p>
          {isToday && <Badge tone="accent">{t('ui.today')}</Badge>}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-x-1 text-xs text-muted tabular">
          <span className={cx('whitespace-nowrap', over && 'text-warn')}>{fmtMinutes(planned)}</span>
          <span className="whitespace-nowrap">{t('dayCol.ofBudget', { time: fmtMinutes(budget) })}</span>
        </div>
        <Progress
          value={ratio}
          color={over ? 'bg-warn' : 'bg-accent'}
          className="mt-1.5"
        />
        {doneMinutes > 0 && (
          <p className="mt-1.5 text-xs text-muted tabular">{t('dayCol.studied', { time: fmtMinutes(doneMinutes) })}</p>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            {isStudyDay ? t('dayCol.noSessions') : t('dayCol.offDay')}
          </p>
        ) : (
          sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              course={courseById.get(s.courseId)}
              topic={s.topicId ? topicById.get(s.topicId) : undefined}
              assessment={s.assessmentId ? assessmentById.get(s.assessmentId) : undefined}
              onFocus={onFocus}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
