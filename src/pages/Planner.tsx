import { addDays, format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDateFnsLocale } from '../lib/grading';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AnimatedPage,
  BentoMetricTile,
  WeekDayPills,
} from '../components/motion/Primitives';
import { celebrateStationery } from '../lib/motionTokens';
import CourseDistribution from '../components/planner/CourseDistribution';
import DayColumn from '../components/planner/DayColumn';
import FocusResumeCard from '../components/planner/FocusResumeCard';
import PlanConscienceCard from '../components/planner/PlanConscienceCard';
import WeekCheckCard from '../components/planner/WeekCheckCard';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { resolveUniAccessory } from '../lib/uniAccessories';

const WeeklyTutorModal = lazy(() => import('../components/assistant/WeeklyTutorModal'));
const ActiveReviewModal = lazy(() => import('../components/practice/ActiveReviewModal'));
const PlanPreferencesSheet = lazy(() => import('../components/planner/PlanPreferencesSheet'));
const SessionModal = lazy(() => import('../components/planner/SessionModal'));
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import { ActionSheet, Badge, Button, Card, CourseChip, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { showToast } from '../lib/uiHelpers';
import { weekdayShort } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { computeExtraActivityPenaltyByWeekday } from '../lib/academicCredits';
import {
  analyzePlanConscience,
  analyzeTestMode,
  computeDayBudget,
  findFirstFreeSlotOnDate,
  planSummary,
  rescheduleOverdueSessions,
  resolveDayPlanProfile,
} from '../lib/planner';
import { getDueReviewQueue } from '../lib/spacedRepetition';
import { capitalizeFirst, fmtMinutes, formatSessionDisplay, sessionMinutes, todayStr } from '../lib/selectors';
import { useHubUiStore } from '../store/useHubUiStore';
import { useStore } from '../store/useStore';
import { consumeSilentPlanAdjust } from '../store/planUndo';
import {
  DEFAULT_PLANNER_PREFS,
  maxDailyMinutes,
  minutesForWeekday,
  resolvePlannerPrefs,
  weeklyStudyMinutes,
} from '../lib/planner/availability';
import type { Course, StudySession } from '../types';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const TEST_MODE_ACK_KEY = 'uni-test-mode-ack-v1';
const WEEK_CHECK_ACK_KEY = 'uni-week-check-ack-v1';

function readStoredFlag(key: string): string {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) ?? '' : '';
  } catch {
    return '';
  }
}

function writeStoredFlag(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

function studyDaysLabel(days: number[], emptyLabel: string): string {
  const ordered = DAY_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return emptyLabel;
  const pos = ordered.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1);
  if (ordered.length > 2 && contiguous) {
    return `${weekdayShort[ordered[0]]}–${weekdayShort[ordered[ordered.length - 1]]}`;
  }
  return ordered.map((d) => weekdayShort[d]).join(', ');
}

