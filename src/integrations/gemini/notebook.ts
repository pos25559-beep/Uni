import { format } from 'date-fns';
import type { GenerationConfig, SchemaRequest } from 'firebase/ai';
import { tr } from '../../i18n/tr';
import {
  parseStudyGuide,
  parseStudyGuideTopic,
  studyGuideToMarkdown,
  type StudyGuide,
  type StudyGuideLabels,
  type StudyGuideTopic,
} from '../../lib/studyGuide';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import type { ChatAttachment } from './core';
import {
  buildContentsWithAttachments,
  callDirectRest,
  resolveGeminiConfig,
  runNativeGenerate,
  withQuotaAndFallback,
} from './core';
import { AiConsentRequiredError, THINKING_BALANCED, THINKING_DEEP, resolveChatThinkingConfig } from './models';
import { isDailyQuotaError } from '../../lib/aiAccess';
import {
  AREA_VOICE_HINTS,
  PERSONA_INSTRUCTIONS_BY_LANG,
  getActiveAppLanguage,
  outputLanguageInstruction,
} from './promptContext';
import { STUDY_GUIDE_SCHEMA, STUDY_GUIDE_TOPIC_SCHEMA, TOPIC_SHEET_SCHEMA } from './schemas';

export interface NotebookSourceInput {
  title: string;
  content: string;
}

/** Próxima avaliação da cadeira, para o Guia de Estudo apontar ao teste certo. */
export interface NotebookAssessmentContext {
  title: string;
  /** ISO da data (ex.: 2026-12-03T14:00:00). */
  date: string;
  daysLeft: number;
  weight?: number;
  topicTitles: string[];
}

export interface NotebookBriefArgs {
  mode: 'guide' | 'quiz' | 'summary' | 'podcast';
  sources: NotebookSourceInput[];
  attachments?: ChatAttachment[];
  courseName?: string;
  persona?: UniPersonaMode;
  accessory?: UniAccessoryId;
  assessment?: NotebookAssessmentContext | null;
  /** Cancela o pedido (ex.: o estudante fechou o Caderno). */
  signal?: AbortSignal;
}

export interface StudyGuideResult {
  /** Guia estruturado; null quando o modelo não devolveu JSON válido (então `markdown` é o texto livre). */
  guide: StudyGuide | null;
  markdown: string;
}

export interface StudyGuideProgress {
  phase: 'mapping' | 'topics';
  done: number;
  total: number;
}

export interface ExtractedTopicSheetResult {
  title: string;
  summary: string;
  keyConcepts: string[];
}

/** Tempo máximo por pedido do caderno/guia (cada modelo da cadeia). */
const NOTEBOOK_TIMEOUT_MS = 150_000;
/** Tempo máximo do guia inteiro (mapa + secções, com as novas tentativas): acima disto desiste com aviso. */
const STUDY_GUIDE_TOTAL_BUDGET_MS = 240_000;
const STUDY_GUIDE_MAX_DEEP_TOPICS = 6;
const STUDY_GUIDE_CONCURRENCY = 3;
const GUIDE_MARKDOWN_PROMPT =
  'Cria um **Guia de Estudo Estruturado** claro com conceitos-chave, armadilhas comuns de teste e plano rápido de revisão, citando sempre as fontes como [Fonte N] ou o nome do ficheiro.';

export function getStudyGuideLabels(): StudyGuideLabels {
  return {
    goal: tr('assistant:notebook.guide.goal'),
    keyIdeas: tr('assistant:notebook.guide.keyIdeas'),
    formulas: tr('assistant:notebook.guide.formulas'),
    pitfalls: tr('assistant:notebook.guide.pitfalls'),
    sources: tr('assistant:notebook.guide.sources'),
    examTraps: tr('assistant:notebook.guide.examTraps'),
    revisionPlan: tr('assistant:notebook.guide.revisionPlan'),
    selfCheck: tr('assistant:notebook.guide.selfCheck'),
    answer: tr('assistant:notebook.guide.answer'),
    units: tr('assistant:notebook.guide.units'),
    validity: tr('assistant:notebook.guide.validity'),
    workedExample: tr('assistant:notebook.guide.workedExample'),
    examPattern: tr('assistant:notebook.guide.examPattern'),
    practice: tr('assistant:notebook.guide.practice'),
    minutes: (n) => tr('assistant:notebook.guide.minutes', { count: n }),
    page: (p) => tr('assistant:notebook.guide.page', { page: p }),
  };
}

