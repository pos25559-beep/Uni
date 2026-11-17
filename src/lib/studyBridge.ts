import { tr } from '../i18n/tr';
import type { AppLanguage, Assessment, Course, GradingScale, ID, StudySession, Topic } from '../types';
import { normalizeAppLanguage } from './grading';
import type { TopicSheetRecord, UniAgentRecord } from './localDb';
import { todayStr } from './selectors';
import { computeNextSrsState, type RecallScore } from './spacedRepetition';
import { suggestFormForCourse } from './uniAccessories';
import {
  recomputeUniAgentProgression,
  sanitizeNotebookDelta,
  transferMasteryWisdomToAgent,
} from './uniMastery';

export interface BuildStudyGuideExportInput {
  course: Course;
  topic?: Topic;
  sheets?: TopicSheetRecord[];
  agent?: UniAgentRecord | null;
  language?: AppLanguage | string;
}

/** Constrói um guião de estudo estruturado pronto a usar no Caderno do Uni ou num caderno externo. */
export function buildStudyGuideExport({
  course,
  topic,
  sheets = [],
  agent,
  language = 'pt-PT',
}: BuildStudyGuideExportInput): string {
  const lang = normalizeAppLanguage(language);
  const focusedTopic = topic ?? course.topics[0];
  const scopedSheets = focusedTopic
    ? sheets.filter((s) => s.topicId === focusedTopic.id)
    : sheets;
  const relevantSheets = (scopedSheets.length > 0 ? scopedSheets : sheets).slice(0, 3);
  const weakSpots = (agent?.notebook.weakSpots ?? []).slice(0, 4);

  const headings =
    lang === 'en'
      ? {
          title: `Study Guide · ${course.name} (${course.shortName})`,
          topic: 'Focus topic',
          concepts: 'Key concepts & sheets',
          weak: 'Known tricky spots',
          prompts: 'Active-recall prompts',
          p1: '1. Explain the core definition or intuition in two sentences without looking at notes.',
          p2: '2. What edge case or common exam trap breaks this rule?',
          p3: '3. Solve one concrete example step by step and check units/hypotheses.',
        }
      : lang === 'es'
        ? {
            title: `Guía de estudio · ${course.name} (${course.shortName})`,
            topic: 'Tema en foco',
            concepts: 'Conceptos clave y fichas',
            weak: 'Puntos débiles detectados',
            prompts: 'Preguntas de recuerdo activo',
            p1: '1. Explica la definición o intuición central en dos frases sin mirar los apuntes.',
            p2: '2. ¿Qué caso límite o trampa típica de examen suele aparecer aquí?',
            p3: '3. Resuelve un ejemplo concreto paso a paso verificando hipótesis y unidades.',
          }
        : lang === 'pt-BR'
          ? {
              title: `Roteiro de estudo · ${course.name} (${course.shortName})`,
              topic: 'Tópico em foco',
              concepts: 'Conceitos-chave e fichas',
              weak: 'Pontos fracos mapeados',
              prompts: 'Perguntas de recall ativo',
              p1: '1. Explique a definição ou intuição central em duas frases sem consultar anotações.',
              p2: '2. Qual caso-limite ou pegadinha clássica de prova costuma derrubar aqui?',
              p3: '3. Resolva um exemplo concreto passo a passo conferindo hipóteses e unidades.',
            }
          : {
              title: `Guião de estudo · ${course.name} (${course.shortName})`,
              topic: 'Tópico em foco',
              concepts: 'Conceitos-chave e fichas',
              weak: 'Pontos fracos registados',
              prompts: 'Perguntas de recall ativo',
              p1: '1. Explica a definição ou intuição central em duas frases sem olhar para os apontamentos.',
              p2: '2. Que caso-limite ou armadilha típica de teste costuma aparecer aqui?',
              p3: '3. Resolve um exemplo concreto passo a passo validando hipóteses e unidades.',
            };

  const lines: string[] = [`# ${headings.title}`];
  if (focusedTopic) {
    lines.push('', `**${headings.topic}:** ${focusedTopic.title}`);
  }

  if (relevantSheets.length > 0) {
    lines.push('', `## ${headings.concepts}`);
    for (const sh of relevantSheets) {
      const conceptList = sh.keyConcepts.length > 0 ? ` — ${sh.keyConcepts.slice(0, 5).join(', ')}` : '';
      lines.push(`- **${sh.title}**${conceptList}`);
      if (sh.summary.trim()) {
        lines.push(`  ${sh.summary.trim().replace(/\s+/g, ' ').slice(0, 320)}`);
      }
    }
  } else if (course.topics.length > 0) {
    lines.push('', `## ${headings.concepts}`);
    for (const t of course.topics.slice(0, 6)) {
      lines.push(`- ${t.title}`);
    }
  }

  if (weakSpots.length > 0) {
    lines.push('', `## ${headings.weak}`);
    for (const ws of weakSpots) {
      lines.push(`- **${ws.topic}**: ${ws.note}`);
    }
  }

  lines.push('', `## ${headings.prompts}`, headings.p1, headings.p2, headings.p3);
  return lines.join('\n');
}

