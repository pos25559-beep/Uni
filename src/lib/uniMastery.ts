import { addDays, format, parseISO } from 'date-fns';
import type { AppLanguage, Assessment, Course, GradingScale, ID, StudySession } from '../types';
import { gradeToPercent, normalizeAppLanguage } from './grading';
import type {
  TopicSheetRecord,
  UniAgentDiploma,
  UniAgentMilestone,
  UniAgentNotebook,
  UniAgentRecord,
  UniAgentWeakSpot,
  UniExpeditionQuestion,
  UniStage,
} from './localDb';
import { todayStr } from './selectors';
import { estimateTopicRetention, isTopicReviewDue } from './spacedRepetition';
import { inferAccessoryFromCourses, type UniAccessoryId } from './uniAccessories';

export interface UniStageInfo {
  stage: UniStage;
  label: string;
  labelEn: string;
  labelEs: string;
  labelPtBr: string;
  minMastery: number;
  nextThreshold: number | null;
  hint: string;
  hintEn: string;
  hintEs: string;
  hintPtBr: string;
}

export const UNI_STAGES: UniStageInfo[] = [
  {
    stage: 0,
    label: 'Ovo',
    labelEn: 'Egg',
    labelEs: 'Huevo',
    labelPtBr: 'Ovo',
    minMastery: 0,
    nextThreshold: 10,
    hint: 'Conclui sessões com recall para despertar o teu Uni.',
    hintEn: 'Complete a focus session with recall to wake up your Uni.',
    hintEs: 'Completa una sesión con recall para despertar a tu Uni.',
    hintPtBr: 'Conclua sessões com recall para despertar o seu Uni.',
  },
  {
    stage: 1,
    label: 'Aprendiz',
    labelEn: 'Apprentice',
    labelEs: 'Aprendiz',
    labelPtBr: 'Aprendiz',
    minMastery: 10,
    nextThreshold: 35,
    hint: 'Mantém revisões espaçadas em dia para evoluir para Explorador.',
    hintEn: 'Keep spaced reviews on schedule to evolve to Explorer.',
    hintEs: 'Mantén los repasos espaciados al día para pasar a Explorador.',
    hintPtBr: 'Mantenha as revisões espaçadas em dia para evoluir para Explorador.',
  },
  {
    stage: 2,
    label: 'Explorador',
    labelEn: 'Explorer',
    labelEs: 'Explorador',
    labelPtBr: 'Explorador',
    minMastery: 35,
    nextThreshold: 65,
    hint: 'Expedições desbloqueadas! Consolida os tópicos para chegar a Especialista.',
    hintEn: 'Expeditions unlocked! Consolidate topics to reach Specialist.',
    hintEs: '¡Expediciones desbloqueadas! Consolida los temas para llegar a Especialista.',
    hintPtBr: 'Expedições desbloqueadas! Consolide os tópicos para chegar a Especialista.',
  },
  {
    stage: 3,
    label: 'Especialista',
    labelEn: 'Specialist',
    labelEs: 'Especialista',
    labelPtBr: 'Especialista',
    minMastery: 65,
    nextThreshold: 90,
    hint: 'Modo Exame ativo! Mantém o ritmo nas avaliações para alcançar Mestre.',
    hintEn: 'Exam drills active! Keep scoring well on assessments to reach Master.',
    hintEs: '¡Modo Examen activo! Mantén el ritmo para alcanzar Maestro.',
    hintPtBr: 'Modo Prova ativo! Mantenha o ritmo nas avaliações para alcançar Mestre.',
  },
  {
    stage: 4,
    label: 'Mestre',
    labelEn: 'Master',
    labelEs: 'Maestro',
    labelPtBr: 'Mestre',
    minMastery: 90,
    nextThreshold: null,
    hint: 'Domínio máximo — pronto para emitir diploma e ensinar um Uni seguinte.',
    hintEn: 'Peak mastery — ready for graduation diploma and mentoring a next course Uni.',
    hintEs: 'Dominio máximo: listo para emitir diploma y enseñar al Uni de la siguiente asignatura.',
    hintPtBr: 'Domínio máximo — pronto para emitir diploma e ensinar o Uni da próxima disciplina.',
  },
];

