import type { Content, GenerationConfig } from 'firebase/ai';
import { tr } from '../../i18n/tr';
import { normalizeAppLanguage } from '../../lib/grading';
import type {
  TopicSheetRecord,
  UniAgentExpedition,
  UniAgentRecord,
  UniExpeditionQuestion,
} from '../../lib/localDb';
import type { UniPersonaMode } from '../../lib/uniAccessories';
import {
  extractUniCheckInSyncBlock,
  mergeParsedUnderstandingWithAi,
  type ParsedCheckInUnderstanding,
} from '../../lib/uniCheckInNlu';
import type { NotebookDeltaProposal } from '../../lib/uniMastery';
import type { AppState } from '../../store/useStore';
import type { AppLanguage } from '../../types';
import { askGemini } from './chat';
import type { ChatAttachment } from './core';
import {
  buildContentsWithAttachments,
  callDirectRest,
  resolveGeminiConfig,
  runNativeGenerate,
  withQuotaAndFallback,
} from './core';
import { THINKING_FAST } from './models';
import type { NotebookSourceInput } from './notebook';
import {
  PERSONA_INSTRUCTIONS_BY_LANG,
  outputLanguageInstruction,
} from './promptContext';
import {
  NOTEBOOK_MEMORY_DELTA_SCHEMA,
  PRACTICE_SET_SCHEMA,
  UNI_EXPEDITION_SCHEMA,
  UNI_RECALL_EVAL_SCHEMA,
  UNI_RECALL_PROMPT_SCHEMA,
} from './schemas';

export interface GeneratedPracticeCardDraft {
  prompt: string;
  answer: string;
  sourceTitle?: string;
}

export interface UniRecallPromptResult {
  question: string;
  hint: string;
}

export interface UniRecallEvaluationResult {
  score: 1 | 2 | 3;
  feedback: string;
  detectedWeakSpot?: { topic: string; note: string };
  matchedStrength?: string;
}

/**
 * Gera um micro-baralho de 3 a 5 cartões de prática ativa fundamentado nos materiais reais
 * da cadeira (PDFs, excertos extraídos e notas do Diário) para rever após foco ou no SRS.
 */
export async function generateMaterialPracticeSet(args: {
  topicTitle: string;
  courseName?: string;
  cardCount?: number;
  sources?: NotebookSourceInput[];
  attachments?: ChatAttachment[];
  diaryContext?: string;
  existingPrompts?: string[];
}): Promise<GeneratedPracticeCardDraft[]> {
  const { customKey, model } = resolveGeminiConfig();
  const count = Math.max(3, Math.min(5, args.cardCount ?? 4));

  const sourcesBlock = (args.sources ?? [])
    .filter((s) => s.content.trim())
    .slice(0, 3)
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 4500)}`)
    .join('\n\n');

  const avoidBlock =
    args.existingPrompts && args.existingPrompts.length > 0
      ? `\nEvita repetir perguntas já feitas:\n- ${args.existingPrompts.slice(0, 5).join('\n- ')}`
      : '';

  const prompt = `Cria exatamente ${count} cartões curtos de prática ativa (active recall / estilo pergunta de teste) sobre "${args.topicTitle}"${args.courseName ? ` (${args.courseName})` : ''}.
${outputLanguageInstruction()}
${args.diaryContext ? `\nContexto real do estudante (Diário / até onde deu a matéria):\n${args.diaryContext}` : ''}
${sourcesBlock ? `\nCONTEÚDO REAL DOS MATERIAIS DA CADEIRA:\n${sourcesBlock}` : ''}
${!sourcesBlock && args.attachments && args.attachments.length > 0 ? '\nAnalisa os ficheiros anexados da cadeira e extrai perguntas fiéis à matéria real.' : ''}
${avoidBlock}