export interface ImportQuizResultInput {
  rawText: string;
  course: Course;
  topicId?: ID;
  agent?: UniAgentRecord | null;
  sessions?: StudySession[];
  assessments?: Assessment[];
  today?: string;
  gradingScale?: GradingScale;
}

export interface ImportedQuizOutcome {
  nextCourse: Course;
  nextAgent: UniAgentRecord | null;
  targetTopic: Topic;
  score: RecallScore;
  hits?: number;
  total?: number;
  ratioPct: number;
  extractedWeakNotes: string[];
}

/**
 * Analisa resultados colados de um quiz/autoavaliação e fecha o ciclo diretamente
 * em `spacedRepetition.ts` e no Caderno do Uni (`UniAgentRecord`).
 */
export function parseAndImportQuizResult({
  rawText,
  course,
  topicId,
  agent = null,
  sessions = [],
  assessments = [],
  today = todayStr(),
  gradingScale = 'pt20',
}: ImportQuizResultInput): ImportedQuizOutcome {
  const cleaned = rawText.trim();
  if (!cleaned) {
    throw new Error(tr('common:errors.bridgePasteQuiz'));
  }

  let hits: number | undefined;
  let total: number | undefined;
  let ratioPct = 65;

  const fracMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(?:\/|de|out of|em)\s*(\d+(?:[.,]\d+)?)/i);
  const pctMatch = cleaned.match(/(\d{1,3})\s*%/);

  if (fracMatch) {
    const a = Number(fracMatch[1].replace(',', '.'));
    const b = Number(fracMatch[2].replace(',', '.'));
    if (Number.isFinite(a) && Number.isFinite(b) && b > 0 && a >= 0 && a <= b) {
      hits = Math.round(a);
      total = Math.round(b);
      ratioPct = Math.round((a / b) * 100);
    }
  } else if (pctMatch) {
    const pctVal = Number(pctMatch[1]);
    if (Number.isFinite(pctVal) && pctVal >= 0 && pctVal <= 100) {
      ratioPct = pctVal;
    }
  } else {
    const lower = cleaned.toLowerCase();
    if (/(dominei|perfeito|100%|acert.*tudo|mastered|all right)/i.test(lower)) {
      ratioPct = 90;
    } else if (/(errei|falhei|d[uú]vida|missed|failed|fall[eé]|dif[ií]cil)/i.test(lower)) {
      ratioPct = 40;
    }
  }

  const score: RecallScore = ratioPct >= 80 ? 3 : ratioPct >= 50 ? 2 : 1;
  const confidence: Topic['confidence'] =
    ratioPct >= 85 ? 5 : ratioPct >= 70 ? 4 : ratioPct >= 50 ? 3 : ratioPct >= 30 ? 2 : 1;

  const targetTopic =
    (topicId ? course.topics.find((t) => t.id === topicId) : undefined) ??
    course.topics.find((t) => cleaned.toLowerCase().includes(t.title.toLowerCase())) ??
    course.topics[0] ?? {
      id: `top-bridge-${Date.now()}`,
      title: course.shortName || course.name,
      status: 'learning' as const,
      confidence: 3 as const,
    };

  const nextSrs = computeNextSrsState(
    targetTopic,
    score,
    confidence,
    today,
    hits !== undefined && total !== undefined ? { hits, total } : undefined,
  );
  const updatedTopic: Topic = { ...targetTopic, ...nextSrs };

  const existsInCourse = course.topics.some((t) => t.id === targetTopic.id);
  const nextTopics = existsInCourse
    ? course.topics.map((t) => (t.id === targetTopic.id ? updatedTopic : t))
    : [...course.topics, updatedTopic];
  const nextCourse: Course = { ...course, topics: nextTopics };

  const extractedWeakNotes: string[] = [];
  const weakLines = cleaned
    .split(/[\n.;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 6 && /(errei|falhei|erro|d[uú]vida|missed|weak|fall[eé]|rever|revisar)/i.test(line));

  for (const line of weakLines.slice(0, 3)) {
    extractedWeakNotes.push(line.slice(0, 180));
  }
  if (score === 1 && extractedWeakNotes.length === 0) {
    extractedWeakNotes.push(cleaned.slice(0, 180));
  }

  let nextAgent: UniAgentRecord | null = agent;
  if (agent) {
    let nextNotebook = agent.notebook;
    if (extractedWeakNotes.length > 0) {
      nextNotebook = sanitizeNotebookDelta(nextNotebook, {
        weakSpot: {
          topic: updatedTopic.title,
          note: extractedWeakNotes.join(' · '),
        },
      });
    } else if (score === 3) {
      nextNotebook = sanitizeNotebookDelta(nextNotebook, {
        strength: tr('common:errors.bridgeStrength', { pct: ratioPct, topic: updatedTopic.title }),
      });
    }
    const recomputed = recomputeUniAgentProgression(
      { ...agent, notebook: nextNotebook },
      nextCourse,
      sessions,
      assessments,
      today,
      gradingScale,
    );
    nextAgent = recomputed.agent;
  }

  return {
    nextCourse,
    nextAgent,
    targetTopic: updatedTopic,
    score,
    hits,
    total,
    ratioPct,
    extractedWeakNotes,
  };
}

