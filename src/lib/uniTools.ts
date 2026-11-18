import { Behavior, Type, type FunctionDeclaration } from '@google/genai';
import { tr } from '../i18n/tr';
import { newId, useStore } from '../store/useStore';
import type { Course, PracticeCard, StudySession, Task, Topic } from '../types';
import {
  getUniAgent,
  listTopicSheetsByCourse,
  type UniAgentRecord,
} from './localDb';
import { saveUniAgent } from './uniAgents';
import { sanitizeNotebookDelta } from './uniMastery';
import { todayStr } from './selectors';
import { computeNextSrsState, type RecallScore } from './spacedRepetition';

export type UniToolName =
  | 'ler_plano'
  | 'ler_ficha'
  | 'registar_recall'
  | 'criar_sessao'
  | 'criar_flashcards'
  | 'marcar_duvida'
  | 'focar_plano';

export type UniWriteToolName = 'criar_sessao' | 'criar_flashcards' | 'marcar_duvida' | 'focar_plano';

export interface UniToolCallInput {
  id?: string;
  name: UniToolName;
  args: Record<string, unknown>;
}

export interface UniToolExecutionContext {
  activeCourse?: Course;
  courses?: Course[];
  sessions?: StudySession[];
  assessments?: { id: string; courseId: string; title: string; date: string; weight: number }[];
  today?: string;
  agent?: UniAgentRecord | null;
}

export interface UniToolProposal {
  id: string;
  toolName: UniWriteToolName;
  courseId?: string;
  courseLabel: string;
  topicId?: string;
  topicTitle: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  /** Payload específico para criar_sessao */
  session?: {
    date: string;
    minutes: number;
    notes: string;
  };
  /** Payload específico para criar_flashcards */
  flashcards?: Array<{
    front: string;
    back: string;
  }>;
  /** Payload específico para marcar_duvida */
  doubt?: {
    note: string;
    createTask?: boolean;
  };
  /** Payload específico para focar_plano */
  planFocus?: {
    exclusive: boolean;
    reason: string;
  };
}

export const READ_OR_RECALL_TOOLS: ReadonlySet<UniToolName> = new Set([
  'ler_plano',
  'ler_ficha',
  'registar_recall',
]);

export const WRITE_CONFIRM_TOOLS: ReadonlySet<UniToolName> = new Set([
  'criar_sessao',
  'criar_flashcards',
  'marcar_duvida',
  'focar_plano',
]);

export function isUniToolName(name: string): name is UniToolName {
  return (
    name === 'ler_plano' ||
    name === 'ler_ficha' ||
    name === 'registar_recall' ||
    name === 'criar_sessao' ||
    name === 'criar_flashcards' ||
    name === 'marcar_duvida' ||
    name === 'focar_plano'
  );
}

export function requiresStudentConfirmation(name: UniToolName): boolean {
  return WRITE_CONFIRM_TOOLS.has(name);
}

/**
 * Declarações oficiais de Function Calling para o Gemini (chat e Voz Live `gemini-3.8-live`).
 */