Regras:
- Perguntas diretas, concretas e verificáveis (1–2 frases), privilegiando exercícios típicos, definições críticas ou armadilhas de exame presentes nos materiais quando houver fontes.
- Resposta objetiva em 1–3 frases, suficiente para o estudante confirmar se acertou.
- Em "sourceTitle", coloca o nome exato da fonte/documento usado (ou omite se não houver fontes anexadas).
Devolve APENAS JSON válido no formato:
{"cards":[{"prompt":"...","answer":"...","sourceTitle":"opcional"}]}`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: prompt }], args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    maxOutputTokens: 900,
    responseMimeType: 'application/json',
    responseSchema: PRACTICE_SET_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('notebook', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    cards?: Array<Partial<GeneratedPracticeCardDraft>>;
  };

  const clean = (parsed.cards ?? [])
    .map((c) => ({
      prompt: c.prompt?.trim() ?? '',
      answer: c.answer?.trim() ?? '',
      ...(c.sourceTitle?.trim() ? { sourceTitle: c.sourceTitle.trim().slice(0, 90) } : {}),
    }))
    .filter((c) => c.prompt.length >= 6 && c.answer.length >= 3)
    .slice(0, count);

  if (clean.length === 0) {
    throw new Error(tr('common:errors.practiceCardsFail'));
  }
  return clean;
}

/**
 * Conduz um turno conversacional curto no Diário/Check-in do Uni para extrair matéria (ex.: "cai até ao slide 8"),
 * estado emocional e resumo de estudo em linguagem natural.
 */
export async function converseCheckInWithGemini(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  baseUnderstanding: ParsedCheckInUnderstanding;
  courseName?: string;
  courseTopics: { id: string; title: string }[];
  courseMaterials: string[];
  assessmentTitle?: string;
  persona?: UniPersonaMode;
  signal?: AbortSignal;
}): Promise<{
  reply: string;
  understanding: ParsedCheckInUnderstanding;
}> {
  const personaHint =
    args.persona === 'exigente'
      ? 'Sê direto, energético e prático.'
      : args.persona === 'calmo'
        ? 'Sê sereno, acolhedor e tranquilo.'
        : args.persona === 'curioso'
          ? 'Sê curioso e faz uma pergunta breve para confirmar detalhes.'
          : args.persona === 'treinador'
            ? 'Sê positivo, prático e focado em metas curtas.'
            : 'Sê próximo, humano e empático como um colega atento.';

  const topicsList =
    args.courseTopics.length > 0
      ? args.courseTopics.map((t) => `- [${t.id}] ${t.title}`).join('\n')
      : '(sem tópicos listados ainda)';
  const matsList =
    args.courseMaterials.length > 0
      ? args.courseMaterials.slice(0, 28).map((m) => `- ${m}`).join('\n')
      : '(sem apontamentos anexados)';

  const system = `És o Uni num mini-chat humano de check-in com um estudante universitário em Portugal. ${personaHint}
Modo de conversa: ${args.baseUnderstanding.kind} (${args.courseName ?? 'geral'}${args.assessmentTitle ? ` · ${args.assessmentTitle}` : ''}).
Responde em 2 a 3 frases curtas, humanas e naturais (${outputLanguageInstruction()}), confirmando exatamente o que entendeste (matéria até que slide/aula, dúvidas, cansaço ou ansiedade) e perguntando se quer ajustar algo antes de confirmar. NÃO uses listas longas nem questionários formais.

Tópicos existentes na cadeira:
${topicsList}

Apontamentos disponíveis na biblioteca desta cadeira (usa para perceber intervalos como "até ao slide 8" ou "até T08"):
${matsList}

