import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDateFnsLocale } from '../lib/grading';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import ActiveReviewModal from '../components/practice/ActiveReviewModal';
import {
  AnimatedPage,
  BentoMetricTile,
  WeekDayPills,
} from '../components/motion/Primitives';
import { celebrateStationery } from '../lib/motionTokens';
import CourseDistribution from '../components/planner/CourseDistribution';
import DayColumn from '../components/planner/DayColumn';
import FocusResumeCard from '../components/planner/FocusResumeCard';
import PlanBuilderModal from '../components/planner/PlanBuilderModal';
import SessionModal from '../components/planner/SessionModal';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import { ActionSheet, Badge, Button, Card, CourseChip, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { showToast } from '../lib/uiHelpers';
import { weekdayShort } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { analyzeTestMode, generatePlan, planSummary, rescheduleOverdueSessions } from '../lib/planner';
import { getDueReviewQueue } from '../lib/spacedRepetition';
import { capitalizeFirst, fmtMinutes, formatSessionDisplay, sessionMinutes, todayStr } from '../lib/selectors';
import { useHubUiStore } from '../store/useHubUiStore';
import { useStore } from '../store/useStore';
import type { PlannerPreferences, StudySession } from '../types';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const studyLogs = useStore((s) => s.studyLogs);
  const replaceGeneratedSessions = useStore((s) => s.replaceGeneratedSessions);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);
  const upsertMany = useStore((s) => s.upsertMany);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const updateSettings = useStore((s) => s.updateSettings);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const today = useMemo(() => todayStr(), []);
  const legacyReconciledRef = useRef(false);

  useEffect(() => {
    if (legacyReconciledRef.current || courses.length === 0) return;
    const hasLegacySystemSession = sessions.some(
      (s) =>
        s.generated &&
        !s.done &&
        s.date >= today &&
        (s.notes === 'Equilíbrio Modo Teste' || s.notes === 'Foco Modo Teste'),
    );
    if (!hasLegacySystemSession) return;
    legacyReconciledRef.current = true;
    reconcileFuturePlan(true);
  }, [courses.length, sessions, today, reconcileFuturePlan]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [modal, setModal] = useState<{ session?: StudySession; date: string } | null>(null);
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

  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today),
    [courses, assessments, today],
  );

  const [anchorDate] = useState(() => new Date());
  const weekDays = useMemo(() => {
    const start = addWeeks(startOfWeek(anchorDate, { weekStartsOn: 1 }), weekOffset);
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

  const hasPendingGenerated = useMemo(
    () => sessions.some((s) => s.generated && !s.done && s.date >= today),
    [sessions, today],
  );

  const noPlanInputs = courses.length === 0;
  const starterOnlyMode = courses.length > 0 && !assessments.some((a) => a.grade === undefined);
  const plannerPrefs = settings.plannerPrefs;

  const generate = () => {
    void hapticTap();
    const now = new Date();
    const plan = generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings,
      from: today,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      days: plannerPrefs?.horizonDays ?? 14,
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
      difficultCourseIds: academicProfile.difficultCourseIds,
      weeklyCheckIns,
      studyLogs,
      extraActivities: academicProfile.extraActivities,
      preferredPeriod: plannerPrefs?.preferredPeriod,
      blockMinutes: plannerPrefs?.blockMinutes,
      strategy: plannerPrefs?.strategy,
      boostCourseIds: plannerPrefs?.boostCourseIds,
      pausedCourseIds: plannerPrefs?.pausedCourseIds,
      exclusiveTestFocus: plannerPrefs?.exclusiveTestFocus,
    });
    replaceGeneratedSessions(today, plan);
    setBuilderOpen(false);
    celebrateStationery();
    showToast(t('ui.toastGenerated', { count: plan.length }), 'ok');
  };

  const applyCustomPlan = ({
    prefs,
    dailyStudyMinutes,
    studyDays,
    plan,
  }: {
    prefs: PlannerPreferences;
    dailyStudyMinutes: number;
    studyDays: number[];
    plan: StudySession[];
  }) => {
    void hapticTap();
    updateSettings({
      plannerPrefs: prefs,
      dailyStudyMinutes,
      studyDays,
    });
    replaceGeneratedSessions(today, plan);
    if (prefs.includeOverdue && overdue.length > 0) {
      const now = new Date();
      const { updated } = rescheduleOverdueSessions({
        overdue,
        existing: [
          ...sessions.filter((s) => !s.generated || s.done || s.date < today).filter((s) => s.date >= today),
          ...plan,
        ],
        classes,
        events,
        settings: { ...settings, dailyStudyMinutes, studyDays },
        from: today,
        nowMinutes: now.getHours() * 60 + now.getMinutes(),
        days: prefs.horizonDays,
        preferredPeriod: prefs.preferredPeriod,
      });
      if (updated.length > 0) upsertMany('sessions', updated);
    }
    setBuilderOpen(false);
    celebrateStationery();
    showToast(t('ui.toastApplied', { count: plan.length }), 'ok');
  };

  const onGenerate = () => setBuilderOpen(true);

  const moveAllToToday = () => {
    void hapticTap();
    upsertMany('sessions', overdue.map((s) => ({ ...s, date: today })));
    showToast(t('ui.movedToday'), 'ok');
  };

  const rescheduleOverdueSmart = () => {
    void hapticTap();
    const now = new Date();
    const { updated, unscheduledCount } = rescheduleOverdueSessions({
      overdue,
      existing: sessions.filter((s) => s.date >= today),
      classes,
      events,
      settings,
      from: today,
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      days: plannerPrefs?.horizonDays ?? 14,
      preferredPeriod: plannerPrefs?.preferredPeriod ?? 'auto',
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
        subtitle={`${fmtMinutes(settings.dailyStudyMinutes)} · ${studyDaysLabel(settings.studyDays, t('ui.noStudyDays'))}${plannerPrefs ? ` · ${plannerPrefs.blockMinutes}m (${plannerPrefs.horizonDays}d)` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TabGuideHelpButton tabKey="plano" />
            {dueReviewCount > 0 && (
              <Button variant="secondary" onClick={() => setReviewOpen(true)}>
                <Brain size={16} /> {t('reviewDue')} ({dueReviewCount})
              </Button>
            )}
            <Button
              variant={testMode.mode !== 'normal' ? 'secondary' : 'primary'}
              onClick={onGenerate}
              disabled={noPlanInputs}
            >
              <Sparkles size={16} /> {t('generatePlan')}
            </Button>
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

      {testMode.mode !== 'normal' && (
        <div
          className={
            testMode.mode === 'single_test'
              ? 'flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-pastel-butter/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
              : 'flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-pastel-blush/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
          }
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-surface/80 p-2 text-coral dark:bg-black/25">
              <Flame size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {testMode.mode === 'single_test'
                    ? t('testModeSingleTitle')
                    : t('testModeMultiTitle', { count: testMode.urgentCourseIds.length })}
                </span>
                <Badge tone={testMode.mode === 'single_test' ? 'warn' : 'danger'}>
                  {testMode.mode === 'single_test' ? t('testModeFocusBadge') : t('testModeBalanceBadge')}
                </Badge>
              </div>
                <p className="mt-1 text-xs opacity-75">
                  {testMode.mode === 'single_test'
                    ? t('ui.testSingle', { focus: plannerPrefs?.exclusiveTestFocus ? t('ui.focusExclusive') : t('ui.focusPriority'), course: testMode.urgentAssessments[0].course.shortName, test: testMode.urgentAssessments[0].assessment.title, days: testMode.urgentAssessments[0].daysLeft })
                    : t('ui.testBalance', { list: testMode.urgentAssessments.map((u) => `${u.course.shortName} (${u.daysLeft}d)`).join(' · ') })}
                </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openUniCheckIn({
                  kind: 'exam_prep',
                  assessmentId: testMode.urgentAssessments[0]?.assessment.id,
                  courseId: testMode.urgentAssessments[0]?.course.id,
                })
              }
            >
              {t('alignWithUni')}
            </Button>
            <Button size="sm" variant="primary" onClick={generate}>
              <Sparkles size={14} /> {t('recalculate')}
            </Button>
          </div>
        </div>
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

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={noPlanInputs ? t('ui.emptyNoCourses') : t('ui.emptyNoPlan')}
          hint={
            noPlanInputs
              ? t('ui.emptyNoCoursesHint')
              : t('ui.emptyNoPlanHint')
          }
          action={
            noPlanInputs ? (
              <Button variant="primary" onClick={() => navigate('/cadeiras')}>
                {t('ui.goCourses')}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={() => setModal({ date: today })} disabled={courses.length === 0}>
                  <Plus size={16} /> {t('ui.newSession')}
                </Button>
                <Button variant="primary" onClick={onGenerate}>
                  <Sparkles size={16} /> {t('generatePlan')}
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
              <ul className="divide-y divide-line">
                {overdue.map((s) => {
                  const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CourseChip course={courseById.get(s.courseId)} />
                          <span className="text-xs tabular text-muted">
                            {format(parseISO(s.date), 'EEE d MMM', { locale: dfLocale })}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">
                          {formatSessionDisplay(s, topic, i18n.language).title}
                        </p>
                        <p className="text-xs tabular text-muted">{s.minutes} min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => patch('sessions', s.id, { date: today })}>
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
              <DayColumn
                date={selectedDate}
                sessions={byDay.get(activeDayKey) ?? []}
                budget={settings.dailyStudyMinutes}
                isToday={activeDayKey === today}
                isStudyDay={settings.studyDays.includes(selectedDate.getDay())}
                courseById={courseById}
                topicById={topicById}
                assessmentById={assessmentById}
                onFocus={(s) => setFocusId(s.id)}
                onEdit={(s) => setModal({ session: s, date: s.date })}
                onAdd={(date) => setModal({ date })}
              />
            </div>

            <div
              className={
                viewMode === 'week'
                  ? 'grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'
                  : 'hidden lg:grid lg:grid-cols-4 lg:gap-3 xl:grid-cols-7'
              }
            >
              {weekDays.map((d, i) => {
                const key = weekKeys[i];
                return (
                  <DayColumn
                    key={key}
                    date={d}
                    sessions={byDay.get(key) ?? []}
                    budget={settings.dailyStudyMinutes}
                    isToday={key === today}
                    isStudyDay={settings.studyDays.includes(d.getDay())}
                    courseById={courseById}
                    topicById={topicById}
                    assessmentById={assessmentById}
                    onFocus={(s) => setFocusId(s.id)}
                    onEdit={(s) => setModal({ session: s, date: s.date })}
                    onAdd={(date) => setModal({ date })}
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
              label={t('ui.dailyGoal')}
              value={fmtMinutes(settings.dailyStudyMinutes)}
              hint={studyDaysLabel(settings.studyDays, t('ui.noStudyDays'))}
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
              setModal({ date: activeDayKey });
            },
          },
          {
            id: 'review-due',
            label: dueReviewCount > 0 ? t('ui.reviewDueN', { count: dueReviewCount }) : t('ui.practiceReview'),
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
        <SessionModal
          courses={courses}
          session={modal.session}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
        />
      )}

      <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />

      <ActiveReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />

      <PlanBuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        courses={courses}
        assessments={assessments}
        classes={classes}
        events={events}
        sessions={sessions}
        settings={settings}
        difficultCourseIds={academicProfile.difficultCourseIds}
        weeklyCheckIns={weeklyCheckIns}
        studyLogs={studyLogs}
        extraActivities={academicProfile.extraActivities}
        today={today}
        overdueCount={overdue.length}
        hasPendingGenerated={hasPendingGenerated}
        onApply={applyCustomPlan}
      />
    </AnimatedPage>
  );
}
