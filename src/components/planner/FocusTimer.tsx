// Temporizador de foco para uma sessão. Baseado em timestamps (Date.now()), por isso
// continua certo mesmo com o separador em segundo plano (os timers do browser abrandam).
import { Brain, Check, Loader2, Pause, Play, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { generateRecallChallenge, type RecallChallenge } from '../../integrations/gemini';
import { courseColors } from '../../lib/colors';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState, RECALL_LABELS, type RecallScore } from '../../lib/spacedRepetition';
import { useStore } from '../../store/useStore';
import type { Course, StudySession, Topic } from '../../types';
import { Button, Ring, cx } from '../ui';

type Phase = 'idle' | 'running' | 'paused' | 'finished';
const levels: Topic['confidence'][] = [1, 2, 3, 4, 5];
const levelText = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Dominada'];
const recallScores: RecallScore[] = [1, 2, 3];
const EXTRA_MS = 5 * 60_000;

const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface FocusTimerProps {
  session: StudySession;
  course?: Course;
  topic?: Topic;
  onClose: () => void;
}

export default function FocusTimer({ session, course, topic, onClose }: FocusTimerProps) {
  const patch = useStore((s) => s.patch);
  const updateTopic = useStore((s) => s.updateTopic);
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));

  const [budgetMs, setBudgetMs] = useState(session.minutes * 60_000);
  const [phase, setPhase] = useState<Phase>('idle');
  /** Tempo acumulado antes do último arranque (ms). */
  const [accumulated, setAccumulated] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confidenceSet, setConfidenceSet] = useState<Topic['confidence'] | null>(null);
  const [recallScore, setRecallScore] = useState<RecallScore | null>(null);
  const [nextIntervalBanner, setNextIntervalBanner] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<RecallChallenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);
  const originalTitle = useRef(document.title);

  const elapsedMs = Math.min(
    budgetMs,
    accumulated + (phase === 'running' && startedAt !== null ? now - startedAt : 0),
  );
  const remainingMs = Math.max(0, budgetMs - elapsedMs);
  const running = phase === 'running';
  const color = course ? courseColors[course.color].hex : '#8b5cf6';

  // Atualiza o relógio enquanto corre.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Título do separador com o tempo restante, restaurado ao sair.
  useEffect(() => {
    const original = originalTitle.current;
    if (running) document.title = `${formatClock(remainingMs)} · Foco`;
    else document.title = original;
  }, [running, remainingMs]);

  useEffect(() => {
    const original = originalTitle.current;
    return () => { document.title = original; };
  }, []);

  // Tecla Escape fecha o overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase('running');
  };

  const pause = () => {
    const t = Date.now();
    if (startedAt !== null) setAccumulated((a) => a + (t - startedAt));
    setStartedAt(null);
    setPhase('paused');
  };

  const finish = () => {
    if (phase === 'finished') return;
    const t = Date.now();
    const total = Math.min(
      budgetMs,
      accumulated + (phase === 'running' && startedAt !== null ? t - startedAt : 0),
    );
    setAccumulated(total);
    setStartedAt(null);
    setPhase('finished');
    const minutes = Math.max(1, Math.round(total / 60_000));
    patch('sessions', session.id, { done: true, actualMinutes: minutes });
    if (session.topicId) {
      updateTopic(session.courseId, session.topicId, {
        lastStudied: todayStr(),
        ...(topic?.status === 'todo' ? { status: 'learning' as const } : {}),
      });
    }
  };

  // Ao chegar a zero, conclui sozinho.
  useEffect(() => {
    if (phase === 'running' && remainingMs === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingMs]);

  const applyPedagogicalEvaluation = (nextRecall: RecallScore | null, nextConfidence: Topic['confidence'] | null) => {
    if (!session.topicId || !topic) return;
    const finalConf = nextConfidence ?? confidenceSet ?? topic.confidence;
    if (nextRecall) {
      const srsUpdate = computeNextSrsState(topic, nextRecall, finalConf, todayStr());
      updateTopic(session.courseId, session.topicId, srsUpdate);
      setNextIntervalBanner(
        `Próxima revisão ativa agendada para ${srsUpdate.nextReviewDate} (+${srsUpdate.srsIntervalDays}d).`,
      );
    } else if (nextConfidence) {
      updateTopic(session.courseId, session.topicId, { confidence: nextConfidence });
    }
  };

  const setConfidence = (level: Topic['confidence']) => {
    setConfidenceSet(level);
    applyPedagogicalEvaluation(recallScore, level);
  };

  const selectRecall = (score: RecallScore) => {
    setRecallScore(score);
    applyPedagogicalEvaluation(score, confidenceSet);
  };

  const askUniChallenge = async () => {
    if (!topic || challengeBusy) return;
    setChallengeBusy(true);
    setRecallError(null);
    setShowHint(false);
    try {
      const res = await generateRecallChallenge(topic.title, course?.name);
      setChallenge(res);
    } catch (err) {
      setRecallError(err instanceof Error ? err.message : 'Não foi possível gerar o desafio agora.');
    } finally {
      setChallengeBusy(false);
    }
  };

  const progress = budgetMs > 0 ? elapsedMs / budgetMs : 0;
  const finished = phase === 'finished';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 p-6 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar temporizador"
        className="absolute right-4 top-4 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
      >
        <X size={20} />
      </button>

      <div className="rise flex w-full max-w-sm flex-col items-center text-center">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          {course && (
            <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5', courseColors[course.color].soft)}>
              <span className={cx('size-1.5 rounded-full', courseColors[course.color].dot)} />
              {course.shortName}
            </span>
          )}
          <span className="tabular">{session.minutes} min planeados</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          {topic?.title ?? session.notes ?? 'Estudo'}
        </h2>

        <div className="my-8">
          <Ring value={progress} size={248} stroke={10} color={color}>
            <span className="text-5xl font-semibold tracking-tight tabular">{formatClock(remainingMs)}</span>
          </Ring>
        </div>

        {!finished ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {phase === 'running' ? (
                <Button onClick={pause} className="h-12 px-6">
                  <Pause size={18} /> Pausar
                </Button>
              ) : (
                <Button variant="primary" onClick={start} className="h-12 px-6">
                  <Play size={18} /> {phase === 'paused' ? 'Retomar' : 'Iniciar'}
                </Button>
              )}
              <Button onClick={() => setBudgetMs((b) => b + EXTRA_MS)} className="h-12 px-4">
                <Plus size={16} /> 5 min
              </Button>
              <Button variant="ghost" onClick={finish} className="h-12 px-4">
                <Check size={16} /> Concluir
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted tabular">
              {Math.round(elapsedMs / 60_000)} de {Math.round(budgetMs / 60_000)} min
            </p>
          </>
        ) : (
          <div className="w-full space-y-4">
            <p className="text-sm font-semibold text-ok">Sessão concluída</p>
            {session.topicId && topic ? (
              <div className="space-y-4 text-left">
                <div className="rounded-2xl border border-line bg-surface p-3.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
                      <Brain size={14} className="text-accent" /> Recall Ativo (30s)
                    </span>
                    {aiConsent && (
                      <button
                        type="button"
                        onClick={() => void askUniChallenge()}
                        disabled={challengeBusy}
                        className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-50"
                      >
                        {challengeBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {challenge ? 'Outra pergunta' : 'Pergunta do Uni'}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-fg">
                    {challenge
                      ? challenge.question
                      : `Sem olhar para os apontamentos, tenta resumir em 2 frases a ideia-chave de «${topic.title}».`}
                  </p>
                  {challenge && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setShowHint((v) => !v)}
                        className="text-[11px] font-medium text-accent hover:underline"
                      >
                        {showHint ? 'Esconder pista' : 'Ver critério de resposta'}
                      </button>
                      {showHint && <p className="mt-1 text-[11px] text-muted">{challenge.hint}</p>}
                    </div>
                  )}
                  {recallError && <p className="mt-1.5 text-[11px] text-danger">{recallError}</p>}

                  <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Desempenho no recall ativo">
                    {recallScores.map((score) => {
                      const active = recallScore === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => selectRecall(score)}
                          className={cx(
                            'rounded-xl border px-2 py-2 text-center transition',
                            active
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface-2 text-muted hover:text-fg',
                          )}
                        >
                          <span className="block text-[11px] font-semibold">{RECALL_LABELS[score].label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {recallScore && (
                    <p className="mt-1.5 text-[11px] text-muted">{RECALL_LABELS[recallScore].hint}</p>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-xs font-medium text-muted">Confiança atual na matéria (1–5)</p>
                  <div className="mt-2 flex justify-center gap-2" role="radiogroup" aria-label="Confiança">
                    {levels.map((level) => {
                      const active = (confidenceSet ?? topic.confidence) >= level;
                      return (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={confidenceSet === level}
                          aria-label={`${level} — ${levelText[level - 1]}`}
                          title={levelText[level - 1]}
                          onClick={() => setConfidence(level)}
                          className={cx(
                            'size-9 rounded-full border transition',
                            active ? 'border-accent bg-accent' : 'border-line bg-surface-2 hover:border-muted/60',
                            confidenceSet === level && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
                          )}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-1.5 h-4 text-[11px] text-muted">
                    {confidenceSet ? levelText[confidenceSet - 1] : ''}
                  </p>
                </div>

                {nextIntervalBanner && (
                  <p className="rounded-xl bg-ok/10 px-3 py-2 text-center text-[11px] font-medium text-ok">
                    {nextIntervalBanner}
                  </p>
                )}
              </div>
            ) : null}
            <Button variant="primary" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