No FINAL da tua resposta, inclui exatamente um bloco técnico invisível ao utilizador:
<uni-checkin-sync>{"feeling":"clara|mais_ou_menos|dificil|faltei|produtivo|normal|cansado|confiante|estavel|pressionado|atrasado|ansioso","scopeLabel":"opcional ex: Até Slide 8","studyFocus":"opcional ex: Refazer testes antigos / Resolver exercícios / Rever resumos","topicTitle":"opcional","matchedTopicIds":["ids existentes aplicáveis"],"newTopics":["títulos novos a adicionar caso faltem"],"studiedSummary":"opcional","difficulties":"opcional","rating":4}</uni-checkin-sync>`;

  const raw = await askGemini({
    messages: args.messages,
    system,
    signal: args.signal,
  });

  const { visibleReply, sync } = extractUniCheckInSyncBlock(raw);
  const understanding = mergeParsedUnderstandingWithAi(
    args.baseUnderstanding,
    sync,
    args.courseTopics.length > 0
      ? ({ topics: args.courseTopics } as unknown as AppState['courses'][number])
      : undefined,
  );
  return {
    reply: visibleReply || tr('common:errors.checkInFallbackReply'),
    understanding,
  };
}

/** Gera uma pergunta aberta curta de Recall do Uni para o fecho da sessão de foco. */
export async function generateUniRecallQuestion(args: {
  topicTitle: string;
  courseName?: string;
  agent: UniAgentRecord;
  sheets?: TopicSheetRecord[];
  examMode?: boolean;
}): Promise<UniRecallPromptResult> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: AppLanguage = normalizeAppLanguage(args.agent.language);
  const examMode = args.examMode ?? args.agent.stage >= 3;
  const sheetContext = (args.sheets ?? [])
    .slice(0, 2)
    .map((s) => `[${s.title}]\n${s.summary.slice(0, 1200)}`)
    .join('\n\n');
  const weakPrefix =
    targetLang === 'en'
      ? 'Recorded weak spots'
      : targetLang === 'es'
        ? 'Puntos débiles registrados'
        : targetLang === 'pt-BR'
          ? 'Pontos fracos registrados'
          : 'Pontos fracos registados';
  const weakHint =
    args.agent.notebook.weakSpots.length > 0
      ? `${weakPrefix}: ${args.agent.notebook.weakSpots
          .slice(0, 3)
          .map((w) => `${w.topic} (${w.note})`)
          .join('; ')}.`
      : '';

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName ?? 'this course'}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Ask the student for an active 2-sentence recall on "${args.topicTitle}" from memory (no notes).
${examMode ? 'Specialist Exam Mode unlocked: make the prompt exam-grade (test a condition, trap, or application).' : ''}
${weakHint}
${sheetContext ? `\nCourse sheets:\n${sheetContext}` : ''}
Return ONLY valid JSON:
{"question":"1-2 concise sentences in your archetype voice","hint":"short 1-sentence hint if requested"}`
      : targetLang === 'es'
        ? `Eres «${args.agent.name}», Uni especialista de ${args.courseName ?? 'esta asignatura'}. ${PERSONA_INSTRUCTIONS_BY_LANG.es[args.agent.personaId]}
Pide al estudiante un recuerdo activo de 2 frases sobre «${args.topicTitle}» sin mirar apuntes.
${examMode ? 'Modo Examen de Especialista activo: formula una pregunta exigente tipo examen (condición, excepción o aplicación).' : ''}
${weakHint}
${sheetContext ? `\nMaterial real de la asignatura:\n${sheetContext}` : ''}
Devuelve SOLO JSON válido en español:
{"question":"pregunta corta y concreta en 1–2 frases en tu tono","hint":"pista breve en 1 frase si pide ayuda"}`
        : targetLang === 'pt-BR'
          ? `Você é «${args.agent.name}», Uni especialista de ${args.courseName ?? 'disciplina'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-BR'][args.agent.personaId]}
Peça ao estudante um recall ativo de 2 frases sobre «${args.topicTitle}» sem consultar anotações.
${examMode ? 'Modo Prova de Especialista ativo: faça uma pergunta exigente estilo prova (testando condição, exceção ou aplicação).' : ''}
${weakHint}
${sheetContext ? `\nMaterial real da disciplina:\n${sheetContext}` : ''}
Devolva APENAS JSON válido em português do Brasil:
{"question":"pergunta curta e concreta em 1–2 frases no tom do seu arquétipo","hint":"dica curta em 1 frase caso o aluno peça ajuda"}`
          : `És «${args.agent.name}», Uni especialista de ${args.courseName ?? 'cadeira'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Pede ao estudante um recall ativo de 2 frases sobre «${args.topicTitle}» sem consultar apontamentos.
${examMode ? 'Modo Exame de Especialista ativo: formula uma pergunta exigente estilo teste/exame (testando condição, exceção ou aplicação).' : ''}
${weakHint}
${sheetContext ? `\nMaterial real da cadeira:\n${sheetContext}` : ''}
Devolve APENAS JSON válido:
{"question":"pergunta curta e concreta em 1–2 frases no tom do teu arquétipo","hint":"pista curta em 1 frase caso o aluno peça ajuda"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.45,
    maxOutputTokens: 320,
    responseMimeType: 'application/json',
    responseSchema: UNI_RECALL_PROMPT_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<UniRecallPromptResult>;
  const fallbackQ =
    targetLang === 'en'
      ? `In 2 sentences from memory, explain the core idea of "${args.topicTitle}".`
      : targetLang === 'es'
        ? `Explica en 2 frases, sin mirar apuntes, la idea esencial de «${args.topicTitle}».`
        : targetLang === 'pt-BR'
          ? `Explique em 2 frases, sem consultar anotações, a ideia central de «${args.topicTitle}».`
          : `Explica-me em 2 frases, sem olhar para a sebenta, a ideia essencial de «${args.topicTitle}».`;
  const fallbackHint =
    targetLang === 'en'
      ? 'Include a concise definition and one condition where it applies.'
      : targetLang === 'es'
        ? 'Incluye la definición breve y un caso donde se aplique (o falle).'
        : targetLang === 'pt-BR'
          ? 'Pense em uma definição curta e em um caso onde ela se aplica (ou falha).'
          : 'Pensa numa definição curta e num caso em que se aplica (ou falha).';
  return {
    question: parsed.question?.trim() || fallbackQ,
    hint: parsed.hint?.trim() || fallbackHint,
  };
}

/** Avalia a resposta de recall do estudante com feedback no arquétipo do Uni e nota 1|2|3 para o SRS. */
export async function evaluateUniRecall(args: {
  topicTitle: string;
  question: string;
  studentAnswer: string;
  courseName?: string;
  agent: UniAgentRecord;
  sheets?: TopicSheetRecord[];
}): Promise<UniRecallEvaluationResult> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: AppLanguage = normalizeAppLanguage(args.agent.language);
  const sourceWord = targetLang === 'en' ? 'Source' : 'Fonte';
  const sheetContext = (args.sheets ?? [])
    .slice(0, 2)
    .map((s) => `[${sourceWord}: ${s.title}]\n${s.summary.slice(0, 1600)}`)
    .join('\n\n');

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName ?? 'this course'}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Evaluate the student's active recall answer in clear English.
Topic: ${args.topicTitle}
Question: ${args.question}
Student answer: ${args.studentAnswer}
${sheetContext ? `\nReference sheets:\n${sheetContext}` : ''}

Strict SRS rubric:
- 1 ("Missed"): major conceptual error or empty/inaccurate answer.
- 2 ("Partial"): got the main idea but missed a condition, sign, or nuance.
- 3 ("Mastered"): clear, accurate explanation at course level.

Return ONLY valid JSON:
{"score":1|2|3,"feedback":"2-3 concrete sentences in your archetype voice (cite [Source: ...] if applicable)","weakNote":"if score<3, short note of mistake (max 100 chars), else empty string","strengthNote":"if score==3, short strength (max 90 chars), else empty string"}`
      : targetLang === 'es'
        ? `Eres «${args.agent.name}», Uni especialista de ${args.courseName ?? 'esta asignatura'}. ${PERSONA_INSTRUCTIONS_BY_LANG.es[args.agent.personaId]}
Evalúa la respuesta de recuerdo activo del estudiante en español natural.
Tema: ${args.topicTitle}
Pregunta: ${args.question}
Respuesta del estudiante: ${args.studentAnswer}
${sheetContext ? `\nReferencia de las fichas:\n${sheetContext}` : ''}

Criterio estricto de puntuación para repetición espaciada:
- 1 ("Fallé"): error conceptual grave o respuesta vacía/muy imprecisa.
- 2 ("A medias"): captó la idea general pero falló un detalle, condición o aplicación.
- 3 ("Dominado"): explicación correcta, clara y precisa para el nivel de la asignatura.

Devuelve SOLO JSON válido:
{"score":1|2|3,"feedback":"2 a 3 frases concretas en tu tono para corregir o validar (cita [Fonte: ...] si aplica)","weakNote":"si score<3, nota breve del fallo u omisión (máx 100 chars), si no cadena vacía","strengthNote":"si score==3, punto fuerte corto (máx 90 chars), si no cadena vacía"}`
        : targetLang === 'pt-BR'
          ? `Você é «${args.agent.name}», Uni especialista de ${args.courseName ?? 'disciplina'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-BR'][args.agent.personaId]}
Avalie a resposta de recall ativo do estudante em português do Brasil.
Tópico: ${args.topicTitle}
Pergunta feita: ${args.question}
Resposta do estudante: ${args.studentAnswer}
${sheetContext ? `\nReferência das fichas:\n${sheetContext}` : ''}

Critério estrito de score para repetição espaçada:
- 1 ("Errei"): erro conceitual grave ou resposta vazia/muito imprecisa.
- 2 ("Lembrei ±"): acertou a ideia geral mas falhou em um detalhe, condição ou aplicação.
- 3 ("Dominei"): explicação correta, clara e precisa para o nível da disciplina.

Devolva APENAS JSON válido:
{"score":1|2|3,"feedback":"2 a 3 frases concretas no tom do seu arquétipo corrigindo ou validando (cite [Fonte: ...] se aplicável)","weakNote":"se score<3, nota curta do erro ou omissão (máx 100 chars), senão string vazia","strengthNote":"se score==3, ponto forte curto (máx 90 chars), senão string vazia"}`
          : `És «${args.agent.name}», Uni especialista de ${args.courseName ?? 'cadeira'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Avalia a resposta de recall ativo do estudante em português europeu (pt-PT).
Tópico: ${args.topicTitle}
Pergunta feita: ${args.question}
Resposta do estudante: ${args.studentAnswer}
${sheetContext ? `\nReferência das fichas:\n${sheetContext}` : ''}

Critério estrito de score para repetição espaçada:
- 1 ("Falhei"): erro conceptual grave ou resposta vazia/muito imprecisa.
- 2 ("Lembrei +-"): acertou a ideia geral mas falhou um detalhe, condição ou aplicação.
- 3 ("Dominei"): explicação correta, clara e precisa para o nível do tópico.

Devolve APENAS JSON válido:
{"score":1|2|3,"feedback":"2 a 3 frases concretas no tom do teu arquétipo a corrigir ou validar (cita [Fonte: ...] se aplicável)","weakNote":"se score<3, nota curta do erro ou omissão (máx 100 chars), senão string vazia","strengthNote":"se score==3, ponto forte curto (máx 90 chars), senão string vazia"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.35,
    maxOutputTokens: 450,
    responseMimeType: 'application/json',
    responseSchema: UNI_RECALL_EVAL_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    score?: number;
    feedback?: string;
    weakNote?: string;
    strengthNote?: string;
  };
  const score = parsed.score === 1 || parsed.score === 2 || parsed.score === 3 ? parsed.score : 2;
  const fallbackOk =
    targetLang === 'en'
      ? 'Clean, accurate answer — strong retention!'
      : targetLang === 'es'
        ? '¡Respuesta limpia y precisa, gran retención!'
        : targetLang === 'pt-BR'
          ? 'Resposta limpa e firme! Boa retenção.'
          : 'Resposta limpa e sólida. Boa retenção!';
  const fallbackPartial =
    targetLang === 'en'
      ? 'Almost there — double check the key condition in your sheet before the next review.'
      : targetLang === 'es'
        ? 'Casi lo tienes — repasa la condición clave en tu ficha antes del próximo repaso.'
        : targetLang === 'pt-BR'
          ? 'Quase lá — revise a condição principal na ficha antes da próxima revisão.'
          : 'Quase lá — revê a condição principal na ficha antes da próxima revisão.';
  const feedback = parsed.feedback?.trim() || (score === 3 ? fallbackOk : fallbackPartial);
  const weakNote = parsed.weakNote?.trim();
  const strengthNote = parsed.strengthNote?.trim();

  return {
    score,
    feedback,
    ...(score < 3 && weakNote
      ? { detectedWeakSpot: { topic: args.topicTitle, note: weakNote.slice(0, 180) } }
      : {}),
    ...(score === 3 && strengthNote ? { matchedStrength: strengthNote.slice(0, 120) } : {}),
  };
}

/** Prepara até 3 perguntas curtas de expedição para a revisão espaçada do dia seguinte. */
export async function generateUniExpeditionQuestions(args: {
  courseName: string;
  agent: UniAgentRecord;
  candidateTopics: Array<{ id?: string; title: string }>;
  sheets?: TopicSheetRecord[];
  forDate: string;
}): Promise<UniAgentExpedition> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: AppLanguage = normalizeAppLanguage(args.agent.language);
  const topics = args.candidateTopics.slice(0, 3);
  const sheetContext = (args.sheets ?? [])
    .slice(0, 4)
    .map((s) => `[${s.title}]\n${s.summary.slice(0, 1100)}`)
    .join('\n\n');

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Prepare ${topics.length || 2} sharp spaced-repetition expedition questions for tomorrow (${args.forDate}) covering these topics:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Core concepts of ${args.courseName}`}
${sheetContext ? `\nSaved course sheets:\n${sheetContext}` : ''}
Return ONLY valid JSON:
{"questions":[{"topicTitle":"exact topic name","q":"short active-recall question in your voice","hint":"1-sentence hint","sourceRef":"sheet title or Syllabus"}]}`
      : targetLang === 'es'
        ? `Eres «${args.agent.name}», Uni especialista de ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG.es[args.agent.personaId]}
