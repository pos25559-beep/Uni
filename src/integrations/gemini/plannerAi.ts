import type { Content, GenerationConfig } from 'firebase/ai';
import { normalizeAppLanguage } from '../../lib/grading';
import { sanitizeIntentItems, type IntentItem } from '../../lib/planner/intent';
import type { AppLanguage, Assessment, Course, StudySession } from '../../types';
import {
  callDirectRest,
  resolveGeminiConfig,
  runNativeGenerate,
  withQuotaAndFallback,
} from './core';
import { THINKING_FAST } from './models';
import { getActiveAppLanguage } from './promptContext';
import { PLAN_INTENT_SCHEMA, PLAN_REVIEW_SCHEMA } from './schemas';

/**
 * «Como está a tua semana?» com IA: devolve a INTENÇÃO (regras com validade), nunca blocos.
 * Corre só com consentimento (resolveGeminiConfig recusa sem ele). O resultado é validado e
 * juntado à leitura simples (`parsePlannerBriefing`), que funciona sempre, mesmo sem IA.
 */
export async function extractPlanIntentWithAi(args: {
  text: string;
  courses: Course[];
  assessments: Assessment[];
  today: string;
  lang?: AppLanguage | string;
  signal?: AbortSignal;
}): Promise<IntentItem[]> {
  const { customKey, model } = resolveGeminiConfig();
  const text = args.text.trim().slice(0, 1200);
  if (!text) return [];
  const targetLang = normalizeAppLanguage(args.lang ?? getActiveAppLanguage());
  const weekdayToday = new Date(`${args.today}T12:00:00`).getDay();
  const catalog = args.courses
    .map((c) => {
      const topics = c.topics
        .slice(0, 25)
        .map((t) => `${t.id}=${t.title}`)
        .join('; ');
      return `- ${c.id} | ${c.shortName} | ${c.name}${topics ? ` | tópicos: ${topics}` : ''}`;
    })
    .join('\n');
  const exams = args.assessments
    .filter((a) => a.grade === undefined && a.date.slice(0, 10) >= args.today)
    .slice(0, 12)
    .map((a) => `- ${a.courseId} | ${a.title} | ${a.date.slice(0, 16)}`)
    .join('\n');

  const prompt = `Hoje é ${args.today} (dia da semana ${weekdayToday}; 0=domingo … 6=sábado). Língua do estudante: ${targetLang}.
Lê o que o estudante escreveu sobre a semana e devolve só REGRAS para o planeador (nunca blocos nem horários de sessões).
Cadeiras e tópicos (usa só estes ids):
${catalog || '- (nenhuma)'}
Próximas avaliações:
${exams || '- (nenhuma)'}

Tipos de regra:
- focus_phase: USAR SEMPRE que o estudante pedir uma sequência temporal/por etapas (ex.: "só TEP até sexta às 16h, depois só Fab. Aditivo até ao teste, depois semana normal para os 2.ºs testes"). Devolve múltiplos itens focus_phase encadeados com fromDate, fromTime (opcional HH:mm), untilDate, untilTime (opcional HH:mm), phaseMode ("exclusive" | "boost" | "balanced"), courseIds ([ids]; vazio em balanced), strategy (opcional) e label curto.
- course_mode: reforçar (boost) ou pausar (pause) uma cadeira; "until" = último dia (yyyy-MM-dd) se o estudante disser até quando.
- exclusive_focus: quando o estudante pede para focar SÓ numa cadeira numa única janela (sem sequência de fases): courseId e "until".
- course_note: foco curto (≤ 80 caracteres, na língua do estudante) para uma cadeira, com "from"/"until" (yyyy-MM-dd). Sem datas ditas, até 7 dias.
- weekday_rule: mudança PERMANENTE de um dia da semana (todas as semanas): enabled, minutes, window.
- date_override: mudança só numa DATA ("esta sexta não posso", "amanhã só 1 hora"): date (yyyy-MM-dd), enabled, minutes, window.
- strategy: catch_up (atrasado), exams_first (testes), srs_focus (revisões), balanced.
- content_mix: teoria vs prática: theory_first (mais teoria/bases), practice_first (mais exercícios/exames), balanced.
- topic_hint: o estudante diz que já domina / está a meio / nunca viu um tópico: topicId, status (done|review|learning|todo), confidence 1-5.
Regras: não inventes nada que o texto não diga; datas entre hoje e +21 dias; se não houver regras, devolve {"items": []}.

Texto do estudante:
"""${text}"""`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 800,
    responseMimeType: 'application/json',
    responseSchema: PLAN_INTENT_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };
  const raw = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig, signal: args.signal })
      : runNativeGenerate({ model, contents, generationConfig, signal: args.signal }),
  );
  try {
    const match = /\{[\s\S]*\}/.exec(raw || '{}');
    const parsed = JSON.parse(match ? match[0] : '{}') as { items?: unknown };
    return sanitizeIntentItems(parsed.items, args.courses, args.today);
  } catch {
    return [];
  }
}