function buildStudyGuidePrompt(assessment: NotebookAssessmentContext | null | undefined): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const target = assessment
    ? `PRÓXIMA AVALIAÇÃO DA CADEIRA: "${assessment.title}" em ${assessment.date.slice(0, 10)} (faltam ${assessment.daysLeft} dias${
        assessment.weight ? `, peso ${assessment.weight}%` : ''
      }). Tópicos que abrange: ${assessment.topicTitles.length ? assessment.topicTitles.join('; ') : 'não indicados (usa as fontes)'}.
O plano de revisão começa em ${today}, tem de terminar antes de ${assessment.date.slice(0, 10)} e tem de cobrir estes tópicos. Em "goal" diz numa frase qual é a avaliação, a data e o que abrange.`
    : `Não há nenhuma avaliação futura registada para esta cadeira: diz isso em "goal" e planeia 7 dias a partir de ${today}.`;
  return `Cria um Guia de Estudo estruturado, orientado à próxima avaliação.
${target}

Regras do JSON:
- "title": título curto e útil para o guia (sem prefixos numerados).
- "topics": um por tópico a estudar (no máximo 6, pela ordem em que convém estudar), com 2 a 3 ideias-chave, as fórmulas principais em LaTeX (sem cifrões à volta), armadilhas e as fontes onde o tópico está. Cada tópico vai ser aprofundado a seguir, por isso aqui o essencial é acertar nos tópicos e nas fontes (incluindo testes e exames antigos que tenham perguntas sobre ele).
- Em "sources" cita o título da fonte e, quando visível, a página ou o slide em "page". Nunca inventes fontes nem páginas.
- Se faltar matéria importante nos materiais, diz o que falta em "goal" ou nas "examTraps".
- "examTraps": erros típicos em testes. "revisionPlan": "day" em data ISO (aaaa-mm-dd), "task" concreta, "minutes" realistas. "selfCheck": 4 a 6 perguntas que misturem tópicos, com resposta curta.
- Nunca coloques JSON nem blocos de código dentro dos campos de texto.`;
}

export async function runNotebookText(
  args: NotebookBriefArgs,
  customKey: string,
  model: string,
  goalPrompt: string,
  asJson: boolean,
  options?: { schema?: SchemaRequest; deep?: boolean },
): Promise<string> {
  const formattedSources = args.sources
    .filter((s) => s.content.trim())
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 5000)}`)
    .join('\n\n');

  const system = `És o Uni a organizar um Caderno de Estudo interno da Unipedia${args.courseName ? ` para ${args.courseName}` : ''}.
${PERSONA_INSTRUCTIONS_BY_LANG[getActiveAppLanguage()][args.persona ?? 'amigo']}
${AREA_VOICE_HINTS[args.accessory ?? 'default']}
Regras estritas:
- Baseia-te exclusivamente nas fontes e anexos fornecidos pelo estudante.
- Cita sempre as fontes relevantes ${asJson ? 'pelo título do documento e página/slide quando visíveis' : 'no texto usando [Fonte 1], [Fonte 2] ou o nome do documento'}.
- ${asJson ? 'Devolve apenas JSON válido conforme o esquema.' : 'Usa Markdown limpo.'}
- ${outputLanguageInstruction()}`;

  const userPrompt = formattedSources
    ? `${goalPrompt}\n\nFONTES DO CADERNO:\n${formattedSources}`
    : `${goalPrompt}\n\nAnalisa os ficheiros anexados como fontes principais do caderno.`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: userPrompt }], args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: asJson ? 0.35 : 0.45,
    thinkingConfig: options?.deep ? THINKING_DEEP : resolveChatThinkingConfig(model),
    ...(asJson
      ? { responseMimeType: 'application/json', responseSchema: options?.schema ?? STUDY_GUIDE_SCHEMA }
      : {}),
  };

  const longCall = {
    signal: args.signal,
    primaryTimeoutMs: NOTEBOOK_TIMEOUT_MS,
    fallbackTimeoutMs: NOTEBOOK_TIMEOUT_MS,
    overloadRetries: 2,
  };
  return customKey
    ? callDirectRest({ key: customKey, model, contents, system, generationConfig, ...longCall })
    : runNativeGenerate({ model, contents, system, generationConfig, ...longCall });
}

export function assertNotebookInputs(args: NotebookBriefArgs): void {
  const hasText = args.sources.some((s) => s.content.trim());
  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  if (!hasText && !hasAttachments) {
    throw new Error(tr('common:errors.notebookEmptySources'));
  }
}

function buildStudyGuideTopicPrompt(
  topic: StudyGuideTopic,
  others: string[],
  assessment: NotebookAssessmentContext | null | undefined,
  courseName?: string,
): string {
  const target = assessment
    ? `para a avaliação "${assessment.title}" de ${assessment.date.slice(0, 10)}${assessment.weight ? ` (peso ${assessment.weight}%)` : ''}`
    : 'para o próximo teste';
  const sourcesHint = topic.sources.length
    ? `Fontes indicadas no mapa do guia: ${topic.sources.map((src) => (src.page ? `${src.title} (p. ${src.page})` : src.title)).join('; ')}.`
    : '';
  return `Escreve a secção COMPLETA do Guia de Estudo sobre o tópico «${topic.title}»${courseName ? ` da cadeira ${courseName}` : ''}, ${target}.