Prepara ${topics.length || 2} preguntas breves de expedición para el repaso espaciado de mañana (${args.forDate}) sobre estos temas:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Ideas clave de ${args.courseName}`}
${sheetContext ? `\nFichas reales de la asignatura:\n${sheetContext}` : ''}
Devuelve SOLO JSON válido:
{"questions":[{"topicTitle":"nombre exacto del tema","q":"pregunta corta de recuerdo activo en tu tono","hint":"pista corta en 1 frase","sourceRef":"título de ficha o Temario"}]}`
        : targetLang === 'pt-BR'
          ? `Você é «${args.agent.name}», Uni especialista de ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-BR'][args.agent.personaId]}
Prepare ${topics.length || 2} perguntas curtas de expedição para a revisão espaçada de amanhã (${args.forDate}) sobre estes tópicos:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Ideias centrais de ${args.courseName}`}
${sheetContext ? `\nFichas reais da disciplina:\n${sheetContext}` : ''}
Devolva APENAS JSON válido:
{"questions":[{"topicTitle":"nome exato do tópico","q":"pergunta curta de recall no seu tom","hint":"dica curta em 1 frase","sourceRef":"nome da ficha ou Ementa"}]}`
          : `És «${args.agent.name}», Uni especialista de ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Prepara ${topics.length || 2} perguntas curtas de expedição para a revisão espaçada de amanhã (${args.forDate}) sobre estes tópicos:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Ideias centrais de ${args.courseName}`}
${sheetContext ? `\nFichas reais da cadeira:\n${sheetContext}` : ''}
Devolve APENAS JSON válido:
{"questions":[{"topicTitle":"nome exato do tópico","q":"pergunta curta de recall no teu tom","hint":"pista curta em 1 frase","sourceRef":"nome da ficha ou Programa"}]}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.45,
    maxOutputTokens: 700,
    responseMimeType: 'application/json',
    responseSchema: UNI_EXPEDITION_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    questions?: Array<{ topicTitle?: string; q?: string; hint?: string; sourceRef?: string }>;
  };

  const fallbackHint =
    targetLang === 'en'
      ? 'Recall the key definition first.'
      : targetLang === 'es'
        ? 'Empieza por la definición principal.'
        : targetLang === 'pt-BR'
          ? 'Comece pela definição principal.'
          : 'Começa pela definição principal.';

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
  const questions: UniExpeditionQuestion[] = rawQuestions
    .filter((item) => item?.q?.trim())
    .map((item, idx) => {
      const matchedTopic =
        topics.find(
          (t) =>
            item.topicTitle &&
            t.title.toLowerCase().includes(item.topicTitle.trim().toLowerCase()),
        ) ?? topics[idx];
      return {
        id: `exp-${args.forDate}-${idx + 1}`,
        ...(matchedTopic?.id ? { topicId: matchedTopic.id } : {}),
        topicTitle: (matchedTopic?.title || item.topicTitle || args.courseName).slice(0, 120),
        q: String(item.q).trim().slice(0, 500),
        hint: String(item.hint || '').trim().slice(0, 260) || fallbackHint,
        sourceRef:
          String(item.sourceRef || '').trim().slice(0, 120) ||
          (args.sheets?.[0]?.title ?? args.courseName),
      };
    });

  if (questions.length === 0 && topics.length > 0) {
    questions.push({
      id: `exp-${args.forDate}-1`,
      ...(topics[0].id ? { topicId: topics[0].id } : {}),
      topicTitle: topics[0].title,
      q:
        targetLang === 'en'
          ? `Summarize the core rule of "${topics[0].title}" in 2 sentences from memory.`
          : targetLang === 'es'
            ? `Resume en 2 frases sin apuntes la regla clave de «${topics[0].title}».`
            : targetLang === 'pt-BR'
              ? `Resuma em 2 frases, sem anotações, a regra principal de «${topics[0].title}».`
              : `Resume em 2 frases sem apontamentos a regra principal de «${topics[0].title}».`,
      hint:
        targetLang === 'en'
          ? 'Name the main condition and one example.'
          : targetLang === 'es'
            ? 'Indica la condición principal y un ejemplo.'
            : targetLang === 'pt-BR'
              ? 'Indique a condição principal e um exemplo.'
              : 'Indica a condição principal e um exemplo.',
      sourceRef: args.sheets?.[0]?.title ?? args.courseName,
    });
  }

  return {
    preparedAt: new Date().toISOString(),
    forDate: args.forDate,
    questions,
  };
}

/** Extrai uma observação incremental curta para o Caderno do Uni apenas quando `memoryEnabled === true`. */
export async function summarizeNotebookMemoryDelta(args: {
  courseName: string;
  userMessage: string;
  assistantReply: string;
  agent: UniAgentRecord;
}): Promise<NotebookDeltaProposal> {
  if (!args.agent.memoryEnabled) return {};
  if (args.userMessage.trim().length < 20) return {};

  const { customKey, model } = resolveGeminiConfig();
  const prompt = `Analisa esta troca rápida sobre "${args.courseName}" entre estudante e o Uni «${args.agent.name}».
