// Temporizador de foco para uma sessão. Baseado em timestamps (Date.now()), por isso
// continua certo mesmo com o separador em segundo plano (os timers do browser abrandam).
import {
  Check,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { generateUniExpeditionQuestions } from '../../integrations/gemini';
import { courseColors } from '../../lib/colors';
import { FocusAudioEngine } from '../../lib/focusAudio';
import { listTopicSheetsByCourse } from '../../lib/localDb';
import {
  clearActiveFocusSnapshot,
  createDistractionTracker,
  engagePlatformFocusShield,
  loadActiveFocusSnapshot,
  loadFocusShieldPrefs,
  readShieldCapabilities,
  releasePlatformFocusShield,
  resolveRecoveredFocusState,
  saveActiveFocusSnapshot,
  saveFocusShieldPrefs,
  type FocusShieldDevicePrefs,
  type FocusSoundPreset,
  type FocusTimerPhase,
  type WebShieldHandle,
} from '../../lib/focusShield';
import {
  deactivateNativeFocusShield,
  isNativeAndroid,
  openAndroidDndSettings,
  type NativeFocusShieldCapabilities,
} from '../../lib/nativeBridge';
import { normalizeAppLanguage } from '../../lib/grading';
import { formatSessionDisplay, todayStr } from '../../lib/selectors';
import { useHubUiStore } from '../../store/useHubUiStore';
import { useStore } from '../../store/useStore';
import type { Course, StudySession, Topic } from '../../types';
import { Button, Ring } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { inferAccessoryFromCourses } from '../../lib/uniAccessories';
import { saveUniAgent, useUniAgent } from '../../lib/uniAgents';
import {
  getStageInfo,
  pickExpeditionCandidateTopics,
  recomputeUniAgentProgression,
  retrieveRelevantSheets,
  shouldPrepareExpedition,
} from '../../lib/uniMastery';
import { UniBuddy } from '../brand/UnipediaMarks';
import ActivePracticeDeck, { type PracticeOutcomeSummary } from '../practice/ActivePracticeDeck';
import UniFocusRecallPanel from '../practice/UniFocusRecallPanel';
import FocusShieldPanel from './FocusShieldPanel';

type Phase = FocusTimerPhase;
const levels: Topic['confidence'][] = [1, 2, 3, 4, 5];
const EXTRA_MS = 5 * 60_000;

const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatAwayDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${mins} min ${rem}s` : `${mins} min`;
};

interface FocusTimerProps {
  session: StudySession;
  course?: Course;
  topic?: Topic;
  onClose: () => void;
}

export default function FocusTimer({ session, course, topic, onClose }: FocusTimerProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const appLang = normalizeAppLanguage(i18n.language);
  const navigate = useNavigate();
  const patch = useStore((s) => s.patch);
  const updateTopic = useStore((s) => s.updateTopic);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const setFocusTimerOpen = useHubUiStore((s) => s.setFocusTimerOpen);
  const setFocusShieldRunning = useHubUiStore((s) => s.setFocusShieldRunning);
  const { agent: uniAgent } = useUniAgent(course?.id);

  const [initialRecovery] = useState(() => {
    if (session.done) return null;
    const snap = loadActiveFocusSnapshot();
    if (!snap || snap.sessionId !== session.id) return null;
    return resolveRecoveredFocusState(snap);
  });

  const [budgetMs, setBudgetMs] = useState(
    () => initialRecovery?.budgetMs ?? session.minutes * 60_000,
  );
  const [phase, setPhase] = useState<Phase>(() => (initialRecovery ? 'paused' : 'idle'));
  /** Tempo acumulado antes do último arranque (ms). */
  const [accumulated, setAccumulated] = useState(() => initialRecovery?.accumulatedMs ?? 0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [recoveredNotice, setRecoveredNotice] = useState(
    () => Boolean(initialRecovery && (initialRecovery.accumulatedMs > 0 || initialRecovery.distractionCount > 0)),
  );
  const [confirmEarlyFinish, setConfirmEarlyFinish] = useState(false);
  const [confidenceSet, setConfidenceSet] = useState<Topic['confidence'] | null>(null);
  const [showManualConfidence, setShowManualConfidence] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'uni_recall' | 'cards'>('uni_recall');
  const [pickedTopicId, setPickedTopicId] = useState<string>(
    () => session.topicId ?? course?.topics[0]?.id ?? '',
  );

  const [shieldPrefs, setShieldPrefs] = useState<FocusShieldDevicePrefs>(() => loadFocusShieldPrefs());
  const [shieldCaps, setShieldCaps] = useState<{
    nativeAndroid: boolean;
    native: NativeFocusShieldCapabilities;
    web: { fullscreenSupported: boolean; wakeLockSupported: boolean };
  }>(() => ({
    nativeAndroid: isNativeAndroid(),
    native: {
      dndSupported: false,
      dndGranted: false,
      screenPinningSupported: false,
      inLockTask: false,
      dndActiveByApp: false,
      interruptionFilter: 0,
    },
    web: { fullscreenSupported: false, wakeLockSupported: false },
  }));
  const [distractionCount, setDistractionCount] = useState(
    () => initialRecovery?.distractionCount ?? 0,
  );
  const [awaySeconds, setAwaySeconds] = useState(() => initialRecovery?.awaySeconds ?? 0);
  const [shieldUsed, setShieldUsed] = useState(() => initialRecovery?.shieldUsed ?? false);
  const [returnBanner, setReturnBanner] = useState<{ count: number; deltaSeconds: number } | null>(
    null,
  );

  const originalTitle = useRef(document.title);
  const audioRef = useRef<FocusAudioEngine | null>(null);
  const webShieldRef = useRef<WebShieldHandle | null>(null);
  const pendingDndEnableRef = useRef(false);
  const trackerRef = useRef(
    createDistractionTracker({
      distractionCount: initialRecovery?.distractionCount ?? 0,
      awaySeconds: initialRecovery?.awaySeconds ?? 0,
    }),
  );

  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = new FocusAudioEngine();
    return audioRef.current;
  };

  const persistSnapshot = useCallback(
    (overrides?: {
      phase?: Phase;
      budgetMs?: number;
      accumulatedMs?: number;
      startedAt?: number | null;
      distractionCount?: number;
      awaySeconds?: number;
      awayStartedAt?: number | null;
      shieldUsed?: boolean;
    }) => {
      const nextPhase = overrides?.phase ?? phase;
      if (nextPhase !== 'running' && nextPhase !== 'paused') return;
      const trackerState = trackerRef.current.getState();
      saveActiveFocusSnapshot({
        sessionId: session.id,
        phase: nextPhase,
        budgetMs: overrides?.budgetMs ?? budgetMs,
        accumulatedMs: overrides?.accumulatedMs ?? accumulated,
        startedAt: overrides?.startedAt !== undefined ? overrides.startedAt : startedAt,
        distractionCount: overrides?.distractionCount ?? trackerState.distractionCount,
        awaySeconds: overrides?.awaySeconds ?? trackerState.awaySeconds,
        awayStartedAt:
          overrides?.awayStartedAt !== undefined
            ? overrides.awayStartedAt
            : trackerState.awayStartedAt,
        shieldUsed: overrides?.shieldUsed ?? shieldUsed,
        updatedAt: Date.now(),
      });
    },
    [accumulated, budgetMs, phase, session.id, shieldUsed, startedAt],
  );

  const disengageShieldAndAudio = useCallback(async () => {
    audioRef.current?.stop();
    const handle = webShieldRef.current;
    webShieldRef.current = null;
    await releasePlatformFocusShield(handle);
  }, []);

  const elapsedMs = Math.min(
    budgetMs,
    accumulated + (phase === 'running' && startedAt !== null ? now - startedAt : 0),
  );
  const remainingMs = Math.max(0, budgetMs - elapsedMs);
  const running = phase === 'running';
  const color = course ? courseColors[course.color].hex : 'var(--accent)';

  useEffect(() => {
    setFocusTimerOpen(true);
    return () => {
      setFocusTimerOpen(false);
      setFocusShieldRunning(false);
      audioRef.current?.stop();
      const handle = webShieldRef.current;
      webShieldRef.current = null;
      void releasePlatformFocusShield(handle);
    };
  }, [setFocusShieldRunning, setFocusTimerOpen]);

  useEffect(() => {
    setFocusShieldRunning(running);
  }, [running, setFocusShieldRunning]);

  // Lê capacidades Web/Android ao montar e ao regressar das definições do Android.
  const refreshCapabilities = useCallback(async () => {
    const caps = await readShieldCapabilities();
    setShieldCaps(caps);
    if (pendingDndEnableRef.current && caps.nativeAndroid && caps.native.dndGranted) {
      pendingDndEnableRef.current = false;
      setShieldPrefs((prev) => {
        const next = { ...prev, androidDnd: true };
        saveFocusShieldPrefs(next);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    void refreshCapabilities();
    const onWinFocus = () => {
      void refreshCapabilities();
    };
    window.addEventListener('focus', onWinFocus);
    return () => window.removeEventListener('focus', onWinFocus);
  }, [refreshCapabilities]);

  // Atualiza o relógio enquanto corre e grava heartbeat local de recuperação a cada 5s.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const tickId = window.setInterval(() => setNow(Date.now()), 250);
    const saveId = window.setInterval(() => {
      persistSnapshot({ phase: 'running' });
    }, 5000);
    return () => {
      window.clearInterval(tickId);
      window.clearInterval(saveId);
    };
  }, [persistSnapshot, running]);

  // Título do separador com o tempo restante, restaurado ao sair.
  useEffect(() => {
    const original = originalTitle.current;
    if (running) document.title = `${formatClock(remainingMs)} · ${t('common:actions.focus')}`;
    else document.title = original;
  }, [running, remainingMs, t]);

  useEffect(() => {
    const original = originalTitle.current;
    return () => {
      document.title = original;
    };
  }, []);

  // Detector gentil de saída do ecrã/separador durante o foco + re-aquisição de WakeLock.
  useEffect(() => {
    if (!running) {
      trackerRef.current.resetAwayAnchor();
      return;
    }

    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      const evt = trackerRef.current.onVisibilityChange(hidden, Date.now());
      if (hidden) {
        persistSnapshot({ phase: 'running' });
        return;
      }
      if (evt) {
        setDistractionCount(evt.distractionCount);
        setAwaySeconds(evt.awaySeconds);
        setReturnBanner({ count: evt.distractionCount, deltaSeconds: evt.deltaSeconds });
        persistSnapshot({
          phase: 'running',
          distractionCount: evt.distractionCount,
          awaySeconds: evt.awaySeconds,
          awayStartedAt: null,
        });
      }
      if (shieldPrefs.wakeLock) {
        void webShieldRef.current?.reacquireWakeLock();
      }
      void refreshCapabilities();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [persistSnapshot, refreshCapabilities, running, shieldPrefs.wakeLock]);

  const handleClose = useCallback(() => {
    if (phase === 'running') {
      const t = Date.now();
      const nextAcc = startedAt !== null ? accumulated + (t - startedAt) : accumulated;
      persistSnapshot({ phase: 'paused', accumulatedMs: nextAcc, startedAt: null });
    } else if (phase === 'idle' || phase === 'finished') {
      clearActiveFocusSnapshot(session.id);
    }
    void disengageShieldAndAudio();
    onClose();
  }, [accumulated, disengageShieldAndAudio, onClose, persistSnapshot, phase, session.id, startedAt]);

  // Tecla Escape fecha o overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const engageRunningShieldAndAudio = async (prefs: FocusShieldDevicePrefs) => {
    const engaged = await engagePlatformFocusShield(prefs);
    webShieldRef.current = engaged.webHandle;
    if (engaged.shieldUsed) {
      setShieldUsed(true);
    }
    if (prefs.soundPreset !== 'none') {
      ensureAudio().start(prefs.soundPreset, prefs.soundVolume);
    } else {
      audioRef.current?.stop();
    }
    return engaged.shieldUsed;
  };

  const handleTogglePref = (key: 'fullscreen' | 'wakeLock' | 'androidDnd' | 'androidPinning') => {
    const nextPrefs: FocusShieldDevicePrefs = {
      ...shieldPrefs,
      [key]: !shieldPrefs[key],
    };
    setShieldPrefs(nextPrefs);
    saveFocusShieldPrefs(nextPrefs);

    if (running) {
      void (async () => {
        if (isNativeAndroid()) {
          await deactivateNativeFocusShield({
            restoreDnd: !nextPrefs.androidDnd,
            stopPinning: !nextPrefs.androidPinning,
          });
        }
        await webShieldRef.current?.release();
        webShieldRef.current = null;
        const activeNow = await engageRunningShieldAndAudio(nextPrefs);
        if (activeNow) {
          persistSnapshot({ phase: 'running', shieldUsed: true });
        }
      })();
    }
  };

  const handleChangeSound = (preset: FocusSoundPreset) => {
    const nextPrefs: FocusShieldDevicePrefs = { ...shieldPrefs, soundPreset: preset };
    setShieldPrefs(nextPrefs);
    saveFocusShieldPrefs(nextPrefs);
    if (running) {
      if (preset === 'none') {
        audioRef.current?.stop();
      } else {
        ensureAudio().start(preset, nextPrefs.soundVolume);
        setShieldUsed(true);
      }
    }
  };

  const handleChangeVolume = (volume: number) => {
    const nextPrefs: FocusShieldDevicePrefs = { ...shieldPrefs, soundVolume: volume };
    setShieldPrefs(nextPrefs);
    saveFocusShieldPrefs(nextPrefs);
    if (running && nextPrefs.soundPreset !== 'none') {
      ensureAudio().setVolume(volume);
    }
  };

  const handleOpenDndSettings = () => {
    pendingDndEnableRef.current = true;
    void openAndroidDndSettings();
  };

  const start = () => {
    const t = Date.now();
    setConfirmEarlyFinish(false);
    setRecoveredNotice(false);
    setReturnBanner(null);
    setStartedAt(t);
    setNow(t);
    setPhase('running');
    const willUseShield =
      shieldUsed ||
      shieldPrefs.fullscreen ||
      shieldPrefs.wakeLock ||
      shieldPrefs.soundPreset !== 'none' ||
      (shieldCaps.nativeAndroid && (shieldPrefs.androidDnd || shieldPrefs.androidPinning));
    if (willUseShield) setShieldUsed(true);
    persistSnapshot({
      phase: 'running',
      startedAt: t,
      accumulatedMs: accumulated,
      shieldUsed: willUseShield,
    });
    void engageRunningShieldAndAudio(shieldPrefs);
  };

  const pause = () => {
    const t = Date.now();
    const nextAcc = startedAt !== null ? accumulated + (t - startedAt) : accumulated;
    setAccumulated(nextAcc);
    setStartedAt(null);
    setPhase('paused');
    trackerRef.current.resetAwayAnchor();
    persistSnapshot({ phase: 'paused', accumulatedMs: nextAcc, startedAt: null, awayStartedAt: null });
    void disengageShieldAndAudio();
  };

  const syncCourseUniProgression = (allowExpedition: boolean) => {
    if (!uniAgent || !course) return;
    const freshState = useStore.getState();
    const freshCourse = freshState.courses.find((c) => c.id === course.id) ?? course;
    const today = todayStr();
    const { agent: nextAgent } = recomputeUniAgentProgression(
      uniAgent,
      freshCourse,
      freshState.sessions,
      freshState.assessments,
      today,
      freshState.settings.gradingScale ?? 'pt20',
    );
    void saveUniAgent(nextAgent).then(async () => {
      if (!allowExpedition || !aiConsent || !shouldPrepareExpedition(nextAgent, freshCourse, today)) {
        return;
      }
      try {
        const forDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const candidateTopics = pickExpeditionCandidateTopics(freshCourse, forDate);
        const allSheets = await listTopicSheetsByCourse(freshCourse.id);
        const relevant = retrieveRelevantSheets(
          candidateTopics.map((ct) => ct.title).join(' '),
          allSheets,
          candidateTopics[0]?.id,
          4,
        );
        const expedition = await generateUniExpeditionQuestions({
          courseName: freshCourse.name,
          agent: nextAgent,
          candidateTopics,
          sheets: relevant,
          forDate,
        });
        await saveUniAgent({
          ...nextAgent,
          expedition,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Falha silenciosa em background; aluno pode preparar manualmente ou na próxima sessão.
      }
    });
  };

  const commitFinish = (totalMs: number) => {
    if (phase === 'finished') return;
    setConfirmEarlyFinish(false);
    setRecoveredNotice(false);
    setReturnBanner(null);
    setAccumulated(totalMs);
    setStartedAt(null);
    setPhase('finished');
    clearActiveFocusSnapshot(session.id);
    void disengageShieldAndAudio();

    const trackerState = trackerRef.current.getState();
    const finalDistractions = Math.min(500, Math.max(distractionCount, trackerState.distractionCount));
    const finalAwaySeconds = Math.min(86400, Math.max(awaySeconds, trackerState.awaySeconds));
    const minutes = Math.max(1, Math.round(totalMs / 60_000));

    patch('sessions', session.id, {
      done: true,
      actualMinutes: minutes,
      focusDistractions: finalDistractions,
      focusAwaySeconds: finalAwaySeconds,
      focusShieldUsed: shieldUsed,
    });
    if (session.topicId) {
      updateTopic(session.courseId, session.topicId, {
        lastStudied: todayStr(),
        ...(topic?.status === 'todo' ? { status: 'learning' as const } : {}),
      });
    }
    reconcileFuturePlan();
    syncCourseUniProgression(true);
  };

  const finish = () => {
    if (phase === 'finished') return;
    const t = Date.now();
    const total = Math.min(
      budgetMs,
      accumulated + (phase === 'running' && startedAt !== null ? t - startedAt : 0),
    );
    if (total < budgetMs * 0.8) {
      setAccumulated(total);
      setStartedAt(null);
      if (phase === 'running') {
        setPhase('paused');
        persistSnapshot({ phase: 'paused', accumulatedMs: total, startedAt: null });
        void disengageShieldAndAudio();
      }
      setConfirmEarlyFinish(true);
      return;
    }
    commitFinish(total);
  };

  const discardSession = () => {
    clearActiveFocusSnapshot(session.id);
    void disengageShieldAndAudio();
    onClose();
  };

  // Ao chegar a zero, conclui sozinho.
  useEffect(() => {
    if (phase === 'running' && remainingMs === 0) commitFinish(budgetMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingMs]);

  const activePracticeTopic = topic ?? course?.topics.find((t) => t.id === pickedTopicId);

  const setConfidence = (level: Topic['confidence']) => {
    setConfidenceSet(level);
    if (!activePracticeTopic) return;
    updateTopic(session.courseId, activePracticeTopic.id, { confidence: level });
    reconcileFuturePlan();
    syncCourseUniProgression(false);
  };

  const handlePracticeOutcome = (outcome: PracticeOutcomeSummary) => {
    setConfidenceSet(outcome.confidence);
    patch('sessions', session.id, {
      practiceHits: Math.min(100, outcome.hits),
      practiceTotal: Math.min(100, outcome.total),
    });
  };

  const progress = budgetMs > 0 ? elapsedMs / budgetMs : 0;
  const finished = phase === 'finished';
  const elapsedMin = Math.round(elapsedMs / 60_000);
  const recordedMin = Math.max(1, elapsedMin);
  const remainingBudgetMin = Math.max(0, Math.round(budgetMs / 60_000) - recordedMin);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-bg/95 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-md">
      <button
        type="button"
        onClick={handleClose}
        aria-label={t('plan:focus.ui.closeAria')}
        className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
      >
        <X size={20} />
      </button>

      <div className="rise my-auto flex w-full max-w-sm flex-col items-center text-center">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          {course && (
            <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5', courseColors[course.color].soft)}>
              <span className={cx('size-1.5 rounded-full', courseColors[course.color].dot)} />
              {course.shortName}
            </span>
          )}
          <span className="tabular">{t('plan:focus.planned', { minutes: session.minutes })}</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          {formatSessionDisplay(session, topic, appLang).title}
        </h2>

        {phase === 'idle' && uniAgent && course && (
          <div className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left shadow-[var(--shadow-card)]">
            <UniBuddy
              size={28}
              mood="calm"
              form={uniAgent.formId}
              stage={uniAgent.stage}
              accessory={inferAccessoryFromCourses([course])}
              className="shrink-0"
            />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-fg">{uniAgent.name}:</span>{' '}
              {topic
                ? uniAgent.notebook.weakSpots[0]
                  ? t('plan:focus.focusWatchWeak', {
                      topic: topic.title,
                      weak: uniAgent.notebook.weakSpots[0].topic,
                    })
                  : t('plan:focus.readyToAccompany', { topic: topic.title })
                : `${getStageInfo(uniAgent.stage, appLang).localizedLabel} (${uniAgent.mastery}%)`}
            </p>
          </div>
        )}

        {recoveredNotice && !finished && (
          <div className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-left text-xs text-accent-ink">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <RotateCcw size={13} className="shrink-0" />
              {t('plan:focus.ui.recovered')}
            </span>
          </div>
        )}

        {returnBanner && !finished && (
          <div
            role="status"
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-xs text-fg shadow-[var(--shadow-card)]"
          >
            <span>
              {t('plan:focus.ui.returnBanner', {
                count: returnBanner.count,
                away: formatAwayDuration(returnBanner.deltaSeconds),
              })}
            </span>
            <button
              type="button"
              onClick={() => setReturnBanner(null)}
              aria-label={t('plan:focus.ui.dismiss')}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="my-6">
          <Ring value={progress} size={228} stroke={10} color={color}>
            {finished ? (
              <div className="flex flex-col items-center">
                <span className="text-4xl font-semibold tracking-tight tabular">{recordedMin} min</span>
                <span className="mt-1 text-xs text-muted tabular">
                  {t('plan:focus.ui.ofPlanned', { n: Math.round(budgetMs / 60_000) })}
                </span>
              </div>
            ) : (
              <span className="text-5xl font-semibold tracking-tight tabular">{formatClock(remainingMs)}</span>
            )}
          </Ring>
        </div>

        {!finished ? (
          <>
            {confirmEarlyFinish ? (
              <div className="w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]">
                <p className="text-sm font-semibold text-fg">{t('plan:focus.ui.earlyTitle')}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {elapsedMs < 60_000
                    ? t('plan:focus.ui.earlyUnder1')
                    : t('plan:focus.ui.earlyBody', { rec: recordedMin, left: remainingBudgetMin })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => commitFinish(elapsedMs)}>
                    {t('plan:focus.ui.saveN', { n: recordedMin })}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={start}>
                    {t('plan:focus.ui.keepGoing')}
                  </Button>
                  {elapsedMs < 60_000 && (
                    <Button variant="ghost" size="sm" onClick={discardSession}>
                      {t('plan:focus.ui.discard')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {phase === 'running' ? (
                    <Button onClick={pause} className="h-12 px-6">
                      <Pause size={18} /> {t('plan:focus.ui.pause')}
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={start} className="h-12 px-6">
                      <Play size={18} /> {phase === 'paused' ? t('plan:focus.ui.resume') : t('plan:focus.ui.startBtn')}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const nextBudget = budgetMs + EXTRA_MS;
                      setBudgetMs(nextBudget);
                      persistSnapshot({ budgetMs: nextBudget });
                    }}
                    className="h-12 px-4"
                  >
                    <Plus size={16} /> 5 min
                  </Button>
                  <Button variant="ghost" onClick={finish} className="h-12 px-4">
                    <Check size={16} /> {t('plan:focus.ui.finish')}
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted tabular">
                  {t('plan:focus.ui.nOf', { a: elapsedMin, b: Math.round(budgetMs / 60_000) })}
                  {distractionCount > 0 && ` · ${t('plan:focus.ui.exitCount', { count: distractionCount })}`}
                </p>

                <FocusShieldPanel
                  prefs={shieldPrefs}
                  running={running}
                  nativeAndroid={shieldCaps.nativeAndroid}
                  nativeCaps={shieldCaps.native}
                  webCaps={shieldCaps.web}
                  onTogglePref={handleTogglePref}
                  onChangeSound={handleChangeSound}
                  onChangeVolume={handleChangeVolume}
                  onOpenDndSettings={handleOpenDndSettings}
                />

                {uniAgent && course && phase !== 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (phase === 'running') pause();
                      onClose();
                      navigate(`/assistente?course=${course.id}`);
                    }}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-xs text-muted transition hover:border-line-strong hover:text-fg"
                  >
                    <UniBuddy
                      size={22}
                      mood={phase === 'running' ? 'sleeping' : 'calm'}
                      dormant={phase === 'running'}
                      form={uniAgent.formId}
                      stage={uniAgent.stage}
                      accessory={inferAccessoryFromCourses([course])}
                    />
                    <span>{t('plan:focus.silentStatus', { name: uniAgent.name })}</span>
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <div className="w-full space-y-4">
            <p className="text-sm font-semibold text-ok">{t('plan:focus.ui.done')}</p>

            <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs">
              {distractionCount === 0 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ok">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {t('plan:focus.ui.clean')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                  <Shield size={15} className="text-muted" aria-hidden="true" />
                  {t('plan:focus.ui.exits', { n: distractionCount, away: formatAwayDuration(awaySeconds) })}
                </span>
              )}
              {shieldUsed && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                  {t('plan:focus.ui.shield')}
                </span>
              )}
            </div>

            {!topic && course && course.topics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-left">
                <span className="text-xs font-medium text-muted">{t('plan:focus.ui.practiceTopic')}</span>
                {course.topics.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPickedTopicId(t.id)}
                    className={cx(
                      'min-h-11 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition',
                      activePracticeTopic?.id === t.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}

            {activePracticeTopic ? (
              <div className="space-y-3 text-left">
                {uniAgent && course && aiConsent && (
                  <div
                    role="tablist"
                    aria-label={t('plan:focus.ui.modeAria')}
                    className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface-2 p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={practiceMode === 'uni_recall'}
                      onClick={() => setPracticeMode('uni_recall')}
                      className={cx(
                        'min-h-11 rounded-xl px-2.5 text-xs font-medium transition',
                        practiceMode === 'uni_recall'
                          ? 'bg-surface text-fg shadow-[var(--shadow-card)]'
                          : 'text-muted hover:text-fg',
                      )}
                    >
                      {t('plan:focus.tabUniRecall')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={practiceMode === 'cards'}
                      onClick={() => setPracticeMode('cards')}
                      className={cx(
                        'min-h-11 rounded-xl px-2.5 text-xs font-medium transition',
                        practiceMode === 'cards'
                          ? 'bg-surface text-fg shadow-[var(--shadow-card)]'
                          : 'text-muted hover:text-fg',
                      )}
                    >
                      {t('plan:focus.tabCards')}
                    </button>
                  </div>
                )}

                {uniAgent && course && aiConsent && practiceMode === 'uni_recall' ? (
                  <UniFocusRecallPanel
                    key={`${activePracticeTopic.id}-${uniAgent.courseId}`}
                    course={course}
                    topic={activePracticeTopic}
                    agent={uniAgent}
                    onOutcome={handlePracticeOutcome}
                    onOpenTutor={() => {
                      onClose();
                      navigate(`/assistente?course=${course.id}`);
                    }}
                    onFallbackToDeck={() => setPracticeMode('cards')}
                  />
                ) : (
                  <ActivePracticeDeck
                    course={course}
                    topic={activePracticeTopic}
                    autoPrepare
                    onOutcome={handlePracticeOutcome}
                  />
                )}

                <div className="rounded-2xl border border-line bg-surface-2/60 px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowManualConfidence((v) => !v)}
                    className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
                  >
                    {t('plan:focus.ui.adjust', { n: confidenceSet ?? activePracticeTopic.confidence })}
                    {showManualConfidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showManualConfidence && (
                    <div className="pb-2 pt-1">
                      <div className="flex justify-center gap-2" role="radiogroup" aria-label={t('plan:focus.ui.confidence')}>
                        {levels.map((level) => {
                          const active = (confidenceSet ?? activePracticeTopic.confidence) >= level;
                          return (
                            <button
                              key={level}
                              type="button"
                              role="radio"
                              aria-checked={confidenceSet === level}
                              aria-label={`${level} — ${t(`plan:focus.ui.level${level}`)}`}
                              title={t(`plan:focus.ui.level${level}`)}
                              onClick={() => setConfidence(level)}
                              className={cx(
                                'size-11 rounded-full border transition',
                                active ? 'border-accent bg-accent' : 'border-line bg-surface-2 hover:border-muted/60',
                                confidenceSet === level && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
                              )}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-muted">
                        {t(`plan:focus.ui.level${confidenceSet ?? activePracticeTopic.confidence}`)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <Button variant="primary" onClick={handleClose} className="w-full">
              {t('plan:focus.ui.close')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
