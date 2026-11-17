import { tr } from '../i18n/tr';
import {
  generateMaterialPracticeSet,
  type ChatAttachment,
  type GeneratedPracticeCardDraft,
  type NotebookSourceInput,
} from '../integrations/gemini';
import { getAiMaterialLimit, resolveMaterialsForAI } from './materialContent';
import type { RecallScore } from './spacedRepetition';
import type { Course, Material, PracticeCard, StudyLogEntry, Topic } from '../types';

export const MAX_PRACTICE_CARDS_PER_TOPIC = 8;

const STOP_WORDS = new Set([
  'para', 'como', 'sobre', 'entre', 'com', 'dos', 'das', 'nos', 'nas', 'uma', 'uns', 'umas',
  'aula', 'parte', 'tema', 'capitulo', 'capítulo', 'introducao', 'introdução',
]);

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 4 && !STOP_WORDS.has(tok));
}

/**
 * Seleciona até `limit` materiais mais relevantes da cadeira para fundamentar a prática
 * (priorizando testes/fichas/fixados e títulos alinhados ao tópico estudado).
 */
export function selectPriorityMaterialsForTopic(
  materials: Material[],
  courseId: string,
  topicTitle: string,
  limit = 3,
): Material[] {
  const topicTokens = significantTokens(topicTitle);
  const courseMaterials = materials.filter((m) => m.courseId === courseId);
  if (courseMaterials.length === 0) return [];

  const scored = courseMaterials.map((m) => {
    let score = 0;
    if (m.pinned) score += 3;
    if (m.category === 'teste_antigo' || m.category === 'exame_antigo' || m.category === 'ficha') {
      score += 3;
    } else if (m.category === 'sebenta' || m.category === 'slide_oficial') {
      score += 2;
    }
    if (m.provider === 'upload') score += 2;
    if (m.hasSolution) score += 1;

    if (topicTokens.length > 0) {
      const matTokens = new Set(significantTokens(`${m.title} ${m.fileName ?? ''}`));
      let overlap = 0;
      for (const tok of topicTokens) {
        if (matTokens.has(tok)) overlap += 1;
      }
      score += Math.min(6, overlap * 3);
    }

    return { material: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.material);
}

/** Resume notas e dificuldades recentes do Diário associadas à cadeira/tópico. */
export function buildDiaryPracticeContext(
  studyLogs: StudyLogEntry[],
  courseId: string,
  topicId?: string,
): string {
  const relevant = [...studyLogs]
    .filter((l) => l.courseId === courseId)
    .sort((a, b) => {
      const aMatch = topicId && a.topicIds?.includes(topicId) ? 1 : 0;
      const bMatch = topicId && b.topicIds?.includes(topicId) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);

  const lines = relevant
    .map((l) => {
      const parts = [
        l.topicTitle ? `tópico: ${l.topicTitle}` : '',
        l.studiedSummary ? `revisto: ${l.studiedSummary}` : '',
        l.difficulties ? `dificuldades: ${l.difficulties}` : '',
        l.studyFocus ? `foco: ${l.studyFocus}` : '',
      ].filter(Boolean);
      return parts.length > 0 ? `- [${l.date}] ${parts.join(' · ')}` : '';
    })
    .filter(Boolean);

  return lines.join('\n');
}

/** Ordena os cartões de prática colocando primeiro os menos dominados / mais antigos. */
export function orderPracticeDeckForReview(cards: PracticeCard[]): PracticeCard[] {
  return [...cards].sort((a, b) => {
    const scoreA = a.lastScore ?? 1.5;
    const scoreB = b.lastScore ?? 1.5;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Funde novos cartões no deck guardado do tópico, evitando duplicados e mantendo máx. 8. */
export function mergeTopicPracticeDeck(
  existing: PracticeCard[] | undefined,
  incoming: GeneratedPracticeCardDraft[],
  dateStr: string,
  createId: () => string,
): PracticeCard[] {
  const prev = existing ?? [];
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const seen = new Set(prev.map((c) => normalize(c.prompt)));

  const added: PracticeCard[] = [];
  for (const draft of incoming) {
    const prompt = draft.prompt.trim().slice(0, 260);
    const answer = draft.answer.trim().slice(0, 420);
    if (!prompt || !answer) continue;
    const key = normalize(prompt);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: createId(),
      prompt,
      answer,
      ...(draft.sourceTitle?.trim() ? { sourceTitle: draft.sourceTitle.trim().slice(0, 90) } : {}),
      createdAt: dateStr,
    });
  }

  // Prioriza os cartões novos + os existentes que ainda precisam de reforço.
  const combined = [...added, ...orderPracticeDeckForReview(prev)];
  return combined.slice(0, MAX_PRACTICE_CARDS_PER_TOPIC);
}

/** Agrega a pontuação de uma micro-sessão (3–5 cartões) para atualizar SRS e confiança. */
export function computePracticeSessionOutcome(
  ratings: RecallScore[],
  currentConfidence: Topic['confidence'],
): {
  recallScore: RecallScore;
  confidence: Topic['confidence'];
  hits: number;
  total: number;
} {
  if (ratings.length === 0) {
    return { recallScore: 2, confidence: currentConfidence, hits: 0, total: 0 };
  }
  const total = ratings.length;
  const hits = ratings.filter((r) => r >= 2).length;
  const avg = ratings.reduce((sum, r) => sum + r, 0) / total;
  const hitRate = hits / total;

  let recallScore: RecallScore;
  if (avg < 1.6 || hitRate < 0.5) recallScore = 1;
  else if (avg >= 2.5 && hitRate >= 0.8) recallScore = 3;
  else recallScore = 2;

  let confidence: Topic['confidence'];
  if (recallScore === 1) confidence = Math.min(2, currentConfidence) as Topic['confidence'];
  else if (recallScore === 2) confidence = Math.max(2, Math.min(4, currentConfidence)) as Topic['confidence'];
  else confidence = Math.max(4, currentConfidence) as Topic['confidence'];

  return { recallScore, confidence, hits, total };
}

export interface PreparedPracticeDeck {
  cards: PracticeCard[];
  mergedDeck: PracticeCard[];
  generatedCount: number;
  usedMaterialTitles: string[];
  needsDriveAuth: boolean;
  error?: string;
}

/**
 * Prepara o baralho de 3–5 cartões para praticar um tópico:
 * reutiliza cartões guardados ou gera novos a partir dos materiais reais da cadeira.
 */
export async function preparePracticeDeckForTopic(args: {
  course?: Course;
  topic: Topic;
  materials: Material[];
  studyLogs: StudyLogEntry[];
  aiConsent: boolean;
  hasCustomKey: boolean;
  dateStr: string;
  createId: () => string;
  forceGenerate?: boolean;
  cardCount?: number;
}): Promise<PreparedPracticeDeck> {
  const saved = orderPracticeDeckForReview(args.topic.practiceCards ?? []);
  const targetCount = Math.max(3, Math.min(5, args.cardCount ?? 4));

  if (!args.forceGenerate && saved.length >= 3) {
    return {
      cards: saved.slice(0, targetCount),
      mergedDeck: saved,
      generatedCount: 0,
      usedMaterialTitles: [],
      needsDriveAuth: false,
    };
  }

  if (!args.aiConsent) {
    return {
      cards: saved.slice(0, targetCount),
      mergedDeck: saved,
      generatedCount: 0,
      usedMaterialTitles: [],
      needsDriveAuth: false,
    };
  }

  const courseId = args.course?.id ?? '';
  const maxFiles = Math.min(3, getAiMaterialLimit(args.hasCustomKey));
  const candidateMaterials = courseId
    ? selectPriorityMaterialsForTopic(args.materials, courseId, args.topic.title, maxFiles)
    : [];

  let sources: NotebookSourceInput[] = [];
  let attachments: ChatAttachment[] = [];
  let usedMaterialTitles: string[] = [];
  let needsDriveAuth = false;

  if (candidateMaterials.length > 0) {
    const resolved = await resolveMaterialsForAI(candidateMaterials, { maxFiles });
    sources = resolved.textExcerpts.map((ex) => ({ title: ex.title, content: ex.content }));
    attachments = resolved.attachments;
    usedMaterialTitles = resolved.readTitles;
    needsDriveAuth = resolved.needsDriveAuth;
  }

  const diaryContext = courseId
    ? buildDiaryPracticeContext(args.studyLogs, courseId, args.topic.id)
    : '';

  try {
    const drafts = await generateMaterialPracticeSet({
      topicTitle: args.topic.title,
      courseName: args.course?.name,
      cardCount: targetCount,
      sources,
      attachments,
      diaryContext,
      existingPrompts: saved.map((c) => c.prompt),
    });

    const merged = mergeTopicPracticeDeck(
      args.topic.practiceCards,
      drafts,
      args.dateStr,
      args.createId,
    );

    return {
      cards: merged.slice(0, targetCount),
      mergedDeck: merged,
      generatedCount: drafts.length,
      usedMaterialTitles,
      needsDriveAuth,
    };
  } catch (err) {
    return {
      cards: saved.slice(0, targetCount),
      mergedDeck: saved,
      generatedCount: 0,
      usedMaterialTitles,
      needsDriveAuth,
      error: err instanceof Error ? err.message : tr('common:errors.practiceGenFail'),
    };
  }
}