Extrai APENAS factos pedagógicos objetivos e úteis para estudo futuro (dificuldade recorrente concreta ou ponto forte demonstrado). Nunca inventes notas nem incluas dados pessoais sensíveis. Se não houver nenhum facto relevante novo, devolve vazio.
Pergunta do estudante: ${args.userMessage.slice(0, 600)}
Resposta do Uni: ${args.assistantReply.slice(0, 900)}

Devolve APENAS JSON válido:
{"weakSpot":{"topic":"nome curto do tópico","note":"dificuldade concreta observada"},"strength":"ponto forte curto opcional"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.25,
    maxOutputTokens: 220,
    responseMimeType: 'application/json',
    responseSchema: NOTEBOOK_MEMORY_DELTA_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  // Tarefa interna: não desconta da quota de recall que o estudante vê.
  const rawText = customKey
    ? await callDirectRest({ key: customKey, model, contents, generationConfig })
    : await runNativeGenerate({ model, contents, generationConfig });

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  let parsed: {
    weakSpot?: { topic?: string; note?: string } | null;
    strength?: string | null;
  } = {};
  try {
    parsed = JSON.parse(match ? match[0] : rawText || '{}') as typeof parsed;
  } catch {
    return {};
  }
  return {
    ...(parsed.weakSpot?.topic?.trim() && parsed.weakSpot?.note?.trim()
      ? {
          weakSpot: {
            topic: parsed.weakSpot.topic.trim().slice(0, 80),
            note: parsed.weakSpot.note.trim().slice(0, 180),
          },
        }
      : {}),
    ...(parsed.strength?.trim() ? { strength: parsed.strength.trim().slice(0, 120) } : {}),
  };
}
