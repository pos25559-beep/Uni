// Uma coluna do quadro semanal: um dia com as suas sessões e o orçamento.
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Flame, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weekdayShort } from '../../lib/colors';
import { resolveDateFnsLocale } from '../../lib/grading';
import type { DayBudgetReductionReason } from '../../lib/planner';
import { fmtMinutes, sessionMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { Assessment, Course, Material, StudySession, Topic } from '../../types';
import { Badge, Progress } from '../ui';
import SessionCard from './SessionCard';

interface DayColumnProps {
  date: Date;
  sessions: StudySession[];
  budget: number;
  budgetReason?: DayBudgetReductionReason;
  isToday: boolean;
  isPast?: boolean;
  isStudyDay: boolean;
  isMarathonDay?: boolean;
  weekDates?: string[];
  courseById: Map<string, Course>;
  topicById: Map<string, Topic>;
  assessmentById: Map<string, Assessment>;
  materialById?: Map<string, Material>;
  onFocus: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
  onAdd: (date: string) => void;
  onToggleLock?: (session: StudySession) => void;
  onQuickMove?: (session: StudySession, targetDate: string) => void;
}

export default function DayColumn({
  date,
  sessions,
  budget,
  budgetReason,
  isToday,
  isPast = false,
  isStudyDay,
  isMarathonDay,
  weekDates,
  courseById,
  topicById,
  assessmentById,
  materialById,
  onFocus,
  onEdit,
  onAdd,
  onToggleLock,
  onQuickMove,
}: DayColumnProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const [pastExpanded, setPastExpanded] = useState(false);

  const planned = sessions.reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes), 0);
  const doneMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const leftMinutes = sessions.filter((s) => !s.done).reduce((sum, s) => sum + s.minutes, 0);
  const over = budget > 0 && planned > budget;
  const ratio = budget > 0 ? planned / budget : 0;
  const dateKey = format(date, 'yyyy-MM-dd');

  const showSessions = !isPast || pastExpanded;

  return (
    <div
      className={cx(
        'flex flex-col rounded-[22px] border p-3.5 shadow-card',
        isPast
          ? 'border-line/70 bg-surface-2/45 opacity-90'
          : isToday
            ? 'border-accent/60 bg-pastel-mint/40 ring-1 ring-accent dark:bg-[#17312B]/65'
            : isMarathonDay
              ? 'border-warn/50 bg-pastel-butter/55 dark:bg-[#352D14]/70'
              : isStudyDay
                ? 'border-line/80 bg-surface'
                : 'border-line/70 bg-surface-2/65',
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <p className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted">
            {weekdayShort[date.getDay()]}
          </p>
          {!isPast && (
            <button
              type="button"
              onClick={() => onAdd(dateKey)}
              aria-label={t('dayCol.addAria', { date: format(date, 'd MMM', { locale: dfLocale }) })}
              className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="whitespace-nowrap text-base font-semibold tracking-tight tabular">
            {format(date, 'd MMM', { locale: dfLocale })}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {!isPast && isMarathonDay && (
              <Badge tone="warn">
                <Flame size={12} aria-hidden="true" /> {t('dayCol.marathon')}
              </Badge>
            )}
            {isToday && <Badge tone="accent">{t('ui.today')}</Badge>}
          </div>
        </div>
      </div>

      {isPast ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted tabular">
            {t('dayCol.pastSummary', {
              done: fmtMinutes(doneMinutes),
              left: fmtMinutes(leftMinutes),
            })}
          </p>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setPastExpanded((v) => !v)}
              aria-expanded={pastExpanded}
              className="inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-line/80 bg-surface/70 px-3 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <span>
                {pastExpanded
                  ? t('dayCol.hideDay')
                  : t('dayCol.showDay', { count: sessions.length })}
              </span>
              {pastExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-1.5 text-xs tabular">
            <span className={cx('font-medium', over ? 'text-warn' : 'text-muted')}>
              {t('dayCol.plannedOfBudget', {
                planned: fmtMinutes(planned),
                budget: budget > 0 ? fmtMinutes(budget) : fmtMinutes(0),
              })}
            </span>
          </div>
          {budgetReason && budget > 0 && (
            <p className="mt-0.5 text-xs text-muted">{t(`dayCol.reduced.${budgetReason}`)}</p>
          )}
          <Progress
            value={ratio}
            color={over ? 'bg-warn' : 'bg-accent'}
            className="mt-1.5"
          />
          {doneMinutes > 0 && (
            <p className="mt-1.5 text-xs text-muted tabular">
              {t('dayCol.studied', { time: fmtMinutes(doneMinutes) })}
            </p>
          )}
        </div>
      )}

      {showSessions && (
        <div className="mt-3 flex flex-1 flex-col gap-2">
          {sessions.length === 0 ? (
            !isPast && (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                {isStudyDay || isMarathonDay ? t('dayCol.noSessions') : t('dayCol.offDay')}
              </p>
            )
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                course={courseById.get(s.courseId)}
                topic={s.topicId ? topicById.get(s.topicId) : undefined}
                assessment={s.assessmentId ? assessmentById.get(s.assessmentId) : undefined}
                material={s.materialId ? materialById?.get(s.materialId) : undefined}
                weekDates={weekDates}
                onFocus={onFocus}
                onEdit={onEdit}
                onToggleLock={onToggleLock}
                onQuickMove={onQuickMove}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
