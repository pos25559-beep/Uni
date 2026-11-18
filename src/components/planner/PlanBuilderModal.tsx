import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  PauseCircle,
  RotateCcw,
  Sparkles,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { refinePlanBriefingWithAi } from '../../integrations/gemini';
import { resolveDateFnsLocale } from '../../lib/grading';
import { findFirstFreeSlotOnDate, generatePlan } from '../../lib/planner';
import {
  normalizeWeekdaySchedule,
  parsePlannerBriefing,
  type ParsedBriefingInsight,
  type ParsedPlannerBriefing,
} from '../../lib/plannerBriefing';
import { fmtMinutes } from '../../lib/selectors';
import { cx, showToast } from '../../lib/uiHelpers';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  PlannerContentMix,
  PlannerDayPeriod,
  PlannerPreferences,
  PlannerStrategy,
  PreExamMarathonConfig,
  Settings,
  StudyLogEntry,
  StudySession,
  Topic,
  WeekdayAvailability,
  WeeklyCheckIn,
} from '../../types';
import { Badge, CourseChip, Modal, Switch } from '../ui';
import { Button } from '../ui/Button';
import BuilderStepBriefing, { type TopicCalibrationOverride } from './BuilderStepBriefing';
import BuilderStepPreview from './BuilderStepPreview';
import BuilderStepSchedule from './BuilderStepSchedule';

type BuilderStep = 1 | 2 | 3 | 4;

const DEFAULT_PREFS: PlannerPreferences = {
  horizonDays: 14,
  preferredPeriod: 'auto',
  blockMinutes: 50,
  strategy: 'balanced',
  boostCourseIds: [],
  pausedCourseIds: [],
  includeOverdue: true,
  fillClassGaps: false,
  contentMix: 'balanced',
  preExamMarathon: { enabled: false, daysBefore: 2, dailyMinutes: 480 },
};

const STRATEGY_IDS: PlannerStrategy[] = ['balanced', 'exams_first', 'srs_focus', 'catch_up'];
const MIX_IDS: PlannerContentMix[] = ['balanced', 'theory_first', 'practice_first'];
const BLOCK_DURATIONS: (25 | 35 | 50 | 75)[] = [25, 35, 50, 75];
const HORIZONS: (7 | 14 | 21)[] = [7, 14, 21];

interface Props {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials?: Material[];
  sessions: StudySession[];
  settings: Settings;
  difficultCourseIds?: ID[];
  weeklyCheckIns: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  extraActivities?: ExtraActivity[];
  today: string;
  overdueCount: number;
  hasPendingGenerated: boolean;
  onApply: (args: {
    prefs: PlannerPreferences;
    dailyStudyMinutes: number;
    studyDays: number[];
    plan: StudySession[];
    topicUpdates: Array<{ courseId: ID; topicId: ID; changes: Partial<Topic> }>;
  }) => void;
}

