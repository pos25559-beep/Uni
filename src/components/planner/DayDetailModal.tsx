import { format, parseISO } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Flame, GraduationCap, Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { courseColors } from '../../lib/colors';
import { resolveDateFnsLocale } from '../../lib/grading';
import type { DayBudgetReductionReason } from '../../lib/planner';
import { capitalizeFirst, fmtMinutes, sessionMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { Assessment, CalendarEvent, ClassSlot, Course, Material, StudySession, Topic } from '../../types';
import { Badge, Button, EmptyState, Modal, Progress } from '../ui';
import SessionCard from './SessionCard';

interface DayDetailModalProps {
  dateKey: string | null;
  sessions: StudySession[];
  budget: number;
  budgetReason?: DayBudgetReductionReason;
  isToday: boolean;
  isPast: boolean;
  isStudyDay: boolean;
  isMarathonDay?: boolean;
  classes: ClassSlot[];
  events: CalendarEvent[];
  assessments: Assessment[];
  weekDates: string[];
  courseById: Map<string, Course>;
  topicById: Map<string, Topic>;
  assessmentById: Map<string, Assessment>;
  materialById: Map<string, Material>;
  onClose: () => void;
  onStepDay: (delta: -1 | 1) => void;
  onFocus: (session: StudySession) => void;
  onEdit: (session: StudySession) => void;
  onAdd: (dateKey: string) => void;
  onToggleLock: (session: StudySession) => void;
  onQuickMove: (session: StudySession, targetDate: string) => void;
  onEditAssessment?: (assessment: Assessment) => void;
}

/**
 * Painel dedicado ao dia selecionado ("aba do dia"), com agenda académica,
 * progresso do orçamento e ações completas em cada bloco de estudo.
 */
export default function DayDetailModal({
  dateKey,
  sessions,
  budget,
  budgetReason,
  isToday,
  isPast,
  isStudyDay,
  isMarathonDay,
  classes,
  events,
  assessments,
  weekDates,
  courseById,
  topicById,
  assessmentById,
  materialById,
  onClose,
  onStepDay,
  onFocus,
  onEdit,
  onAdd,
  onToggleLock,
  onQuickMove,
  onEditAssessment,
}: DayDetailModalProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);

  if (!dateKey) {
    return (
      <Modal open={false} onClose={onClose} title="" maxWidthClass="sm:max-w-2xl">
        {null}
      </Modal>
    );
  }

  const parsedDate = parseISO(dateKey);
  const weekday = parsedDate.getDay();
  const modalTitle = capitalizeFirst(format(parsedDate, 'EEEE · d MMM', { locale: dfLocale }));

  const planned = sessions.reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes), 0);
  const doneMinutes = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const over = budget > 0 && planned > budget;
  const ratio = budget > 0 ? planned / budget : 0;

  const dayClasses = [...classes]
    .filter((c) => c.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));
  const dayExams = [...assessments]
    .filter((a) => a.date.slice(0, 10) === dateKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dayEvents = [...events]
    .filter((e) => e.start.slice(0, 10) === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start));
  const hasAgenda = dayClasses.length > 0 || dayExams.length > 0 || dayEvents.length > 0;

  return (
    <Modal open onClose={onClose} title={modalTitle} maxWidthClass="sm:max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              iconOnly
              variant="secondary"
              aria-label={t('dayModal.prevDay')}
              onClick={() => onStepDay(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              size="sm"
              iconOnly
              variant="secondary"
              aria-label={t('dayModal.nextDay')}
              onClick={() => onStepDay(1)}
            >
              <ChevronRight size={16} />
            </Button>
            {isToday && <Badge tone="accent">{t('ui.today')}</Badge>}
            {!isPast && isMarathonDay && (
              <Badge tone="warn">
                <Flame size={12} aria-hidden="true" /> {t('dayCol.marathon')}
              </Badge>
            )}
            {!isStudyDay && !isMarathonDay && !isPast && (
              <Badge tone="neutral">{t('dayCol.offDay')}</Badge>
            )}
          </div>

          <Button size="sm" variant="primary" onClick={() => onAdd(dateKey)}>
            <Plus size={15} aria-hidden="true" /> {t('dayModal.addBlock')}
          </Button>
        </div>

        <div
          className={cx(
            'rounded-2xl border p-3.5',
            isToday
              ? 'border-accent/45 bg-pastel-mint/45 dark:border-accent/35 dark:bg-[#17312B]/65'
              : isMarathonDay
                ? 'border-[#DFD2AE] bg-pastel-butter/55 dark:border-warn/30 dark:bg-[#352D14]/60'
                : 'border-line bg-surface-2/50',
          )}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs tabular">
            <span className={cx('font-semibold', over ? 'text-warn' : 'text-fg')}>
              {t('dayCol.plannedOfBudget', {
                planned: fmtMinutes(planned),
                budget: budget > 0 ? fmtMinutes(budget) : fmtMinutes(0),
              })}
            </span>
            {doneMinutes > 0 && (
              <span className="font-medium text-ok">
                {t('dayCol.studied', { time: fmtMinutes(doneMinutes) })}
              </span>
            )}
          </div>
          {budgetReason && budget > 0 && (
            <p className="mt-1 text-xs text-muted">{t(`dayCol.reduced.${budgetReason}`)}</p>
          )}
          <Progress value={ratio} color={over ? 'bg-warn' : 'bg-accent'} className="mt-2" />
        </div>

        {hasAgenda && (
          <div className="space-y-2 rounded-2xl border border-line bg-pastel-sky/35 p-3.5 dark:bg-[#192A3D]/55">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('dayModal.schedule')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dayExams.map((a) =>
                onEditAssessment ? (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onEditAssessment(a)}
                    title={t('courses:assess.edit')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-coral/35 bg-pastel-blush/80 px-2.5 py-1 text-xs font-semibold text-[#141312] transition hover:border-coral hover:bg-pastel-blush dark:border-coral/40 dark:bg-[#3A2218] dark:text-[#FAF6EC]"
                  >
                    <Flame size={12} className="shrink-0 text-coral" aria-hidden="true" />
                    <span>
                      {t('dayModal.examLabel')} · {a.date.slice(11, 16) || '—'} ·{' '}
                      {courseById.get(a.courseId)?.shortName ?? ''} — {a.title}
                    </span>
                    <Pencil size={11} className="shrink-0 opacity-70" aria-hidden="true" />
                  </button>
                ) : (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-coral/35 bg-pastel-blush/80 px-2.5 py-1 text-xs font-semibold text-[#141312] dark:border-coral/40 dark:bg-[#3A2218] dark:text-[#FAF6EC]"
                  >
                    <Flame size={12} className="shrink-0 text-coral" aria-hidden="true" />
                    <span>
                      {t('dayModal.examLabel')} · {a.date.slice(11, 16) || '—'} ·{' '}
                      {courseById.get(a.courseId)?.shortName ?? ''} — {a.title}
                    </span>
                  </span>
                ),
              )}
              {dayClasses.map((cl) => {
                const c = courseById.get(cl.courseId);
                const color = courseColors[c?.color ?? 'emerald'];
                return (
                  <span
                    key={cl.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-fg dark:bg-surface-2"
                  >
                    <GraduationCap size={12} className="shrink-0 text-muted" aria-hidden="true" />
                    <span className={cx('size-1.5 shrink-0 rounded-full', color.dot)} />
                    <span>
                      {cl.start}–{cl.end} · {c?.shortName ?? cl.type}
                    </span>
                  </span>
                );
              })}
              {dayEvents.map((ev) => (
                <span
                  key={ev.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-fg dark:bg-surface-2"
                >
                  <Clock size={12} className="shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    {!ev.allDay && ev.start.length >= 16 ? `${ev.start.slice(11, 16)} · ` : ''}
                    {ev.title}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title={isStudyDay || isMarathonDay ? t('dayCol.noSessions') : t('dayCol.offDay')}
            hint={t('dayModal.emptyHint')}
            action={
              <Button size="sm" variant="secondary" onClick={() => onAdd(dateKey)}>
                <Plus size={14} aria-hidden="true" /> {t('dayModal.addBlock')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                course={courseById.get(s.courseId)}
                topic={s.topicId ? topicById.get(s.topicId) : undefined}
                assessment={s.assessmentId ? assessmentById.get(s.assessmentId) : undefined}
                material={s.materialId ? materialById.get(s.materialId) : undefined}
                weekDates={weekDates}
                onFocus={(sess) => {
                  onClose();
                  onFocus(sess);
                }}
                onEdit={onEdit}
                onToggleLock={onToggleLock}
                onQuickMove={onQuickMove}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
