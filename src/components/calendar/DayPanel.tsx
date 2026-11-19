// Painel do dia selecionado: lista completa com ações (apagar eventos locais, concluir sessões, abrir avaliações).
import { format, parseISO } from 'date-fns';
import { appDateLocale as pt, longDatePattern } from '../../lib/dateLocale';
import { CalendarPlus, ChevronRight, Check, MapPin, Pencil, Play, Trash2 } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useHubUiStore } from '../../store/useHubUiStore';
import { useStore } from '../../store/useStore';
import type { Assessment, CalendarEvent, ClassSlot, Course, StudySession } from '../../types';
import { Badge, Button, Card, CourseChip, EmptyState } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { capitalizeFirst } from '../../lib/selectors';
import AssessmentFormModal from '../courses/AssessmentFormModal';
import ClassFormModal from '../courses/ClassFormModal';
import { ConfirmModal } from '../courses/ConfirmModal';
import NewEventModal from './NewEventModal';
import type { CalItem } from './items';
import { KIND_META, SOURCE_LABEL, isImported, itemTone, timeLabel } from './shared';

const SessionModal = lazy(() => import('../planner/SessionModal'));

interface Props {
  date: string;
  items: CalItem[];
  courseById: Map<string, Course>;
  onNewEvent: () => void;
}