const AREA_EXPLORER_ITEM: Record<UniAccessoryId, { pt: string; ptBr: string; es: string; en: string }> = {
  default: { pt: 'Marcador Dourado', ptBr: 'Marcador Dourado', es: 'Marcapáginas Dorado', en: 'Golden Bookmark' },
  math: { pt: 'Régua Geométrica', ptBr: 'Régua Geométrica', es: 'Regla Geométrica', en: 'Geometric Ruler' },
  tech: { pt: 'Auscultadores de Depuração', ptBr: 'Fones de Depuração', es: 'Auriculares de Depuración', en: 'Debug Headphones' },
  health: { pt: 'Estetoscópio de Clínica', ptBr: 'Estetoscópio Clínico', es: 'Estetoscopio Clínico', en: 'Clinical Stethoscope' },
  arts: { pt: 'Caderno de Esboços', ptBr: 'Caderno de Esboços', es: 'Cuaderno de Bocetos', en: 'Studio Sketchbook' },
  science: { pt: 'Frasco de Ensaio', ptBr: 'Frasco de Ensaio', es: 'Matraz de Laboratorio', en: 'Lab Flask' },
  humanities: { pt: 'Lupa de Arquivo', ptBr: 'Lupa de Arquivo', es: 'Lupa de Archivo', en: 'Archive Magnifier' },
};

export function getCourseAreaItem(course: Course, lang: AppLanguage | string = 'pt-PT'): string {
  const normalized = normalizeAppLanguage(lang);
  const accessory = inferAccessoryFromCourses([course]);
  const entry = AREA_EXPLORER_ITEM[accessory] ?? AREA_EXPLORER_ITEM.default;
  if (normalized === 'en') return entry.en;
  if (normalized === 'es') return entry.es;
  if (normalized === 'pt-BR') return entry.ptBr;
  return entry.pt;
}

export function stageFromMastery(mastery: number): UniStage {
  if (mastery >= 90) return 4;
  if (mastery >= 65) return 3;
  if (mastery >= 35) return 2;
  if (mastery >= 10) return 1;
  return 0;
}

export function getStageInfo(
  stage: UniStage,
  lang: AppLanguage | string = 'pt-PT',
): UniStageInfo & { localizedLabel: string; localizedHint: string } {
  const normalized = normalizeAppLanguage(lang);
  const found = UNI_STAGES.find((s) => s.stage === stage) ?? UNI_STAGES[0];
  return {
    ...found,
    localizedLabel:
      normalized === 'en'
        ? found.labelEn
        : normalized === 'es'
          ? found.labelEs
          : normalized === 'pt-BR'
            ? found.labelPtBr
            : found.label,
    localizedHint:
      normalized === 'en'
        ? found.hintEn
        : normalized === 'es'
          ? found.hintEs
          : normalized === 'pt-BR'
            ? found.hintPtBr
            : found.hint,
  };
}

/**
 * Calcula a mestria real (0–100) exclusivamente a partir de dados verificáveis da app:
 * retenção/recall dos tópicos (`spacedRepetition.ts`), estado de estudo e notas lançadas.
 */
export function computeCourseMastery(
  course: Course,
  assessments: Assessment[],
  dayKey = todayStr(),
  gradingScale: GradingScale = 'pt20',
): number {
  const topics = course.topics ?? [];
  let topicComponent = 0;

  if (topics.length > 0) {
    let points = 0;
    for (const topic of topics) {
      const retention = estimateTopicRetention(topic, dayKey);
      const baseConfidence = Math.min(1, Math.max(0, (topic.confidence - 1) / 4));
      let topicScore = 0;

      if (topic.status === 'done' || topic.lastRecallScore === 3) {
        topicScore = Math.max(0.75, retention.retentionPct / 100);
      } else if ((topic.recallCount ?? 0) > 0 || topic.status === 'review') {
        topicScore = Math.max(0.4, (retention.retentionPct / 100) * 0.85);
      } else if (topic.status === 'learning') {
        topicScore = Math.max(0.2, baseConfidence * 0.45);
      } else {
        topicScore = Math.max(0, baseConfidence * 0.25);
      }

      if (retention.state === 'at_risk') {
        topicScore *= 0.72;
      }
      points += Math.min(1, topicScore);
    }
    topicComponent = (points / topics.length) * 80;
  }

  const courseAssessments = assessments.filter((a) => a.courseId === course.id);
  const graded = courseAssessments.filter((a) => typeof a.grade === 'number' && !Number.isNaN(a.grade));
  let gradeComponent = 0;

  if (graded.length > 0) {
    const avgRatio =
      graded.reduce((sum, a) => sum + gradeToPercent(a.grade ?? 0, gradingScale) / 100, 0) / graded.length;
    gradeComponent = avgRatio * 20;
  } else if (course.topics.some((t) => (t.recallCount ?? 0) > 0 && t.lastRecallScore === 3)) {
    gradeComponent = 5;
  }

  return Math.max(0, Math.min(100, Math.round(topicComponent + gradeComponent)));
}

