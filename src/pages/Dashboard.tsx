import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertTriangle, ArrowRight, CalendarClock, CalendarDays, Check, Clock, Flame, GraduationCap, MessageSquare, Plus, Sparkles,
} from 'lucide-react';
import { Badge, Button, Card, CourseChip, EmptyState, Input, PageHeader, Progress, Ring, cx } from '../components/ui';
import { AnimatedPage, BentoMetricTile } from '../components/motion/Primitives';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import { courseColors, kindLabel } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { analyzeTestMode } from '../lib/planner';
import {
  daysUntil, fmtGrade, fmtMinutes, gradeSummary, minutesThisWeek, readiness, semesterAverage,
  sessionMinutes, studyStreak, todayStr, topicProgress, upcomingAssessments, urgency,
} from '../lib/selectors';
import { newId, useStore } from '../store/useStore';
import type { Assessment, Course, StudySession, Task } from '../types';
import AcademicGmailWidget from '../components/home/AcademicGmailWidget';

const greeting = (hour: number) => (hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmtDay = (iso: string) => format(parseISO(iso), 'd MMM', { locale: pt });
const fmtDateTime = (iso: string) => format(parseISO(iso), "EEE d MMM · HH:mm", { locale: pt });

/** "hoje", "amanhã", "ontem", "em N dias", "há N dias". */
const dayWord = (days: number) => {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
};

const PRIORITY_DOT: Record<Task['priority'], string> = { 1: 'bg-danger', 2: 'bg-warn', 3: 'bg-muted' };
const PRIORITY_LABEL: Record<Task['priority'], string> = { 1: 'Prioridade alta', 2: 'Prioridade média', 3: 'Prioridade baixa' };

/** Tarefas com data primeiro (mais cedo primeiro), depois por prioridade (1 = mais alta). */
const compareTasks = (a: Task, b: Task) => {
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return a.priority - b.priority;
};

interface Scored {
  a: Assessment;
  course: Course | undefined;
  score: number;
  ready: number;
}

interface AgendaItem {
  key: string;
  start: string;
  end: string;
  allDay: boolean;
  title: string;
  sub?: string;
  dot: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const sessions = useStore((s) => s.sessions);
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const settings = useStore((s) => s.settings);
  const patch = useStore((s) => s.patch);
  const upsert = useStore((s) => s.upsert);

  const now = new Date();
  const today = todayStr();
  const weekday = now.getDay();
  const nowTime = format(now, 'HH:mm');

  const courseById = useMemo(() => new Map<string, Course>(courses.map((c) => [c.id, c])), [courses]);

  // --- Alerta e avisos -----------------------------------------------------
  const upcoming = useMemo(() => upcomingAssessments(assessments), [assessments]);

  const scored = useMemo<Scored[]>(() => upcoming.map((a) => {
    const course = courseById.get(a.courseId);
    return { a, course, score: urgency(a, course), ready: readiness(a, course) };
  }), [upcoming, courseById]);

  const topAlert = useMemo(() => {
    let top: Scored | undefined;
    for (const x of scored) {
      if (daysUntil(x.a.date) <= 14 && (!top || x.score > top.score)) top = x;
    }
    return top && top.score >= 30 ? top : undefined;
  }, [scored]);

  const overdue = useMemo(
    () => sessions.filter((s) => !s.done && s.date < today).length,
    [sessions, today],
  );

  // --- Estatísticas ----------------------------------------------------------
  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);
  const weekMinutes = useMemo(() => minutesThisWeek(sessions), [sessions]);
  const weekGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  const weekPct = weekGoal > 0 ? Math.min(100, Math.round((weekMinutes / weekGoal) * 100)) : 0;
  const streak = useMemo(() => studyStreak(sessions), [sessions]);
  const next = upcoming[0];
  const nextCourse = next ? courseById.get(next.courseId) : undefined;
  const nextDays = next ? daysUntil(next.date) : null;

  // --- Foco de hoje ---------------------------------------------------------
  const todaySessions = useMemo(
    () => sessions
      .filter((s) => s.date === today)
      .sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99') || a.minutes - b.minutes),
    [sessions, today],
  );
  const plannedToday = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const doneToday = todaySessions.reduce((sum, s) => sum + (s.done ? s.minutes : 0), 0);
  const progressToday = plannedToday > 0 ? doneToday / plannedToday : 0;

  const topicTitle = (s: StudySession) =>
    courseById.get(s.courseId)?.topics.find((t) => t.id === s.topicId)?.title ?? 'Estudo geral';

  const toggleSession = (s: StudySession) => {
    void hapticTap();
    patch('sessions', s.id, { done: !s.done, actualMinutes: s.done ? undefined : s.minutes });
  };

  // --- Agenda de hoje -------------------------------------------------------
  const agenda = useMemo<AgendaItem[]>(() => {
    const fromClasses: AgendaItem[] = classes
      .filter((c) => c.weekday === weekday)
      .map((c) => {
        const course = courseById.get(c.courseId);
        return {
          key: `c-${c.id}`,
          start: c.start,
          end: c.end,
          allDay: false,
          title: course ? `${course.shortName} · ${c.type}` : c.type,
          sub: c.room,
          dot: course ? courseColors[course.color].dot : 'bg-muted',
        };
      });
    const fromEvents: AgendaItem[] = events
      .filter((e) => e.start.slice(0, 10) === today)
      .map((e) => {
        const course = e.courseId ? courseById.get(e.courseId) : undefined;
        return {
          key: `e-${e.id}`,
          start: e.allDay ? '00:00' : e.start.slice(11, 16),
          end: e.allDay ? '' : e.end.slice(11, 16),
          allDay: !!e.allDay,
          title: e.title,
          sub: e.location,
          dot: course ? courseColors[course.color].dot : 'bg-accent',
        };
      });
    return [...fromClasses, ...fromEvents].sort((a, b) => a.start.localeCompare(b.start));
  }, [classes, events, courseById, today, weekday]);

  // --- Tarefas --------------------------------------------------------------
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done).sort(compareTasks), [tasks]);
  const [draft, setDraft] = useState('');
  const [tutorOpen, setTutorOpen] = useState(false);
  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today),
    [courses, assessments, today],
  );

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    upsert('tasks', { id: newId(), title, done: false, priority: 2 });
    setDraft('');
  };
  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') addTask();
  };
  const toggleTask = (t: Task) => patch('tasks', t.id, { done: !t.done });

  const subtitle = `${capitalize(format(now, "EEEE, d 'de' MMMM", { locale: pt }))} · ${settings.semesterName}`;

  return (
    <AnimatedPage>
      <PageHeader
        title={`${greeting(now.getHours())}${settings.userName ? `, ${settings.userName}` : ''}`}
        subtitle={subtitle}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setTutorOpen(true)}>
            <MessageSquare size={15} /> Tutor semanal
          </Button>
        }
      />

      {testMode.mode !== 'normal' && (
        <Link
          to="/plano"
          className="rise mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft/50 px-4 py-3 transition hover:bg-accent-soft"
        >
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="shrink-0 text-accent" />
            <div className="text-sm">
              <span className="font-semibold">
                {testMode.mode === 'single_test' ? 'Modo Teste ativo (< 10 dias)' : 'Modo Teste Múltiplo ativo (< 10 dias)'}
              </span>
              <span className="ml-2 text-muted">
                {testMode.urgentAssessments
                  .map((u) => `${u.course.shortName} (${u.daysLeft === 0 ? 'hoje' : `${u.daysLeft}d`})`)
                  .join(' · ')}
              </span>
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-accent" />
        </Link>
      )}

      {topAlert && (
        <Link
          to="/plano"
          className="rise mb-4 flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 transition hover:bg-warn/15"
        >
          <AlertTriangle size={18} className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">
              {topAlert.a.title} de {topAlert.course?.shortName ?? 'cadeira'} {dayWord(daysUntil(topAlert.a.date))}
            </span>
            <span className="text-muted"> — preparação a {pct(topAlert.ready)}</span>
          </p>
          <ArrowRight size={16} className="shrink-0 text-muted" />
        </Link>
      )}

      {overdue > 0 && (
        <Link to="/plano" className="mb-4 flex items-center gap-2 px-1 text-xs text-muted hover:text-fg">
          <Clock size={14} className="shrink-0" />
          <span>
            {overdue} {overdue === 1 ? 'sessão por concluir de dias anteriores' : 'sessões por concluir de dias anteriores'} — reagendar no plano
          </span>
          <ArrowRight size={12} className="shrink-0" />
        </Link>
      )}

      <div data-tour="bento-overview" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BentoMetricTile
          tone="indigo"
          label="Média do semestre"
          value={fmtGrade(average)}
          hint={average === null ? 'Sem notas lançadas' : 'Ponderada por ECTS'}
          icon={<GraduationCap size={16} className="text-accent" />}
        />
        <BentoMetricTile
          tone="mint"
          label="Estudo esta semana"
          value={fmtMinutes(weekMinutes)}
          hint={`${weekPct}% da meta de ${fmtMinutes(weekGoal)}`}
          icon={<Clock size={16} className="text-ok" />}
        />
        <BentoMetricTile
          tone="amber"
          label="Sequência"
          value={streak}
          hint="dias seguidos"
          icon={<Flame size={16} className="text-warn" />}
        />
        <BentoMetricTile
          tone="lilac"
          label="Próxima avaliação"
          value={nextDays === null ? '—' : capitalize(dayWord(nextDays))}
          hint={next ? `${next.title}${nextCourse ? ` · ${nextCourse.shortName}` : ''}` : 'Nada marcado'}
          icon={<CalendarClock size={16} className="text-accent" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card
            title="Foco de hoje"
            action={<Button size="sm" onClick={() => navigate('/plano')}>Abrir plano</Button>}
          >
            {todaySessions.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title="Sem sessões para hoje"
                hint="Gera um plano de estudo para distribuir a matéria pelos próximos dias."
              />
            ) : (
              <>
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted">
                    <span className="tabular">
                      {fmtMinutes(doneToday)} de {fmtMinutes(plannedToday)} concluídos
                    </span>
                    <span className="tabular">{pct(progressToday)}</span>
                  </div>
                  <Progress value={progressToday} />
                </div>
                <ul className="space-y-2">
                  {todaySessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      course={courseById.get(s.courseId)}
                      topic={topicTitle(s)}
                      onToggle={() => toggleSession(s)}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title="Próximas avaliações">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title="Sem avaliações marcadas"
                hint="Quando adicionares testes, trabalhos ou exames, aparecem aqui."
              />
            ) : (
              <ul className="divide-y divide-line">
                {scored.slice(0, 5).map((x) => (
                  <AssessmentRow key={x.a.id} assessment={x.a} course={x.course} ready={x.ready} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card
            title="Agenda de hoje"
            action={<span className="text-xs tabular text-muted">{format(now, 'd MMM', { locale: pt })}</span>}
          >
            {agenda.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={22} />}
                title="Nada agendado para hoje"
                hint="Dia livre — boa altura para avançar no plano."
              />
            ) : (
              <ol className="space-y-1">
                {agenda.map((item) => {
                  const isNow = !item.allDay && nowTime >= item.start && nowTime < item.end;
                  return (
                    <li
                      key={item.key}
                      className={cx('flex gap-3 rounded-xl px-2 py-2', isNow && 'bg-accent-soft')}
                    >
                      <div className="w-12 shrink-0 pt-0.5 text-right text-xs tabular text-muted">
                        {item.allDay ? 'Dia' : item.start}
                      </div>
                      <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface', item.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted">
                          {[item.allDay ? 'Dia inteiro' : `${item.start}–${item.end}`, item.sub].filter(Boolean).join(' · ')}
                        </p>
                        {isNow && <span className="text-[11px] font-semibold text-accent">Agora</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card
            title="Tarefas"
            action={<span className="text-xs tabular text-muted">{pendingTasks.length} pendentes</span>}
          >
            <div className="relative mb-3">
              <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onDraftKey}
                placeholder="Nova tarefa — Enter para adicionar"
                aria-label="Nova tarefa"
                className="pl-9"
              />
            </div>
            {pendingTasks.length === 0 ? (
              <EmptyState title="Sem tarefas pendentes" hint="Escreve acima para adicionar a primeira." />
            ) : (
              <>
                <ul className="space-y-1">
                  {pendingTasks.slice(0, 6).map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      course={t.courseId ? courseById.get(t.courseId) : undefined}
                      today={today}
                      onToggle={() => toggleTask(t)}
                    />
                  ))}
                </ul>
                {pendingTasks.length > 6 && (
                  <p className="mt-2 px-1 text-xs text-muted">e mais {pendingTasks.length - 6}</p>
                )}
              </>
            )}
          </Card>

          <AcademicGmailWidget />

          <Card title="Cadeiras">
            {courses.length === 0 ? (
              <EmptyState title="Ainda sem cadeiras" hint="Adiciona cadeiras para acompanhar matéria e notas." />
            ) : (
              <ul className="space-y-1">
                {courses.map((c) => (
                  <CourseRow key={c.id} course={c} assessments={assessments} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />
    </AnimatedPage>
  );
}

function SessionRow({ session, course, topic, onToggle }: {
  session: StudySession; course: Course | undefined; topic: string; onToggle: () => void;
}) {
  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-3 transition',
        session.done && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={session.done ? 'Marcar como por concluir' : 'Marcar como concluída'}
        className={cx(
          'grid size-6 shrink-0 place-items-center rounded-full border transition',
          session.done ? 'border-ok bg-ok text-bg' : 'border-muted/60 hover:border-accent',
        )}
      >
        {session.done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CourseChip course={course} />
          <span className="text-xs tabular text-muted">{session.start ?? 'Qualquer hora'}</span>
        </div>
        <p className={cx('mt-1 truncate text-sm font-medium', session.done && 'text-muted line-through')}>
          {topic}
        </p>
      </div>
      <span className="shrink-0 text-xs tabular text-muted">
        {session.done ? fmtMinutes(sessionMinutes(session)) : `${session.minutes} min`}
      </span>
    </li>
  );
}

function AssessmentRow({ assessment, course, ready }: {
  assessment: Assessment; course: Course | undefined; ready: number;
}) {
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
          <Badge tone={tone}>{capitalize(dayWord(days))}</Badge>
          <span className="text-xs text-muted">{kindLabel[assessment.kind]}</span>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">{assessment.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <CourseChip course={course} />
          <span className="tabular">{fmtDateTime(assessment.date)}</span>
          <span className="tabular">· peso {assessment.weight}%</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={ready} color={bar} className="flex-1" />
          <span className="w-10 text-right text-xs font-medium tabular">{pct(ready)}</span>
        </div>
      </Link>
    </li>
  );
}

function TaskRow({ task, course, today, onToggle }: {
  task: Task; course: Course | undefined; today: string; onToggle: () => void;
}) {
  const overdue = !!task.due && task.due < today;
  const dueLabel = task.due
    ? (task.due === today ? 'hoje' : overdue ? `${dayWord(daysUntil(task.due))} · ${fmtDay(task.due)}` : fmtDay(task.due))
    : null;
  return (
    <li className="flex items-center gap-3 rounded-xl px-1 py-2 transition hover:bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Concluir: ${task.title}`}
        className="grid size-5 shrink-0 place-items-center rounded-full border border-muted/60 transition hover:border-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{task.title}</p>
        {(course || dueLabel) && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {course && <span>{course.shortName}</span>}
            {dueLabel && <span className={cx('tabular', overdue && 'font-medium text-danger')}>{dueLabel}</span>}
          </p>
        )}
      </div>
      <span
        title={PRIORITY_LABEL[task.priority]}
        aria-label={PRIORITY_LABEL[task.priority]}
        className={cx('size-1.5 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
      />
    </li>
  );
}

function CourseRow({ course, assessments }: { course: Course; assessments: Assessment[] }) {
  const progress = topicProgress(course);
  const grades = gradeSummary(course, assessments);
  return (
    <li>
      <Link
        to={`/cadeiras/${course.id}`}
        className="flex items-center gap-3 rounded-xl px-1 py-2 transition hover:bg-surface-2"
      >
        <Ring value={progress} size={44} stroke={4} color={courseColors[course.color].hex}>
          <span className="text-[10px]">{pct(progress)}</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{course.shortName}</p>
          <p className="text-xs tabular text-muted">
            Atual <span className="text-fg">{fmtGrade(grades.current)}</span> · Objetivo {fmtGrade(course.targetGrade)}
          </p>
        </div>
        <ArrowRight size={14} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
