import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  Compass,
  GraduationCap,
  HardDrive,
  MessageSquare,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import UniCollectiblesModal from '../components/brand/UniCollectiblesModal';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import PostOnboardingHubModal from '../components/onboarding/PostOnboardingHubModal';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import AcademicGmailWidget from '../components/home/AcademicGmailWidget';
import { getUniCollectibleStates, readCollectibleTelemetry } from '../lib/uniCollectibles';
import {
  AgendaRibbonCard,
  HighlightShapesGrid,
  NotebookFocusSheet,
  StickyTasksPad,
} from '../components/home/PlayfulWidgets';
import {
  AnimatedPage,
  BentoMetricTile,
  FolderCardDeck,
  StaggerContainer,
  StaggerItem,
  StickerBadge,
  UNIPEDIA_BOUNCE_SPRING,
  celebrateStationery,
} from '../components/motion/Primitives';
import {
  Badge,
  Button,
  Card,
  CourseChip,
  Progress,
  Ring,
  SegmentedControl,
  cx,
  showToast,
} from '../components/ui';
import { courseColors, kindLabel } from '../lib/colors';
import { hapticSuccess, hapticTap } from '../lib/nativeBridge';
import { analyzeTestMode } from '../lib/planner';
import {
  getHubProgress,
  type HubStepKey,
} from '../lib/studyHub';
import { resolveUniAccessory } from '../lib/uniAccessories';
import {
  daysUntil,
  fmtGrade,
  fmtMinutes,
  gradeSummary,
  minutesThisWeek,
  readiness,
  semesterAverage,
  sessionMinutes,
  studyStreak,
  todayStr,
  topicProgress,
  upcomingAssessments,
  urgency,
} from '../lib/selectors';
import { newId, useStore } from '../store/useStore';
import type { Assessment, Course, StudySession, Task } from '../types';