export interface TransferMasteryInput {
  sourceCourse: Course;
  sourceAgent: UniAgentRecord;
  targetCourse: Course;
  targetAgent?: UniAgentRecord | null;
  nowIso?: string;
}

/**
 * No estágio Mestre (`stage === 4`, mestria >= 90), permite ao Uni ensinar o Uni da cadeira seguinte
 * transferindo `learningStyle`, hábitos positivos (`strengths`) e nota de continuidade.
 */
export function transferMasteryToNextCourse({
  sourceCourse,
  sourceAgent,
  targetCourse,
  targetAgent,
  nowIso = new Date().toISOString(),
}: TransferMasteryInput): UniAgentRecord {
  if (sourceAgent.stage < 4) {
    throw new Error(tr('common:errors.bridgeNeedMaster'));
  }
  if (sourceCourse.id === targetCourse.id) {
    throw new Error(tr('common:errors.bridgeDiffCourse'));
  }

  const baseTarget: UniAgentRecord = targetAgent ?? {
    courseId: targetCourse.id,
    name: (targetCourse.shortName || targetCourse.code || 'Uni').slice(0, 30),
    formId: suggestFormForCourse(targetCourse),
    personaId: sourceAgent.personaId,
    language: sourceAgent.language,
    memoryEnabled: sourceAgent.memoryEnabled,
    stage: 0,
    mastery: 0,
    milestones: [],
    items: [],
    notebook: {
      goals: [],
      weakSpots: [],
      strengths: [],
      customNotes: [],
      updatedAt: nowIso,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return transferMasteryWisdomToAgent(
    sourceAgent,
    sourceCourse.shortName || sourceCourse.name,
    baseTarget,
    nowIso,
  );
}
