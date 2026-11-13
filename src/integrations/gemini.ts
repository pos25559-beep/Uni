// Cliente mínimo da API Gemini (generateContent) e construção do contexto de estudo.
// A chave vive apenas nas Definições (localStorage) e é enviada só no cabeçalho do pedido.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useStore } from '../store/useStore';
import type { AppState } from '../store/useStore';
import type { Material } from '../types';
import {
  daysUntil, fmtGrade, fmtMinutes, gradeSummary, minutesThisWeek, readiness, studyStreak,
  todayStr, upcomingAssessments,
} from '../lib/selectors';
import { statusLabel } from '../lib/colors';
import type { UniAccessoryId, UniPersonaMode } from '../lib/uniAccessories';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** ISO datetime */
  at: string;
  sourceDocTitles?: string[];
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CONTEXT_CHARS = 4500;
const DEFAULT_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-2.5-flash';

export class AiConsentRequiredError extends Error {
  constructor() {
    super('Ativa primeiro o Uni nas Definições para que ele possa responder às tuas perguntas.');
    this.name = 'AiConsentRequiredError';
  }
}

export class MissingGeminiKeyError extends Error {
  constructor() {
    super('Cola a tua chave pessoal do Gemini nas Definições para acordar o Uni.');
    this.name = 'MissingGeminiKeyError';
  }
}

function resolveGeminiConfig() {
  const { geminiApiKey, geminiModel, aiConsent } = useStore.getState().settings;
  if (!aiConsent) {
    throw new AiConsentRequiredError();
  }
  const key = geminiApiKey.trim() || (import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY ?? '') : '');
  if (!key) {
    throw new MissingGeminiKeyError();
  }
  const raw = geminiModel.trim();
  const model = !raw || raw.startsWith('gemini-2.0') || raw.startsWith('gemini-3.8') ? DEFAULT_MODEL : raw;
  return { key, model };
}

async function callGenerateWithFallback(args: {
  key: string;
  model: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<GenerateResponse> {
  const runOnce = async (targetModel: string) => {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(targetModel)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.key },
      body: JSON.stringify(args.body),
      signal: args.signal,
    });
    const data = (await res.json().catch(() => null)) as GenerateResponse | null;
    return { res, data };
  };

  const primary = await runOnce(args.model);
  if (primary.res.ok) {
    return primary.data ?? {};
  }

  const msg = primary.data?.error?.message?.toLowerCase() ?? '';
  const shouldFallback =
    args.model === DEFAULT_MODEL &&
    (primary.res.status === 404 ||
      primary.res.status === 400 ||
      primary.res.status === 403 ||
      msg.includes('not found') ||
      msg.includes('not supported') ||
      msg.includes('model'));

  if (shouldFallback) {
    const backup = await runOnce(FALLBACK_MODEL);
    if (backup.res.ok) {
      return backup.data ?? {};
    }
    throw new Error(backup.data?.error?.message ?? `Erro ${backup.res.status} ao contactar o Uni.`);
  }

  throw new Error(primary.data?.error?.message ?? `Erro ${primary.res.status} ao contactar o Uni.`);
}

export interface ExtractedHistoryItem {
  code?: string;
  name: string;
  grade?: number;
  ects?: number;
  status: 'aprovada' | 'a_fazer' | 'por_fazer';
}

/** Analisa um print/captura do portal académico (ex.: CLIP, Fénix, Sigarra) com Gemini Vision. */
export async function parseAcademicHistoryFromScreenshot(
  base64Data: string,
  mimeType: string,
): Promise<ExtractedHistoryItem[]> {
  const { key, model } = resolveGeminiConfig();

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const prompt = `Extrai todas as unidades curriculares (cadeiras) visíveis nesta captura de ecrã de um portal universitário português (ex: CLIP, Fénix, Sigarra, Moodle).
Devolve APENAS um array JSON válido onde cada item segue exatamente o formato:
{"code": "string opcional", "name": "nome completo da cadeira", "grade": número entre 0 e 20 ou null se ainda não tiver nota, "ects": número ou 6, "status": "aprovada" | "a_fazer" | "por_fazer"}
Regras:
- Se tiver nota >= 10 (ou "Aprovado"), status = "aprovada".
- Se estiver inscrito no semestre atual sem nota final, status = "a_fazer".
- Se tiver reprovado ou falta realizar, status = "por_fazer".
- Não inventes cadeiras que não estejam na imagem.`;

  const data = await callGenerateWithFallback({
    key,
    model,
    body: {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: cleanBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    },
  });

  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '[]';
  const jsonMatch = /\[[\s\S]*\]/.exec(rawText);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && 'name' in item))
    .map((item) => {
      const gradeNum = typeof item.grade === 'number' && !Number.isNaN(item.grade) ? item.grade : undefined;
      const ectsNum = typeof item.ects === 'number' && !Number.isNaN(item.ects) ? item.ects : 6;
      const statusRaw = String(item.status ?? '');
      const status: ExtractedHistoryItem['status'] =
        statusRaw === 'aprovada' || statusRaw === 'a_fazer' || statusRaw === 'por_fazer'
          ? statusRaw
          : gradeNum && gradeNum >= 10
            ? 'aprovada'
            : 'a_fazer';

      return {
        code: typeof item.code === 'string' && item.code.trim() ? item.code.trim() : undefined,
        name: String(item.name).trim(),
        grade: gradeNum,
        ects: ectsNum,
        status,
      };
    });
}

