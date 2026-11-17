import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { formatAppDate, normalizeAppLanguage } from '../lib/grading';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookMarked,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  HardDrive,
  MessageSquare,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import AcademicGmailWidget from '../components/home/AcademicGmailWidget';
import ExpeditionTodayCard from '../components/home/ExpeditionTodayCard';
import {
  AssessmentRow,
  SessionRow,
  TaskRow,
} from '../components/home/DashboardRows';
import { dayWord, pct, useDashboardAgenda } from '../components/home/useDashboardAgenda';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import type { StudyLogKind } from '../types';
import {
  AgendaRibbonCard,
  NotebookFocusSheet,
  StickyTasksPad,
} from '../components/home/PlayfulWidgets';
import {
  AnimatedPage,
  FolderCardDeck,
  StaggerContainer,
  StaggerItem,
  StickerBadge,
} from '../components/motion/Primitives';
import { courseColors } from '../lib/colors';
import { UNIPEDIA_BOUNCE_SPRING, celebrateStationery } from '../lib/motionTokens';
import { Button, Card, Modal, Progress, SegmentedControl } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { hapticSuccess, hapticTap } from '../lib/nativeBridge';
import { getHubProgress } from '../lib/studyHub';
import { resolveUniAccessory } from '../lib/uniAccessories';
import { daysUntil, fmtGrade, fmtMinutes, formatSessionDisplay, sessionMinutes } from '../lib/selectors';
import { useHubUiStore } from '../store/useHubUiStore';
import { newId, useStore } from '../store/useStore';
import type { StudySession, Task } from '../types';