export interface PlanReviewOpinion {
  tone: 'warn' | 'tip' | 'good';
  summary: string;
  suggestion: string;
}

export interface PlanAiReview {
  headline: string;
  opinions: PlanReviewOpinion[];
}

/**
 * «Consciência do Uni»: parecer opcional em leitura simples (nunca altera blocos sozinho)
 * sobre o plano real montado pelo estudante ou pelo motor.
 */
export async function reviewPlanWithAi(args: {
  today: string;
  courses: Course[];
  assessments: Assessment[];
  sessions: StudySession[];
  pausedCourseIds?: string[];
  boostCourseIds?: string[];
  exclusiveTestFocus?: boolean;
  lang?: AppLanguage | string;
  signal?: AbortSignal;
}): Promise<PlanAiReview> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang = normalizeAppLanguage(args.lang ?? getActiveAppLanguage());
  const courseMap = new Map(args.courses.map((c) => [c.id, c]));

  const upcomingSessions = args.sessions
    .filter((s) => !s.done && s.date >= args.today)
    .sort((a, b) => `${a.date}${a.start ?? ''}`.localeCompare(`${b.date}${b.start ?? ''}`))
    .slice(0, 24)
    .map((s) => {
      const c = courseMap.get(s.courseId);
      return `- ${s.date} ${s.start ?? '--:--'} | ${s.minutes}m | ${c?.shortName ?? s.courseId}${s.generated === false ? ' [manual]' : ''}`;
    })
    .join('\n');

  const upcomingTests = args.assessments
    .filter((a) => a.grade === undefined && a.date.slice(0, 10) >= args.today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)
    .map((a) => {
      const c = courseMap.get(a.courseId);
      const pendingTopics = (c?.topics ?? []).filter((t) => t.status !== 'done').length;
      return `- ${a.date.slice(0, 10)} | ${c?.shortName ?? a.courseId}: ${a.title} (peso ${a.weight}%, ${pendingTopics} tópicos por dominar)`;
    })
    .join('\n');

  const pausedNames = (args.pausedCourseIds ?? [])
    .map((id) => courseMap.get(id)?.shortName ?? id)
    .join(', ');
  const boostNames = (args.boostCourseIds ?? [])
    .map((id) => courseMap.get(id)?.shortName ?? id)
    .join(', ');

  const prompt = `És a «Consciência do Uni» (conselheiro calmo, honesto e prático) para um estudante universitário. Hoje é ${args.today}. Responde sempre em ${targetLang}.
Avalia o plano atual (sem inventar dados) e dá 1 frase geral ("headline") e 1 a 3 opiniões curtas ("opinions") com diagnóstico + melhoria prática.
Preferências declaradas:
- Pausadas: ${pausedNames || 'nenhuma'}
- Reforçadas: ${boostNames || 'nenhuma'}
- Foco exclusivo ativo: ${args.exclusiveTestFocus ? 'sim' : 'não'}

Próximos testes:
${upcomingTests || '- (nenhum)'}

Sessões planeadas nos próximos dias:
${upcomingSessions || '- (vazio)'}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.25,
    maxOutputTokens: 700,
    responseMimeType: 'application/json',
    responseSchema: PLAN_REVIEW_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const raw = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig, signal: args.signal })
      : runNativeGenerate({ model, contents, generationConfig, signal: args.signal }),
  );
  const match = /\{[\s\S]*\}/.exec(raw || '{}');
  const parsed = JSON.parse(match ? match[0] : '{}') as Partial<PlanAiReview>;
  const opinions = Array.isArray(parsed.opinions)
    ? parsed.opinions
        .filter(
          (o): o is PlanReviewOpinion =>
            Boolean(o) &&
            (o.tone === 'warn' || o.tone === 'tip' || o.tone === 'good') &&
            typeof o.summary === 'string' &&
            typeof o.suggestion === 'string',
        )
        .slice(0, 3)
    : [];
  return {
    headline: typeof parsed.headline === 'string' ? parsed.headline.slice(0, 140) : '',
    opinions,
  };
}
