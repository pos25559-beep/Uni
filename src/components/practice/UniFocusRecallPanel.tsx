import { CheckCircle2, HelpCircle, Loader2, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  evaluateUniRecall,
  generateUniRecallQuestion,
  type UniRecallEvaluationResult,
  type UniRecallPromptResult,
} from '../../integrations/gemini';
import {
  listTopicSheetsByCourse,
  type TopicSheetRecord,
  type UniAgentRecord,
  type UniStage,
} from '../../lib/localDb';
import { computePracticeSessionOutcome } from '../../lib/practiceEngine';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState, RECALL_LABELS } from '../../lib/spacedRepetition';
import { cx } from '../../lib/uiHelpers';
import { inferAccessoryFromCourses } from '../../lib/uniAccessories';
import { saveUniAgent } from '../../lib/uniAgents';
import {
  getStageInfo,
  recomputeUniAgentProgression,
  retrieveRelevantSheets,
  sanitizeNotebookDelta,
} from '../../lib/uniMastery';
import { useStore } from '../../store/useStore';
import type { AppLanguage, Course, Topic } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Textarea } from '../ui';
import type { PracticeOutcomeSummary } from './ActivePracticeDeck';

interface UniFocusRecallPanelProps {
  course: Course;
  topic: Topic;
  agent: UniAgentRecord;
  onOutcome?: (outcome: PracticeOutcomeSummary) => void;
  onOpenTutor?: () => void;
  onFallbackToDeck?: () => void;
}

const SCORE_TONE: Record<1 | 2 | 3, string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-warn-soft text-warn',
  3: 'bg-ok-soft text-ok',
};

