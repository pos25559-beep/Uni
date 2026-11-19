import { format } from 'date-fns';
import { Check, ChevronRight, Flame, Lock, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { courseColors, weekdayShort } from '../../lib/colors';
import { resolveDateFnsLocale } from '../../lib/grading';
import { fmtMinutes, formatSessionDisplay, sessionMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { Course, StudySession, Topic } from '../../types';
import { Progress } from '../ui';

interface CompactWeekDayCardProps {
  date: Date;
  dateKey: string;
  sessions: StudySession[];
  budget: number;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  isStudyDay: boolean;
  isMarathonDay?: boolean;
  courseById: Map<string, Course>;
  topicById: Map<string, Topic>;
  onOpenDay: (dateKey: string) => void;
  onEditSession: (session: StudySession) => void;
  onAddSession: (dateKey: string) => void;
}

function compactDuration(min: number): string {
  return fmtMinutes(Math.max(0, min)).replace(/\s+/g, '');
}

/**
 * Cartão compacto para a grelha semanal desktop (7 colunas numa só linha):
 * mantém dias cheios compactos e permite abrir o painel detalhado do dia.
 */
export default function CompactWeekDayCard({
  date,
  dateKey,
  sessions,
  budget,
  isToday,
  isSelected,
  isPast,
  isStudyDay,
  isMarathonDay,
  courseById,
  topicById,
  onOpenDay,
  onEditSession,
  onAddSession,
}: CompactWeekDayCardProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);

  const planned = sessions.reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes), 0);
  const doneMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const leftMinutes = sessions.filter((s) => !s.done).reduce((sum, s) => sum + s.minutes, 0);
  const over = budget > 0 && planned > budget;
  const ratio = budget > 0 ? planned / budget : 0;
  const formattedDate = format(date, 'd MMM', { locale: dfLocale });

  return (
    <div
      className={cx(
        'flex min-w-0 flex-col rounded-[20px] border p-2.5 shadow-card transition',
        isPast
          ? 'border-line/70 bg-surface-2/45 opacity-85'
          : isToday
            ? 'border-accent/65 bg-pastel-mint/45 ring-1 ring-accent dark:bg-[#17312B]/70'
            : isSelected
              ? 'border-[#141312]/40 bg-pastel-cream/70 ring-1 ring-[#141312]/25 dark:border-white/30 dark:bg-surface-2/75'
              : isMarathonDay
                ? 'border-warn/50 bg-pastel-butter/55 dark:bg-[#352D14]/70'
                : isStudyDay
                  ? 'border-line/85 bg-surface'
                  : 'border-line/70 bg-surface-2/60',
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={() => onOpenDay(dateKey)}
          aria-label={t('dayCol.openDayAria', { date: formattedDate })}
          className="group min-w-0 flex-1 rounded-xl px-1 py-0.5 text-left transition hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted">
              {weekdayShort[date.getDay()]}
            </span>
            {isToday && (
              <span className="whitespace-nowrap rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-bold text-accent-ink">
                {t('ui.today')}
              </span>
            )}
            {!isPast && !isToday && isMarathonDay && (
              <Flame size={13} className="shrink-0 text-coral" aria-hidden="true" />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="whitespace-nowrap font-display text-sm font-bold tracking-tight text-fg tabular">
              {formattedDate}
            </span>
            <ChevronRight
              size={14}
              className="shrink-0 text-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
        </button>

        {!isPast && (
          <button
            type="button"
            onClick={() => onAddSession(dateKey)}
            aria-label={t('dayCol.addAria', { date: formattedDate })}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {isPast ? (
        <div className="mt-2 space-y-2 px-1">
          <p className="text-xs leading-snug text-muted tabular">
            {t('dayCol.pastSummary', {
              done: fmtMinutes(doneMinutes),
              left: fmtMinutes(leftMinutes),
            })}
          </p>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenDay(dateKey)}
              className="inline-flex min-h-9 w-full items-center justify-between rounded-xl border border-line/80 bg-surface/75 px-2.5 text-xs font-semibold text-muted transition hover:text-fg"
            >
              <span>{t('dayCol.showDay', { count: sessions.length })}</span>
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onOpenDay(dateKey)}
            className="mt-1.5 w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            <p className={cx('truncate text-xs font-medium tabular', over ? 'text-warn' : 'text-muted')}>
              {compactDuration(planned)} / {compactDuration(budget)}
            </p>
            <Progress value={ratio} color={over ? 'bg-warn' : 'bg-accent'} className="mt-1" />
          </button>

          <div className="mt-2.5 flex flex-1 flex-col gap-1.5">
            {sessions.length === 0 ? (
              <button
                type="button"
                onClick={() => onOpenDay(dateKey)}
                className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line px-2 py-5 text-center text-xs text-muted transition hover:border-accent/40 hover:text-fg"
              >
                {isStudyDay || isMarathonDay ? t('dayCol.noSessions') : t('dayCol.offDay')}
              </button>
            ) : (
              sessions.map((s) => {
                const course = courseById.get(s.courseId);
                const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                const color = courseColors[course?.color ?? 'emerald'];
                const disp = formatSessionDisplay(s, topic, i18n.language);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onEditSession(s)}
                    className={cx(
                      'w-full rounded-xl border px-2 py-1.5 text-left transition hover:brightness-[0.98]',
                      s.done
                        ? 'border-dashed border-line bg-surface/75 opacity-65'
                        : color.tint,
                    )}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono text-xs text-muted tabular">
                      <span>{s.start || '—'}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span>{s.minutes}m</span>
                        {s.locked && <Lock size={11} aria-hidden="true" />}
                        {s.done && <Check size={12} className="text-ok" aria-hidden="true" />}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs">
                      <span className={cx('size-1.5 shrink-0 rounded-full', color.dot)} />
                      <span className="truncate font-bold text-fg">
                        {course?.shortName ?? '—'}
                      </span>
                    </div>
                    <p
                      className={cx(
                        'mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-fg/85',
                        s.done && 'line-through',
                      )}
                    >
                      {disp.title}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
