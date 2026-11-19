import { addDays, format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  HelpCircle,
  MessageSquare,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
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
import CompactWeekDayCard from '../components/planner/CompactWeekDayCard';
import DayColumn from '../components/planner/DayColumn';
import DayDetailModal from '../components/planner/DayDetailModal';
import FocusResumeCard from '../components/planner/FocusResumeCard';
import PlanConscienceCard from '../components/planner/PlanConscienceCard';
import WeekCheckCard from '../components/planner/WeekCheckCard';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { resolveUniAccessory } from '../lib/uniAccessories';

const ActiveReviewModal = lazy(() => import('../components/practice/ActiveReviewModal'));
const AssessmentFormModal = lazy(() => import('../components/courses/AssessmentFormModal'));
const PlanPreferencesSheet = lazy(() => import('../components/planner/PlanPreferencesSheet'));
const SessionModal = lazy(() => import('../components/planner/SessionModal'));
import { TabGuideBanner, TabGuideHelpButton, useTabGuideOverlay } from '../components/onboarding/TabGuideBanner';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import { ActionSheet, Badge, Button, Card, CourseChip, EmptyState, Modal, PageHeader, SegmentedControl } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { courseColors, weekdayShort } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { computeExtraActivityPenaltyByWeekday } from '../lib/academicCredits';
import {
  analyzePlanConscience,
  analyzeTestMode,
  classifyOverdue,
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
import { isReplaceable } from '../lib/planner/replan';
import { consumeSilentPlanAdjust } from '../store/planUndo';
import {
  DEFAULT_PLANNER_PREFS,
  maxDailyMinutes,
  minutesForWeekday,
  resolvePlannerPrefs,
  weeklyStudyMinutes,
} from '../lib/planner/availability';
import type { Assessment, Course, StudySession } from '../types';

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
  const toggleTabGuide = useTabGuideOverlay((st) => st.toggleTab);
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
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [modal, setModal] = useState<{ session?: StudySession; date: string; defaultStart?: string } | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<{ assessment: Assessment; course: Course } | null>(null);
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
      nextMode === 'auto' ? { replan: 'prefs', force: true } : { replan: false },
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
  const [ackedWeekSig, setAckedWeekSig] = useState(() => readStoredFlag(WEEK_CHECK_ACK_KEY));
  const [activeSheet, setActiveSheet] = useState<'testMode' | 'weekCheck' | 'conscience' | null>(null);
  const acknowledgeTestMode = () => {
    if (urgentSignature) {
      writeStoredFlag(TEST_MODE_ACK_KEY, urgentSignature);
      setAckedTestSig(urgentSignature);
    }
  };

  const [mountNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [conscienceDismissedIds, setConscienceDismissedIds] = useState<Set<string>>(() => new Set());
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

  // Atrasos em três grupos: blocos gerados que o plano novo já cobre (só arrumar), sessões
  // do estudante por encaixar, e sessões de testes que já passaram (descartar).
  const overdueBuckets = useMemo(
    () =>
      classifyOverdue({
        sessions: sorted,
        today,
        assessments,
        pausedCourseIds: plannerPrefs?.pausedCourseIds,
      }),
    [sorted, today, assessments, plannerPrefs?.pausedCourseIds],
  );
  const overdue = useMemo(
    () =>
      [...overdueBuckets.manual, ...overdueBuckets.missedGenerated].sort(
        (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
      ),
    [overdueBuckets],
  );

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
  const weekCheckNeedsAttention =
    !noPlanInputs && !plannerPrefs?.briefingAppliedAt && ackedWeekSig !== currentWeekAckSig;
  const testModeNeedsAttention =
    testMode.mode !== 'normal' && Boolean(urgentSignature) && ackedTestSig !== urgentSignature;
  const acknowledgeWeekCheck = () => {
    writeStoredFlag(WEEK_CHECK_ACK_KEY, currentWeekAckSig);
    setAckedWeekSig(currentWeekAckSig);
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
    if (changed) {
      celebrateStationery();
    } else {
      showToast(t('ui.toastGenerated', { count: futureGeneratedCount() }), 'ok');
    }
  };

  const toggleSessionLock = (session: StudySession) => {
    void hapticTap();
    patch('sessions', session.id, { locked: !session.locked });
  };

  const quickMoveSession = (session: StudySession, targetDate: string) => {
    void hapticTap();
    const resolved = resolvePlannerPrefs(settings);
    const wd = parseISO(targetDate).getDay();
    const dayProfile = resolveDayPlanProfile({
      dateKey: targetDate,
      weekday: wd,
      settings,
      assessments,
      weekdaySchedule: resolved.weekdaySchedule,
      preferredPeriod: resolved.preferredPeriod,
      preExamMarathon: resolved.preExamMarathon,
      dateOverrides: resolved.dateOverrides,
    });
    const currentNow = new Date();
    const slot = dayProfile.enabled
      ? findFirstFreeSlotOnDate({
          dateKey: targetDate,
          minutes: session.minutes,
          preferredPeriod: dayProfile.windowMode,
          nowMinutes: targetDate === today ? currentNow.getHours() * 60 + currentNow.getMinutes() : undefined,
          classes,
          events,
          existingSessions: sessions.filter((x) => x.id !== session.id),
          blockedPeriods: dayProfile.blockedPeriods,
          assessments,
        })
      : null;
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
    const resolved = resolvePlannerPrefs(settings);
    const dayProfile = resolveDayPlanProfile({
      dateKey: today,
      weekday: now.getDay(),
      settings,
      assessments,
      weekdaySchedule: resolved.weekdaySchedule,
      preferredPeriod: resolved.preferredPeriod,
      preExamMarathon: resolved.preExamMarathon,
      dateOverrides: resolved.dateOverrides,
    });
    if (!dayProfile.enabled) return null;
    const slot = findFirstFreeSlotOnDate({
      dateKey: today,
      minutes: session.minutes,
      preferredPeriod: dayProfile.windowMode,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      classes,
      events,
      existingSessions: others.filter((x) => x.id !== session.id),
      blockedPeriods: dayProfile.blockedPeriods,
      assessments,
    });
    return slot ? { ...session, date: today, start: slot, locked: true } : null;
  };

  const moveOneToToday = (session: StudySession) => {
    void hapticTap();
    // Os blocos gerados de hoje cedem o lugar: o plano recalcula à volta da sessão fixada.
    const moved = placeToday(
      session,
      sessions.filter((x) => x.date === today && (plannerMode === 'manual' || !isReplaceable(x, today))),
    );
    if (!moved) {
      showToast(t('ui.noRoom'), 'neutral');
      return;
    }
    patch('sessions', session.id, { date: moved.date, start: moved.start, locked: true });
    replan('manual', { force: true, silent: true });
    showToast(t('ui.movedToday'), 'ok');
  };

  const rescheduleOverdueSmart = (targets: StudySession[] = overdueBuckets.manual) => {
    void hapticTap();
    const now = new Date();
    const { updated, unscheduledCount } = rescheduleOverdueSessions({
      overdue: targets,
      // Blocos gerados cedem o lugar às sessões do estudante; o plano recalcula a seguir.
      // No modo Manual o plano não recalcula: aí nada cede o lugar (evita sobreposições).
      existing: sessions.filter(
        (s) => s.date >= today && (plannerMode === 'manual' || !isReplaceable(s, today)),
      ),
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
      dateOverrides: plannerPrefs?.dateOverrides,
    });
    if (updated.length > 0) {
      upsertMany('sessions', updated);
      replan('manual', { force: true, silent: true });
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

  /** Arruma sessões passadas (apagar), com Desfazer. */
  const clearPastSessions = (items: StudySession[], message: string) => {
    if (items.length === 0) return;
    void hapticTap();
    const removed = [...items];
    for (const x of removed) remove('sessions', x.id);
    showToast(message, {
      tone: 'neutral',
      action: { label: t('replan.undo'), onPress: () => upsertMany('sessions', removed) },
    });
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

  const computeDayContext = (date: Date, dateKey: string) => {
    const profile = resolveDayPlanProfile({
      dateKey,
      weekday: date.getDay(),
      settings,
      assessments,
      pausedCourseIds: plannerPrefs?.pausedCourseIds,
      weekdaySchedule: plannerPrefs?.weekdaySchedule,
      preferredPeriod: plannerPrefs?.preferredPeriod,
      preExamMarathon: plannerPrefs?.preExamMarathon,
      dateOverrides: plannerPrefs?.dateOverrides,
    });
    const dayBudget = computeDayBudget({
      dateKey,
      weekday: date.getDay(),
      dayProfile: profile,
      classes,
      events,
      extraPenaltyMinutes: extraPenaltyByWeekday.get(date.getDay()) ?? 0,
      latestCheckInMood: weeklyCheckIns[0]?.mood,
    });
    return { profile, dayBudget };
  };

  const handleSelectDayPill = (key: string) => {
    setSelectedDayKey(key);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setDayModalKey(key);
    }
  };

  const stepDayModal = (delta: -1 | 1) => {
    if (!dayModalKey) return;
    const nextDate = addDays(parseISO(dayModalKey), delta);
    const nextKey = format(nextDate, 'yyyy-MM-dd');
    setSelectedDayKey(nextKey);
    setDayModalKey(nextKey);
    if (nextKey < weekKeys[0]) setWeekOffset((w) => w - 1);
    else if (nextKey > weekKeys[weekKeys.length - 1]) setWeekOffset((w) => w + 1);
  };

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow={t('plannerEyebrow')}
        title={t('plannerTitle')}
        accentTitle={t('plannerAccent')}
        subtitle={availabilitySummary}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {/* No telemóvel o guia passa para o menu ⋯, para tudo caber numa linha. */}
            <span className="hidden sm:contents">
              <TabGuideHelpButton tabKey="plano" />
            </span>
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
                <Sparkles size={16} />
                <span className="sm:hidden">{sessions.length > 0 ? t('ui.updateShort') : t('ui.generateShort')}</span>
                <span className="hidden sm:inline">{sessions.length > 0 ? t('updatePlan') : t('generatePlan')}</span>
              </Button>
            )}
            {!noPlanInputs && (
              <>
            {testMode.mode !== 'normal' && (
              <button
                type="button"
                onClick={() => {
                  acknowledgeTestMode();
                  setActiveSheet((cur) => (cur === 'testMode' ? null : 'testMode'));
                }}
                aria-expanded={activeSheet === 'testMode'}
                aria-label={t('ui.testModeExpandAria', { count: testMode.urgentAssessments.length })}
                title={t('ui.testModeExpandAria', { count: testMode.urgentAssessments.length })}
                className={cx(
                  'relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-coral/35 bg-pastel-blush/85 px-2.5 text-xs font-semibold text-[#141312] transition hover:border-coral dark:bg-[#381E21] dark:text-[#FAF6EC]',
                  activeSheet === 'testMode' && 'border-coral ring-2 ring-coral/30',
                )}
              >
                <Flame size={16} className="text-coral" aria-hidden="true" />
                <span className="tabular">{testMode.urgentAssessments.length}</span>
                {testModeNeedsAttention && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-coral" aria-hidden="true" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                acknowledgeWeekCheck();
                setActiveSheet((cur) => (cur === 'weekCheck' ? null : 'weekCheck'));
              }}
              aria-expanded={activeSheet === 'weekCheck'}
              aria-label={t('weekCheck.compactOpenAria')}
              title={t('weekCheck.compactOpenAria')}
              className={cx(
                'relative inline-flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-pastel-mint/70 text-xs font-medium text-[#141312] transition hover:border-accent dark:bg-[#17312B] dark:text-[#FAF6EC]',
                activeSheet === 'weekCheck' && 'border-accent ring-2 ring-accent/25',
              )}
            >
              <MessageSquareText size={16} className="text-accent-ink dark:text-accent" aria-hidden="true" />
              {(plannerPrefs?.briefingNote || weekCheckNeedsAttention) && (
                <span
                  className={cx(
                    'absolute right-1.5 top-1.5 size-1.5 rounded-full',
                    plannerPrefs?.briefingNote ? 'bg-ok' : 'bg-accent',
                  )}
                  aria-hidden="true"
                />
              )}
            </button>

            {conscienceReport.status !== 'empty' && (
              <button
                type="button"
                onClick={() => setActiveSheet((cur) => (cur === 'conscience' ? null : 'conscience'))}
                aria-expanded={activeSheet === 'conscience'}
                aria-label={t('conscience.compactAria')}
                title={t('conscience.compactAria')}
                className={cx(
                  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium text-[#141312] transition hover:border-accent dark:text-[#FAF6EC]',
                  visibleConscienceCount > 0
                    ? 'border-warn/35 bg-pastel-butter/85 dark:bg-[#352D14]'
                    : 'border-accent/20 bg-pastel-sage/65 dark:bg-[#23311B]',
                  activeSheet === 'conscience' && 'border-accent ring-2 ring-accent/25',
                )}
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
              </>
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
        <div className="flex flex-wrap items-center justify-end gap-2">
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

      {starterOnlyMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-pastel-sage/75 px-4 py-3 text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]">
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
          {(overdueBuckets.manual.length > 0 ||
            overdueBuckets.missedGenerated.length > 0 ||
            overdueBuckets.expired.length > 0) && (
            <section
              aria-label={t('overdue.aria')}
              className="rise space-y-3 rounded-[24px] border border-coral/30 bg-pastel-blush/50 p-4 text-[#141312] shadow-card dark:bg-[#381E21]/75 dark:text-[#FAF6EC] sm:p-5"
            >
              <h2 className="font-display text-base font-bold tracking-tight">{t('overdue.title')}</h2>

              {overdueBuckets.manual.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-line/70 bg-surface/90 p-3 text-fg dark:bg-black/25">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {t('overdue.yours', { count: overdueBuckets.manual.length })}
                    </p>
                    {overdueBuckets.manual.length > 1 && (
                      <Button size="sm" variant="primary" onClick={() => rescheduleOverdueSmart(overdueBuckets.manual)}>
                        <Sparkles size={13} /> {t('overdue.fitAll')}
                      </Button>
                    )}
                  </div>
                  <ul className="divide-y divide-line">
                    {overdueBuckets.manual.map((s) => {
                      const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                      return (
                        <li key={s.id} className="space-y-2 py-2.5 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <CourseChip course={courseById.get(s.courseId)} />
                              <span className="text-xs tabular text-muted">
                                {format(parseISO(s.date), 'EEE d MMM', { locale: dfLocale })} · {fmtMinutes(s.minutes)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm font-medium">
                              {formatSessionDisplay(s, topic, i18n.language).title}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => rescheduleOverdueSmart([s])}>
                              {t('overdue.fit')}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => moveOneToToday(s)}>
                              {t('ui.moveToday')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => clearPastSessions([s], t('overdue.discarded', { count: 1 }))}
                            >
                              {t('ui.discard')}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {overdueBuckets.missedGenerated.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-surface/90 p-3 text-fg dark:bg-black/25">
                  <p className="min-w-0 flex-1 text-sm">
                    {t('overdue.missed', { count: overdueBuckets.missedGenerated.length })}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      clearPastSessions(
                        overdueBuckets.missedGenerated,
                        t('overdue.discarded', { count: overdueBuckets.missedGenerated.length }),
                      )
                    }
                  >
                    {t('overdue.missedOk')}
                  </Button>
                </div>
              )}

              {overdueBuckets.expired.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-surface/90 p-3 text-fg dark:bg-black/25">
                  <p className="min-w-0 flex-1 text-sm">
                    {t('overdue.expired', { count: overdueBuckets.expired.length })}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      clearPastSessions(
                        overdueBuckets.expired,
                        t('overdue.discarded', { count: overdueBuckets.expired.length }),
                      )
                    }
                  >
                    {t('overdue.discardAll')}
                  </Button>
                </div>
              )}
            </section>
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

            <div className={viewMode === 'week' ? 'hidden lg:block' : undefined}>
              <WeekDayPills
                days={pillDays}
                selectedKey={activeDayKey}
                onSelect={handleSelectDayPill}
              />
            </div>

            {/* Mobile: vista de Dia selecionado */}
            <div className={viewMode === 'day' ? 'lg:hidden' : 'hidden'}>
              {(() => {
                const { profile, dayBudget } = computeDayContext(selectedDate, activeDayKey);
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

            {/* Mobile: vista compacta da Semana inteira (sem cartões altos empilhados) */}
            <div className={viewMode === 'week' ? 'space-y-2 lg:hidden' : 'hidden'}>
              {weekDays.map((d, i) => {
                const key = weekKeys[i];
                const daySessions = byDay.get(key) ?? [];
                const isToday = key === today;
                const isPast = key < today;
                const { profile, dayBudget } = computeDayContext(d, key);
                const planned = daySessions.reduce(
                  (sum, s) => sum + (s.done ? sessionMinutes(s) : s.minutes),
                  0,
                );
                const doneMinutes = daySessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
                const leftMinutes = daySessions
                  .filter((s) => !s.done)
                  .reduce((sum, s) => sum + s.minutes, 0);

                return (
                  <div
                    key={key}
                    className={cx(
                      'rounded-[22px] border p-3.5 shadow-card',
                      isPast
                        ? 'border-line/70 bg-surface-2/45 opacity-90'
                        : isToday
                          ? 'border-accent/60 bg-pastel-mint/45 ring-1 ring-accent dark:bg-[#17312B]/70'
                          : profile.isMarathonDay
                            ? 'border-warn/50 bg-pastel-butter/55 dark:bg-[#352D14]/70'
                            : profile.enabled
                              ? 'border-line/80 bg-surface'
                              : 'border-line/70 bg-surface-2/60',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDayKey(key);
                          setViewMode('day');
                        }}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                              {weekdayShort[d.getDay()]}
                            </span>
                            <span className="text-sm font-bold text-fg tabular">
                              {format(d, 'd MMM', { locale: dfLocale })}
                            </span>
                            {isToday && <Badge tone="accent">{t('ui.today')}</Badge>}
                            {!isPast && profile.isMarathonDay && (
                              <Badge tone="warn">
                                <Flame size={11} aria-hidden="true" /> {t('dayCol.marathon')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted tabular">
                            {isPast
                              ? t('dayCol.pastSummary', {
                                  done: fmtMinutes(doneMinutes),
                                  left: fmtMinutes(leftMinutes),
                                })
                              : t('dayCol.plannedOfBudget', {
                                  planned: fmtMinutes(planned),
                                  budget: dayBudget.budget > 0 ? fmtMinutes(dayBudget.budget) : fmtMinutes(0),
                                })}
                          </p>
                        </div>
                      </button>
                      {!isPast && (
                        <button
                          type="button"
                          onClick={() => openNewSession(key)}
                          aria-label={t('dayCol.addAria', { date: format(d, 'd MMM', { locale: dfLocale }) })}
                          className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>

                    {!isPast && (
                      daySessions.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {daySessions.map((s) => {
                            const c = courseById.get(s.courseId);
                            const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                            const color = courseColors[c?.color ?? 'emerald'];
                            const disp = formatSessionDisplay(s, topic, i18n.language);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setModal({ session: s, date: s.date })}
                                className={cx(
                                  'flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition hover:brightness-[0.98]',
                                  s.done
                                    ? 'border-dashed border-line bg-surface/80 opacity-65'
                                    : color.tint,
                                )}
                              >
                                {s.start && (
                                  <span className="shrink-0 font-mono text-xs text-muted tabular">
                                    {s.start}
                                  </span>
                                )}
                                {c?.shortName && (
                                  <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold', color.soft)}>
                                    {c.shortName}
                                  </span>
                                )}
                                <span className={cx('min-w-0 flex-1 truncate font-medium text-fg', s.done && 'line-through')}>
                                  {disp.title}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-muted tabular">
                                  {fmtMinutes(s.minutes)}
                                </span>
                                {s.done && (
                                  <Check size={14} className="shrink-0 text-ok" aria-hidden="true" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted">
                          {profile.enabled ? t('dayCol.noSessions') : t('dayCol.offDay')}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: 7 dias numa única linha com blocos compactos; clicar num dia abre a aba do dia */}
            <div className="hidden lg:grid lg:grid-flow-col lg:auto-cols-[minmax(148px,1fr)] lg:gap-2 lg:overflow-x-auto lg:pb-1 xl:grid-cols-7 xl:auto-cols-auto xl:gap-2.5 xl:overflow-visible xl:pb-0">
              {weekDays.map((d, i) => {
                const key = weekKeys[i];
                const { profile, dayBudget } = computeDayContext(d, key);
                return (
                  <CompactWeekDayCard
                    key={key}
                    date={d}
                    dateKey={key}
                    sessions={byDay.get(key) ?? []}
                    budget={dayBudget.budget}
                    isToday={key === today}
                    isSelected={key === activeDayKey}
                    isPast={key < today}
                    isStudyDay={profile.enabled}
                    isMarathonDay={profile.isMarathonDay}
                    courseById={courseById}
                    topicById={topicById}
                    onOpenDay={(k) => {
                      setSelectedDayKey(k);
                      setDayModalKey(k);
                    }}
                    onEditSession={(s) => setModal({ session: s, date: s.date })}
                    onAddSession={openNewSession}
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
            id: 'guide',
            label: t('common:guide.button'),
            hint: t('common:guide.openTitle'),
            icon: <HelpCircle size={16} />,
            onSelect: () => toggleTabGuide('plano'),
          },
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
            onSelect: () => openUniCheckIn({ kind: 'week' }),
          },
        ]}
      />

      {dayModalKey && (() => {
        const modalDateObj = parseISO(dayModalKey);
        const { profile, dayBudget } = computeDayContext(modalDateObj, dayModalKey);
        return (
          <DayDetailModal
            dateKey={dayModalKey}
            sessions={byDay.get(dayModalKey) ?? []}
            budget={dayBudget.budget}
            budgetReason={dayBudget.reducedReason}
            isToday={dayModalKey === today}
            isPast={dayModalKey < today}
            isStudyDay={profile.enabled}
            isMarathonDay={profile.isMarathonDay}
            classes={classes}
            events={events}
            assessments={assessments}
            weekDates={weekKeys}
            courseById={courseById}
            topicById={topicById}
            assessmentById={assessmentById}
            materialById={materialById}
            onClose={() => setDayModalKey(null)}
            onStepDay={stepDayModal}
            onFocus={(s) => setFocusId(s.id)}
            onEdit={(s) => setModal({ session: s, date: s.date })}
            onAdd={openNewSession}
            onToggleLock={toggleSessionLock}
            onQuickMove={quickMoveSession}
            onEditAssessment={(a) => {
              const c = courseById.get(a.courseId);
              if (c) setEditingAssessment({ assessment: a, course: c });
            }}
          />
        );
      })()}

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

      {editingAssessment && (
        <Suspense fallback={null}>
          <AssessmentFormModal
            course={editingAssessment.course}
            assessment={editingAssessment.assessment}
            onClose={() => setEditingAssessment(null)}
          />
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

      <Modal
        open={activeSheet === 'testMode' && testMode.mode !== 'normal'}
        onClose={() => setActiveSheet(null)}
        title={
          testMode.mode === 'single_test'
            ? t('testModeSingleTitle')
            : t('testModeMultiTitle', { count: testMode.urgentCourseIds.length })
        }
      >
        <div className="space-y-4">
          <div
            className={cx(
              'flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5',
              testMode.mode === 'single_test'
                ? 'bg-pastel-butter/75 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
                : 'bg-pastel-blush/75 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface/80 text-coral dark:bg-black/25">
              <Flame size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-xs leading-relaxed">
              {testMode.mode === 'single_test'
                ? t('testModeSingleTitle')
                : t('testModeMultiTitle', { count: testMode.urgentCourseIds.length })}
            </span>
            <Badge tone={testMode.mode === 'single_test' ? 'warn' : 'danger'}>
              {testMode.mode === 'single_test' ? t('testModeFocusBadge') : t('testModeBalanceBadge')}
            </Badge>
          </div>

          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-2/40">
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
                  className="flex min-h-[54px] items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-snug text-fg sm:text-sm">
                    {t('testModeLine', {
                      course: u.course.shortName,
                      title: u.assessment.title,
                      when,
                    })}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      iconOnly
                      variant="ghost"
                      aria-label={t('courses:assess.edit')}
                      title={t('courses:assess.edit')}
                      onClick={() => setEditingAssessment({ assessment: u.assessment, course: u.course })}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => {
                        acknowledgeTestMode();
                        setActiveSheet(null);
                        openUniCheckIn({
                          kind: 'exam_prep',
                          assessmentId: u.assessment.id,
                          courseId: u.course.id,
                        });
                      }}
                    >
                      {t('alignShort')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#DFD2AE] bg-pastel-butter/55 px-3.5 py-3 text-[#141312] dark:border-line dark:bg-[#352D14]/65 dark:text-[#FAF6EC] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed opacity-85">{t('testModePhasesHint')}</p>
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0 self-start sm:self-center"
              onClick={() => {
                acknowledgeTestMode();
                setActiveSheet('weekCheck');
              }}
            >
              {t('testModePhasesBtn')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSheet === 'weekCheck'}
        onClose={() => setActiveSheet(null)}
        title={t('weekCheck.title')}
      >
        <WeekCheckCard
          initialOpen
          inModal
          onCollapse={() => {
            acknowledgeWeekCheck();
            setActiveSheet(null);
          }}
        />
      </Modal>

      <Modal
        open={activeSheet === 'conscience' && conscienceReport.status !== 'empty'}
        onClose={() => setActiveSheet(null)}
        title={t('conscience.title')}
      >
        <PlanConscienceCard
          today={today}
          report={conscienceReport}
          dismissedIds={conscienceDismissedIds}
          inModal
          onDismiss={(id) =>
            setConscienceDismissedIds((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            })
          }
          onCollapse={() => setActiveSheet(null)}
        />
      </Modal>
    </AnimatedPage>
  );
}