const greeting = (hour: number) => (hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmtDay = (iso: string) => format(parseISO(iso), 'd MMM', { locale: pt });
const fmtDateTime = (iso: string) => format(parseISO(iso), 'EEE d MMM · HH:mm', { locale: pt });

const dayWord = (days: number) => {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
};

const PRIORITY_DOT: Record<Task['priority'], string> = {
  1: 'bg-danger',
  2: 'bg-warn',
  3: 'bg-muted',
};
const PRIORITY_LABEL: Record<Task['priority'], string> = {
  1: 'Prioridade alta',
  2: 'Prioridade média',
  3: 'Prioridade baixa',
};

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
  const materials = useStore((s) => s.materials);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const patch = useStore((s) => s.patch);
  const upsert = useStore((s) => s.upsert);
  const updateSettings = useStore((s) => s.updateSettings);

  const uniAccessory = useMemo(
    () => resolveUniAccessory(settings.uniAccessory, academicProfile?.degreeName, courses[0]?.name),
    [settings.uniAccessory, academicProfile?.degreeName, courses],
  );
  const collectibles = useMemo(
    () => getUniCollectibleStates(readCollectibleTelemetry(sessions, courses, weeklyCheckIns)),
    [sessions, courses, weeklyCheckIns],
  );
  const unlockedCollectibles = collectibles.filter((c) => c.unlocked).length;

  const [scope, setScope] = useState<'today' | 'week'>('today');
  const [draft, setDraft] = useState('');
  const [tutorOpen, setTutorOpen] = useState(false);
  const [uniBubbleOpen, setUniBubbleOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [hubModalStep, setHubModalStep] = useState<HubStepKey | null>(null);

  const hubProgress = useMemo(
    () =>
      getHubProgress({
        academicProfile,
        courses,
        classes,
        assessments,
        materials,
        sessions,
        settings,
      }),
    [academicProfile, courses, classes, assessments, materials, sessions, settings],
  );

  useEffect(() => {
    if (
      academicProfile?.onboardingCompleted &&
      settings.tourCompleted &&
      !settings.hubSetupCompleted &&
      !settings.hubSetupDismissed
    ) {
      try {
        if (sessionStorage.getItem('unipedia.hubAutoShown') === '1') return;
        sessionStorage.setItem('unipedia.hubAutoShown', '1');
      } catch {
        // ignore storage error
      }
      setHubModalStep(null);
      setHubModalOpen(true);
    }
  }, [
    academicProfile?.onboardingCompleted,
    settings.tourCompleted,
    settings.hubSetupCompleted,
    settings.hubSetupDismissed,
  ]);

  const now = new Date();
  const today = todayStr();
  const weekday = now.getDay();
  const nowTime = format(now, 'HH:mm');

  const courseById = useMemo(() => new Map<string, Course>(courses.map((c) => [c.id, c])), [courses]);

  const upcoming = useMemo(() => upcomingAssessments(assessments), [assessments]);

  const scored = useMemo<Scored[]>(
    () =>
      upcoming.map((a) => {
        const course = courseById.get(a.courseId);
        return { a, course, score: urgency(a, course), ready: readiness(a, course) };
      }),
    [upcoming, courseById],
  );

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

  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);
  const weekMinutes = useMemo(() => minutesThisWeek(sessions), [sessions]);
  const weekGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  const weekPct = weekGoal > 0 ? Math.min(100, Math.round((weekMinutes / weekGoal) * 100)) : 0;
  const streak = useMemo(() => studyStreak(sessions), [sessions]);
  const next = upcoming[0];
  const nextCourse = next ? courseById.get(next.courseId) : undefined;
  const nextDays = next ? daysUntil(next.date) : null;

  const todaySessions = useMemo(
    () =>
      sessions
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
    const becomingDone = !s.done;
    void hapticTap();
    patch('sessions', s.id, { done: becomingDone, actualMinutes: s.done ? undefined : s.minutes });
    if (becomingDone && todaySessions.length > 0) {
      const allOthersDone = todaySessions.every((item) => (item.id === s.id ? true : item.done));
      if (allOthersDone) {
        void hapticSuccess();
        celebrateStationery();
        showToast('Objetivo de hoje concluído!', 'ok');
      }
    }
  };

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

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done).sort(compareTasks), [tasks]);
  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today),
    [courses, assessments, today],
  );

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    void hapticTap();
    upsert('tasks', { id: newId(), title, done: false, priority: 2 });
    setDraft('');
    showToast('Tarefa adicionada', 'ok');
  };

  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') addTask();
  };

  const toggleTask = (t: Task) => {
    void hapticTap();
    patch('tasks', t.id, { done: !t.done });
  };

  const firstName = settings.userName.trim().split(/\s+/)[0] ?? '';
  const dateLabel = capitalize(format(now, "EEEE, d 'de' MMM", { locale: pt }));
  const doneSessionsCount = todaySessions.filter((s) => s.done).length;
  const uniTip = next
    ? `Tens ${next.title}${nextCourse ? ` (${nextCourse.shortName})` : ''} ${dayWord(daysUntil(next.date))}. Queres que prepare um plano ou resumo rápido?`
    : todaySessions.length > 0
      ? `Faltam ${todaySessions.length - doneSessionsCount} sessões para fechares a meta de hoje. Vamos a isso!`
      : 'Sem sessões marcadas para hoje — adiciona as tuas cadeiras ou conversa comigo no Tutor!';

  return (
    <AnimatedPage className="space-y-5">
      {/* Cabeçalho editorial com o Uni interativo ("Clippy") e máximo 2 ações circulares */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pastel-sage/85 ring-1 ring-line/50 dark:bg-surface-2">
            <UniBuddy
              mood={streak >= 3 || progressToday >= 1 ? 'celebrate' : 'happy'}
              accessory={uniAccessory}
              size={38}
              onClick={() => {
                void hapticTap();
                setUniBubbleOpen((v) => !v);
              }}
              ariaLabel="Falar com o Uni"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-muted">
              {dateLabel} · {settings.semesterName}
            </p>
            <h1 className="truncate font-display text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">
              {greeting(now.getHours())}
              {firstName ? (
                <>
                  , <span className="font-serif font-medium italic text-accent">{firstName}</span>
                </>
              ) : (
                <>
                  , <span className="font-serif font-medium italic text-accent">bora estudar</span>
                </>
              )}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <TabGuideHelpButton tabKey="dashboard" />
          <Button
            variant="secondary"
            iconOnly
            onClick={() => setTutorOpen(true)}
            aria-label="Abrir check-in com o Uni"
            title="Check-in semanal"
          >
            <MessageSquare size={18} />
          </Button>
          <Button
            variant="secondary"
            iconOnly
            onClick={() => navigate('/definicoes')}
            aria-label="Abrir definições"
            title="Definições"
          >
            <SettingsIcon size={18} />
          </Button>
        </div>
      </header>

      <TabGuideBanner tabKey="dashboard" />

      {/* Cartão compacto de progresso do Hub de Estudo */}
      {!settings.hubSetupDismissed && !hubProgress.allReady && (
        <section
          aria-label="Progresso do Hub de Estudo"
          className="rounded-[24px] border border-[#141312]/10 bg-pastel-sage/55 p-4 text-[#141312] shadow-card dark:border-white/10 dark:bg-surface dark:text-fg"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-surface/85 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent dark:bg-surface-2">
                  <Compass size={11} /> Hub de Estudo · {hubProgress.flow.shortLabel}
                </span>
                <span className="text-xs font-semibold tabular opacity-80">
                  {hubProgress.readyCount}/{hubProgress.totalCount} fontes ligadas
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-85">
                Liga o teu horário, datas de provas, Drives/PC e Gemini Notebook para um plano sempre afinado.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setHubModalStep(null);
                  setHubModalOpen(true);
                }}
              >
                <Sparkles size={13} /> Completar Hub
              </Button>
              <button
                type="button"
                onClick={() => updateSettings({ hubSetupDismissed: true })}
                aria-label="Dispensar lembrete do Hub"
                title="Dispensar"
                className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface/70 hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {hubProgress.steps.map((step) => {
              const icon =
                step.key === 'schedule' ? (
                  <CalendarClock size={13} />
                ) : step.key === 'assessments' ? (
                  <CalendarDays size={13} />
                ) : step.key === 'drive_hd' ? (
                  <HardDrive size={13} />
                ) : (
                  <BookMarked size={13} />
                );
              const chipLabel =
                step.key === 'schedule'
                  ? 'Horário'
                  : step.key === 'assessments'
                    ? 'Provas'
                    : step.key === 'drive_hd'
                      ? 'Drive / PC'
                      : 'Gemini Notebook';
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    setHubModalStep(step.key);
                    setHubModalOpen(true);
                  }}
                  className={cx(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    step.ready
                      ? 'border-ok/35 bg-ok/10 text-ok'
                      : 'border-line bg-surface/90 text-fg hover:border-accent dark:bg-surface-2',
                  )}
                >
                  {step.ready ? <Check size={13} /> : icon}
                  <span>{chipLabel}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Balão interativo do Uni ("Clippy" da Unipedia) */}
      <AnimatePresence>
        {uniBubbleOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={UNIPEDIA_BOUNCE_SPRING}
            className="flex items-center justify-between gap-2.5 rounded-[22px] border border-line bg-surface p-3.5 shadow-card"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Uni · O teu tutor</p>
              <p className="text-xs leading-relaxed text-fg">{uniTip}</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => navigate('/assistente')}>
              Falar com o Uni
            </Button>
            <button
              type="button"
              onClick={() => setUniBubbleOpen(false)}
              aria-label="Fechar sugestão do Uni"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switcher compacto com transição spring */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          layoutId="dashboard-scope"
          value={scope}
          onChange={(v) => setScope(v as 'today' | 'week')}
          items={[
            { id: 'today', label: 'Hoje', count: todaySessions.length },
            { id: 'week', label: 'Esta semana' },
          ]}
        />
        {streak > 0 && (
          <StickerBadge tone="butter" tilt={-1.5}>
            {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}
          </StickerBadge>
        )}
        <button
          type="button"
          onClick={() => {
            void hapticTap();
            setCollectiblesOpen(true);
          }}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-fg transition hover:border-accent"
        >
          <Sparkles size={13} className="text-accent" />
          <span>Coleção Uni · {unlockedCollectibles}/{collectibles.length}</span>
        </button>
      </div>

      <StaggerContainer className="space-y-5">
      {/* Cartão Hero estilo papelaria com métricas inline */}
      <StaggerItem>
      <section
        data-tour="bento-overview"
        className="rounded-[26px] bg-pastel-butter/75 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
              {scope === 'today' ? 'Resumo de hoje' : 'Pulso da semana'}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold">
              {scope === 'today'
                ? plannedToday > 0
                  ? `${fmtMinutes(doneToday)} de ${fmtMinutes(plannedToday)} focados`
                  : 'Dia leve para pôr matéria em dia'
                : `${fmtMinutes(weekMinutes)} de ${fmtMinutes(weekGoal)} esta semana`}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/plano')}
              className="flex size-10 items-center justify-center rounded-full bg-surface/85 text-fg shadow-card transition hover:scale-105 dark:bg-black/30 dark:text-[#FAF6EC]"
              aria-label="Abrir plano"
            >
              <CalendarDays size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-left">
          <div>
            <p className="text-[11px] font-medium opacity-70">Média</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular sm:text-2xl">{fmtGrade(average)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium opacity-70">Semana</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular sm:text-2xl">{weekPct}%</p>
          </div>
          <div>
            <p className="text-[11px] font-medium opacity-70">Sessões</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular sm:text-2xl">
              {doneSessionsCount}/{todaySessions.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium opacity-70">Provas</p>
            <p className="mt-0.5 font-display text-xl font-bold tabular sm:text-2xl">{upcoming.length}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium opacity-80">
            <span>{scope === 'today' ? 'Progresso de hoje' : 'Meta semanal'}</span>
            <span className="tabular">{scope === 'today' ? pct(progressToday) : `${weekPct}%`}</span>
          </div>
          <Progress
            value={scope === 'today' ? progressToday : weekPct / 100}
            color="bg-[#141312] dark:bg-accent"
          />
        </div>
      </section>
      </StaggerItem>

      {/* Alertas contextuais compactos */}
      {testMode.mode !== 'normal' && (
        <StaggerItem>
        <Link
          to="/plano"
          className="flex items-center justify-between gap-3 rounded-[20px] bg-pastel-peach/80 px-4 py-3 text-[#141312] transition hover:opacity-95 dark:bg-surface-2 dark:text-[#FAF6EC]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Sparkles size={18} className="shrink-0 text-coral" />
            <div className="min-w-0 text-sm">
              <span className="font-semibold">
                {testMode.mode === 'single_test' ? 'Modo Teste ativo (< 10 dias)' : 'Modo Teste Múltiplo'}
              </span>
              <span className="ml-2 opacity-75">
                {testMode.urgentAssessments
                  .map((u) => `${u.course.shortName} (${u.daysLeft === 0 ? 'hoje' : `${u.daysLeft}d`})`)
                  .join(' · ')}
              </span>
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0" />
        </Link>
        </StaggerItem>
      )}

      {topAlert && (
        <StaggerItem>
        <Link
          to="/plano"
          className="flex items-center gap-3 rounded-[20px] border border-warn/40 bg-warn/10 px-4 py-3 transition hover:bg-warn/15"
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
        </StaggerItem>
      )}

      {overdue > 0 && (
        <StaggerItem>
        <Link to="/plano" className="flex items-center gap-2 px-1 text-xs font-medium text-muted hover:text-fg">
          <Clock size={14} className="shrink-0" />
          <span>
            {overdue} {overdue === 1 ? 'sessão por concluir' : 'sessões por concluir'} — reagendar no plano
          </span>
          <ArrowRight size={12} className="shrink-0" />
        </Link>
        </StaggerItem>
      )}

      {/* Bento 2x1 colorido estilo referência "Ver ->" */}
      <StaggerItem>
      <div className="grid grid-cols-2 gap-3">
        <BentoMetricTile
          tone="sage"
          label="Próxima avaliação"
          value={nextDays === null ? 'Livre' : capitalize(dayWord(nextDays))}
          hint={next ? `${next.title}${nextCourse ? ` · ${nextCourse.shortName}` : ''}` : 'Sem provas próximas'}
          icon={<CalendarClock size={16} />}
          actionLabel="Ver"
          onClick={() => navigate(next ? `/cadeiras/${next.courseId}` : '/calendario')}
        />
        <BentoMetricTile
          tone="sky"
          label="Caderno & Progresso"
          value={courses.length > 0 ? `${courses.length} cad.` : 'Novo'}
          hint={average !== null ? `Média atual ${fmtGrade(average)}` : 'Abre as tuas estatísticas'}
          icon={<GraduationCap size={16} />}
          actionLabel="Ver"
          onClick={() => navigate(scope === 'week' ? '/progresso' : '/cadeiras')}
        />
      </div>
      </StaggerItem>

      {/* Mosaico orgânico de formas pastel ("Daily highlights") */}
      <StaggerItem>
        <HighlightShapesGrid
          focusedLabel={fmtMinutes(weekMinutes)}
          streakDays={streak}
          sessionsLabel={`${doneSessionsCount}/${todaySessions.length}`}
          pendingCount={pendingTasks.length}
          onOpenProgress={() => navigate('/progresso')}
          onOpenPlan={() => navigate('/plano')}
          onFocusTasks={() => {
            const el = document.getElementById('dashboard-quick-task');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
            }
          }}
        />
      </StaggerItem>

      {/* Conteúdo principal em blocos lúdicos de papelaria */}
      <StaggerItem>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <NotebookFocusSheet
            isEmpty={todaySessions.length === 0}
            onOpenPlan={() => navigate('/plano')}
            uniAccessory={uniAccessory}
          >
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
          </NotebookFocusSheet>

          <StickyTasksPad
            pendingCount={pendingTasks.length}
            draft={draft}
            onDraftChange={setDraft}
            onDraftKeyDown={onDraftKey}
            inputId="dashboard-quick-task"
          >
            {pendingTasks.length === 0 ? (
              <p className="rounded-2xl bg-white/55 px-3 py-4 text-center text-xs opacity-75 dark:bg-black/20">
                Sem tarefas pendentes — escreve acima para apontar algo rápido.
              </p>
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
                  <p className="mt-2 px-1 text-xs opacity-75">e mais {pendingTasks.length - 6}</p>
                )}
              </>
            )}
          </StickyTasksPad>

          {upcoming.length > 0 && (
            <Card title="Próximas avaliações">
              <ul className="divide-y divide-line">
                {scored.slice(0, 4).map((x) => (
                  <AssessmentRow key={x.a.id} assessment={x.a} course={x.course} ready={x.ready} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {courses.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-base font-bold">As tuas pastas</h2>
                <Link to="/cadeiras" className="inline-link text-xs font-semibold text-accent hover:underline">
                  Ver todas →
                </Link>
              </div>
              <FolderCardDeck courses={courses} onOpenCourse={(id) => navigate(`/cadeiras/${id}`)} />
            </div>
          )}

          <AgendaRibbonCard dateBadge={format(now, 'd MMM', { locale: pt })} isEmpty={agenda.length === 0}>
            <ol className="space-y-1">
              {agenda.map((item) => {
                const isNow = !item.allDay && nowTime >= item.start && nowTime < item.end;
                return (
                  <li
                    key={item.key}
                    className={cx(
                      'flex gap-3 rounded-xl px-2 py-2',
                      isNow && 'bg-white/80 dark:bg-black/25',
                    )}
                  >
                    <div className="w-12 shrink-0 pt-0.5 text-right text-xs tabular opacity-70">
                      {item.allDay ? 'Dia' : item.start}
                    </div>
                    <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white/80 dark:ring-black/30', item.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs opacity-75">
                        {[item.allDay ? 'Dia inteiro' : `${item.start}–${item.end}`, item.sub]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {isNow && <span className="text-xs font-semibold text-accent">Agora</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </AgendaRibbonCard>

          <AcademicGmailWidget />

          {courses.length > 0 && (
            <Card title="Progresso por cadeira">
              <ul className="space-y-1">
                {courses.map((c) => (
                  <CourseRow key={c.id} course={c} assessments={assessments} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      </StaggerItem>
      </StaggerContainer>

      <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />
      <UniCollectiblesModal open={collectiblesOpen} onClose={() => setCollectiblesOpen(false)} />
      <PostOnboardingHubModal
        open={hubModalOpen}
        initialFocusStep={hubModalStep}
        onClose={() => setHubModalOpen(false)}
      />
    </AnimatedPage>
  );
}

function SessionRow({
  session,
  course,
  topic,
  onToggle,
}: {
  session: StudySession;
  course: Course | undefined;
  topic: string;
  onToggle: () => void;
}) {
  return (
    <li
      className={cx(
        'flex min-h-[54px] items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 transition',
        session.done && 'opacity-65',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={session.done ? 'Marcar como por concluir' : 'Marcar como concluída'}
        className={cx(
          'grid size-8 shrink-0 place-items-center rounded-full border-2 transition',
          session.done ? 'border-ok bg-ok text-white' : 'border-muted/50 bg-surface hover:border-accent',
        )}
      >
        {session.done && <Check size={15} strokeWidth={3} />}
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
      <span className="shrink-0 text-xs font-semibold tabular text-muted">
        {session.done ? fmtMinutes(sessionMinutes(session)) : `${session.minutes} min`}
      </span>
    </li>
  );
}

function AssessmentRow({
  assessment,
  course,
  ready,
}: {
  assessment: Assessment;
  course: Course | undefined;
  ready: number;
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

function TaskRow({
  task,
  course,
  today,
  onToggle,
}: {
  task: Task;
  course: Course | undefined;
  today: string;
  onToggle: () => void;
}) {
  const overdue = !!task.due && task.due < today;
  const dueLabel = task.due
    ? task.due === today
      ? 'hoje'
      : overdue
        ? `${dayWord(daysUntil(task.due))} · ${fmtDay(task.due)}`
        : fmtDay(task.due)
    : null;
  return (
    <li className="flex min-h-[48px] items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Concluir: ${task.title}`}
        className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-muted/50 bg-surface transition hover:border-accent"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
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
        className={cx('size-2 shrink-0 rounded-full', PRIORITY_DOT[task.priority])}
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
        className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2"
      >
        <Ring value={progress} size={44} stroke={4} color={courseColors[course.color].hex}>
          <span className="text-xs font-semibold tabular">{pct(progress)}</span>
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