${others.length ? `Os outros tópicos têm secção própria; não os repitas: ${others.join('; ')}.` : ''}
${sourcesHint}

O objetivo é que o estudante consiga resolver as perguntas de teste deste tópico só com esta secção e os seus apontamentos. Profundidade de um bom professor, não de um resumo.

Campos:
- "title": exatamente «${topic.title}».
- "summary": 5 a 8 frases. Explica o conceito, a intuição física e quando se usa, com a notação das fontes.
- "keyIdeas": 3 a 6 ideias que caem no teste, cada uma numa frase concreta.
- "formulaDetails": TODAS as fórmulas necessárias para resolver exercícios deste tópico, cada uma completa em LaTeX (sem "...", sem cifrões à volta, sem texto como "sigma1": usa \\sigma_1). Em "meaning" explica cada símbolo; em "units" as unidades SI; em "validity" as hipóteses (por exemplo estado plano de tensão, material isotrópico, atrito nulo, deformação homogénea).
- "workedExample": um exercício típico resolvido. Prefere um exercício de um teste/exame antigo ou de uma ficha das fontes e indica-o em "source" com a página quando visível; se não houver, cria um exemplo representativo e deixa "source" vazio. "steps": passos numerados com as contas e as unidades, já verificadas. "result": valor final com unidades e a conclusão.
- "examPattern": como este tópico aparece nos testes/exames antigos das fontes (tipo de pergunta, o que pedem, cotação se visível). Se não houver testes antigos nas fontes, diz isso numa frase.
- "pitfalls": 3 a 5 erros concretos que custam pontos.
- "practice": 3 a 5 perguntas ao estilo do teste com resposta (numérica com unidades quando aplicável).
- "sources": só documentos que usaste, com página ou slide quando visíveis. Nunca inventes fontes nem páginas.