export default function DayPanel({ date, items, courseById, onNewEvent }: Props) {
  const { t } = useTranslation('plan');
  const courses = useStore((s) => s.courses);
  const classes = useStore((s) => s.classes);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const events = useStore((s) => s.events);
  const remove = useStore((s) => s.remove);
  const patch = useStore((s) => s.patch);
  const openFocus = useHubUiStore((s) => s.openFocus);
  const heading = format(parseISO(date), longDatePattern(), { locale: pt });
  const [toDelete, setToDelete] = useState<{ storeKey: 'events' | 'classes'; refId: string; title: string } | null>(null);
  const [editingClass, setEditingClass] = useState<{ slot: ClassSlot; course: Course } | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<{ assessment: Assessment; course: Course } | null>(null);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  return (
    <>
    <Card
      className="lg:sticky lg:top-4"
      title={capitalizeFirst(heading)}
      action={items.length > 0 ? <Badge>{items.length}</Badge> : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t('cal.dayEmpty')}
          hint={t('cal.dayEmptyHint')}
          action={
            <Button size="sm" onClick={onNewEvent}>
              <CalendarPlus size={14} /> {t('newEvent.title')}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const course = it.courseId ? courseById.get(it.courseId) : undefined;
            const Icon = KIND_META[it.kind].icon;
            const localEvent = it.kind === 'evento' && it.source === 'local';
            const calendarEvent = localEvent ? events.find((e) => e.id === it.refId) : undefined;
            const classSlot =
              it.kind === 'aula' ? classes.find((c) => c.id === it.refId) : undefined;
            const studySession =
              it.kind === 'estudo' ? sessions.find((s) => s.id === it.refId) : undefined;
            return (
              <li
                key={it.id}
                className={cx('flex items-start gap-3 rounded-xl border border-line p-3', it.done ? 'border-dashed bg-surface' : 'bg-surface-2/40')}
              >
                <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', itemTone(it, course))}>
                  <Icon size={15} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-xs tabular text-muted">{timeLabel(it)} · {KIND_META[it.kind].label}</p>
                  <p className={cx('truncate text-sm font-medium', it.done && 'line-through')}>{it.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {course && <CourseChip course={course} />}
                    {it.location && (
                      <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{it.location}</span>
                      </span>
                    )}
                    {isImported(it) && it.source && <Badge tone="accent">{SOURCE_LABEL[it.source]}</Badge>}
                  </div>
                </div>

                {localEvent && (
                  <div className="flex shrink-0 items-center gap-1">
                    {calendarEvent && (
                      <button
                        type="button"
                        aria-label={t('cal.editEvent')}
                        title={t('cal.editEvent')}
                        onClick={() => setEditingEvent(calendarEvent)}
                        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t('cal.deleteEvent')}
                      title={t('cal.deleteEvent')}
                      onClick={() =>
                        setToDelete({ storeKey: 'events', refId: it.refId, title: it.title })
                      }
                      className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/12 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}

                {classSlot && course && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={t('cal.editClassAria', { title: it.title })}
                      title={t('cal.editClassHint')}
                      onClick={() => setEditingClass({ slot: classSlot, course })}
                      className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('cal.deleteClassAria', { title: it.title })}
                      title={t('cal.deleteClass')}
                      onClick={() =>
                        setToDelete({ storeKey: 'classes', refId: classSlot.id, title: it.title })
                      }
                      className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-danger/12 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}

                {it.kind === 'estudo' && (
                  <div className="flex shrink-0 items-center gap-1">
                    {!it.done && (
                      <button
                        type="button"
                        aria-label={t('session.focusAria')}
                        title={t('session.focus')}
                        onClick={() => openFocus(it.refId)}
                        className="grid size-11 place-items-center rounded-lg border border-line bg-surface text-accent-ink transition hover:border-accent"
                      >
                        <Play size={15} />
                      </button>
                    )}
                    {studySession && (
                      <button
                        type="button"
                        aria-label={t('session.edit')}
                        title={t('session.edit')}
                        onClick={() => setEditingSession(studySession)}
                        className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={it.done ? t('cal.uncheckSession') : t('cal.checkSession')}
                      title={it.done ? t('cal.uncheckSession') : t('cal.checkTitle')}
                      onClick={() =>
                        it.done
                          ? patch('sessions', it.refId, { done: false, actualMinutes: undefined })
                          : patch('sessions', it.refId, {
                              done: true,
                              actualMinutes:
                                studySession?.actualMinutes ?? studySession?.minutes ?? it.minutes ?? 0,
                            })
                      }
                      className={cx(
                        'grid size-11 shrink-0 place-items-center rounded-lg border transition',
                        it.done ? 'border-ok/40 bg-ok/12 text-ok' : 'border-line bg-surface text-muted hover:text-fg',
                      )}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                )}

                {it.kind === 'tarefa' && (
                  <button
                    type="button"
                    aria-label={t('cal.completeTask')}
                    title={t('cal.completeTask')}
                    onClick={() => patch('tasks', it.refId, { done: !it.done })}
                    className={cx(
                      'grid size-11 shrink-0 place-items-center rounded-lg border transition',
                      it.done ? 'border-ok/40 bg-ok/12 text-ok' : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    <Check size={16} />
                  </button>
                )}

                {it.kind === 'avaliacao' && it.courseId && (() => {
                  const assessmentObj = assessments.find((a) => a.id === it.refId);
                  const assessmentCourse = courseById.get(it.courseId);
                  return (
                    <div className="flex shrink-0 items-center gap-1">
                      {assessmentObj && assessmentCourse && (
                        <button
                          type="button"
                          aria-label={t('courses:assess.edit')}
                          title={t('courses:assess.edit')}
                          onClick={() =>
                            setEditingAssessment({ assessment: assessmentObj, course: assessmentCourse })
                          }
                          className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      <Link
                        to={`/cadeiras/${it.courseId}`}
                        aria-label={t('cal.openCourseAria')}
                        title={t('cal.openCourseAria')}
                        className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-fg transition hover:border-muted/50"
                      >
                        {t('cal.openShort')} <ChevronRight size={14} />
                      </Link>
                    </div>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
    {editingClass && (
      <ClassFormModal
        course={editingClass.course}
        initialSlot={editingClass.slot}
        onClose={() => setEditingClass(null)}
      />
    )}
    {editingAssessment && (
      <AssessmentFormModal
        course={editingAssessment.course}
        assessment={editingAssessment.assessment}
        onClose={() => setEditingAssessment(null)}
      />
    )}
    {editingEvent && (
      <NewEventModal
        defaultDate={date}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
      />
    )}
    {editingSession && (
      <Suspense fallback={null}>
        <SessionModal
          courses={courses}
          session={editingSession}
          defaultDate={date}
          onClose={() => setEditingSession(null)}
        />
      </Suspense>
    )}
    {toDelete && (
      <ConfirmModal
        title={toDelete.storeKey === 'classes' ? t('cal.deleteClass') : t('cal.deleteEvent')}
        message={t('cal.deleteConfirmMsg', { title: toDelete.title })}
        confirmLabel={t('cal.deleteConfirmBtn')}
        onConfirm={() => remove(toDelete.storeKey, toDelete.refId)}
        onClose={() => setToDelete(null)}
      />
    )}
    </>
  );
}