export async function askGemini(args: {
  messages: ChatMessage[];
  system: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { key, model } = resolveGeminiConfig();

  const data = await callGenerateWithFallback({
    key,
    model,
    body: {
      systemInstruction: { parts: [{ text: args.system }] },
      contents: args.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.65 },
    },
    signal: args.signal,
  });

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(
      reason
        ? `O Uni pediu para reformulares a pergunta (${reason}).`
        : 'O Uni não devolveu resposta agora. Tenta de novo.',
    );
  }

  const text = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('O Uni devolveu uma resposta vazia. Tenta de novo.');
  return text;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumo em texto simples do estado da app, enviado ao modelo. */
export function buildStudyContext(state: AppState): string {
  const { courses, assessments, sessions, tasks, settings, academicProfile, weeklyCheckIns } = state;
  const today = todayStr();
  const lines: string[] = [];

  lines.push(`Data de hoje: ${format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}`);
  lines.push(`Semestre: ${settings.semesterName}`);

  if (academicProfile) {
    lines.push('', 'PERFIL ACADÉMICO DO ESTUDANTE (UNIPEDIA):');
    lines.push(`- Faculdade/Curso: ${academicProfile.universityName} — ${academicProfile.degreeName}`);
    lines.push(`- Ingresso: ${academicProfile.entryYear} · Ano atual: ${academicProfile.currentAcademicYear}.º ano, ${academicProfile.currentSemester}.º semestre`);
    if (academicProfile.difficultCourseIds.length > 0) {
      const hardNames = academicProfile.difficultCourseIds.map(
        (id) => courses.find((c) => c.id === id)?.shortName ?? id,
      );
      lines.push(`- Cadeiras onde tem mais dificuldade: ${hardNames.join(', ')}`);
    }
    if (academicProfile.difficultTopicsNotes?.trim()) {
      lines.push(`- Dificuldades declaradas pelo aluno: ${academicProfile.difficultTopicsNotes.trim()}`);
    }
    const approved = academicProfile.completedCourses.filter((c) => c.status === 'aprovada');
    if (approved.length > 0) {
      const preview = approved
        .slice(0, 12)
        .map((c) => `${c.code}${typeof c.grade === 'number' ? ` (${c.grade}v)` : ''}`)
        .join(', ');
      lines.push(`- Histórico de cadeiras já concluídas (${approved.length}): ${preview}`);
    }
  }

  lines.push('', 'CADEIRAS:');
  if (courses.length === 0) lines.push('- Sem cadeiras registadas.');
  for (const c of courses) {
    const g = gradeSummary(c, assessments);
    const needed = g.needed === null
      ? ''
      : g.needed > 20 ? '; objetivo inatingível nas restantes avaliações' : `; precisa de ${fmtGrade(g.needed)} nas restantes`;
    const current = g.current === null
      ? 'sem notas ainda'
      : `média atual ${fmtGrade(g.current)} (${Math.round(g.gradedWeight)}% avaliado)`;
    const hardTag = academicProfile?.difficultCourseIds.includes(c.id) ? ' [PRIORIDADE/DIFICULDADE]' : '';
    lines.push(`- ${c.name} (${c.ects} ECTS)${hardTag}: ${current}; objetivo ${fmtGrade(c.targetGrade)}${needed}.`);
    if (c.topics.length > 0) {
      const topics = c.topics.map((t) => `${t.title} [${statusLabel[t.status].toLowerCase()}, confiança ${t.confidence}/5]`);
      lines.push(`  Matéria: ${topics.join('; ')}.`);
    }
  }

  lines.push('', 'PRÓXIMAS AVALIAÇÕES:');
  const upcoming = upcomingAssessments(assessments).slice(0, 8);
  const urgentSoon = upcoming.filter((a) => daysUntil(a.date) <= 10);
  if (urgentSoon.length === 1) {
    const c = courses.find((x) => x.id === urgentSoon[0].courseId);
    lines.push(`- MODO TESTE ATIVO (<10 dias): Foco intensivo em ${c?.shortName ?? urgentSoon[0].title} (${urgentSoon[0].title}).`);
  } else if (urgentSoon.length >= 2) {
    const names = urgentSoon.map((a) => courses.find((c) => c.id === a.courseId)?.shortName ?? a.title);
    lines.push(`- MODO TESTE MÚLTIPLO ATIVO (<10 dias): Equilibrar ${urgentSoon.length} avaliações urgentes (${names.join(' vs ')}).`);
  }
  if (upcoming.length === 0) lines.push('- Nenhuma avaliação futura registada.');
  for (const a of upcoming) {
    const course = courses.find((c) => c.id === a.courseId);
    const days = daysUntil(a.date);
    const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias (${format(parseISO(a.date), 'd MMM', { locale: pt })})`;
    const ready = Math.round(readiness(a, course) * 100);
    lines.push(`- ${course?.shortName ?? 'Geral'} – ${a.title} (${a.kind}) ${when}; peso ${a.weight}%; preparação ${ready}%.`);
  }

  if (weeklyCheckIns && weeklyCheckIns.length > 0) {
    const latest = weeklyCheckIns[0];
    lines.push('', `ÚLTIMO CHECK-IN SEMANAL (${latest.weekOf}):`);
    lines.push(`- Estado do aluno: ${latest.mood}`);
    if (latest.understoodTopics.length > 0) {
      lines.push(`- O que já consolidou: ${latest.understoodTopics.join(', ')}`);
    }
    if (latest.classDifficulties.length > 0) {
      lines.push(`- O que não entendeu na aula: ${latest.classDifficulties.join(', ')}`);
    }
    if (latest.pendingNextWeek.length > 0) {
      lines.push(`- Ficou para a próxima semana: ${latest.pendingNextWeek.join(', ')}`);
    }
    if (latest.notes.trim()) {
      lines.push(`- Notas do aluno: ${latest.notes.trim()}`);
    }
  }

  lines.push('', 'PLANO DE HOJE:');
  const todays = sessions.filter((s) => s.date === today);
  if (todays.length === 0) lines.push('- Sem sessões planeadas hoje.');
  for (const s of todays) {
    const course = courses.find((c) => c.id === s.courseId);
    const topic = course?.topics.find((t) => t.id === s.topicId)?.title;
    const label = `${course?.shortName ?? 'Geral'}${topic ? ` – ${topic}` : ''}`;
    const status = s.done ? `feita (${fmtMinutes(s.actualMinutes ?? s.minutes)})` : `por fazer (${fmtMinutes(s.minutes)})`;
    lines.push(`- ${label}: ${status}.`);
  }

  const weeklyGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  lines.push('', 'ESTUDO:');
  lines.push(`- Esta semana: ${fmtMinutes(minutesThisWeek(sessions))} de ${fmtMinutes(weeklyGoal)} planeados por semana.`);
  lines.push(`- Sequência atual: ${plural(studyStreak(sessions), 'dia seguido', 'dias seguidos')}.`);

  lines.push('', 'TAREFAS PENDENTES:');
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, 8);
  if (pending.length === 0) lines.push('- Nenhuma tarefa pendente.');
  for (const t of pending) {
    const course = courses.find((c) => c.id === t.courseId);
    const due = t.due
      ? `, prazo ${format(parseISO(t.due), 'd MMM', { locale: pt })}${t.due < today ? ' (atrasada)' : ''}`
      : '';
    lines.push(`- ${t.title}${course ? ` (${course.shortName})` : ''}${due}.`);
  }

  const text = lines.join('\n');
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS - 20)}\n[…resumo truncado]` : text;
}

/** Resumo dos documentos/materiais associados para fornecer contexto de estudo detalhado ao Gemini. */
export function buildDocumentContext(materials: Material[]): string {
  if (!materials || materials.length === 0) return '';
  const lines: string[] = ['DOCUMENTOS E MATERIAIS DE ESTUDO DISPONÍVEIS:'];
  for (const m of materials) {
    const prov = m.provider.toUpperCase();
    lines.push(`- [${prov}] ${m.title}: ${m.url}`);
  }
  return lines.join('\n');
}

const PERSONA_INSTRUCTIONS: Record<UniPersonaMode, string> = {
  amigo:
    'Estilo Amigo: próximo, bem-humorado sem exageros, celebra pequenas vitórias do estudante e explica conceitos com exemplos do dia-a-dia.',
  exigente:
    'Estilo Exigente (Modo Exame): direto ao ponto, rigoroso nas definições e provas, cobra raciocínio ao estudante antes de dar a solução final.',
  calmo:
    'Estilo Anti-Stress: voz tranquila e paciente, parte tarefas grandes em micro-passos de 15 minutos e acalma o ritmo antes de provas difíceis.',
};

const AREA_VOICE_HINTS: Record<UniAccessoryId, string> = {
  default: 'Companheiro versátil do caderno escolar.',
  math: 'Com chapéu π de Matemática: raciocínio lógico passo a passo, intuição geométrica e verificação de contas.',
  tech: 'Com auscultadores de Engenharia & Programação: pensamento estruturado, pseudocódigo limpo e depuração metódica.',
  health: 'Com estetoscópio de Saúde & Biociências: liga conceitos anatómicos/fisiológicos a casos práticos.',
  arts: 'Com boina de Artes & Design: visual, criativo, atento a referências e composição.',
  science: 'Com óculos de laboratório: rigor experimental, unidades, hipóteses e fenómeno físico/químico.',
  humanities: 'Com óculos clássicos de Letras, Direito & Economia: clareza argumentativa, tese-síntese e contexto histórico.',
};

export const SYSTEM_PROMPT = (
  context: string,
  docContext?: string,
  opts?: { persona?: UniPersonaMode; accessory?: UniAccessoryId; studentName?: string },
): string => {
  const persona = opts?.persona ?? 'amigo';
  const accessory = opts?.accessory ?? 'default';
  const firstName = opts?.studentName?.trim().split(/\s+/)[0] || '';

  return `Tu és o Uni, o companheiro de estudo exclusivo da Unipedia${firstName ? ` a ajudar ${firstName}` : ''}.
Identidade obrigatória:
- Fala sempre como «o Uni» na primeira pessoa. Nunca digas "como modelo de IA", "como assistente virtual" nem "sou o Gemini".
- ${PERSONA_INSTRUCTIONS[persona]}
- Visual e área ativa: ${AREA_VOICE_HINTS[accessory]}
- Responde sempre em português europeu (pt-PT), de forma concisa, concreta e calorosa.
- Baseia conselhos nos dados do resumo e nos documentos/fontes anexados abaixo. Se algo não estiver nos dados, assume com naturalidade em vez de inventar.
- Usa Markdown: títulos curtos (###), listas e **negrito** para destacar o essencial.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta antes de corrigir e avançar.
- Se a conversa fugir do estudo, brinca brevemente como o Uni e traz o foco de volta às cadeiras.
${docContext ? `\n${docContext}\n` : ''}
Resumo atual do caderno do estudante:
"""
${context}
"""`;
};

export interface NotebookSourceInput {
  title: string;
  content: string;
}

export async function generateNotebookBrief(args: {
  mode: 'guide' | 'quiz' | 'summary';
  sources: NotebookSourceInput[];
  courseName?: string;
  persona?: UniPersonaMode;
  accessory?: UniAccessoryId;
}): Promise<string> {
  const { key, model } = resolveGeminiConfig();
  const formattedSources = args.sources
    .filter((s) => s.content.trim())
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 5000)}`)
    .join('\n\n');

  if (!formattedSources) {
    throw new Error('Adiciona pelo menos uma fonte ou nota ao teu Caderno antes de gerar.');
  }

  const goalPrompt =
    args.mode === 'guide'
      ? 'Cria um **Guia de Estudo Estruturado** claro com conceitos-chave, armadilhas comuns de teste e plano rápido de revisão, citando sempre as fontes como [Fonte N].'
      : args.mode === 'quiz'
        ? 'Cria **5 perguntas de treino de exame** com resposta e explicação curta escondida em secção final, citando a origem de cada uma como [Fonte N].'
        : 'Faz um **Resumo Executivo por Tópicos** direto e memorável, citando de onde veio cada ideia como [Fonte N].';

  const system = `És o Uni a organizar um Caderno de Estudo estilo Gemini Notebook${args.courseName ? ` para ${args.courseName}` : ''}.
${PERSONA_INSTRUCTIONS[args.persona ?? 'amigo']}
${AREA_VOICE_HINTS[args.accessory ?? 'default']}
Regras estritas:
- Baseia-te exclusivamente nas fontes fornecidas pelo estudante.
- Cita sempre as fontes relevantes no texto usando [Fonte 1], [Fonte 2], etc.
- Escreve em português europeu (pt-PT) com Markdown limpo.`;

  const data = await callGenerateWithFallback({
    key,
    model,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: `${goalPrompt}\n\nFONTES DO CADERNO:\n${formattedSources}` }],
        },
      ],
      generationConfig: { temperature: 0.45 },
    },
  });

  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('Não foi possível gerar o caderno agora. Tenta novamente.');
  return text;
}