Usa $...$ para matemática dentro do texto (summary, keyIdeas, steps, practice, meaning). Nunca escrevas símbolos por extenso (sigma_y, tau, sqrt(3)): usa $\\sigma_y$, $\\tau$, $\\sqrt{3}$.
Citações: quando uma frase vem de uma fonte, termina-a com [n], onde n é a posição (1, 2, 3…) dessa fonte na lista "sources" que devolves. Usa só números que existam na lista.
Verifica todas as contas e unidades antes de responder. Não escrevas JSON nem blocos de código dentro dos campos.`;
}

function mergeGuideTopic(outline: StudyGuideTopic, deep: StudyGuideTopic | null): StudyGuideTopic {
  if (!deep) return outline;
  const seen = new Set<string>();
  const sources = [...deep.sources, ...outline.sources].filter((src) => {
    const key = `${src.title.toLowerCase()}|${src.page ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ...deep,
    title: outline.title,
    keyIdeas: deep.keyIdeas.length ? deep.keyIdeas : outline.keyIdeas,
    formulas: deep.formulaDetails?.length ? [] : outline.formulas,
    pitfalls: deep.pitfalls.length ? deep.pitfalls : outline.pitfalls,
    sources,
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Guia de Estudo em duas fases: primeiro um mapa do teste e depois uma secção completa por tópico.
 */
export async function generateStudyGuide(
  args: Omit<NotebookBriefArgs, 'mode'> & { onProgress?: (p: StudyGuideProgress) => void },
): Promise<StudyGuideResult & { failedTopics: number }> {
  const { customKey, model } = resolveGeminiConfig();
  const { onProgress, signal: outerSignal, ...rest } = args;

  // Um só sinal para tudo: cancela quando o estudante fecha o Caderno ou quando passa o tempo máximo.
  const budget = new AbortController();
  let budgetExceeded = false;
  const onOuterAbort = () => budget.abort();
  if (outerSignal?.aborted) budget.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
  const budgetTimer = setTimeout(() => {
    budgetExceeded = true;
    budget.abort();
  }, STUDY_GUIDE_TOTAL_BUDGET_MS);

  const full: NotebookBriefArgs = { ...rest, mode: 'guide', signal: budget.signal };
  try {
    assertNotebookInputs(full);
    const result = await withQuotaAndFallback('notebook', customKey, async () => {
      onProgress?.({ phase: 'mapping', done: 0, total: 0 });
      const raw = await runNotebookText(full, customKey, model, buildStudyGuidePrompt(args.assessment), true);
      const outline = parseStudyGuide(raw);
      if (!outline) {
        const markdown = await runNotebookText(full, customKey, model, GUIDE_MARKDOWN_PROMPT, false);
        return { guide: null, markdown, failedTopics: 0 };
      }

      const deepTopics = outline.topics.slice(0, STUDY_GUIDE_MAX_DEEP_TOPICS);
      const titles = outline.topics.map((tp) => tp.title);
      let done = 0;
      onProgress?.({ phase: 'topics', done, total: deepTopics.length });
      let failed = 0;
      const sections = await mapWithConcurrency(deepTopics, STUDY_GUIDE_CONCURRENCY, async (topic) => {
        if (budget.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        let section: StudyGuideTopic | null = null;
        try {
          const sectionRaw = await runNotebookText(
            full,
            customKey,
            model,
            buildStudyGuideTopicPrompt(
              topic,
              titles.filter((x) => x !== topic.title),
              args.assessment,
              args.courseName,
            ),
            true,
            { schema: STUDY_GUIDE_TOPIC_SCHEMA, deep: true },
          );
          section = parseStudyGuideTopic(sectionRaw);
        } catch (err) {
          // Cancelamento, consentimento e chave não são «falha de um tópico»: param o guia todo.
          if (budget.signal.aborted || isGuideFatalError(err)) throw err;
          section = null;
        }
        if (!section) failed += 1;
        done += 1;
        onProgress?.({ phase: 'topics', done, total: deepTopics.length });
        return section;
      });

      // Se nenhuma secção saiu, o guia seria só o mapa: falha (e a quota é devolvida) em vez de o gravar.
      if (deepTopics.length > 0 && failed === deepTopics.length) {
        throw new Error(tr('common:errors.notebookGenFail'));
      }

      const guide: StudyGuide = {
        ...outline,
        topics: outline.topics.map((tp, i) => (i < sections.length ? mergeGuideTopic(tp, sections[i]) : tp)),
      };
      return { guide, markdown: studyGuideToMarkdown(guide, getStudyGuideLabels()), failedTopics: failed };
    });

    if (!result.markdown) throw new Error(tr('common:errors.notebookGenFail'));
    return result;
  } catch (err) {
    if (budgetExceeded && !outerSignal?.aborted) {
      throw new Error(
        tr('common:errors.guideTimeout', { minutes: Math.round(STUDY_GUIDE_TOTAL_BUDGET_MS / 60_000) }),
      );
    }
    throw err;
  } finally {
    clearTimeout(budgetTimer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Erros que não se resolvem tentando o tópico seguinte. */
function isGuideFatalError(err: unknown): boolean {
  if (err instanceof AiConsentRequiredError) return true;
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'AbortError') return true;
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  return status === 400 || status === 401 || status === 403 || isDailyQuotaError(err);
}

/**
 * Refaz um tópico do guia com um pedido do estudante («mais exemplos de Tresca»).
 */
export async function refineStudyGuideTopic(
  args: Omit<NotebookBriefArgs, 'mode'> & { topic: StudyGuideTopic; instruction: string; otherTopicTitles: string[] },
): Promise<StudyGuideTopic | null> {
  const { customKey, model } = resolveGeminiConfig();
  const { topic, instruction, otherTopicTitles, ...rest } = args;
  const full: NotebookBriefArgs = { ...rest, mode: 'guide' };
  assertNotebookInputs(full);
  const current = JSON.stringify(topic).slice(0, 12_000);
  const prompt = `${buildStudyGuideTopicPrompt(topic, otherTopicTitles, args.assessment, args.courseName)}

Esta é a versão atual da secção (JSON):
${current}

Pedido do estudante para esta secção: «${instruction.trim().slice(0, 500)}»
Reescreve a secção completa a cumprir o pedido, mantendo o que estava certo e melhorando o resto.`;
  const raw = await withQuotaAndFallback('notebook', customKey, () =>
    runNotebookText(full, customKey, model, prompt, true, { schema: STUDY_GUIDE_TOPIC_SCHEMA, deep: true }),
  );
  const parsed = parseStudyGuideTopic(raw);
  return parsed ? mergeGuideTopic(topic, parsed) : null;
}

export async function generateNotebookBrief(args: NotebookBriefArgs): Promise<string> {
  if (args.mode === 'guide') {
    return (await generateStudyGuide(args)).markdown;
  }
  const { customKey, model } = resolveGeminiConfig();
  assertNotebookInputs(args);

  const goalPrompt =
    args.mode === 'quiz'
      ? 'Cria **5 perguntas de treino de exame** com resposta e explicação curta escondida em secção final, citando a origem de cada uma como [Fonte N] ou nome do ficheiro.'
      : 'Faz um **Resumo Executivo por Tópicos** direto e memorável, citando de onde veio cada ideia como [Fonte N] ou nome do ficheiro.';

  const text = await withQuotaAndFallback('notebook', customKey, () =>
    runNotebookText(args, customKey, model, goalPrompt, false),
  );

  if (!text) throw new Error(tr('common:errors.notebookGenFail'));
  return text;
}

/** Gera uma ficha de tópico estruturada e citável a partir de materiais reais para guardar em IndexedDB. */
export async function extractTopicSheetFromSources(args: {
  topicTitle: string;
  courseName?: string;
  sources: NotebookSourceInput[];
  attachments?: ChatAttachment[];
}): Promise<ExtractedTopicSheetResult> {
  const { customKey, model } = resolveGeminiConfig();
  const formattedSources = args.sources
    .filter((s) => s.content.trim())
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 5000)}`)
    .join('\n\n');

  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  if (!formattedSources && !hasAttachments) {
    throw new Error(tr('common:errors.sheetEmptySources'));
  }

  const prompt = `Cria uma ficha de estudo permanente e citável sobre "${args.topicTitle}"${args.courseName ? ` (${args.courseName})` : ''}.
Regras obrigatórias:
- ${outputLanguageInstruction()}
- Usa EXCLUSIVAMENTE as fontes fornecidas.
- Inclui: 1) Ideia central, 2) Definições e fórmulas-chave (com LaTeX se aplicável), 3) Armadilhas típicas de teste e 4) Exemplo resolvido ou caso prático curto.
- Cita sempre a origem entre parênteses retos: [Fonte: nome exato]. Se faltar algo nas fontes, não inventes.
${formattedSources ? `\nFONTES:\n${formattedSources}` : '\nAnalisa os ficheiros anexados como fontes principais.'}

Devolve APENAS JSON válido:
{"title":"Título claro da ficha","summary":"Markdown estruturado da ficha","keyConcepts":["conceito 1","conceito 2","conceito 3"]}`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: prompt }], args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.35,
    maxOutputTokens: 1600,
    responseMimeType: 'application/json',
    responseSchema: TOPIC_SHEET_SCHEMA,
    thinkingConfig: THINKING_BALANCED,
  };

  const rawText = await withQuotaAndFallback('notebook', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<ExtractedTopicSheetResult>;
  const summary = parsed.summary?.trim() ?? '';
  if (!summary) {
    throw new Error(tr('common:errors.sheetExtractFail'));
  }
  return {
    title: parsed.title?.trim().slice(0, 80) || args.topicTitle,
    summary,
    keyConcepts: Array.isArray(parsed.keyConcepts)
      ? parsed.keyConcepts.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
      : [],
  };
}