export const UNI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'ler_plano',
    description:
      'Lê as próximas sessões planeadas e avaliações próximas da cadeira ou semana do estudante. Não altera dados.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira opcional.' },
        daysAhead: { type: Type.NUMBER, description: 'Número de dias à frente a inspecionar (padrão 7).' },
      },
    },
  },
  {
    name: 'ler_ficha',
    description:
      'Consulta fichas de estudo locais e pontos fracos guardados no Caderno do Uni sobre um tópico ou cadeira.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira.' },
        topicQuery: { type: Type.STRING, description: 'Nome ou palavras-chave do tópico.' },
      },
    },
  },
  {
    name: 'registar_recall',
    description:
      'Guarda o resultado de um recall ativo que o estudante acabou de responder na conversa (atualiza revisão espaçada).',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        topicTitle: { type: Type.STRING, description: 'Nome do tópico avaliado.' },
        score: {
          type: Type.NUMBER,
          description: '1 = rever já (falhou), 2 = com esforço (parcial), 3 = dominei.',
        },
        confidence: {
          type: Type.NUMBER,
          description: 'Confiança estimada de 1 a 5 (opcional).',
        },
      },
      required: ['topicTitle', 'score'],
    },
  },
  {
    name: 'criar_sessao',
    description:
      'Propõe uma nova sessão extra de estudo no plano do estudante. Exige sempre confirmação explícita antes de guardar.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira.' },
        topicTitle: { type: Type.STRING, description: 'Tópico ou foco da sessão.' },
        date: { type: Type.STRING, description: 'Data no formato yyyy-MM-dd (padrão hoje).' },
        minutes: { type: Type.NUMBER, description: 'Duração sugerida em minutos (25, 35, 50 ou 75).' },
        notes: { type: Type.STRING, description: 'Nota breve sobre o objetivo do bloco.' },
      },
      required: ['topicTitle', 'minutes'],
    },
  },
  {
    name: 'criar_flashcards',
    description:
      'Propõe 1 a 5 flashcards de prática rápida para um tópico da cadeira. Exige sempre confirmação explícita do estudante.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira.' },
        topicTitle: { type: Type.STRING, description: 'Nome do tópico.' },
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING, description: 'Pergunta ou frente do cartão.' },
              back: { type: Type.STRING, description: 'Resposta curta ou verso do cartão.' },
            },
            required: ['front', 'back'],
          },
        },
      },
      required: ['topicTitle', 'cards'],
    },
  },
  {
    name: 'marcar_duvida',
    description:
      'Propõe registar uma dúvida específica na ficha da cadeira (e opcionalmente na lista para levar à aula/professor). Exige confirmação.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira.' },
        topicTitle: { type: Type.STRING, description: 'Tópico onde surgiu a dúvida.' },
        note: { type: Type.STRING, description: 'Descrição objetiva da dúvida.' },
      },
      required: ['topicTitle', 'note'],
    },
  },
  {
    name: 'focar_plano',
    description:
      'Propõe focar o plano de estudo numa cadeira específica (opcionalmente em modo exclusivo 100% até ao próximo teste) e regenerar sessões futuras. Exige sempre confirmação.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING, description: 'ID ou sigla da cadeira a priorizar.' },
        exclusive: {
          type: Type.BOOLEAN,
          description: 'true para dedicar 100% dos blocos futuros a esta cadeira; false para reforçar peso mantendo outras cadeiras.',
        },
        reason: { type: Type.STRING, description: 'Motivo breve do ajuste (ex.: Foco total até ao teste).' },
      },
      required: ['courseId'],
    },
  },
];

const TOOL_BLOCK_RE = /<uni-tool>([\s\S]*?)<\/uni-tool>/gi;

/** Extrai blocos `<uni-tool>{...}</uni-tool>` da resposta em texto e devolve texto limpo + chamadas tipadas. */
export function extractUniToolsFromText(raw: string): {
  displayText: string;
  calls: UniToolCallInput[];
} {
  const calls: UniToolCallInput[] = [];
  let match: RegExpExecArray | null;
  TOOL_BLOCK_RE.lastIndex = 0;

  while ((match = TOOL_BLOCK_RE.exec(raw)) !== null) {
    const inner = match[1]?.trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner) as Record<string, unknown>;
      const rawName = String(parsed.name ?? '').trim();
      if (!isUniToolName(rawName)) continue;
      const args =
        parsed.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args)
          ? (parsed.args as Record<string, unknown>)
          : Object.fromEntries(
              Object.entries(parsed).filter(([k]) => k !== 'name' && k !== 'id'),
            );
      calls.push({
        id: typeof parsed.id === 'string' ? parsed.id : undefined,
        name: rawName,
        args,
      });
    } catch {
      // Ignora bloco incompleto durante streaming
    }
  }

  let displayText = raw.replace(TOOL_BLOCK_RE, '').trim();
  const unclosedIdx = displayText.toLowerCase().indexOf('<uni-tool>');
  if (unclosedIdx >= 0) {
    displayText = displayText.slice(0, unclosedIdx).trim();
  }

  return { displayText, calls };
}

