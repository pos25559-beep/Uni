import {
  BookOpen,
  Brain,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import {
  computePracticeSessionOutcome,
  mergeTopicPracticeDeck,
  orderPracticeDeckForReview,
  preparePracticeDeckForTopic,
  selectPriorityMaterialsForTopic,
} from '../../lib/practiceEngine';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState, RECALL_LABELS, type RecallScore } from '../../lib/spacedRepetition';
import { cx } from '../../lib/uiHelpers';
import { newId, useStore } from '../../store/useStore';
import type { Course, PracticeCard, Topic } from '../../types';
import { Button, Input, Textarea } from '../ui';

export interface PracticeOutcomeSummary {
  hits: number;
  total: number;
  recallScore: RecallScore;
  confidence: Topic['confidence'];
  nextReviewDate?: string;
  srsIntervalDays?: number;
}

interface ActivePracticeDeckProps {
  course?: Course;
  topic: Topic;
  cardCount?: number;
  autoPrepare?: boolean;
  onOutcome?: (summary: PracticeOutcomeSummary) => void;
}

const RATING_OPTIONS: RecallScore[] = [1, 2, 3];

export default function ActivePracticeDeck({
  course,
  topic,
  cardCount = 4,
  autoPrepare = false,
  onOutcome,
}: ActivePracticeDeckProps) {
  const materials = useStore((s) => s.materials);
  const studyLogs = useStore((s) => s.studyLogs);
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const updateTopic = useStore((s) => s.updateTopic);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);

  const initialCards = useMemo(
    () => orderPracticeDeckForReview(topic.practiceCards ?? []).slice(0, cardCount),
    [topic.practiceCards, cardCount],
  );

  const [cards, setCards] = useState<PracticeCard[]>(initialCards);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<string, RecallScore>>({});
  const [completedSummary, setCompletedSummary] = useState<PracticeOutcomeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedSources, setUsedSources] = useState<string[]>([]);
  const [addingManual, setAddingManual] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualAnswer, setManualAnswer] = useState('');

  const courseMaterials = useMemo(
    () =>
      course
        ? selectPriorityMaterialsForTopic(materials, course.id, topic.title, 3)
        : [],
    [course, materials, topic.title],
  );

  // Sincroniza caso o tópico mude (ex.: próximo tópico na fila de revisão).
  useEffect(() => {
    const latestTopic = useStore
      .getState()
      .courses.flatMap((c) => c.topics)
      .find((t) => t.id === topic.id);
    setCards(orderPracticeDeckForReview(latestTopic?.practiceCards ?? []).slice(0, cardCount));
    setIndex(0);
    setRevealed(false);
    setRatings({});
    setCompletedSummary(null);
    setError(null);
    setUsedSources([]);
    setAddingManual(false);
  }, [topic.id, cardCount]);

  const loadFromMaterials = async (forceGenerate: boolean) => {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      const result = await preparePracticeDeckForTopic({
        course,
        topic,
        materials,
        studyLogs,
        aiConsent,
        hasCustomKey: hasCustomGeminiKey(),
        dateStr: todayStr(),
        createId: newId,
        forceGenerate,
        cardCount,
      });

      if (result.error) {
        setError(result.error);
      }
      if (result.usedMaterialTitles.length > 0) {
        setUsedSources(result.usedMaterialTitles);
      }
      if (result.generatedCount > 0) {
        updateTopic(course.id, topic.id, { practiceCards: result.mergedDeck });
      }
      if (result.cards.length > 0) {
        setCards(result.cards);
        setIndex(0);
        setRevealed(false);
        setRatings({});
        setCompletedSummary(null);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoPrepare || !aiConsent || !course) return;
    if ((topic.practiceCards?.length ?? 0) >= 3) return;
    void loadFromMaterials(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, autoPrepare]);

  const finishPracticeRun = (nextRatings: Record<string, RecallScore>, activeCards: PracticeCard[]) => {
    const list = activeCards.map((c) => nextRatings[c.id]).filter((s): s is RecallScore => Boolean(s));
    const outcome = computePracticeSessionOutcome(list, topic.confidence);
    const today = todayStr();

    let nextReviewDate: string | undefined;
    let srsIntervalDays: number | undefined;

    if (course) {
      const updatedDeck = (topic.practiceCards ?? activeCards).map((card) =>
        nextRatings[card.id] ? { ...card, lastScore: nextRatings[card.id] } : card,
      );
      const srsUpdate = computeNextSrsState(topic, outcome.recallScore, outcome.confidence, today, {
        hits: outcome.hits,
        total: outcome.total,
      });
      nextReviewDate = srsUpdate.nextReviewDate;
      srsIntervalDays = srsUpdate.srsIntervalDays;
      updateTopic(course.id, topic.id, {
        ...srsUpdate,
        practiceCards: updatedDeck,
      });
      reconcileFuturePlan();
    }

    const summary: PracticeOutcomeSummary = {
      ...outcome,
      nextReviewDate,
      srsIntervalDays,
    };
    setCompletedSummary(summary);
    onOutcome?.(summary);
  };

  const handleRateCard = (score: RecallScore) => {
    const activeCard = cards[index];
    if (!activeCard) return;
    const nextRatings = { ...ratings, [activeCard.id]: score };
    setRatings(nextRatings);

    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      finishPracticeRun(nextRatings, cards);
    }
  };

  const handleQuickSingleRating = (score: RecallScore) => {
    if (!course) return;
    const today = todayStr();
    const nextConf =
      score === 1
        ? (Math.min(2, topic.confidence) as Topic['confidence'])
        : score === 2
          ? (Math.max(3, topic.confidence) as Topic['confidence'])
          : (Math.max(4, topic.confidence) as Topic['confidence']);
    const srsUpdate = computeNextSrsState(topic, score, nextConf, today, {
      hits: score >= 2 ? 1 : 0,
      total: 1,
    });
    updateTopic(course.id, topic.id, srsUpdate);
    reconcileFuturePlan();
    const summary: PracticeOutcomeSummary = {
      hits: score >= 2 ? 1 : 0,
      total: 1,
      recallScore: score,
      confidence: nextConf,
      nextReviewDate: srsUpdate.nextReviewDate,
      srsIntervalDays: srsUpdate.srsIntervalDays,
    };
    setCompletedSummary(summary);
    onOutcome?.(summary);
  };

  const handleSaveManualCard = () => {
    const prompt = manualPrompt.trim();
    const answer = manualAnswer.trim();
    if (!prompt || !answer || !course) return;
    const merged = mergeTopicPracticeDeck(
      topic.practiceCards,
      [{ prompt, answer }],
      todayStr(),
      newId,
    );
    updateTopic(course.id, topic.id, { practiceCards: merged });
    setCards(merged.slice(0, cardCount));
    setIndex(0);
    setRevealed(false);
    setRatings({});
    setCompletedSummary(null);
    setManualPrompt('');
    setManualAnswer('');
    setAddingManual(false);
  };

  const activeCard = cards[index];

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3.5 text-left text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          <Brain size={14} className="text-accent-ink" />
          {cards.length > 0 && !completedSummary
            ? `Prática real · Cartão ${index + 1}/${cards.length}`
            : `Prática ativa · ${topic.title}`}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {course && (
            <button
              type="button"
              onClick={() => setAddingManual((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-fg transition hover:bg-surface"
            >
              <Plus size={13} />
              {addingManual ? 'Cancelar' : 'Novo cartão'}
            </button>
          )}
          {aiConsent && course && (
            <button
              type="button"
              onClick={() => void loadFromMaterials(true)}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-accent/20 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : cards.length > 0 ? (
                <RefreshCw size={13} />
              ) : (
                <Sparkles size={13} />
              )}
              {cards.length > 0 ? 'Novos da matéria' : 'Gerar dos apontamentos'}
            </button>
          )}
        </div>
      </div>

      {(usedSources.length > 0 || courseMaterials.length > 0) && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <FileText size={13} className="shrink-0 text-accent-ink" />
          <span>
            {usedSources.length > 0
              ? `Fontes lidas: ${usedSources.join(', ')}`
              : `Materiais disponíveis: ${courseMaterials.map((m) => m.title).join(', ')}`}
          </span>
        </p>
      )}

      {addingManual && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
          <Input
            value={manualPrompt}
            onChange={(e) => setManualPrompt(e.target.value)}
            placeholder="Pergunta curta (ex.: Condição de KKT no ponto ótimo?)"
            aria-label="Pergunta do cartão"
          />
          <Textarea
            rows={2}
            value={manualAnswer}
            onChange={(e) => setManualAnswer(e.target.value)}
            placeholder="Resposta / fórmula ou ideia-chave"
            aria-label="Resposta do cartão"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={handleSaveManualCard}
            disabled={!manualPrompt.trim() || !manualAnswer.trim()}
          >
            Guardar cartão no tópico
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {busy && cards.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-2/70 p-4 text-xs text-muted">
          <Loader2 size={15} className="animate-spin text-accent-ink" />
          A preparar 3–5 perguntas com base na tua matéria real…
        </div>
      ) : completedSummary ? (
        <div className="space-y-2.5 rounded-xl border border-ok/30 bg-ok/10 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok">
              <CheckCircle2 size={15} />
              {completedSummary.hits}/{completedSummary.total}{' '}
              {completedSummary.total === 1 ? 'verificação consolidada' : 'cartões consolidados'}
            </span>
            <span className="text-xs font-medium text-fg tabular">
              Confiança {completedSummary.confidence}/5
            </span>
          </div>
          {completedSummary.nextReviewDate && (
            <p className="text-xs text-fg">
              Próxima revisão ativa agendada para{' '}
              <strong className="tabular">{completedSummary.nextReviewDate}</strong> (+
              {completedSummary.srsIntervalDays}d).
            </p>
          )}
          {cards.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIndex(0);
                setRevealed(false);
                setRatings({});
                setCompletedSummary(null);
              }}
            >
              Repetir baralho
            </Button>
          )}
        </div>
      ) : activeCard ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface-2/50 p-3.5">
          {activeCard.sourceTitle && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
              <BookOpen size={12} />
              Fonte: {activeCard.sourceTitle}
            </span>
          )}
          <p className="text-sm font-medium leading-relaxed text-fg">{activeCard.prompt}</p>

          {!revealed ? (
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => setRevealed(true)}
            >
              <Eye size={14} /> Revelar resposta
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-surface p-3 text-xs leading-relaxed text-fg">
                {activeCard.answer}
              </div>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Autoavaliação do cartão">
                {RATING_OPTIONS.map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => handleRateCard(score)}
                    className={cx(
                      'min-h-11 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition',
                      score === 3
                        ? 'border-ok/40 bg-ok/10 text-ok hover:bg-ok/20'
                        : score === 2
                          ? 'border-accent/40 bg-accent-soft text-accent-ink hover:bg-accent/20'
                          : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    {RECALL_LABELS[score].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted">
            Sem olhar para os apontamentos, tenta explicar por palavras tuas a ideia central de «{topic.title}» — ou cria/gera um baralho de prática acima.
          </p>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Autoavaliação rápida do tópico">
            {RATING_OPTIONS.map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => handleQuickSingleRating(score)}
                className="min-h-11 rounded-xl border border-line bg-surface-2 px-2 py-2 text-center text-xs font-semibold text-fg transition hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
              >
                {RECALL_LABELS[score].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