/** Calcula marcos verificáveis de evolução (sem moedas nem loja artificial). */
export function computeCourseMilestones(
  course: Course,
  sessions: StudySession[],
  assessments: Assessment[],
  existing: UniAgentMilestone[] = [],
  nowIso?: string,
  gradingScale: GradingScale = 'pt20',
  lang: AppLanguage = 'pt-PT',
): { milestones: UniAgentMilestone[]; items: string[] } {
  const effectiveNowIso = nowIso ?? new Date().toISOString();
  const byId = new Map<string, UniAgentMilestone>();
  for (const m of existing) {
    byId.set(m.id, m);
  }

  const addIfMissing = (id: string, label: string) => {
    if (!byId.has(id)) {
      byId.set(id, { id, label, at: effectiveNowIso });
    }
  };

  const normalizedLang = normalizeAppLanguage(lang);

  if (course.topics.some((t) => t.lastRecallScore === 3)) {
    addIfMissing(
      'first_perfect_recall',
      normalizedLang === 'en'
        ? '1st mastered recall in a topic'
        : normalizedLang === 'es'
          ? '1.er recuerdo perfecto en un tema'
          : normalizedLang === 'pt-BR'
            ? '1.º recall perfeito em um tópico'
            : '1.º recall perfeito num tópico',
    );
  }

  const completedDays = new Set(
    sessions.filter((s) => s.courseId === course.id && s.done).map((s) => s.date),
  );
  if (completedDays.size >= 5) {
    addIfMissing(
      'five_study_days',
      normalizedLang === 'en'
        ? '5 real study days in this course'
        : normalizedLang === 'es'
          ? '5 días reales de estudio en esta asignatura'
          : normalizedLang === 'pt-BR'
            ? '5 dias reais de estudo nesta disciplina'
            : '5 dias reais de estudo nesta cadeira',
    );
  }
  if (completedDays.size >= 7) {
    addIfMissing(
      'seven_study_days',
      normalizedLang === 'en'
        ? '7 real study days in this course'
        : normalizedLang === 'es'
          ? '7 días reales de estudio en esta asignatura'
          : normalizedLang === 'pt-BR'
            ? '7 dias reais de estudo nesta disciplina'
            : '7 dias reais de estudo nesta cadeira',
    );
  }

  if (
    assessments.some(
      (a) => a.courseId === course.id && typeof a.grade === 'number' && !Number.isNaN(a.grade),
    )
  ) {
    addIfMissing(
      'first_graded_assessment',
      normalizedLang === 'en'
        ? '1st graded assessment recorded'
        : normalizedLang === 'es'
          ? '1.ª evaluación con nota registrada'
          : normalizedLang === 'pt-BR'
            ? '1.ª avaliação com nota registrada'
            : '1.ª avaliação com nota registada',
    );
  }

  const latestStudied = course.topics
    .map((t) => t.lastStudied)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  const dayKey = (nowIso ? nowIso.slice(0, 10) : latestStudied) || todayStr();
  const mastery = computeCourseMastery(course, assessments, dayKey, gradingScale);
  const stage = stageFromMastery(mastery);
  const items: string[] = [];
  if (stage >= 2) {
    items.push(getCourseAreaItem(course, normalizedLang));
  }
  if (stage >= 3) {
    items.push(
      normalizedLang === 'en'
        ? 'Exam Foil Seal'
        : normalizedLang === 'es'
          ? 'Sello de Especialista'
          : 'Selo de Especialista',
    );
  }
  if (stage >= 4) {
    items.push(
      normalizedLang === 'en'
        ? 'Master Laurels'
        : normalizedLang === 'es'
          ? 'Laureles de Maestro'
          : 'Louros de Mestre',
    );
  }

  return {
    milestones: Array.from(byId.values()),
    items,
  };
}