export default function UniFocusRecallPanel({
  course,
  topic,
  agent,
  onOutcome,
  onOpenTutor,
  onFallbackToDeck,
}: UniFocusRecallPanelProps) {
  const { t, i18n } = useTranslation('plan');
  const appLang: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'pt-PT';
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const updateTopic = useStore((s) => s.updateTopic);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);

  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [promptData, setPromptData] = useState<UniRecallPromptResult | null>(null);
  const [sheets, setSheets] = useState<TopicSheetRecord[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<{
    result: UniRecallEvaluationResult;
    nextReviewDate: string;
    srsIntervalDays: number;
    notebookSaved: boolean;
    stageUpFrom: UniStage | null;
    nextStageLabel: string;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const courseSheets = await listTopicSheetsByCourse(course.id);
        const relevant = retrieveRelevantSheets(topic.title, courseSheets, topic.id, 3);
        if (!active) return;
        setSheets(relevant);

        const generated = await generateUniRecallQuestion({
          topicTitle: topic.title,
          courseName: course.name,
          agent,
          sheets: relevant,
          examMode: agent.stage >= 3,
        });
        if (!active) return;
        setPromptData(generated);
        setError(null);
      } catch (err) {
        if (!active) return;
        setPromptData({
          question: `Explica em 2 frases, sem olhar para os apontamentos, a ideia essencial de «${topic.title}».`,
          hint: 'Inclui a definição principal e um exemplo ou condição onde se aplica.',
        });
        setError(err instanceof Error ? err.message : 'Não foi possível gerar pergunta personalizada agora.');
      } finally {
        if (active) setLoadingPrompt(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [agent, course.id, course.name, reloadNonce, topic.id, topic.title]);

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (trimmed.length < 3 || !promptData || evaluating) return;

    setEvaluating(true);
    setError(null);
    try {
      const result = await evaluateUniRecall({
        topicTitle: topic.title,
        question: promptData.question,
        studentAnswer: trimmed,
        courseName: course.name,
        agent,
        sheets,
      });

      const outcome = computePracticeSessionOutcome([result.score], topic.confidence);
      const today = todayStr();
      const srsUpdate = computeNextSrsState(topic, outcome.recallScore, outcome.confidence, today, {
        hits: outcome.hits,
        total: outcome.total,
      });

      updateTopic(course.id, topic.id, srsUpdate);
      reconcileFuturePlan();

      const freshState = useStore.getState();
      const freshCourse = freshState.courses.find((c) => c.id === course.id) ?? course;

      const hasDelta = Boolean(agent.memoryEnabled && (result.detectedWeakSpot || result.matchedStrength));
      const nextNotebook = hasDelta
        ? sanitizeNotebookDelta(agent.notebook, {
            weakSpot: result.detectedWeakSpot,
            strength: result.matchedStrength,
          })
        : agent.notebook;

      const { agent: progressed, stageUpFrom } = recomputeUniAgentProgression(
        { ...agent, notebook: nextNotebook },
        freshCourse,
        freshState.sessions,
        freshState.assessments,
        today,
        gradingScale,
      );
      await saveUniAgent(progressed);

      setEvaluation({
        result,
        nextReviewDate: srsUpdate.nextReviewDate ?? today,
        srsIntervalDays: srsUpdate.srsIntervalDays ?? 1,
        notebookSaved: hasDelta,
        stageUpFrom,
        nextStageLabel: getStageInfo(progressed.stage, appLang).localizedLabel,
      });

      onOutcome?.({
        ...outcome,
        nextReviewDate: srsUpdate.nextReviewDate,
        srsIntervalDays: srsUpdate.srsIntervalDays,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível avaliar a resposta agora. Podes usar o Baralho de Cartões.',
      );
    } finally {
      setEvaluating(false);
    }
  };

  const handleAnother = () => {
    setLoadingPrompt(true);
    setEvaluation(null);
    setAnswer('');
    setShowHint(false);
    setError(null);
    setReloadNonce((n) => n + 1);
  };

  const stageInfo = getStageInfo(agent.stage, appLang);
  const accessory = inferAccessoryFromCourses([course]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <UniBuddy
            size={30}
            mood={evaluation?.result.score === 3 ? 'happy' : 'calm'}
            form={agent.formId}
            stage={agent.stage}
            accessory={accessory}
            className="shrink-0"
          />
          <div>
            <p className="text-xs font-semibold text-fg">
              {t('focus.recallTitle', { name: agent.name })}
              {agent.stage >= 3 && (
                <span className="ml-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
                  {t('focus.examModeBadge')}
                </span>
              )}
            </p>
            <p className="text-xs text-muted">
              {stageInfo.localizedLabel} ({agent.mastery}%)
              {sheets.length > 0 && ` · ${sheets.length} ${sheets.length === 1 ? 'ficha' : 'fichas'}`}
            </p>
          </div>
        </div>

        {!evaluation && promptData?.hint && !loadingPrompt && (
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-muted transition hover:text-fg"
          >
            <HelpCircle size={14} aria-hidden="true" />
            {showHint ? t('focus.hideHint') : t('focus.showHint')}
          </button>
        )}
      </div>

      {loadingPrompt ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3.5 py-4 text-xs text-muted">
          <Loader2 size={15} className="animate-spin text-accent-ink" />
          A preparar pergunta de recall para «{topic.title}»…
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
            <p className="text-sm leading-relaxed text-fg">{promptData?.question}</p>
            {showHint && promptData?.hint && !evaluation && (
              <p className="mt-2 rounded-lg border border-accent/25 bg-accent-soft/60 px-2.5 py-1.5 text-xs text-accent-ink">
                Pista: {promptData.hint}
              </p>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft/60 px-3 py-2 text-xs text-warn">
              <p>{error}</p>
              {onFallbackToDeck && (
                <button
                  type="button"
                  onClick={onFallbackToDeck}
                  className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
                >
                  Trocar para Baralho de Cartões
                </button>
              )}
            </div>
          )}

          {!evaluation ? (
            <div className="mt-3 space-y-2.5">
              <Textarea
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t('focus.answerPlaceholder')}
                aria-label={t('focus.answerPlaceholder')}
              />
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={evaluating || answer.trim().length < 3}
                className="w-full"
              >
                {evaluating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> {t('focus.evaluatingBtn', { name: agent.name })}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> {t('focus.evaluateBtn')}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    SCORE_TONE[evaluation.result.score],
                  )}
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {RECALL_LABELS[evaluation.result.score].label} ({evaluation.result.score}/3)
                </span>
                <span className="text-xs text-muted tabular">
                  {t('focus.nextReview', {
                    date: evaluation.nextReviewDate,
                    days: evaluation.srsIntervalDays,
                  })}
                </span>
              </div>

              <div className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-xs leading-relaxed text-fg">
                {evaluation.result.feedback}
              </div>

              {evaluation.stageUpFrom !== null && (
                <div className="rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-medium text-accent-ink">
                  {t('focus.stageUp', { name: agent.name, stage: evaluation.nextStageLabel })}
                </div>
              )}

              {evaluation.notebookSaved && (
                <p className="text-xs text-muted">{t('focus.notebookSaved', { name: agent.name })}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handleAnother} className="flex-1">
                  <RefreshCw size={14} /> {t('focus.anotherRecall')}
                </Button>
                {onOpenTutor && (
                  <Button variant="ghost" size="sm" onClick={onOpenTutor} className="flex-1">
                    <MessageSquareText size={14} /> {t('focus.openTutor')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