export default function Dashboard() {
  const { t, i18n } = useTranslation('today');
  const appLang = normalizeAppLanguage(i18n.language);
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
  const studyLogs = useStore((s) => s.studyLogs);
  const patch = useStore((s) => s.patch);
  const upsert = useStore((s) => s.upsert);
  const updateSettings = useStore((s) => s.updateSettings);

  const uniAccessory = useMemo(
    () => resolveUniAccessory(settings.uniAccessory, academicProfile?.degreeName, courses[0]?.name),
    [settings.uniAccessory, academicProfile?.degreeName, courses],
  );
  const gradingScale = settings.gradingScale ?? 'pt20';

  const [scope, setScope] = useState<'today' | 'week'>('today');
  const [draft, setDraft] = useState('');
  const [uniBubbleOpen, setUniBubbleOpen] = useState(false);
  const [undoSession, setUndoSession] = useState<StudySession | null>(null);
  const [dismissedNudgeKey, setDismissedNudgeKey] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('unipedia_dismissed_inapp_nudge');
    } catch {
      return null;
    }
  });
  const openHubModal = useHubUiStore((s) => s.openModal);

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

  const [now] = useState(() => new Date());
  const {
    today,
    nowTime,
    courseById,
    upcoming,
    scored,
    topAlert,
    overdue,
    average,
    weekMinutes,
    weekGoal,
    weekPct,
    streak,
    todaySessions,
    plannedToday,
    doneToday,
    progressToday,
    inAppNudge,
    agenda,
    pendingTasks,
    testMode,
  } = useDashboardAgenda({
    courses,
    assessments,
    classes,
    events,
    sessions,
    tasks,
    studyLogs,
    weeklyCheckIns,
    settings,
    now,
  });

  const next = upcoming[0];
  const nextCourse = next ? courseById.get(next.courseId) : undefined;
  const upcomingPlanSessions = useMemo(
    () =>
      sessions
        .filter((s) => !s.done && s.date > today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')),
    [sessions, today],
  );
  const nextStudyDate = upcomingPlanSessions[0]?.date;
  const nextStudyDaySessions = useMemo(
    () => (nextStudyDate ? upcomingPlanSessions.filter((s) => s.date === nextStudyDate) : []),
    [upcomingPlanSessions, nextStudyDate],
  );
  const nextStudyDayLabel = useMemo(() => {
    if (!nextStudyDate) return null;
    try {
      return formatAppDate(`${nextStudyDate}T12:00:00`, appLang, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return nextStudyDate;
    }
  }, [nextStudyDate, appLang]);

  const topicTitle = (s: StudySession) => {
    const topic = courseById.get(s.courseId)?.topics.find((t) => t.id === s.topicId);
    return formatSessionDisplay(s, topic, appLang).title;
  };

  const visibleNudge = inAppNudge && inAppNudge.key !== dismissedNudgeKey ? inAppNudge : null;

  const handleOpenNudgeRoute = (route: string) => {
    if (route.startsWith('/?uniLog=')) {
      const qs = new URLSearchParams(route.slice(2));
      const logKind = qs.get('uniLog');
      openUniCheckIn({
        kind: (logKind === 'class' || logKind === 'day' || logKind === 'week' || logKind === 'exam_prep'
          ? logKind
          : 'day') as StudyLogKind,
        courseId: qs.get('courseId') || undefined,
        classSlotId: qs.get('classSlotId') || undefined,
        assessmentId: qs.get('assessmentId') || undefined,
      });
      return;
    }
    navigate(route);
  };

  const applySessionToggle = (s: StudySession, becomingDone: boolean) => {
    void hapticTap();
    patch('sessions', s.id, {
      done: becomingDone,
      actualMinutes: becomingDone ? s.actualMinutes ?? s.minutes : undefined,
    });
    if (becomingDone && todaySessions.length > 0) {
      const allOthersDone = todaySessions.every((item) => (item.id === s.id ? true : item.done));
      if (allOthersDone) {
        void hapticSuccess();
        celebrateStationery();
        showToast(t('goalDone'), 'ok');
      }
    }
  };

  const toggleSession = (s: StudySession) => {
    if (s.done) {
      setUndoSession(s);
      return;
    }
    applySessionToggle(s, true);
  };

  const startQuickMinutesBlock = (minutes: 10 | 25 | 50) => {
    void hapticTap();
    const pendingToday = todaySessions.find((s) => !s.done);
    if (pendingToday) {
      if (minutes < pendingToday.minutes) {
        patch('sessions', pendingToday.id, { minutes });
      }
      navigate(`/plano?focus=${encodeURIComponent(pendingToday.id)}`);
      return;
    }
    const targetCourse = nextCourse ?? courses[0];
    if (!targetCourse) {
      navigate('/cadeiras');
      return;
    }
    const targetTopic =
      targetCourse.topics.find((tp) => tp.status !== 'done') ?? targetCourse.topics[0];
    const id = newId();
    upsert('sessions', {
      id,
      courseId: targetCourse.id,
      topicId: targetTopic?.id,
      date: today,
      start: nowTime,
      minutes,
      done: false,
      generated: false,
      notes: minutes === 10 ? 'Revisão espaçada' : 'Consolidação',
    });
    navigate(`/plano?focus=${encodeURIComponent(id)}`);
  };

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;
    void hapticTap();
    upsert('tasks', { id: newId(), title, done: false, priority: 2 });
    setDraft('');
    showToast(t('taskAdded'), 'ok');
  };

  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') addTask();
  };

  const toggleTask = (t: Task) => {
    void hapticTap();
    patch('tasks', t.id, { done: !t.done });
  };

  const isMinimal = (settings.appTone ?? 'vibrante') === 'serio';
  const firstName = settings.userName.trim().split(/\s+/)[0] ?? '';
  const dateLabel = formatAppDate(now, appLang, { weekday: 'long', day: 'numeric', month: 'short' });
  const shortDateLabel = formatAppDate(now, appLang, { weekday: 'short', day: 'numeric', month: 'short' });
  const greetingText =
    now.getHours() < 12
      ? t('greetingMorning')
      : now.getHours() < 19
        ? t('greetingAfternoon')
        : t('greetingEvening');
  const doneSessionsCount = todaySessions.filter((s) => s.done).length;
  const uniTip = next
    ? t('uniTips.nextExam', {
        title: next.title,
        course: nextCourse ? ` (${nextCourse.shortName})` : '',
        when: dayWord(daysUntil(next.date), appLang),
      })
    : todaySessions.length > 0
      ? t('uniTips.sessionsLeft', { count: todaySessions.length - doneSessionsCount })
      : t('uniTips.noSessions');

  const greetingHeading = (
    <>
      {greetingText}
      {firstName ? (
        <>
          ,{' '}
          <span className={cx(isMinimal ? 'text-accent-ink' : 'font-serif font-medium italic text-accent')}>
            {firstName}
          </span>
        </>
      ) : (
        <>
          ,{' '}
          <span className={cx(isMinimal ? 'text-accent-ink' : 'font-serif font-medium italic text-accent')}>
            {t('defaultSubtitle')}
          </span>
        </>
      )}
    </>
  );

  return (
    <AnimatedPage className="space-y-4 sm:space-y-5">
      {/* Cabeçalho editorial sem truncamento no telemóvel */}
      <header className="space-y-2 sm:space-y-0">
        <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {!isMinimal && (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pastel-sage/85 ring-1 ring-line/50 dark:bg-surface-2 sm:size-12">
                <UniBuddy
                  mood={streak >= 3 || progressToday >= 1 ? 'celebrate' : 'happy'}
                  accessory={uniAccessory}
                  size={34}
                  onClick={() => {
                    void hapticTap();
                    setUniBubbleOpen((v) => !v);
                  }}
                  ariaLabel={t('uniAria')}
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-muted">
                <span className="sm:hidden">{shortDateLabel}</span>
                <span className="hidden sm:inline">{dateLabel}</span>
                {settings.semesterName.trim() ? ` · ${settings.semesterName.trim()}` : ''}
              </p>
              <h1 className="hidden truncate font-display text-3xl font-bold leading-tight tracking-tight sm:block">
                {greetingHeading}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <TabGuideHelpButton tabKey="dashboard" />
            <Button
              variant="secondary"
              iconOnly
              onClick={() => openUniCheckIn({ kind: 'day' })}
              aria-label={t('openCheckInAria')}
              title={t('openCheckInTitle')}
            >
              <MessageSquare size={18} />
            </Button>
            <Button
              variant="secondary"
              iconOnly
              onClick={() => navigate('/definicoes')}
              aria-label={t('openSettingsAria')}
              title={t('common:nav.settings')}
            >
              <SettingsIcon size={18} />
            </Button>
          </div>
        </div>

        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:hidden">
          {greetingHeading}
        </h1>
      </header>

      <TabGuideBanner tabKey="dashboard" />

      {visibleNudge && (
        <section
          aria-label="Lembrete do Uni"
          className={cx(
            'flex flex-col gap-3 border px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between',
            isMinimal
              ? 'rounded-2xl border-line bg-surface text-fg'
              : 'rounded-3xl border-honey/45 bg-pastel-honey/45 text-fg dark:border-honey/30 dark:bg-surface',
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-honey/20 text-honey-ink dark:text-honey">
              <Bell size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{visibleNudge.title}</p>
              <p className="text-xs text-muted line-clamp-2">{visibleNudge.body}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="primary" onClick={() => handleOpenNudgeRoute(visibleNudge.route)}>
              {visibleNudge.ctaLabel}
            </Button>
            <button
              type="button"
              onClick={() => {
                setDismissedNudgeKey(visibleNudge.key);
                try {
                  sessionStorage.setItem('unipedia_dismissed_inapp_nudge', visibleNudge.key);
                } catch {
                  // noop
                }
              }}
              className="-mr-2 grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              aria-label={t('dismissNudgeAria')}
            >
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Tira Modo Teste em 1 linha compacta logo no topo — leva direto à sessão de hoje / plano */}
      {testMode.mode !== 'normal' && visibleNudge?.kind !== 'exam_prep' && (
        <Link
          to={
            todaySessions.find((s) => !s.done)
              ? `/plano?focus=${encodeURIComponent(todaySessions.find((s) => !s.done)!.id)}`
              : '/plano'
          }
          className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-pastel-peach/80 px-3.5 py-2 text-xs text-[#141312] transition hover:opacity-95 dark:bg-surface-2 dark:text-[#FAF6EC]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={14} className="shrink-0 text-coral" />
            <span className="truncate font-medium">
              <strong className="font-semibold">
                {testMode.mode === 'single_test' ? t('testModeSingle') : t('testModeMulti')}:
              </strong>{' '}
              {testMode.urgentAssessments
                .map((u) => `${u.course.shortName} (${u.daysLeft === 0 ? t('testModeToday') : `${u.daysLeft}d`})`)
                .join(' · ')}
            </span>
          </div>
          <ArrowRight size={14} className="shrink-0" />
        </Link>
      )}

      {/* Balão interativo do Uni ("Clippy" da Unipedia) */}
      <AnimatePresence>
        {uniBubbleOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={UNIPEDIA_BOUNCE_SPRING}
            className="flex items-center justify-between gap-2.5 rounded-3xl border border-line bg-surface p-3.5 shadow-card"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-accent-ink">{t('uniBubbleTitle')}</p>
              <p className="text-xs leading-relaxed text-fg">{uniTip}</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => navigate('/assistente')}>
              {t('talkWithUni')}
            </Button>
            <button
              type="button"
              onClick={() => setUniBubbleOpen(false)}
              aria-label={t('closeSuggestionAria')}
              className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switcher compacto alinhado numa só faixa com a coleção/sequência */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          layoutId="dashboard-scope"
          value={scope}
          onChange={(v) => setScope(v as 'today' | 'week')}
          items={[
            { id: 'today', label: t('scopeToday'), count: todaySessions.length },
            { id: 'week', label: t('scopeWeek') },
          ]}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {streak > 0 && (
            <StickerBadge tone="butter" tilt={-1.5}>
              {streak}d
            </StickerBadge>
          )}
        </div>
      </div>

      <StaggerContainer className="space-y-3.5 sm:space-y-5">
      <ExpeditionTodayCard />
      {topAlert &&
        !(
          testMode.mode !== 'normal' &&
          testMode.urgentAssessments.some((u) => u.assessment.id === topAlert.a.id)
        ) && (
        <StaggerItem>
        <Link
          to="/plano"
          className="flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2.5 transition hover:bg-warn/15"
        >
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1 text-xs sm:text-sm">
            <span className="font-medium">
              {topAlert.a.title} ({topAlert.course?.shortName ?? t('topAlert.fallbackCourse')}) {dayWord(daysUntil(topAlert.a.date), appLang)}
            </span>
            <span className="text-muted">{t('topAlert.prepAt', { pct: pct(topAlert.ready) })}</span>
          </p>
          <ArrowRight size={15} className="shrink-0 text-muted" />
        </Link>
        </StaggerItem>
      )}

      {overdue > 0 && (
        <StaggerItem>
        <Link to="/plano" className="inline-flex min-h-11 items-center gap-2 px-1 text-xs font-medium text-muted hover:text-fg">
          <Clock size={14} className="shrink-0" />
          <span>
            {overdue} {overdue === 1 ? t('overdueSingle') : t('overduePlural')}
          </span>
          <ArrowRight size={12} className="shrink-0" />
        </Link>
        </StaggerItem>
      )}

      {/* Conteúdo principal: Próxima sessão / Foco + Tarefas logo acima da dobra no mobile */}
      <StaggerItem>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <NotebookFocusSheet
            isEmpty={todaySessions.length === 0 && nextStudyDaySessions.length === 0}
            onOpenPlan={() => navigate('/plano')}
            uniAccessory={uniAccessory}
          >
            {courses.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/65 px-3 py-2 text-xs dark:bg-black/20">
                <span className="font-semibold text-fg">
                  {appLang === 'en'
                    ? 'I have:'
                    : appLang === 'es'
                      ? 'Tengo:'
                      : 'Tenho agora:'}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([10, 25, 50] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => startQuickMinutesBlock(mins)}
                      className="min-h-[36px] rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-fg transition hover:border-accent hover:bg-accent-soft/50"
                    >
                      ⚡ {mins} min
                    </button>
                  ))}
                </div>
              </div>
            )}
            {todaySessions.length > 0 ? (
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
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/75 px-3.5 py-2.5 text-xs dark:bg-black/25">
                  <span className="font-semibold text-fg">
                    {t('restBanner.nextPlan', { date: nextStudyDayLabel ?? '' })}
                  </span>
                  <span className="font-mono text-xs text-muted tabular">
                    {nextStudyDaySessions.length === 1
                      ? t('restBanner.blockOne')
                      : t('restBanner.blockMany', { count: nextStudyDaySessions.length })}{' '}
                    ·{' '}
                    {fmtMinutes(nextStudyDaySessions.reduce((acc, s) => acc + sessionMinutes(s), 0))}
                  </span>
                </div>
                <ul className="space-y-2">
                  {nextStudyDaySessions.slice(0, 3).map((s) => {
                    const course = courseById.get(s.courseId);
                    const colorStyle = course ? courseColors[course.color] : courseColors.emerald;
                    return (
                      <li key={s.id}>
                        <Link
                          to="/plano"
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-3.5 py-2.5 transition hover:bg-white dark:bg-black/25 dark:hover:bg-black/35"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cx(
                                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                                  colorStyle.soft,
                                )}
                              >
                                <span className={cx('size-1.5 rounded-full', colorStyle.dot)} />
                                {course?.shortName ?? t('folders.courseFallback')}
                              </span>
                              {s.start && (
                                <span className="font-mono text-xs text-muted tabular">{s.start}</span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-sm font-semibold text-fg">{topicTitle(s)}</p>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-semibold text-muted tabular">
                            {fmtMinutes(sessionMinutes(s))}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {nextStudyDaySessions.length > 3 && (
                  <Link
                    to="/plano"
                    className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-accent-ink hover:underline"
                  >
                    {t('restBanner.seeAllBlocks', { count: nextStudyDaySessions.length })} <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            )}
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
                {t('emptyTasks')}
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
                  <p className="mt-2 px-1 text-xs opacity-75">+{pendingTasks.length - 6}</p>
                )}
              </>
            )}
          </StickyTasksPad>

          {upcoming.length > 0 && (
            <Card title={t('examsTitle')}>
              <ul className="divide-y divide-line">
                {scored.slice(0, 4).map((x) => (
                  <AssessmentRow key={x.a.id} assessment={x.a} course={x.course} ready={x.ready} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {/* Cartão Hero estilo papelaria com métricas inline */}
          <section
            data-tour="bento-overview"
            className={cx(
              'p-4 shadow-card sm:p-5',
              isMinimal
                ? 'rounded-2xl border border-line bg-surface text-fg'
                : 'rounded-3xl bg-pastel-butter/75 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  {scope === 'today' ? t('summaryToday') : t('summaryWeek')}
                </p>
                <h2 className="mt-0.5 font-display text-base font-bold sm:text-lg">
                  {scope === 'today'
                    ? plannedToday > 0
                      ? t('focusedOf', { done: fmtMinutes(doneToday), planned: fmtMinutes(plannedToday) })
                      : nextStudyDayLabel
                        ? t('summaryRestNext', { date: nextStudyDayLabel })
                        : t('summaryRest')
                    : t('weekOf', { done: fmtMinutes(weekMinutes), goal: fmtMinutes(weekGoal) })}
                </h2>
              </div>
              <Button
                iconOnly
                variant="secondary"
                onClick={() => navigate('/plano')}
                aria-label={t('openPlan')}
              >
                <CalendarDays size={16} />
              </Button>
            </div>

            {courses.length > 0 || todaySessions.length > 0 || pendingTasks.length > 0 ? (
              <>
                <div className="mt-3 grid grid-cols-4 gap-2 text-left sm:mt-4">
                  <div>
                    <p className="text-xs font-medium opacity-75">{t('avgLabel')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular sm:text-2xl">
                      {fmtGrade(average, gradingScale, appLang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium opacity-75">{t('summaryMetrics.week')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular sm:text-2xl">{weekPct}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium opacity-75">{t('summaryMetrics.sessions')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular sm:text-2xl">
                      {doneSessionsCount}/{todaySessions.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium opacity-75">{t('summaryMetrics.exams')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular sm:text-2xl">{upcoming.length}</p>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs font-medium opacity-80">
                    <span>
                      {scope === 'today' ? t('summaryMetrics.todayProgress') : t('summaryMetrics.weekGoal')}
                    </span>
                    <span className="tabular">{scope === 'today' ? pct(progressToday) : `${weekPct}%`}</span>
                  </div>
                  <Progress
                    value={scope === 'today' ? progressToday : weekPct / 100}
                    color="bg-[#141312] dark:bg-accent"
                  />
                </div>
              </>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                <Button size="sm" variant="primary" onClick={() => navigate('/cadeiras')}>
                  {t('summaryMetrics.addCoursesBtn')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => navigate('/plano')}>
                  {t('summaryMetrics.createPlanBtn')}
                </Button>
              </div>
            )}
          </section>

          {courses.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-display text-base font-bold">{t('folders.heading')}</h2>
                <Link
                  to="/cadeiras"
                  className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-accent-ink hover:underline"
                >
                  {t('folders.seeAll')}
                </Link>
              </div>
              <FolderCardDeck courses={courses} onOpenCourse={(id) => navigate(`/cadeiras/${id}`)} />
            </div>
          )}

          <AgendaRibbonCard dateBadge={formatAppDate(now, appLang, { day: 'numeric', month: 'short' })} isEmpty={agenda.length === 0}>
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
                      {item.allDay ? t('agendaCard.allDayLabel') : item.start}
                    </div>
                    <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-white/80 dark:ring-black/30', item.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs opacity-75">
                        {[item.allDay ? t('agendaCard.allDayLongLabel') : `${item.start}–${item.end}`, item.sub]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {isNow && <span className="text-xs font-semibold text-accent-ink">{t('agendaCard.nowLabel')}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </AgendaRibbonCard>

          <AcademicGmailWidget hideWhenEmpty />
        </div>
      </div>
      </StaggerItem>

      {/* Primeiros passos recolhido para baixo da ação principal no Hoje */}
      {!settings.hubSetupDismissed && !hubProgress.allReady && (
        <StaggerItem>
          {hubProgress.readyCount >= 2 ? (
            <div
              aria-label={t('firstSteps.ariaLabel')}
              className={cx(
                'flex min-h-11 items-center justify-between gap-2 py-1 pr-1 pl-3.5 shadow-card',
                isMinimal
                  ? 'rounded-2xl border border-line bg-surface text-fg'
                  : 'rounded-2xl bg-pastel-sage/50 text-[#141312] dark:bg-surface dark:text-fg dark:ring-1 dark:ring-white/10',
              )}
            >
              <button
                type="button"
                onClick={() => openHubModal(null)}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold"
              >
                <Sparkles size={14} className="shrink-0 text-accent" />
                <span className="truncate">
                  {t('firstSteps.title', { flow: hubProgress.flow.shortLabel })} · {t('firstSteps.connected', { ready: hubProgress.readyCount, total: hubProgress.totalCount })}
                </span>
                <span className="hidden shrink-0 rounded-full bg-surface/85 px-2 py-0.5 text-xs font-bold text-accent-ink dark:bg-surface-2 sm:inline-flex">
                  {t('firstSteps.badgeComplete')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ hubSetupDismissed: true })}
                aria-label={t('firstSteps.dismissAria')}
                title={t('firstSteps.dismissTitle')}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface/70 hover:text-fg"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <section
              aria-label={t('firstSteps.ariaLabel')}
              className={cx(
                'p-4 shadow-card',
                isMinimal
                  ? 'rounded-2xl border border-line bg-surface text-fg'
                  : 'rounded-3xl bg-pastel-sage/55 text-[#141312] dark:bg-surface dark:text-fg dark:ring-1 dark:ring-white/10',
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <h2 className="font-display text-base font-bold">
                      {t('firstSteps.title', { flow: hubProgress.flow.shortLabel })}
                    </h2>
                    <span className="text-xs font-semibold tabular-nums text-accent-ink">
                      {t('firstSteps.connected', { ready: hubProgress.readyCount, total: hubProgress.totalCount })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-85">
                    {t('firstSteps.body')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                  <Button size="sm" variant="primary" onClick={() => openHubModal(null)}>
                    <Sparkles size={13} /> {t('firstSteps.cta')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ hubSetupDismissed: true })}
                    aria-label={t('firstSteps.dismissAria')}
                    title={t('firstSteps.dismissTitle')}
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
                      ? t('firstSteps.chips.schedule')
                      : step.key === 'assessments'
                        ? t('firstSteps.chips.assessments')
                        : step.key === 'drive_hd'
                          ? t('firstSteps.chips.driveHd')
                          : t('firstSteps.chips.uniNotebook');
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => openHubModal(step.key)}
                      className={cx(
                        'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                        step.ready
                          ? 'border-ok/35 bg-ok/10 text-ok-ink'
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
        </StaggerItem>
      )}
      </StaggerContainer>

      <Modal
        open={undoSession !== null}
        onClose={() => setUndoSession(null)}
        title={t('undoModal.title')}
      >
        {undoSession && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('undoModal.body', {
                title: topicTitle(undoSession),
                minutes: fmtMinutes(sessionMinutes(undoSession)),
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setUndoSession(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = undoSession;
                  setUndoSession(null);
                  applySessionToggle(target, false);
                }}
              >
                {t('undoModal.confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AnimatedPage>
  );
}