/** Recalcula campos derivados (`mastery`, `stage`, `milestones`, `items`, `nextAssessment`) sem confiar no modelo. */
export function recomputeUniAgentProgression(
  agent: UniAgentRecord,
  course: Course,
  sessions: StudySession[],
  assessments: Assessment[],
  dayKey = todayStr(),
  gradingScale: GradingScale = 'pt20',
): { agent: UniAgentRecord; stageUpFrom: UniStage | null } {
  const mastery = computeCourseMastery(course, assessments, dayKey, gradingScale);
  const nextStage = stageFromMastery(mastery);
  const lang: AppLanguage = normalizeAppLanguage(agent.language);
  const { milestones, items } = computeCourseMilestones(
    course,
    sessions,
    assessments,
    agent.milestones,
    new Date().toISOString(),
    gradingScale,
    lang,
  );

  const nextUpcoming = assessments
    .filter((a) => a.courseId === course.id && a.date.slice(0, 10) >= dayKey)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const mergedItems = Array.from(new Set([...(agent.items ?? []), ...items]));
  const updated: UniAgentRecord = {
    ...agent,
    mastery,
    stage: nextStage,
    milestones,
    items: mergedItems,
    notebook: {
      ...agent.notebook,
      ...(nextUpcoming
        ? { nextAssessment: { title: nextUpcoming.title, date: nextUpcoming.date } }
        : { nextAssessment: undefined }),
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  return {
    agent: updated,
    stageUpFrom: nextStage > agent.stage ? agent.stage : null,
  };
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/** Seleciona as 3–5 fichas mais relevantes do IndexedDB para a pergunta ou sessão atual. */
export function retrieveRelevantSheets(
  query: string,
  sheets: TopicSheetRecord[],
  topicId?: ID,
  limit = 4,
): TopicSheetRecord[] {
  if (sheets.length === 0) return [];
  const queryTokens = normalizeTokens(query);

  const scored = sheets.map((sheet) => {
    let score = 0;
    if (topicId && sheet.topicId === topicId) score += 12;

    const haystack = [sheet.title, ...sheet.keyConcepts, sheet.summary.slice(0, 1800)].join(' ');
    const hayTokens = new Set(normalizeTokens(haystack));

    for (const token of queryTokens) {
      if (hayTokens.has(token)) score += 3;
    }

    const titleTokens = new Set(normalizeTokens(sheet.title));
    for (const token of queryTokens) {
      if (titleTokens.has(token)) score += 4;
    }

    return { sheet, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.sheet.updatedAt.localeCompare(a.sheet.updatedAt);
  });

  return scored.slice(0, limit).map((item) => item.sheet);
}

export interface NotebookDeltaProposal {
  weakSpot?: { topic: string; note: string };
  strength?: string;
}

/** Valida e aplica uma atualização incremental segura ao Caderno do Uni (nunca altera mestria/estágio). */
export function sanitizeNotebookDelta(
  notebook: UniAgentNotebook,
  proposal: NotebookDeltaProposal,
  nowIso = new Date().toISOString(),
): UniAgentNotebook {
  const weakSpots: UniAgentWeakSpot[] = [...(notebook.weakSpots ?? [])];
  const strengths: string[] = [...(notebook.strengths ?? [])];

  if (proposal.weakSpot?.topic?.trim() && proposal.weakSpot?.note?.trim()) {
    const cleanTopic = proposal.weakSpot.topic.trim().slice(0, 80);
    const cleanNote = proposal.weakSpot.note.trim().slice(0, 220);
    const idx = weakSpots.findIndex(
      (w) => w.topic.toLowerCase() === cleanTopic.toLowerCase(),
    );
    if (idx >= 0) {
      weakSpots[idx] = {
        topic: cleanTopic,
        note: cleanNote,
        seen: Math.min(99, (weakSpots[idx]?.seen ?? 1) + 1),
      };
    } else {
      weakSpots.unshift({ topic: cleanTopic, note: cleanNote, seen: 1 });
    }
  }

  if (proposal.strength?.trim()) {
    const cleanStrength = proposal.strength.trim().slice(0, 140);
    const exists = strengths.some((s) => s.toLowerCase() === cleanStrength.toLowerCase());
    if (!exists) {
      strengths.unshift(cleanStrength);
    }
  }

  return {
    ...notebook,
    weakSpots: weakSpots.slice(0, 6),
    strengths: strengths.slice(0, 6),
    updatedAt: nowIso,
  };
}

/** Verifica se o Uni já está no estágio Explorador (2+) e deve preparar expedição para amanhã. */
export function shouldPrepareExpedition(
  agent: UniAgentRecord,
  course: Course,
  dayKey = todayStr(),
): boolean {
  if (agent.stage < 2) return false;
  if (!course.topics || course.topics.length === 0) return false;
  const tomorrow = format(addDays(parseISO(dayKey), 1), 'yyyy-MM-dd');
  if (agent.expedition && agent.expedition.forDate >= tomorrow && agent.expedition.questions.length > 0) {
    return false;
  }
  return true;
}

/** Seleciona até 3 tópicos prioritários (devidos amanhã/atrasados ou estudados recentemente) para a expedição. */
export function pickExpeditionCandidateTopics(course: Course, targetDayKey: string) {
  const due = course.topics.filter((t) => isTopicReviewDue(t, targetDayKey));
  const studied = course.topics.filter((t) => Boolean(t.lastStudied) && !due.includes(t));
  const fallback = course.topics.filter((t) => !due.includes(t) && !studied.includes(t));
  return [...due, ...studied, ...fallback].slice(0, 3);
}

/** Devolve as perguntas de expedição pendentes prontas para o estudante hoje. */
export function getPendingExpeditionQuestions(
  agent: UniAgentRecord,
  todayDayKey = todayStr(),
): UniExpeditionQuestion[] {
  if (!agent.expedition || agent.expedition.forDate > todayDayKey) return [];
  return agent.expedition.questions.filter((q) => q.answeredScore === undefined);
}

/** Indica se uma cadeira já pode emitir o diploma de fim de semestre. */
export function canIssueDiploma(course: Course, assessments: Assessment[], agent: UniAgentRecord): boolean {
  if (agent.diploma) return true;
  if (agent.stage >= 4) return true;
  const mine = assessments.filter((a) => a.courseId === course.id);
  const gradedWeight = mine
    .filter((a) => typeof a.grade === 'number' && !Number.isNaN(a.grade))
    .reduce((sum, a) => sum + (a.weight || 0), 0);
  if (gradedWeight >= 95) return true;
  const masteredCount = course.topics.filter((t) => t.status === 'done' || t.lastRecallScore === 3).length;
  return course.topics.length > 0 && masteredCount >= Math.ceil(course.topics.length * 0.75);
}

/** Emite o registo de diploma do Uni com nota ponderada e contagem de tópicos dominados. */
export function buildUniDiploma(
  course: Course,
  assessments: Assessment[],
  agent: UniAgentRecord,
  issuedAt = new Date().toISOString(),
): UniAgentDiploma {
  const mine = assessments.filter(
    (a) => a.courseId === course.id && typeof a.grade === 'number' && !Number.isNaN(a.grade),
  );
  const totalWeight = mine.reduce((sum, a) => sum + Math.max(0, a.weight || 0), 0);
  let finalGrade: number | undefined;
  if (mine.length > 0) {
    if (totalWeight > 0) {
      const weighted = mine.reduce((sum, a) => sum + (a.grade as number) * Math.max(0, a.weight || 0), 0);
      finalGrade = Math.round((weighted / totalWeight) * 100) / 100;
    } else {
      const avg = mine.reduce((sum, a) => sum + (a.grade as number), 0) / mine.length;
      finalGrade = Math.round(avg * 100) / 100;
    }
  }
  const masteredTopicCount = course.topics.filter(
    (t) => t.status === 'done' || t.lastRecallScore === 3,
  ).length;
  return {
    issuedAt,
    ...(finalGrade !== undefined ? { finalGrade } : {}),
    masteredTopicCount,
    totalTopicCount: course.topics.length,
    stageAtGraduation: agent.stage,
  };
}

/** Transfere estilo de estudo e forças metodológicas de um Uni Mestre para o Uni da cadeira seguinte. */
export function transferMasteryWisdomToAgent(
  masterAgent: UniAgentRecord,
  masterCourseName: string,
  targetAgent: UniAgentRecord,
  nowIso = new Date().toISOString(),
): UniAgentRecord {
  const lang = normalizeAppLanguage(targetAgent.language);
  const noteText =
    lang === 'en'
      ? `Study habits inherited from ${masterCourseName} (${masterAgent.name})`
      : lang === 'es'
        ? `Metodología heredada de ${masterCourseName} (${masterAgent.name})`
        : lang === 'pt-BR'
          ? `Metodologia herdada de ${masterCourseName} (${masterAgent.name})`
          : `Metodologia herdada de ${masterCourseName} (${masterAgent.name})`;
  const mergedStrengths = Array.from(
    new Set([
      ...(targetAgent.notebook.strengths ?? []),
      ...(masterAgent.notebook.strengths ?? []).slice(0, 2),
    ]),
  ).slice(0, 6);
  const mergedNotes = Array.from(
    new Set([...(targetAgent.notebook.customNotes ?? []), noteText]),
  ).slice(0, 6);

  return {
    ...targetAgent,
    notebook: {
      ...targetAgent.notebook,
      ...(targetAgent.notebook.learningStyle
        ? { learningStyle: targetAgent.notebook.learningStyle }
        : masterAgent.notebook.learningStyle
          ? { learningStyle: masterAgent.notebook.learningStyle }
          : {}),
      strengths: mergedStrengths,
      customNotes: mergedNotes,
      updatedAt: nowIso,
    },
    updatedAt: nowIso,
  };
}
