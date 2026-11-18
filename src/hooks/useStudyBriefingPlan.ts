import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiConsentRequiredError, generateWeeklyPlanFromBriefing } from '../integrations/gemini';
import { hasAiAccess } from '../lib/aiAccess';
import {
  buildBriefingPlannerSnapshot,
  buildOfflineBriefingWeeklyFallback,
  groundLlmWeeklyPlanDetailed,
} from '../lib/studyBriefingPlan';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  Settings,
  StudyLogEntry,
  StudySession,
  WeeklyCheckIn,
} from '../types';

export type BriefingHookStatus = 'idle' | 'loading' | 'preview' | 'error';

interface UseStudyBriefingPlanArgs {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials: Material[];
  sessions: StudySession[];
  settings: Settings;
  today: string;
  difficultCourseIds?: ID[];
  weeklyCheckIns?: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  extraActivities?: ExtraActivity[];
}

export function useStudyBriefingPlan({
  courses,
  assessments,
  classes,
  events,
  materials,
  sessions,
  settings,
  today,
  difficultCourseIds,
  weeklyCheckIns,
  studyLogs,
  extraActivities,
}: UseStudyBriefingPlanArgs) {
  const { t, i18n } = useTranslation('plan');

  const [briefingText, setBriefingText] = useState<string>(
    () => settings.plannerPrefs?.briefingNote ?? '',
  );
  const [status, setStatus] = useState<BriefingHookStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsAiConsent, setNeedsAiConsent] = useState(false);
  const [isOfflinePreview, setIsOfflinePreview] = useState(false);
  const [strategySummary, setStrategySummary] = useState('');
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [refinementsApplied, setRefinementsApplied] = useState<string[]>([]);
  const [previewSessions, setPreviewSessions] = useState<StudySession[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const preservedExisting = useMemo(
    () => sessions.filter((s) => !s.generated || s.done || s.locked || s.date < today),
    [sessions, today],
  );

  const effectivePreviewSessions = useMemo(() => {
    const excluded = new Set(excludedIds);
    const locked = new Set(lockedIds);
    return previewSessions
      .filter((s) => !excluded.has(s.id))
      .map((s) => (locked.has(s.id) ? { ...s, locked: true } : s));
  }, [previewSessions, excludedIds, lockedIds]);

  const summarizeCurrentPreview = useCallback(
    (list: StudySession[]): string => {
      const courseMap = new Map(courses.map((c) => [c.id, c.shortName]));
      return list
        .slice(0, 18)
        .map(
          (s) =>
            `${s.date} ${s.start ?? ''} (${s.minutes}m) ${courseMap.get(s.courseId) ?? s.courseId}${s.notes ? `: ${s.notes}` : ''}`,
        )
        .join('\n');
    },
    [courses],
  );

  const runLlmGeneration = useCallback(
    async (text: string, nextRefinements: string[], currentSummary?: string) => {
      const trimmed = text.trim();
      if (!trimmed || courses.length === 0) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setErrorMessage(null);
      setNeedsAiConsent(false);

      if (!hasAiAccess(settings)) {
        setNeedsAiConsent(true);
        setErrorMessage(t('studyBriefing.aiConsentNeeded'));
        setStatus('error');
        return;
      }

      try {
        const snapshot = buildBriefingPlannerSnapshot({
          courses,
          assessments,
          classes,
          events,
          settings,
          today,
        });
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const llmOutput = await generateWeeklyPlanFromBriefing({
          briefingText: trimmed,
          plannerSnapshot: snapshot,
          refinementHistory: nextRefinements,
          currentPlanSummary: currentSummary,
          lang: i18n.language,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const { sessions: grounded, dropped } = groundLlmWeeklyPlanDetailed({
          llmOutput,
          courses,
          assessments,
          classes,
          events,
          materials,
          settings,
          existingPreservedSessions: preservedExisting,
          today,
          nowMinutes,
        });

        if (grounded.length === 0) {
          setErrorMessage(t('studyBriefing.noFreeSlotsError'));
          setStatus('error');
          return;
        }

        setIsOfflinePreview(false);
        setStrategySummary(
          dropped > 0
            ? `${llmOutput.strategySummary} ${t('studyBriefing.blocksDropped', { count: dropped })}`.trim()
            : llmOutput.strategySummary,
        );
        setSuggestedFollowUps(llmOutput.suggestedFollowUps);
        setRefinementsApplied(nextRefinements);
        setPreviewSessions(grounded);
        setExcludedIds([]);
        setLockedIds([]);
        setStatus('preview');
      } catch (err) {
        if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') {
          return;
        }
        if (err instanceof AiConsentRequiredError) {
          setNeedsAiConsent(true);
          setErrorMessage(t('studyBriefing.aiConsentNeeded'));
          setStatus('error');
          return;
        }
        const msg =
          err instanceof Error && err.message.trim()
            ? err.message
            : t('studyBriefing.genericError');
        setErrorMessage(msg);
        setStatus('error');
      }
    },
    [
      assessments,
      classes,
      courses,
      events,
      i18n.language,
      materials,
      preservedExisting,
      settings,
      t,
      today,
    ],
  );

  const generateFromBriefing = useCallback(
    async (textOverride?: string) => {
      const targetText = textOverride ?? briefingText;
      if (textOverride !== undefined) setBriefingText(textOverride);
      await runLlmGeneration(targetText, []);
    },
    [briefingText, runLlmGeneration],
  );

  const refinePreview = useCallback(
    async (directive: string) => {
      const nextRefinements = [...refinementsApplied, directive].slice(-5);
      const summary = summarizeCurrentPreview(effectivePreviewSessions);
      await runLlmGeneration(briefingText, nextRefinements, summary);
    },
    [
      briefingText,
      effectivePreviewSessions,
      refinementsApplied,
      runLlmGeneration,
      summarizeCurrentPreview,
    ],
  );

  const generateOfflineFallback = useCallback(() => {
    const now = new Date();
    const { sessions: fallbackSessions, strategySummary: offlineSummary } =
      buildOfflineBriefingWeeklyFallback({
        briefingText,
        courses,
        assessments,
        classes,
        events,
        materials,
        settings,
        existingPreservedSessions: preservedExisting,
        difficultCourseIds,
        weeklyCheckIns,
        studyLogs,
        extraActivities,
        today,
        nowMinutes: now.getHours() * 60 + now.getMinutes(),
      });

    if (fallbackSessions.length === 0) {
      setErrorMessage(t('studyBriefing.noFreeSlotsError'));
      setStatus('error');
      return;
    }

    setIsOfflinePreview(true);
    setNeedsAiConsent(false);
    setErrorMessage(null);
    setStrategySummary(offlineSummary);
    setSuggestedFollowUps([]);
    setPreviewSessions(fallbackSessions);
    setExcludedIds([]);
    setLockedIds([]);
    setStatus('preview');
  }, [
    assessments,
    briefingText,
    classes,
    courses,
    difficultCourseIds,
    events,
    extraActivities,
    materials,
    preservedExisting,
    settings,
    studyLogs,
    t,
    today,
    weeklyCheckIns,
  ]);

  const cancelLoading = useCallback(() => {
    abortRef.current?.abort();
    setStatus(previewSessions.length > 0 ? 'preview' : 'idle');
  }, [previewSessions.length]);

  const toggleLock = useCallback((id: string) => {
    setLockedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const excludeSession = useCallback((id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const restoreExcluded = useCallback(() => {
    setExcludedIds([]);
  }, []);

  const discardPreview = useCallback(() => {
    abortRef.current?.abort();
    setPreviewSessions([]);
    setExcludedIds([]);
    setLockedIds([]);
    setRefinementsApplied([]);
    setSuggestedFollowUps([]);
    setStrategySummary('');
    setIsOfflinePreview(false);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  return {
    briefingText,
    setBriefingText,
    status,
    errorMessage,
    needsAiConsent,
    isOfflinePreview,
    strategySummary,
    suggestedFollowUps,
    refinementsApplied,
    previewSessions,
    effectivePreviewSessions,
    lockedIds,
    excludedIds,
    generateFromBriefing,
    refinePreview,
    generateOfflineFallback,
    cancelLoading,
    toggleLock,
    excludeSession,
    restoreExcluded,
    discardPreview,
  };
}