export default function PlanBuilderModal({
  open,
  onClose,
  courses,
  assessments,
  classes,
  events,
  materials = [],
  sessions,
  settings,
  difficultCourseIds,
  weeklyCheckIns,
  studyLogs = [],
  extraActivities,
  today,
  overdueCount,
  hasPendingGenerated,
  onApply,
}: Props) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const initial = settings.plannerPrefs ?? DEFAULT_PREFS;

  const [step, setStep] = useState<BuilderStep>(1);
  const [strategy, setStrategy] = useState<PlannerStrategy>(initial.strategy ?? 'balanced');
  const [contentMix, setContentMix] = useState<PlannerContentMix>(initial.contentMix ?? 'balanced');
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 21>(initial.horizonDays ?? 14);
  const [preferredPeriod, setPreferredPeriod] = useState<PlannerDayPeriod>(
    initial.preferredPeriod ?? 'auto',
  );
  const [blockMinutes, setBlockMinutes] = useState<25 | 35 | 50 | 75>(initial.blockMinutes ?? 50);
  const [weekdaySchedule, setWeekdaySchedule] = useState<Record<string, WeekdayAvailability>>(() =>
    normalizeWeekdaySchedule(initial.weekdaySchedule, settings, initial.preferredPeriod ?? 'auto'),
  );
  const [fillClassGaps, setFillClassGaps] = useState<boolean>(initial.fillClassGaps ?? false);
  const [marathon, setMarathon] = useState<PreExamMarathonConfig>(
    initial.preExamMarathon ?? { enabled: false, daysBefore: 2, dailyMinutes: 480 },
  );
  const [boostIds, setBoostIds] = useState<ID[]>(initial.boostCourseIds ?? []);
  const [pausedIds, setPausedIds] = useState<ID[]>(initial.pausedCourseIds ?? []);
  const [exclusiveTestFocus, setExclusiveTestFocus] = useState<boolean>(
    initial.exclusiveTestFocus ?? false,
  );
  const [includeOverdue, setIncludeOverdue] = useState<boolean>(initial.includeOverdue ?? true);

  // Step 1 Briefing & Topic calibration state
  const [briefingText, setBriefingText] = useState<string>(initial.briefingNote ?? '');
  const [briefingCourseFocus, setBriefingCourseFocus] = useState<Record<string, string>>(
    initial.briefingCourseFocus ?? {},
  );
  const [parsedAiOverride, setParsedAiOverride] = useState<ParsedPlannerBriefing | null>(null);
  const [disabledInsightIds, setDisabledInsightIds] = useState<string[]>([]);
  const [isRefiningAi, setIsRefiningAi] = useState(false);
  const [topicOverrides, setTopicOverrides] = useState<Record<ID, TopicCalibrationOverride>>({});

  // Step 4 interactive preview overrides
  const [lockedPreviewIds, setLockedPreviewIds] = useState<string[]>([]);
  const [removedPreviewIds, setRemovedPreviewIds] = useState<string[]>([]);
  const [movedPreviewMap, setMovedPreviewMap] = useState<
    Record<string, { date: string; start?: string }>
  >({});
  const [nowAnchor] = useState(() => new Date());

  const deterministicParsed = useMemo(
    () => parsePlannerBriefing({ text: briefingText, courses, materials }),
    [briefingText, courses, materials],
  );
  const effectiveParsed = parsedAiOverride ?? deterministicParsed;

  const applyParsedToBuilderState = (
    parsed: ParsedPlannerBriefing,
    disabledIds: string[],
  ) => {
    const disabledSet = new Set(disabledIds);
    const activeInsights = parsed.insights.filter((ins) => !disabledSet.has(ins.id));

    if (activeInsights.some((ins) => ins.activateCatchUp)) {
      setStrategy('catch_up');
    }
    const marathonInsight = activeInsights.find((ins) => ins.kind === 'marathon' && ins.marathon);
    if (marathonInsight?.marathon) {
      setMarathon(marathonInsight.marathon);
    }

    const availInsights = activeInsights.filter((ins) => ins.kind === 'availability');
    if (availInsights.length > 0) {
      setWeekdaySchedule((prev) => {
        const next = { ...prev };
        for (const ins of availInsights) {
          if (ins.weekday === undefined) continue;
          const k = String(ins.weekday);
          const cur = next[k] ?? { enabled: true, minutes: 120, window: 'auto' as const };
          const blocked = new Set(cur.blockedPeriods ?? []);
          if (ins.blockedPeriod) blocked.add(ins.blockedPeriod);
          next[k] = {
            ...cur,
            ...(ins.setEnabled !== undefined ? { enabled: ins.setEnabled } : {}),
            ...(ins.setWindow ? { window: ins.setWindow } : {}),
            ...(ins.setMinutes !== undefined ? { minutes: ins.setMinutes } : {}),
            ...(blocked.size > 0 ? { blockedPeriods: [...blocked] } : {}),
          };
        }
        return next;
      });
    }

    const nextTopicOverrides: Record<ID, TopicCalibrationOverride> = {};
    for (const ins of activeInsights) {
      if (ins.kind === 'topic_mastered' && ins.topicUpdates) {
        for (const u of ins.topicUpdates) {
          nextTopicOverrides[u.topicId] = { status: u.status, confidence: u.confidence };
        }
      }
    }
    if (Object.keys(nextTopicOverrides).length > 0) {
      setTopicOverrides((prev) => ({ ...prev, ...nextTopicOverrides }));
    }

    const nextBoost = new Set<ID>();
    const nextPause = new Set<ID>();
    const nextFocus: Record<string, string> = {};
    for (const ins of activeInsights) {
      if (ins.kind === 'course_boost' && ins.courseId) nextBoost.add(ins.courseId);
      if (ins.kind === 'course_pause' && ins.courseId) nextPause.add(ins.courseId);
      if (ins.kind === 'course_focus' && ins.courseId && ins.focusNote) {
        nextFocus[ins.courseId] = ins.focusNote;
      }
    }
    if (parsed === parsedAiOverride) {
      parsed.boostCourseIds.forEach((id) => nextBoost.add(id));
      parsed.pausedCourseIds.forEach((id) => {
        if (!nextBoost.has(id)) nextPause.add(id);
      });
      Object.assign(nextFocus, parsed.briefingCourseFocus);
    }

    if (nextBoost.size > 0) {
      setBoostIds((prev) => [...new Set([...prev, ...nextBoost])]);
      setPausedIds((prev) => prev.filter((id) => !nextBoost.has(id)));
    }
    if (nextPause.size > 0) {
      setPausedIds((prev) => [...new Set([...prev, ...nextPause])]);
      setBoostIds((prev) => prev.filter((id) => !nextPause.has(id)));
    }
    if (Object.keys(nextFocus).length > 0) {
      setBriefingCourseFocus((prev) => ({ ...prev, ...nextFocus }));
    }
  };

  const handleBriefingChange = (nextText: string) => {
    setBriefingText(nextText);
    setParsedAiOverride(null);
    const parsed = parsePlannerBriefing({ text: nextText, courses, materials });
    applyParsedToBuilderState(parsed, disabledInsightIds);
  };

  const handleToggleInsight = (ins: ParsedBriefingInsight) => {
    const currentlyDisabled = disabledInsightIds.includes(ins.id);
    const nextDisabled = currentlyDisabled
      ? disabledInsightIds.filter((id) => id !== ins.id)
      : [...disabledInsightIds, ins.id];
    setDisabledInsightIds(nextDisabled);

    if (currentlyDisabled) {
      // Ligou de novo: reaplica
      applyParsedToBuilderState(effectiveParsed, nextDisabled);
    } else {
      // Desligou: desfaz efeitos diretos deste insight
      if (ins.kind === 'marathon') setMarathon((m) => ({ ...m, enabled: false }));
      if (ins.kind === 'mid_semester') setStrategy('balanced');
      if (ins.kind === 'course_boost' && ins.courseId) {
        setBoostIds((prev) => prev.filter((id) => id !== ins.courseId));
      }
      if (ins.kind === 'course_pause' && ins.courseId) {
        setPausedIds((prev) => prev.filter((id) => id !== ins.courseId));
      }
      if (ins.kind === 'course_focus' && ins.courseId) {
        setBriefingCourseFocus((prev) => {
          const copy = { ...prev };
          delete copy[ins.courseId!];
          return copy;
        });
      }
      if (ins.kind === 'topic_mastered' && ins.topicUpdates) {
        setTopicOverrides((prev) => {
          const copy = { ...prev };
          for (const u of ins.topicUpdates!) delete copy[u.topicId];
          return copy;
        });
      }
      if (ins.kind === 'availability' && ins.weekday !== undefined && ins.blockedPeriod) {
        const k = String(ins.weekday);
        setWeekdaySchedule((prev) => {
          const cur = prev[k];
          if (!cur?.blockedPeriods) return prev;
          const remaining = cur.blockedPeriods.filter((bp) => bp !== ins.blockedPeriod);
          return {
            ...prev,
            [k]: {
              ...cur,
              ...(remaining.length > 0 ? { blockedPeriods: remaining } : { blockedPeriods: undefined }),
            },
          };
        });
      }
    }
  };

  const handleRefineWithAi = async () => {
    setIsRefiningAi(true);
    try {
      const refined = await refinePlanBriefingWithAi({
        text: briefingText,
        courses,
        lang: i18n.language,
      });
      setParsedAiOverride(refined);
      applyParsedToBuilderState(refined, disabledInsightIds);
      showToast(t('builder.briefing.aiRefinedToast'), 'ok');
    } finally {
      setIsRefiningAi(false);
    }
  };

  const handleMarkFirstNTopics = (course: Course, count: number) => {
    setTopicOverrides((prev) => {
      const next = { ...prev };
      course.topics.forEach((tp, idx) => {
        if (idx < count) {
          next[tp.id] = { status: 'done', confidence: 4 };
        } else if (tp.status === 'done' || next[tp.id]?.status === 'done') {
          next[tp.id] = { status: 'todo', confidence: 2 };
        }
      });
      return next;
    });
  };

  const effectiveCourses = useMemo(
    () =>
      courses.map((c) => ({
        ...c,
        topics: c.topics.map((tp) => {
          const ov = topicOverrides[tp.id];
          return ov ? { ...tp, status: ov.status, confidence: ov.confidence } : tp;
        }),
      })),
    [courses, topicOverrides],
  );

  const cycleCourseFocus = (courseId: ID) => {
    if (boostIds.includes(courseId)) {
      setBoostIds((prev) => prev.filter((id) => id !== courseId));
      setPausedIds((prev) => [...prev, courseId]);
    } else if (pausedIds.includes(courseId)) {
      setPausedIds((prev) => prev.filter((id) => id !== courseId));
    } else {
      setBoostIds((prev) => [...prev, courseId]);
    }
  };

  const derivedStudyDays = useMemo(() => {
    const active = [0, 1, 2, 3, 4, 5, 6].filter((d) => weekdaySchedule[String(d)]?.enabled);
    return active.length > 0 ? active : [1, 2, 3, 4, 5, 6];
  }, [weekdaySchedule]);

  const derivedDailyMinutes = useMemo(() => {
    const sum = derivedStudyDays.reduce(
      (acc, d) => acc + (weekdaySchedule[String(d)]?.minutes || 120),
      0,
    );
    return Math.max(30, Math.round(sum / derivedStudyDays.length));
  }, [derivedStudyDays, weekdaySchedule]);

  const previewSettings = useMemo<Settings>(
    () => ({
      ...settings,
      dailyStudyMinutes: derivedDailyMinutes,
      studyDays: derivedStudyDays,
    }),
    [settings, derivedDailyMinutes, derivedStudyDays],
  );

  const preservedExisting = useMemo(
    () => sessions.filter((s) => !s.generated || s.done || s.locked || s.date < today),
    [sessions, today],
  );

  const existingLockedFutureCount = useMemo(
    () => sessions.filter((s) => s.locked && !s.done && s.date >= today).length,
    [sessions, today],
  );

  const rawPreviewPlan = useMemo(() => {
    if (!open || effectiveCourses.length === 0) return [];
    return generatePlan({
      courses: effectiveCourses,
      assessments,
      classes,
      events,
      materials,
      settings: previewSettings,
      from: today,
      nowMinutes: nowAnchor.getHours() * 60 + nowAnchor.getMinutes(),
      days: horizonDays,
      existing: preservedExisting,
      difficultCourseIds,
      weeklyCheckIns,
      studyLogs,
      extraActivities,
      preferredPeriod,
      blockMinutes,
      strategy,
      boostCourseIds: boostIds,
      pausedCourseIds: pausedIds,
      exclusiveTestFocus,
      weekdaySchedule,
      fillClassGaps,
      preExamMarathon: marathon,
      contentMix,
      briefingCourseFocus,
    });
  }, [
    open,
    effectiveCourses,
    assessments,
    classes,
    events,
    materials,
    previewSettings,
    today,
    nowAnchor,
    horizonDays,
    preservedExisting,
    difficultCourseIds,
    weeklyCheckIns,
    studyLogs,
    extraActivities,
    preferredPeriod,
    blockMinutes,
    strategy,
    boostIds,
    pausedIds,
    exclusiveTestFocus,
    weekdaySchedule,
    fillClassGaps,
    marathon,
    contentMix,
    briefingCourseFocus,
  ]);

  const effectivePreviewPlan = useMemo(() => {
    const removedSet = new Set(removedPreviewIds);
    const lockedSet = new Set(lockedPreviewIds);
    return rawPreviewPlan
      .filter((s) => !removedSet.has(s.id))
      .map((s) => {
        const moved = movedPreviewMap[s.id];
        return {
          ...s,
          ...(moved ? { date: moved.date, start: moved.start } : {}),
          ...(lockedSet.has(s.id) ? { locked: true } : {}),
        };
      });
  }, [rawPreviewPlan, removedPreviewIds, lockedPreviewIds, movedPreviewMap]);

  const handleMovePreviewToDate = (session: StudySession, targetDate: string) => {
    if (targetDate === session.date) return;
    const wd = parseISO(targetDate).getDay();
    const avail = weekdaySchedule[String(wd)];
    const nowMin =
      targetDate === today ? nowAnchor.getHours() * 60 + nowAnchor.getMinutes() : undefined;
    const slot = findFirstFreeSlotOnDate({
      dateKey: targetDate,
      minutes: session.minutes,
      preferredPeriod: avail?.window ?? preferredPeriod,
      nowMinutes: nowMin,
      classes,
      events,
      existingSessions: [
        ...preservedExisting,
        ...effectivePreviewPlan.filter((x) => x.id !== session.id),
      ],
      blockedPeriods: avail?.blockedPeriods,
    });
    if (!slot) {
      showToast(
        t('session.noSlotDay', {
          date: format(parseISO(targetDate), 'd MMM', { locale: dfLocale }),
        }),
        'neutral',
      );
      return;
    }
    setMovedPreviewMap((prev) => ({
      ...prev,
      [session.id]: { date: targetDate, start: slot },
    }));
    showToast(
      t('session.movedTo', {
        date: format(parseISO(targetDate), 'd MMM', { locale: dfLocale }),
        time: slot,
      }),
      'ok',
    );
  };

  const handleApply = () => {
    const topicUpdates: Array<{ courseId: ID; topicId: ID; changes: Partial<Topic> }> = [];
    for (const c of courses) {
      for (const tp of c.topics) {
        const ov = topicOverrides[tp.id];
        if (!ov) continue;
        if (ov.status !== tp.status || ov.confidence !== tp.confidence) {
          topicUpdates.push({
            courseId: c.id,
            topicId: tp.id,
            changes: { status: ov.status, confidence: ov.confidence },
          });
        }
      }
    }

    onApply({
      prefs: {
        horizonDays,
        preferredPeriod,
        blockMinutes,
        strategy,
        boostCourseIds: boostIds,
        pausedCourseIds: pausedIds,
        includeOverdue,
        exclusiveTestFocus,
        weekdaySchedule,
        fillClassGaps,
        preExamMarathon: marathon,
        contentMix,
        ...(briefingText.trim() ? { briefingNote: briefingText.trim().slice(0, 1200) } : {}),
        ...(Object.keys(briefingCourseFocus).length > 0 ? { briefingCourseFocus } : {}),
      },
      dailyStudyMinutes: derivedDailyMinutes,
      studyDays: derivedStudyDays,
      plan: effectivePreviewPlan,
      topicUpdates,
    });
  };

  const previewTotalMinutes = useMemo(
    () => effectivePreviewPlan.reduce((sum, s) => sum + s.minutes, 0),
    [effectivePreviewPlan],
  );

  const steps: Array<{ id: BuilderStep; label: string }> = [
    { id: 1, label: t('builder.steps.briefing') },
    { id: 2, label: t('builder.steps.schedule') },
    { id: 3, label: t('builder.steps.strategy') },
    { id: 4, label: t('builder.steps.preview') },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('builder.title')}
      maxWidthClass="sm:max-w-3xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as BuilderStep)}>
                <ChevronLeft size={15} /> {t('builder.prev')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                {t('builder.cancel')}
              </Button>
            )}
            <span className="hidden text-xs text-muted sm:inline">
              {hasPendingGenerated ? t('builder.keepDone') : t('builder.adjustLater')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {step < 4 && (
              <Button variant="secondary" onClick={() => setStep((s) => (s + 1) as BuilderStep)}>
                {t('builder.next')} <ChevronRight size={15} />
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={
                courses.length === 0 ||
                (effectivePreviewPlan.length === 0 && pausedIds.length === courses.length)
              }
            >
              <Sparkles size={15} /> {t('builder.apply', { n: effectivePreviewPlan.length })}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stepper + Resumo compacto sempre visível */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {steps.map((st) => {
              const active = step === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStep(st.id)}
                  className={cx(
                    'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs font-semibold transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold tabular',
                      active ? 'bg-accent text-white' : 'bg-surface text-muted',
                    )}
                  >
                    {st.id}
                  </span>
                  <span className="truncate">{st.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-pastel-sage/55 px-3.5 py-2 text-xs dark:bg-surface-2">
            <span className="font-semibold text-fg tabular">
              {t('builder.sessionsTotal', {
                n: effectivePreviewPlan.length,
                time: fmtMinutes(previewTotalMinutes),
              })}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {marathon.enabled && (
                <Badge tone="warn">
                  <Flame size={11} aria-hidden="true" />{' '}
                  {t('builder.previewActions.marathonBadge')}
                </Badge>
              )}
              <Badge tone="ok">{t('builder.badge', { d: horizonDays, m: blockMinutes })}</Badge>
            </div>
          </div>
        </div>

        {/* Passo 1: Briefing & Ponto de Partida */}
        {step === 1 && (
          <BuilderStepBriefing
            courses={courses}
            settings={settings}
            briefingText={briefingText}
            onBriefingChange={handleBriefingChange}
            insights={effectiveParsed.insights}
            disabledInsightIds={disabledInsightIds}
            onToggleInsight={handleToggleInsight}
            onRefineWithAi={handleRefineWithAi}
            isRefiningAi={isRefiningAi}
            topicOverrides={topicOverrides}
            onSetTopicOverride={(topicId, next) =>
              setTopicOverrides((prev) => ({ ...prev, [topicId]: next }))
            }
            onMarkFirstNTopics={handleMarkFirstNTopics}
          />
        )}

        {/* Passo 2: Disponibilidade por Dia & Maratona Pré-Teste */}
        {step === 2 && (
          <BuilderStepSchedule
            weekdaySchedule={weekdaySchedule}
            onChangeSchedule={setWeekdaySchedule}
            fillClassGaps={fillClassGaps}
            onChangeFillClassGaps={setFillClassGaps}
            marathon={marathon}
            onChangeMarathon={setMarathon}
          />
        )}

        {/* Passo 3: Estratégia, Mistura de Conteúdos, Duração & Foco por Cadeira */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('builder.goal')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STRATEGY_IDS.map((strategyId) => {
                  const active = strategy === strategyId;
                  return (
                    <button
                      key={strategyId}
                      type="button"
                      onClick={() => setStrategy(strategyId)}
                      className={cx(
                        'flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2 text-left transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <span className="text-xs font-bold">{t(`builder.strategy.${strategyId}`)}</span>
                      <span className="mt-0.5 text-xs opacity-75">
                        {t(`builder.strategy.${strategyId}Hint`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('builder.mix.title')}
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {MIX_IDS.map((mixId) => {
                  const active = contentMix === mixId;
                  return (
                    <button
                      key={mixId}
                      type="button"
                      onClick={() => setContentMix(mixId)}
                      className={cx(
                        'flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <span className="text-xs font-bold">{t(`builder.mix.${mixId}`)}</span>
                      <span className="mt-0.5 text-xs opacity-75">
                        {t(`builder.mix.${mixId}Hint`)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  <CalendarDays size={13} /> {t('builder.horizon')}
                </span>
                <div className="flex gap-1.5">
                  {HORIZONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setHorizonDays(d)}
                      className={cx(
                        'min-h-[44px] flex-1 rounded-xl border text-xs font-semibold tabular transition',
                        horizonDays === d
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                      )}
                    >
                      {t('builder.days', { d })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Clock size={13} /> {t('builder.block')}
                </span>
                <div className="flex gap-1.5">
                  {BLOCK_DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBlockMinutes(m)}
                      className={cx(
                        'min-h-[44px] flex-1 rounded-xl border text-xs font-semibold tabular transition',
                        blockMinutes === m
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                      )}
                    >
                      {m === 25 ? '25m 🍅' : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {courses.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {t('builder.focusByCourse')}
                  </span>
                  <span className="text-xs text-muted">{t('builder.toggleHint')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => {
                    const boosted = boostIds.includes(c.id);
                    const paused = pausedIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => cycleCourseFocus(c.id)}
                        className={cx(
                          'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                          boosted
                            ? 'border-accent bg-accent-soft text-accent-ink'
                            : paused
                              ? 'border-dashed border-line bg-surface-2/60 text-muted line-through opacity-75'
                              : 'border-line bg-surface text-fg hover:bg-surface-2',
                        )}
                      >
                        <CourseChip course={c} />
                        {boosted && <Star size={13} className="fill-current" />}
                        {paused && <PauseCircle size={13} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
              <span className="text-xs font-medium text-fg">{t('builder.mix.exclusiveFocus')}</span>
              <Switch
                checked={exclusiveTestFocus}
                onCheckedChange={setExclusiveTestFocus}
                label={t('builder.mix.exclusiveFocus')}
              />
            </div>

            {overdueCount > 0 && (
              <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-pastel-butter/50 px-3.5 py-2 text-xs dark:bg-surface-2">
                <span className="flex items-center gap-2 font-medium text-fg">
                  <Flame size={15} className="shrink-0 text-coral" />
                  {t('builder.overdue', { count: overdueCount })}
                </span>
                <input
                  type="checkbox"
                  checked={includeOverdue}
                  onChange={(e) => setIncludeOverdue(e.target.checked)}
                  className="size-5 accent-[var(--accent)]"
                />
              </label>
            )}

            {(boostIds.length > 0 ||
              pausedIds.length > 0 ||
              strategy !== 'balanced' ||
              contentMix !== 'balanced' ||
              preferredPeriod !== 'auto' ||
              blockMinutes !== 50 ||
              horizonDays !== 14) && (
              <button
                type="button"
                onClick={() => {
                  setStrategy(DEFAULT_PREFS.strategy);
                  setContentMix('balanced');
                  setHorizonDays(DEFAULT_PREFS.horizonDays);
                  setPreferredPeriod(DEFAULT_PREFS.preferredPeriod);
                  setBlockMinutes(DEFAULT_PREFS.blockMinutes);
                  setBoostIds([]);
                  setPausedIds([]);
                  setExclusiveTestFocus(false);
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-muted hover:text-fg"
              >
                <RotateCcw size={13} /> {t('builder.reset')}
              </button>
            )}
          </div>
        )}

        {/* Passo 4: Pré-visualização Interativa & Transparência */}
        {step === 4 && (
          <BuilderStepPreview
            courses={effectiveCourses}
            assessments={assessments}
            materials={materials}
            settings={previewSettings}
            today={today}
            horizonDays={horizonDays}
            weekdaySchedule={weekdaySchedule}
            preferredPeriod={preferredPeriod}
            marathon={marathon}
            pausedCourseIds={pausedIds}
            previewSessions={effectivePreviewPlan}
            existingLockedFutureCount={existingLockedFutureCount}
            lockedPreviewIds={lockedPreviewIds}
            excludedCount={removedPreviewIds.length}
            onToggleLockPreview={(id) =>
              setLockedPreviewIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            onMovePreviewToDate={handleMovePreviewToDate}
            onRemovePreview={(id) => setRemovedPreviewIds((prev) => [...prev, id])}
            onResetExcluded={() => setRemovedPreviewIds([])}
          />
        )}
      </div>
    </Modal>
  );
}