function resolveCourse(
  args: Record<string, unknown>,
  ctx?: UniToolExecutionContext,
): Course | undefined {
  const courses = ctx?.courses ?? useStore.getState().courses;
  const rawCourseId = typeof args.courseId === 'string' ? args.courseId.trim() : '';
  if (rawCourseId) {
    const found = courses.find(
      (c) =>
        c.id === rawCourseId ||
        c.code.toLowerCase() === rawCourseId.toLowerCase() ||
        c.shortName.toLowerCase() === rawCourseId.toLowerCase(),
    );
    if (found) return found;
  }
  return ctx?.activeCourse ?? courses[0];
}

function matchTopic(course: Course | undefined, topicTitle: string): Topic | undefined {
  if (!course || !topicTitle.trim()) return undefined;
  const needle = topicTitle.trim().toLowerCase();
  return (
    course.topics.find((t) => t.title.toLowerCase() === needle) ??
    course.topics.find(
      (t) => t.title.toLowerCase().includes(needle) || needle.includes(t.title.toLowerCase()),
    )
  );
}

/** Executa imediatamente apenas as ferramentas seguras (`ler_plano`, `ler_ficha`, `registar_recall`). */
export async function executeReadOnlyOrRecallUniTool(
  call: UniToolCallInput,
  ctx?: UniToolExecutionContext,
): Promise<{
  ok: boolean;
  requiresConfirmation: boolean;
  summary: string;
  data?: Record<string, unknown>;
}> {
  if (requiresStudentConfirmation(call.name)) {
    return {
      ok: false,
      requiresConfirmation: true,
      summary: tr('uni:uniTools.requiresConfirmation', { name: call.name }),
    };
  }

  const store = useStore.getState();
  const today = ctx?.today ?? todayStr();
  const targetCourse = resolveCourse(call.args, ctx);

  if (call.name === 'ler_plano') {
    const daysAhead =
      typeof call.args.daysAhead === 'number' && call.args.daysAhead > 0
        ? Math.min(30, Math.round(call.args.daysAhead))
        : 7;
    const allSessions = ctx?.sessions ?? store.sessions;
    const allAssessments = ctx?.assessments ?? store.assessments;
    const scopedSessions = allSessions
      .filter((s) => !s.done && s.date >= today && (!targetCourse || s.courseId === targetCourse.id))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
      .slice(0, Math.max(5, daysAhead));
    const upcomingExams = allAssessments
      .filter((a) => a.date.slice(0, 10) >= today && (!targetCourse || a.courseId === targetCourse.id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return {
      ok: true,
      requiresConfirmation: false,
      summary: tr('uni:uniTools.planSummary', {
        sessions: scopedSessions.length,
        exams: upcomingExams.length,
      }),
      data: {
        course: targetCourse ? targetCourse.shortName : 'all',
        sessions: scopedSessions.map((s) => ({
          date: s.date,
          start: s.start ?? null,
          minutes: s.minutes,
          notes: s.notes ?? null,
        })),
        assessments: upcomingExams.map((a) => ({
          title: a.title,
          date: a.date.slice(0, 10),
          weight: a.weight,
        })),
      },
    };
  }

  if (call.name === 'ler_ficha') {
    const query = typeof call.args.topicQuery === 'string' ? call.args.topicQuery.trim().toLowerCase() : '';
    const sheets = targetCourse ? await listTopicSheetsByCourse(targetCourse.id) : [];
    const filtered = query
      ? sheets.filter(
          (sh) =>
            sh.title.toLowerCase().includes(query) ||
            sh.summary.toLowerCase().includes(query) ||
            sh.keyConcepts.some((k) => k.toLowerCase().includes(query)),
        )
      : sheets;
    const picked = (filtered.length > 0 ? filtered : sheets).slice(0, 3);
    const agent = ctx?.agent ?? (targetCourse ? await getUniAgent(targetCourse.id) : null);

    return {
      ok: true,
      requiresConfirmation: false,
      summary: tr('uni:uniTools.sheetsSummary', { count: picked.length }),
      data: {
        sheets: picked.map((s) => ({
          title: s.title,
          summary: s.summary.slice(0, 600),
          keyConcepts: s.keyConcepts.slice(0, 6),
        })),
        weakSpots: agent?.notebook.weakSpots.slice(0, 4) ?? [],
      },
    };
  }

  // registar_recall: o estudante acabou de responder a uma pergunta de recall na conversa
  const rawScore = Number(call.args.score);
  const score: RecallScore = rawScore >= 3 ? 3 : rawScore <= 1 ? 1 : 2;
  const rawConf = Number(call.args.confidence);
  const confidence: Topic['confidence'] =
    rawConf >= 5 ? 5 : rawConf === 4 ? 4 : rawConf === 2 ? 2 : rawConf === 1 ? 1 : score === 3 ? 4 : score === 1 ? 2 : 3;
  const topicTitle = String(call.args.topicTitle ?? '').trim() || tr('uni:uniTools.recallDefaultTopic');

  if (!targetCourse) {
    return {
      ok: false,
      requiresConfirmation: false,
      summary: tr('uni:uniTools.noCourseForRecall'),
    };
  }

  let topic = matchTopic(targetCourse, topicTitle);
  if (!topic) {
    topic = store.ensureCourseTopic(targetCourse.id, topicTitle) ?? undefined;
  }
  if (!topic) {
    return {
      ok: false,
      requiresConfirmation: false,
      summary: tr('uni:uniTools.noTopicForRecall'),
    };
  }

  const nextSrs = computeNextSrsState(topic, score, confidence, today);
  store.updateTopic(targetCourse.id, topic.id, nextSrs);
  store.replan('uni_tool', { silent: true });

  return {
    ok: true,
    requiresConfirmation: false,
    summary: tr('uni:uniTools.recallSummary', {
      score,
      topic: topic.title,
      date: nextSrs.nextReviewDate ?? '',
    }),
    data: {
      courseId: targetCourse.id,
      topicId: topic.id,
      topicTitle: topic.title,
      score,
      nextReviewDate: nextSrs.nextReviewDate,
    },
  };
}

/**
 * Constrói uma proposta pendente para ações de escrita (`criar_sessao`, `criar_flashcards`, `marcar_duvida`).
 * Pura: NUNCA altera o store nem a base local antes da confirmação explícita do estudante.
 */
export function buildUniToolProposal(
  call: UniToolCallInput,
  ctx?: UniToolExecutionContext,
): UniToolProposal | null {
  if (!requiresStudentConfirmation(call.name)) return null;
  const toolName = call.name as UniWriteToolName;
  const today = ctx?.today ?? todayStr();
  const targetCourse = resolveCourse(call.args, ctx);
  const topicTitle = String(call.args.topicTitle ?? call.args.topic ?? '').trim() || (targetCourse?.shortName ?? tr('uni:uniTools.defaultLabel'));
  const matchedTopic = matchTopic(targetCourse, topicTitle);
  const id = call.id || newId();

  if (toolName === 'criar_sessao') {
    const rawDate = typeof call.args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(call.args.date)
      ? call.args.date
      : today;
    const rawMins = Number(call.args.minutes);
    const minutes = Number.isFinite(rawMins) ? Math.min(180, Math.max(15, Math.round(rawMins))) : 35;
    const notes = typeof call.args.notes === 'string' && call.args.notes.trim()
      ? call.args.notes.trim().slice(0, 160)
      : topicTitle;
    return {
      id,
      toolName,
      courseId: targetCourse?.id,
      courseLabel: targetCourse?.shortName ?? targetCourse?.name ?? tr('uni:uniTools.defaultLabel'),
      topicId: matchedTopic?.id,
      topicTitle,
      status: 'pending',
      session: {
        date: rawDate,
        minutes,
        notes,
      },
    };
  }

  if (toolName === 'criar_flashcards') {
    const rawCards = Array.isArray(call.args.cards) ? call.args.cards : [];
    const flashcards = rawCards
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const c = item as Record<string, unknown>;
        const front = String(c.front ?? c.q ?? '').trim();
        const back = String(c.back ?? c.a ?? '').trim();
        if (!front || !back) return null;
        return { front: front.slice(0, 220), back: back.slice(0, 400) };
      })
      .filter((x): x is { front: string; back: string } => Boolean(x))
      .slice(0, 5);

    if (flashcards.length === 0) return null;
    return {
      id,
      toolName,
      courseId: targetCourse?.id,
      courseLabel: targetCourse?.shortName ?? targetCourse?.name ?? tr('uni:uniTools.defaultLabel'),
      topicId: matchedTopic?.id,
      topicTitle,
      status: 'pending',
      flashcards,
    };
  }

  if (toolName === 'focar_plano') {
    if (!targetCourse) return null;
    const exclusive =
      call.args.exclusive === true ||
      String(call.args.exclusive ?? '').toLowerCase() === 'true';
    const reason =
      typeof call.args.reason === 'string' && call.args.reason.trim()
        ? call.args.reason.trim().slice(0, 140)
        : targetCourse.shortName || targetCourse.name;
    return {
      id,
      toolName: 'focar_plano',
      courseId: targetCourse.id,
      courseLabel: targetCourse.shortName ?? targetCourse.name ?? tr('uni:uniTools.defaultLabel'),
      topicTitle: targetCourse.shortName || targetCourse.name,
      status: 'pending',
      planFocus: {
        exclusive,
        reason,
      },
    };
  }

  const note = String(call.args.note ?? call.args.question ?? '').trim();
  if (!note) return null;

  return {
    id,
    toolName: 'marcar_duvida',
    courseId: targetCourse?.id,
    courseLabel: targetCourse?.shortName ?? targetCourse?.name ?? tr('uni:uniTools.defaultLabel'),
    topicId: matchedTopic?.id,
    topicTitle,
    status: 'pending',
    doubt: {
      note: note.slice(0, 240),
      createTask: true,
    },
  };
}

