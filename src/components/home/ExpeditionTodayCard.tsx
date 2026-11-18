import { CheckCircle2, Compass, HelpCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { courseColors } from '../../lib/colors';
import type { UniAgentRecord, UniExpeditionQuestion } from '../../lib/localDb';
import { computePracticeSessionOutcome } from '../../lib/practiceEngine';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState, type RecallScore } from '../../lib/spacedRepetition';
import { inferAccessoryFromCourses } from '../../lib/uniAccessories';
import { saveUniAgent, useUniAgents } from '../../lib/uniAgents';
import { getPendingExpeditionQuestions, recomputeUniAgentProgression } from '../../lib/uniMastery';
import { showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Card } from '../ui';

interface PendingItem {
  agent: UniAgentRecord;
  question: UniExpeditionQuestion;
}

export default function ExpeditionTodayCard() {
  const { t } = useTranslation('uni');
  const courses = useStore((s) => s.courses);
  const updateTopic = useStore((s) => s.updateTopic);
  const replan = useStore((s) => s.replan);
  const agents = useUniAgents();

  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = todayStr();
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const pendingItems = useMemo<PendingItem[]>(() => {
    const out: PendingItem[] = [];
    for (const agent of agents) {
      for (const q of getPendingExpeditionQuestions(agent, today)) {
        out.push({ agent, question: q });
      }
    }
    return out.slice(0, 4);
  }, [agents, today]);

  if (pendingItems.length === 0) return null;

  const active = pendingItems[0];
  const course = courseById.get(active.agent.courseId);
  const accessory = course ? inferAccessoryFromCourses([course]) : 'default';
  const hintKey = `${active.agent.courseId}:${active.question.id}`;
  const hintVisible = Boolean(revealedHints[hintKey]);

  const handleScore = async (score: RecallScore) => {
    if (busyId) return;
    setBusyId(active.question.id);
    try {
      const { agent, question } = active;
      const freshState = useStore.getState();
      const targetCourse = freshState.courses.find((c) => c.id === agent.courseId);

      if (targetCourse && question.topicId) {
        const targetTopic = targetCourse.topics.find((tp) => tp.id === question.topicId);
        if (targetTopic) {
          const outcome = computePracticeSessionOutcome([score], targetTopic.confidence);
          const srsUpdate = computeNextSrsState(targetTopic, outcome.recallScore, outcome.confidence, today, {
            hits: outcome.hits,
            total: outcome.total,
          });
          updateTopic(targetCourse.id, targetTopic.id, srsUpdate);
          replan('topic', { silent: true });
        }
      }

      const nextExpedition = agent.expedition
        ? {
            ...agent.expedition,
            questions: agent.expedition.questions.map((item) =>
              item.id === question.id ? { ...item, answeredScore: score } : item,
            ),
          }
        : undefined;

      const updatedState = useStore.getState();
      const freshCourse = updatedState.courses.find((c) => c.id === agent.courseId);
      const baseAgent: UniAgentRecord = {
        ...agent,
        expedition: nextExpedition,
        updatedAt: new Date().toISOString(),
      };
      const finalAgent = freshCourse
        ? recomputeUniAgentProgression(
            baseAgent,
            freshCourse,
            updatedState.sessions,
            updatedState.assessments,
            today,
            updatedState.settings.gradingScale ?? 'pt20',
          ).agent
        : baseAgent;

      await saveUniAgent(finalAgent);
      showToast(t('expedition.source', { ref: question.topicTitle }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="space-y-3 border-accent/30 bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <UniBuddy
            form={active.agent.formId}
            stage={active.agent.stage}
            accessory={accessory}
            mood="curious"
            size={34}
            interactive={false}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <Compass size={14} className="text-accent-ink" aria-hidden="true" />
              <p className="text-xs font-semibold text-fg">
                {t('expedition.todayTitle')} · {active.agent.name}
              </p>
              {course && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${courseColors[course.color].soft}`}>
                  {course.shortName}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {t('expedition.todaySubtitle')} ({pendingItems.length})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRevealedHints((prev) => ({ ...prev, [hintKey]: !prev[hintKey] }))}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-muted transition hover:text-fg"
        >
          <HelpCircle size={14} aria-hidden="true" />
          {hintVisible ? t('expedition.hideHint') : t('expedition.showHint')}
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
        <p className="text-xs font-semibold text-accent-ink">{active.question.topicTitle}</p>
        <p className="mt-1 text-sm leading-relaxed text-fg">{active.question.q}</p>
        {hintVisible && (
          <p className="mt-2 rounded-lg border border-accent/25 bg-accent-soft/60 px-2.5 py-1.5 text-xs text-accent-ink">
            {active.question.hint}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          {t('expedition.source', { ref: active.question.sourceRef })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={Boolean(busyId)}
          onClick={() => void handleScore(1)}
          className="min-h-11 rounded-xl border border-danger/30 bg-danger-soft/70 px-2 text-xs font-semibold text-danger transition hover:bg-danger-soft"
        >
          {t('expedition.score1')}
        </button>
        <button
          type="button"
          disabled={Boolean(busyId)}
          onClick={() => void handleScore(2)}
          className="min-h-11 rounded-xl border border-warn/30 bg-warn-soft/70 px-2 text-xs font-semibold text-warn transition hover:bg-warn-soft"
        >
          {t('expedition.score2')}
        </button>
        <button
          type="button"
          disabled={Boolean(busyId)}
          onClick={() => void handleScore(3)}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-ok/30 bg-ok-soft/80 px-2 text-xs font-semibold text-ok transition hover:bg-ok-soft"
        >
          <CheckCircle2 size={13} aria-hidden="true" />
          {t('expedition.score3')}
        </button>
      </div>
    </Card>
  );
}