export default function Planner() {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const events = useStore((s) => s.events);
  const materials = useStore((s) => s.materials);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const replan = useStore((s) => s.replan);
  const updateSettings = useStore((s) => s.updateSettings);
  const upsertMany = useStore((s) => s.upsertMany);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const today = useMemo(() => todayStr(), []);
  // Recálculos silenciosos (acabar um foco, prática) avisam-se aqui, sem interromper quem estudava.
  useEffect(() => {
    if (consumeSilentPlanAdjust()) showToast(t('replan.adjusted'), 'neutral');
  }, [t]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [modal, setModal] = useState<{ session?: StudySession; date: string; defaultStart?: string } | null>(null);
  const openFocus = useHubUiStore((st) => st.openFocus);
  const setFocusId = (id: string) => openFocus(id);
  // Ligações antigas e notificações abrem o foco com ?focus=<id>.
  useEffect(() => {
    const fromUrl = searchParams.get('focus');
    if (!fromUrl) return;
    openFocus(fromUrl);
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [openFocus, searchParams, setSearchParams]);

  const dueReviewCount = useMemo(
    () => getDueReviewQueue(courses, today).length,
    [courses, today],
  );

  const plannerPrefs = settings.plannerPrefs;
  const plannerMode = plannerPrefs?.plannerMode ?? 'auto';
  const switchPlannerMode = (nextMode: 'auto' | 'manual') => {
    if (nextMode === plannerMode) return;
    void hapticTap();
    updateSettings(
      {
        plannerPrefs: {
          ...(plannerPrefs ?? DEFAULT_PLANNER_PREFS),
          plannerMode: nextMode,
        },
      },
      { replan: false },
    );
    showToast(t(nextMode === 'manual' ? 'mode.switchedManual' : 'mode.switchedAuto'), 'neutral');
  };
  const extraPenaltyByWeekday = useMemo(
    () => computeExtraActivityPenaltyByWeekday(academicProfile.extraActivities ?? []),
    [academicProfile.extraActivities],
  );

  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today, plannerPrefs?.pausedCourseIds),
    [courses, assessments, today, plannerPrefs?.pausedCourseIds],
  );
  const urgentSignature = useMemo(
    () =>
      testMode.urgentAssessments
        .map((u) => `${u.assessment.id}:${u.assessment.date.slice(0, 10)}`)
        .join('|'),
    [testMode.urgentAssessments],
  );
  const [ackedTestSig, setAckedTestSig] = useState(() => readStoredFlag(TEST_MODE_ACK_KEY));
  const [testModeOpenOverride, setTestModeOpenOverride] = useState<boolean | null>(null);
  const testModeExpanded =
    testMode.mode !== 'normal' &&
    (testModeOpenOverride ?? (Boolean(urgentSignature) && ackedTestSig !== urgentSignature));
  const acknowledgeTestMode = () => {
    if (urgentSignature) {
      writeStoredFlag(TEST_MODE_ACK_KEY, urgentSignature);
      setAckedTestSig(urgentSignature);
    }
    setTestModeOpenOverride(false);
  };

  const [ackedWeekSig, setAckedWeekSig] = useState(() => readStoredFlag(WEEK_CHECK_ACK_KEY));
  const [weekCheckOpenOverride, setWeekCheckOpenOverride] = useState<boolean | null>(null);
  const [mountNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [conscienceDismissedIds, setConscienceDismissedIds] = useState<Set<string>>(() => new Set());
  const [conscienceOpenOverride, setConscienceOpenOverride] = useState<boolean | null>(null);
  const conscienceReport = useMemo(
    () =>
      analyzePlanConscience({
        courses,
        assessments,
        classes,
        events,
        materials,
        sessions,
        settings,
        extraActivities: academicProfile.extraActivities,
        weeklyCheckIns,
        today,
        nowMinutes: mountNowMinutes,
      }),
    [
      courses,
      assessments,
      classes,
      events,
      materials,
      sessions,
      settings,
      academicProfile.extraActivities,
      weeklyCheckIns,
      today,
      mountNowMinutes,
    ],
  );
  const visibleConscienceCount = useMemo(
    () => conscienceReport.opinions.filter((op) => !conscienceDismissedIds.has(op.id)).length,
    [conscienceReport.opinions, conscienceDismissedIds],
  );
  const conscienceExpanded =
    conscienceReport.status !== 'empty' &&
    (conscienceOpenOverride ?? visibleConscienceCount > 0);
  const uniAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile?.degreeName,
    courses[0]?.name,
  );

  const [anchorDate] = useState(() => new Date());
  const weekDays = useMemo(() => {
    const start = addDays(anchorDate, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate, weekOffset]);

  const weekKeys = useMemo(() => weekDays.map((d) => format(d, 'yyyy-MM-dd')), [weekDays]);
  const weekFrom = weekKeys[0];
  const weekTo = weekKeys[6];
  const activeDayKey = weekKeys.includes(selectedDayKey)
    ? selectedDayKey
    : weekKeys.includes(today)
      ? today
      : weekKeys[0];

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const topicById = useMemo(
    () => new Map(courses.flatMap((c) => c.topics.map((t) => [t.id, t] as const))),
    [courses],
  );
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')),
    [sessions],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of sorted) {
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return map;
  }, [sorted]);

  const weekSessions = useMemo(
    () => sorted.filter((s) => s.date >= weekFrom && s.date <= weekTo),
    [sorted, weekFrom, weekTo],
  );

  const overdue = useMemo(() => sorted.filter((s) => !s.done && s.date < today), [sorted, today]);
  const overdueGroups = useMemo(() => {
    const groups = new Map<string, { course?: Course; items: StudySession[] }>();
    for (const s of overdue) {
      const cur = groups.get(s.courseId);
      if (cur) cur.items.push(s);
      else groups.set(s.courseId, { course: courseById.get(s.courseId), items: [s] });
    }
    return [...groups.entries()];
  }, [overdue, courseById]);

  const stats = useMemo(() => {
    const planned = weekSessions.reduce((sum, s) => sum + s.minutes, 0);
    const done = weekSessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
    const doneCount = weekSessions.filter((s) => s.done).length;
    const pct = weekSessions.length > 0 ? Math.round((doneCount / weekSessions.length) * 100) : 0;
    return { planned, done, pct };
  }, [weekSessions]);

  const distribution = useMemo(
    () => planSummary(weekSessions, courses).filter((r) => r.planned > 0),
    [weekSessions, courses],
  );

  const noPlanInputs = courses.length === 0;
  const starterOnlyMode = courses.length > 0 && !assessments.some((a) => a.grade === undefined);
  const currentWeekAckSig = weekKeys[0] ?? today;
  const weekCheckExpanded =
    !noPlanInputs &&
    (weekCheckOpenOverride ??
      (!plannerPrefs?.briefingAppliedAt && ackedWeekSig !== currentWeekAckSig));
  const acknowledgeWeekCheck = () => {
    writeStoredFlag(WEEK_CHECK_ACK_KEY, currentWeekAckSig);
    setAckedWeekSig(currentWeekAckSig);
    setWeekCheckOpenOverride(false);
  };
  // Disponibilidade legível («Seg–Sáb · até 5 h por dia»), sempre a partir do horário por dia.
  const resolvedSchedule = resolvePlannerPrefs(settings).weekdaySchedule ?? {};
  const scheduleDays = DAY_ORDER.filter((d) => minutesForWeekday(resolvedSchedule, d) > 0);
  const scheduleMinutes = scheduleDays.map((d) => minutesForWeekday(resolvedSchedule, d));
  const weeklyGoalMinutes = weeklyStudyMinutes(resolvedSchedule);
  const availabilitySummary =
    scheduleDays.length === 0
      ? t('ui.noStudyDays')
      : t(new Set(scheduleMinutes).size === 1 ? 'ui.availSame' : 'ui.availUpTo', {
          days: studyDaysLabel(scheduleDays, t('ui.noStudyDays')),
          time: fmtMinutes(maxDailyMinutes(resolvedSchedule)),
        });

  const futureGeneratedCount = () =>
    useStore.getState().sessions.filter((x) => x.generated && !x.done && x.date >= today).length;

  const openNewSession = (targetDate: string) => {
    const wd = parseISO(targetDate).getDay();
    const avail = resolvePlannerPrefs(settings).weekdaySchedule?.[String(wd)];
    const currentNow = new Date();
    const freeStart = findFirstFreeSlotOnDate({
      dateKey: targetDate,
      minutes: plannerPrefs?.blockMinutes ?? 50,
      preferredPeriod: avail?.window ?? plannerPrefs?.preferredPeriod ?? 'auto',
      nowMinutes:
        targetDate === today ? currentNow.getHours() * 60 + currentNow.getMinutes() : undefined,
      classes,
      events,
      existingSessions: sessions,
      blockedPeriods: avail?.blockedPeriods,
      assessments,
    });
    setModal({ date: targetDate, defaultStart: freeStart ?? undefined });
  };

  /** Atualizar/gerar plano: mesmo em modo manual, só gera quando pedido explicitamente. */
  const generate = () => {
    void hapticTap();
    const changed = replan('manual', { force: true, allowInManualMode: true });
    celebrateStationery();
    if (!changed) showToast(t('ui.toastGenerated', { count: futureGeneratedCount() }), 'ok');
  };

  const toggleSessionLock = (session: StudySession) => {
    void hapticTap();
    patch('sessions', session.id, { locked: !session.locked });
  };

  const quickMoveSession = (session: StudySession, targetDate: string) => {
    void hapticTap();
    const wd = parseISO(targetDate).getDay();
    const avail = plannerPrefs?.weekdaySchedule?.[String(wd)];
    const currentNow = new Date();
    const slot = findFirstFreeSlotOnDate({
      dateKey: targetDate,
      minutes: session.minutes,
      preferredPeriod: avail?.window ?? plannerPrefs?.preferredPeriod ?? 'auto',
      nowMinutes: targetDate === today ? currentNow.getHours() * 60 + currentNow.getMinutes() : undefined,
      classes,
      events,
      existingSessions: sessions.filter((x) => x.id !== session.id),
      blockedPeriods: avail?.blockedPeriods,
    });
    if (!slot) {
      showToast(
        t('session.noSlotDay', { date: format(parseISO(targetDate), 'd MMM', { locale: dfLocale }) }),
        'neutral',
      );
      return;
    }
    patch('sessions', session.id, { date: targetDate, start: slot, locked: true });
    showToast(
      t('session.movedTo', {
        date: format(parseISO(targetDate), 'd MMM', { locale: dfLocale }),
        time: slot,
      }),
      'ok',
    );
  };

  const onGenerate = () => (sessions.length > 0 ? generate() : setPrefsOpen(true));

  /** Encaixa uma sessão hoje numa hora livre (fixada, para o recálculo não a apagar). */
  const placeToday = (session: StudySession, others: StudySession[]): StudySession | null => {
    const now = new Date();
    const avail = resolvePlannerPrefs(settings).weekdaySchedule?.[String(new Date().getDay())];
    const slot = findFirstFreeSlotOnDate({
      dateKey: today,
      minutes: session.minutes,
      preferredPeriod: avail?.window ?? 'auto',
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      classes,
      events,
      existingSessions: others.filter((x) => x.id !== session.id),
      blockedPeriods: avail?.blockedPeriods,
      assessments,
    });
    return slot ? { ...session, date: today, start: slot, locked: true } : null;
  };

  const moveOneToToday = (session: StudySession) => {
    void hapticTap();
    const moved = placeToday(session, sessions.filter((x) => x.date === today));
    if (!moved) {
      showToast(t('ui.noRoom'), 'neutral');
      return;
    }
    patch('sessions', session.id, { date: moved.date, start: moved.start, locked: true });
    showToast(t('ui.movedToday'), 'ok');
  };

  const moveAllToToday = () => {
    void hapticTap();
    const placed: StudySession[] = [];
    for (const s of overdue) {
      const moved = placeToday(s, [...sessions.filter((x) => x.date === today), ...placed]);
      if (moved) placed.push(moved);
    }
    if (placed.length > 0) upsertMany('sessions', placed);
    showToast(
      placed.length === overdue.length
        ? t('ui.movedToday')
        : t('ui.rescheduledPartial', { count: placed.length, left: overdue.length - placed.length }),
      placed.length > 0 ? 'ok' : 'neutral',
    );
  };

  const rescheduleOverdueSmart = () => {
    void hapticTap();
    const now = new Date();
    const { updated, unscheduledCount } = rescheduleOverdueSessions({
      overdue,
      existing: sessions.filter((s) => s.date >= today),
      classes,
      events,
      assessments,
      settings,
      from: today,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      days: plannerPrefs?.horizonDays ?? 14,
      preferredPeriod: plannerPrefs?.preferredPeriod ?? 'auto',
      weekdaySchedule: plannerPrefs?.weekdaySchedule,
      preExamMarathon: plannerPrefs?.preExamMarathon,
      pausedCourseIds: plannerPrefs?.pausedCourseIds,
    });
    if (updated.length > 0) {
      upsertMany('sessions', updated);
      showToast(
        unscheduledCount > 0
          ? t('ui.rescheduledPartial', { count: updated.length, left: unscheduledCount })
          : t('ui.rescheduledAll', { count: updated.length }),
        'ok',
      );
    } else {
      showToast(t('ui.noRoom'), 'neutral');
    }
  };

  const weekLabel = `${format(weekDays[0], 'd MMM', { locale: dfLocale })} – ${format(weekDays[6], 'd MMM yyyy', { locale: dfLocale })}`;

  const pillDays = useMemo(
    () =>
      weekDays.map((d, i) => {
        const key = weekKeys[i];
        const daySessions = byDay.get(key) ?? [];
        const hasPending = daySessions.some((s) => !s.done);
        const allDone = daySessions.length > 0 && !hasPending;
        return {
          key,
          shortLabel: weekdayShort[d.getDay()],
          dayNumber: format(d, 'd'),
          isToday: key === today,
          dotTone: hasPending ? ('coral' as const) : allDone ? ('accent' as const) : ('none' as const),
          count: daySessions.length,
        };
      }),
    [weekDays, weekKeys, byDay, today],
  );

  const selectedIndex = Math.max(0, weekKeys.indexOf(activeDayKey));
  const selectedDate = weekDays[selectedIndex];

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow={t('plannerEyebrow')}
        title={t('plannerTitle')}
        accentTitle={t('plannerAccent')}
        subtitle={availabilitySummary}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TabGuideHelpButton tabKey="plano" />
            {plannerMode === 'manual' ? (
              <Button
                variant="primary"
                onClick={() => openNewSession(activeDayKey)}
                disabled={noPlanInputs}
              >
                <Plus size={16} /> {t('ui.newSession')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={onGenerate}
                disabled={noPlanInputs}
              >
                <Sparkles size={16} /> {sessions.length > 0 ? t('updatePlan') : t('generatePlan')}
              </Button>
            )}
            <Button
              variant="secondary"
              iconOnly
              onClick={() => setActionsOpen(true)}
              aria-label={t('ui.moreActionsAria')}
              title={t('ui.moreActions')}
            >
              <MoreHorizontal size={18} />
            </Button>
          </div>
        }
      />

      <TabGuideBanner tabKey="plano" />

      {!noPlanInputs && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {testMode.mode !== 'normal' && !testModeExpanded && (
              <button
                type="button"
                onClick={() => setTestModeOpenOverride(true)}
                aria-label={t('ui.testModeExpandAria', { count: testMode.urgentAssessments.length })}
                title={t('ui.testModeExpandAria', { count: testMode.urgentAssessments.length })}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-coral/40 bg-pastel-blush/75 px-3 text-xs font-semibold text-[#141312] transition hover:border-coral dark:bg-surface-2 dark:text-[#FAF6EC]"
              >
                <Flame size={16} className="text-coral" aria-hidden="true" />
                <span className="tabular">{testMode.urgentAssessments.length}</span>
              </button>
            )}

            {!weekCheckExpanded && (
              <button
                type="button"
                onClick={() => setWeekCheckOpenOverride(true)}
                aria-label={t('weekCheck.compactOpenAria')}
                title={t('weekCheck.compactOpenAria')}
                className="relative inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-xs font-medium text-fg transition hover:border-accent"
              >
                <MessageSquareText size={16} className="text-accent" aria-hidden="true" />
                {plannerPrefs?.briefingNote && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-ok" aria-hidden="true" />
                )}
              </button>
            )}

            {conscienceReport.status !== 'empty' && !conscienceExpanded && (
              <button
                type="button"
                onClick={() => setConscienceOpenOverride(true)}
                aria-label={t('conscience.compactAria')}
                title={t('conscience.compactAria')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-fg transition hover:border-accent"
              >
                <UniBuddy
                  size={20}
                  accessory={uniAccessory}
                  skin={settings.uniSkin ?? 'classic'}
                  mood={visibleConscienceCount > 0 ? 'calm' : 'happy'}
                  interactive={false}
                />
                {visibleConscienceCount > 0 && (
                  <span className="rounded-md bg-warn/20 px-1.5 py-0.5 text-xs font-bold text-warn tabular">
                    {visibleConscienceCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <SegmentedControl
            layoutId="planner-control-mode"
            value={plannerMode}
            onChange={(v) => switchPlannerMode(v as 'auto' | 'manual')}
            items={[
              { id: 'auto', label: t('mode.auto') },
              { id: 'manual', label: t('mode.manual') },
            ]}
          />
        </div>
      )}

      {testModeExpanded && (
        <section
          className={
            testMode.mode === 'single_test'
              ? 'space-y-2.5 rounded-3xl bg-pastel-butter/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
              : 'space-y-2.5 rounded-3xl bg-pastel-blush/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-surface/80 text-coral dark:bg-black/25">
                <Flame size={16} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">
                {testMode.mode === 'single_test'
                  ? t('testModeSingleTitle')
                  : t('testModeMultiTitle', { count: testMode.urgentCourseIds.length })}
              </span>
              <Badge tone={testMode.mode === 'single_test' ? 'warn' : 'danger'}>
                {testMode.mode === 'single_test' ? t('testModeFocusBadge') : t('testModeBalanceBadge')}
              </Badge>
            </div>
            <button
              type="button"
              onClick={acknowledgeTestMode}
              aria-label={t('ui.testModeCollapseAria')}
              title={t('ui.testModeCollapseAria')}
              className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-[#141312]/70 transition hover:bg-black/10 hover:text-[#141312] dark:text-[#FAF6EC]/70 dark:hover:bg-white/10 dark:hover:text-[#FAF6EC]"
            >
              <X size={16} />
            </button>
          </div>

          <ul className="space-y-1.5">
            {testMode.urgentAssessments.map((u) => {
              const when =
                u.daysLeft === 0
                  ? t('session.today')
                  : u.daysLeft === 1
                    ? t('session.tomorrow')
                    : t('session.inDays', { n: u.daysLeft });
              return (
                <li
                  key={u.assessment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface/75 px-3 py-1.5 dark:bg-black/20"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">
                    {t('testModeLine', {
                      course: u.course.shortName,
                      title: u.assessment.title,
                      when,
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      acknowledgeTestMode();
                      openUniCheckIn({
                        kind: 'exam_prep',
                        assessmentId: u.assessment.id,
                        courseId: u.course.id,
                      });
                    }}
                  >
                    {t('alignShort')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {starterOnlyMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-pastel-sage/75 px-4 py-3 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-bold">{t('starterModeTitle')}</span> {t('starterModeBody')}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useHubUiStore.getState().openModal('assessments')}
          >
            {t('addExamsBtn')}
          </Button>
        </div>
      )}

      <FocusResumeCard />

      {weekCheckExpanded && (
        <WeekCheckCard
          initialOpen={Boolean(weekCheckOpenOverride)}
          onCollapse={acknowledgeWeekCheck}
        />
      )}

      {!noPlanInputs && conscienceExpanded && (
        <PlanConscienceCard
          today={today}
          report={conscienceReport}
          dismissedIds={conscienceDismissedIds}
          onDismiss={(id) =>
            setConscienceDismissedIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })
          }
          onCollapse={() => setConscienceOpenOverride(false)}
        />
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={noPlanInputs ? t('ui.emptyNoCourses') : t('ui.emptyNoPlan')}
          hint={
            noPlanInputs
              ? t('ui.emptyNoCoursesHint')
              : plannerMode === 'manual'
                ? t('mode.emptyManualHint')
                : t('ui.emptyNoPlanHint')
          }
          action={
            noPlanInputs ? (
              <Button variant="primary" onClick={() => navigate('/cadeiras')}>
                {t('ui.goCourses')}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant={plannerMode === 'manual' ? 'primary' : 'secondary'}
                  onClick={() => openNewSession(today)}
                  disabled={courses.length === 0}
                >
                  <Plus size={16} /> {t('ui.newSession')}
                </Button>
                <Button
                  variant={plannerMode === 'manual' ? 'secondary' : 'primary'}
                  onClick={plannerMode === 'manual' ? generate : onGenerate}
                >
                  <Sparkles size={16} />{' '}
                  {plannerMode === 'manual' ? t('mode.suggestWeekBtn') : t('generatePlan')}
                </Button>
              </div>
            )
          }
        />
      ) : (
        <>
          {overdue.length > 0 && (
            <Card
              className="border-warn/40"
              title={t('ui.overdueTitle', { count: overdue.length })}
              action={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="primary" onClick={rescheduleOverdueSmart}>
                    <Sparkles size={13} /> {t('ui.smartReschedule')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={moveAllToToday}>
                    {t('ui.moveToday')}
                  </Button>
                </div>
              }
            >
              <div className="space-y-4">
                {overdueGroups.map(([courseId, group]) => {
                  const groupMinutes = group.items.reduce((sum, x) => sum + x.minutes, 0);
                  return (
                    <div key={courseId} className="space-y-2 rounded-2xl border border-line/70 bg-surface-2/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <CourseChip course={group.course} />
                        <span className="text-xs font-medium text-muted tabular">
                          {group.items.length} · {fmtMinutes(groupMinutes)}
                        </span>
                      </div>
                      <ul className="divide-y divide-line">
                        {group.items.map((s) => {
                          const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                          return (
                            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs tabular whitespace-nowrap text-muted">
                                  {format(parseISO(s.date), 'EEE d MMM', { locale: dfLocale })} · {s.minutes} min
                                </p>
                                <p className="mt-0.5 truncate text-sm font-medium">
                                  {formatSessionDisplay(s, topic, i18n.language).title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => moveOneToToday(s)}>
                                  {t('ui.moveToday')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => remove('sessions', s.id)}>
                                  {t('ui.discard')}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  iconOnly
                  variant="ghost"
                  aria-label={t('ui.prevWeek')}
                  onClick={() => setWeekOffset((w) => w - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="font-display text-sm font-bold">{capitalizeFirst(weekLabel)}</span>
                <Button
                  size="sm"
                  iconOnly
                  variant="ghost"
                  aria-label={t('ui.nextWeek')}
                  onClick={() => setWeekOffset((w) => w + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
                {weekOffset !== 0 && (
                  <Button size="sm" variant="secondary" onClick={() => { setWeekOffset(0); setSelectedDayKey(today); }}>
                    {t('ui.today')}
                  </Button>
                )}
              </div>

              <div className="lg:hidden">
                <SegmentedControl
                  layoutId="planner-view-mode"
                  value={viewMode}
                  onChange={(v) => setViewMode(v as 'day' | 'week')}
                  items={[
                    { id: 'day', label: t('ui.day') },
                    { id: 'week', label: t('ui.week') },
                  ]}
                />
              </div>
            </div>

            <WeekDayPills
              days={pillDays}
              selectedKey={activeDayKey}
              onSelect={(key) => setSelectedDayKey(key)}
            />

            {/* Mobile: por defeito apenas o dia selecionado; opcionalmente semana completa */}
            <div className={viewMode === 'day' ? 'lg:hidden' : 'hidden'}>
              {(() => {
                const profile = resolveDayPlanProfile({
                  dateKey: activeDayKey,
                  weekday: selectedDate.getDay(),
                  settings,
                  assessments,
                  pausedCourseIds: plannerPrefs?.pausedCourseIds,
                  weekdaySchedule: plannerPrefs?.weekdaySchedule,
                  preferredPeriod: plannerPrefs?.preferredPeriod,
                  preExamMarathon: plannerPrefs?.preExamMarathon,
                  dateOverrides: plannerPrefs?.dateOverrides,
                });
                const dayBudget = computeDayBudget({
                  dateKey: activeDayKey,
                  weekday: selectedDate.getDay(),
                  dayProfile: profile,
                  classes,
                  events,
                  extraPenaltyMinutes: extraPenaltyByWeekday.get(selectedDate.getDay()) ?? 0,
                  latestCheckInMood: weeklyCheckIns[0]?.mood,
                });
                return (
                  <DayColumn
                    date={selectedDate}
                    sessions={byDay.get(activeDayKey) ?? []}
                    budget={dayBudget.budget}
                    budgetReason={dayBudget.reducedReason}
                    isToday={activeDayKey === today}
                    isPast={activeDayKey < today}
                    isStudyDay={profile.enabled}
                    isMarathonDay={profile.isMarathonDay}
                    weekDates={weekKeys}
                    courseById={courseById}
                    topicById={topicById}
                    assessmentById={assessmentById}
                    materialById={materialById}
                    onFocus={(s) => setFocusId(s.id)}
                    onEdit={(s) => setModal({ session: s, date: s.date })}
                    onAdd={openNewSession}
                    onToggleLock={toggleSessionLock}
                    onQuickMove={quickMoveSession}
                  />
                );
              })()}
            </div>

            <div
              className={
                viewMode === 'week'
                  ? 'grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'hidden lg:grid lg:grid-cols-3 lg:gap-3 xl:grid-cols-4'
              }
            >
              {weekDays.map((d, i) => {
                const key = weekKeys[i];
                const profile = resolveDayPlanProfile({
                  dateKey: key,
                  weekday: d.getDay(),
                  settings,
                  assessments,
                  pausedCourseIds: plannerPrefs?.pausedCourseIds,
                  weekdaySchedule: plannerPrefs?.weekdaySchedule,
                  preferredPeriod: plannerPrefs?.preferredPeriod,
                  preExamMarathon: plannerPrefs?.preExamMarathon,
                  dateOverrides: plannerPrefs?.dateOverrides,
                });
                const dayBudget = computeDayBudget({
                  dateKey: key,
                  weekday: d.getDay(),
                  dayProfile: profile,
                  classes,
                  events,
                  extraPenaltyMinutes: extraPenaltyByWeekday.get(d.getDay()) ?? 0,
                  latestCheckInMood: weeklyCheckIns[0]?.mood,
                });
                return (
                  <DayColumn
                    key={key}
                    date={d}
                    sessions={byDay.get(key) ?? []}
                    budget={dayBudget.budget}
                    budgetReason={dayBudget.reducedReason}
                    isToday={key === today}
                    isPast={key < today}
                    isStudyDay={profile.enabled}
                    isMarathonDay={profile.isMarathonDay}
                    weekDates={weekKeys}
                    courseById={courseById}
                    topicById={topicById}
                    assessmentById={assessmentById}
                    materialById={materialById}
                    onFocus={(s) => setFocusId(s.id)}
                    onEdit={(s) => setModal({ session: s, date: s.date })}
                    onAdd={openNewSession}
                    onToggleLock={toggleSessionLock}
                    onQuickMove={quickMoveSession}
                  />
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BentoMetricTile
              tone="sage"
              label={t('ui.planned')}
              value={fmtMinutes(stats.planned)}
              hint={t('ui.sessionsWeek', { count: weekSessions.length })}
              icon={<Clock size={15} />}
            />
            <BentoMetricTile
              tone="mint"
              label={t('ui.done')}
              value={fmtMinutes(stats.done)}
              hint={t('ui.pctWeek', { pct: stats.pct })}
            />
            <BentoMetricTile
              tone="butter"
              label={t('ui.weeklyGoal')}
              value={fmtMinutes(weeklyGoalMinutes)}
              hint={availabilitySummary}
            />
            <BentoMetricTile
              tone={overdue.length > 0 ? 'peach' : 'sky'}
              label={t('ui.overdue')}
              value={overdue.length}
              hint={overdue.length > 0 ? t('ui.toReschedule') : t('ui.allGood')}
              icon={<AlertTriangle size={15} className={overdue.length > 0 ? 'text-coral' : undefined} />}
            />
          </div>

          <Card title={t('ui.distribution')}>
            {distribution.length > 0 ? (
              <CourseDistribution rows={distribution} courseById={courseById} />
            ) : (
              <EmptyState
                icon={<CalendarDays size={24} />}
                title={t('ui.noWeekSessions')}
                hint={t('ui.noWeekSessionsHint')}
              />
            )}
          </Card>
        </>
      )}

      <ActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={t('ui.actionsTitle')}
        actions={[
          {
            id: 'new',
            label: t('ui.newManual'),
            hint: t('ui.addBlockOn', { date: format(selectedDate, 'd MMM', { locale: dfLocale }) }),
            icon: <Plus size={16} />,
            onSelect: () => {
              if (courses.length === 0) {
                showToast(t('ui.addCourseFirst'), 'neutral');
                return;
              }
              openNewSession(activeDayKey);
            },
          },
          ...(plannerMode === 'manual'
            ? [
                {
                  id: 'suggest-auto',
                  label: t('mode.suggestWeekBtn'),
                  hint: t('mode.suggestWeekHint'),
                  icon: <Sparkles size={16} />,
                  onSelect: generate,
                },
              ]
            : []),
          {
            id: 'prefs',
            label: t('ui.preferences'),
            hint: t('ui.preferencesHint'),
            icon: <SlidersHorizontal size={16} />,
            onSelect: () => setPrefsOpen(true),
          },
          {
            id: 'review-due',
            label: dueReviewCount > 0 ? t('ui.quickReviewN', { count: dueReviewCount }) : t('ui.quickReview'),
            hint: t('ui.practiceHint'),
            icon: <Brain size={16} />,
            onSelect: () => setReviewOpen(true),
          },
          {
            id: 'checkin',
            label: t('ui.weeklyCheckin'),
            hint: t('ui.weeklyCheckinHint'),
            icon: <MessageSquare size={16} />,
            onSelect: () => setTutorOpen(true),
          },
        ]}
      />

      {modal && (
        <Suspense fallback={null}>
          <SessionModal
            courses={courses}
            session={modal.session}
            defaultDate={modal.date}
            defaultStart={modal.defaultStart}
            onClose={() => setModal(null)}
          />
        </Suspense>
      )}

      {tutorOpen && (
        <Suspense fallback={null}>
          <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />
        </Suspense>
      )}

      {reviewOpen && (
        <Suspense fallback={null}>
          <ActiveReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
        </Suspense>
      )}

      {prefsOpen && (
        <Suspense fallback={null}>
          <PlanPreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />
        </Suspense>
      )}
    </AnimatedPage>
  );
}
