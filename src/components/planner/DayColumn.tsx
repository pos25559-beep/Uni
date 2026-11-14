// Uma coluna do quadro semanal: um dia com as suas sessões e o orçamento.
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { weekdayShort } from '../../lib/colors';
import { fmtMinutes, sessionMinutes } from '../../lib/selectors';
import type { Assessment, Course, StudySession, Topic } from '../../types';
import { Badge, Progress, cx } from '../ui';
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
  const planned = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const doneMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const over = budget > 0 && planned > budget;
  const ratio = budget > 0 ? planned / budget : 0;
  const dateKey = format(date, 'yyyy-MM-dd');

  return (
    <div
      className={cx(
        'flex flex-col rounded-2xl border bg-surface p-3',
        isToday ? 'border-accent ring-1 ring-accent' : 'border-line',
        !isStudyDay && 'opacity-70',
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
            aria-label={`Adicionar sessão a ${format(date, 'd MMM', { locale: pt })}`}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="whitespace-nowrap text-base font-semibold tracking-tight tabular">
            {format(date, 'd MMM', { locale: pt })}
          </p>
          {isToday && <Badge tone="accent">Hoje</Badge>}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex flex-wrap items-center justify-between gap-x-1 text-xs text-muted tabular">
          <span className={cx('whitespace-nowrap', over && 'text-warn')}>{fmtMinutes(planned)}</span>
          <span className="whitespace-nowrap">de {fmtMinutes(budget)}</span>
        </div>
        <Progress
          value={ratio}
          color={over ? 'bg-warn' : 'bg-accent'}
          className="mt-1.5"
        />
        {doneMinutes > 0 && (
          <p className="mt-1.5 text-xs text-muted tabular">{fmtMinutes(doneMinutes)} estudados</p>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            {isStudyDay ? 'Sem sessões' : 'Dia sem estudo'}
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