/** Aplica no estado da app / IndexedDB apenas após clique explícito do estudante em Confirmar. */
export async function commitUniToolProposal(
  proposal: UniToolProposal,
): Promise<{ summary: string }> {
  const store = useStore.getState();
  const today = todayStr();
  const course = proposal.courseId
    ? store.courses.find((c) => c.id === proposal.courseId)
    : store.courses[0];

  if (proposal.toolName === 'criar_sessao' && proposal.session) {
    const targetCourseId = course?.id ?? proposal.courseId;
    if (!targetCourseId) {
      throw new Error(tr('uni:uniTools.needCourseSession'));
    }
    const newSession: StudySession = {
      id: newId(),
      courseId: targetCourseId,
      ...(proposal.topicId ? { topicId: proposal.topicId } : {}),
      date: proposal.session.date,
      minutes: proposal.session.minutes,
      done: false,
      generated: false,
      notes: proposal.session.notes,
    };
    store.upsert('sessions', newSession);
    return {
      summary: tr('uni:uniTools.sessionAdded', {
        minutes: proposal.session.minutes,
        date: proposal.session.date,
      }),
    };
  }

  if (proposal.toolName === 'criar_flashcards' && proposal.flashcards && proposal.flashcards.length > 0) {
    if (!course) {
      throw new Error(tr('uni:uniTools.needCourseCards'));
    }
    let topic = proposal.topicId
      ? course.topics.find((t) => t.id === proposal.topicId)
      : matchTopic(course, proposal.topicTitle);
    if (!topic) {
      topic = store.ensureCourseTopic(course.id, proposal.topicTitle) ?? undefined;
    }
    if (!topic) {
      throw new Error(tr('uni:uniTools.noTopicForCards'));
    }
    const created: PracticeCard[] = proposal.flashcards.map((fc) => ({
      id: newId(),
      prompt: fc.front,
      answer: fc.back,
      sourceTitle: 'Uni Tutor',
      createdAt: today,
    }));
    const merged = [...created, ...(topic.practiceCards ?? [])].slice(0, 8);
    store.updateTopic(course.id, topic.id, { practiceCards: merged });
    return {
      summary: tr('uni:uniTools.cardsSaved', { count: created.length, topic: topic.title }),
    };
  }

  if (proposal.toolName === 'marcar_duvida' && proposal.doubt) {
    if (course) {
      const existingAgent = await getUniAgent(course.id);
      if (existingAgent) {
        const nextNotebook = sanitizeNotebookDelta(existingAgent.notebook, {
          weakSpot: {
            topic: proposal.topicTitle,
            note: proposal.doubt.note,
          },
        });
        await saveUniAgent({
          ...existingAgent,
          notebook: nextNotebook,
          updatedAt: nextNotebook.updatedAt,
        });
      }
    }
    const task: Task = {
      id: newId(),
      ...(course ? { courseId: course.id } : {}),
      title: tr('uni:uniTools.doubtTask', { topic: proposal.topicTitle, note: proposal.doubt.note }),
      done: false,
      priority: 2,
    };
    store.upsert('tasks', task);
    return {
      summary: tr('uni:uniTools.doubtSaved', { topic: proposal.topicTitle }),
    };
  }

  if (proposal.toolName === 'focar_plano' && proposal.planFocus) {
    if (!course) {
      throw new Error(tr('uni:uniTools.needCourseFocus'));
    }
    const prev = store.settings.plannerPrefs;
    const today = todayStr();
    const boostCourseIds = [
      course.id,
      ...(prev?.boostCourseIds ?? []).filter((id) => id !== course.id),
    ];
    const pausedCourseIds = (prev?.pausedCourseIds ?? []).filter((id) => id !== course.id);
    const nextTestDate = proposal.planFocus.exclusive
      ? store.assessments
          .filter((a) => a.courseId === course.id && a.grade === undefined && a.date.slice(0, 10) >= today)
          .map((a) => a.date.slice(0, 10))
          .sort()[0]
      : undefined;
    const courseModeUntil = nextTestDate
      ? { ...(prev?.courseModeUntil ?? {}), [course.id]: nextTestDate }
      : prev?.courseModeUntil;
    store.updateSettings({
      plannerPrefs: {
        horizonDays: prev?.horizonDays ?? 14,
        preferredPeriod: prev?.preferredPeriod ?? 'auto',
        blockMinutes: prev?.blockMinutes ?? 50,
        strategy: prev?.strategy ?? 'balanced',
        ...prev,
        boostCourseIds,
        pausedCourseIds,
        ...(courseModeUntil ? { courseModeUntil } : {}),
        exclusiveTestFocus: proposal.planFocus.exclusive,
      },
    }, { replan: false });
    const isManual = (prev?.plannerMode ?? 'auto') === 'manual';
    if (!isManual) {
      store.replan('uni_tool', { force: true, prevPrefs: prev });
    }
    return {
      summary: tr(isManual ? 'uni:uniTools.planFocusManualNote' : 'uni:uniTools.planFocusApplied', {
        course: course.shortName || course.name,
      }),
    };
  }

  throw new Error(tr('uni:uniTools.invalidProposal'));
}
