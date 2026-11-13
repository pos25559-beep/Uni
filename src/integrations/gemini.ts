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
const DEFAULT_MODEL = 'gemini-2.5-flash';

export class AiConsentRequiredError extends Error {
  constructor() {
    super('Para usar o Gemini IA tens primeiro de ativar o consentimento de processamento por IA nas Definições.');
    this.name = 'AiConsentRequiredError';
  }
}

export class MissingGeminiKeyError extends Error {
  constructor() {
    super('Configura a tua chave Gemini API nas Definições → Gemini IA (ou ativa em desenvolvimento) para usar este assistente.');
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
  const model = (!geminiModel || geminiModel.startsWith('gemini-2.0') || geminiModel.startsWith('gemini-3.8'))
    ? DEFAULT_MODEL
    : geminiModel.trim();
  return { key, model };
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

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
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
    }),
  });

  const data = (await res.json()) as GenerateResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Erro Gemini Vision ${res.status}`);
  }

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

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: args.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.6 },
    }),
    signal: args.signal,
  });

  const data = (await res.json().catch(() => null)) as GenerateResponse | null;
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Erro ${res.status} ao contactar a Gemini.`);
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(
      reason
        ? `A Gemini bloqueou o pedido (${reason}). Reformula a pergunta.`
        : 'A Gemini não devolveu nenhuma resposta. Tenta de novo.',
    );
  }

  const text = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('A Gemini devolveu uma resposta vazia. Tenta de novo.');
  return text;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumo em texto simples do estado da app, enviado ao modelo. */
export function buildStudyContext(state: AppState): string {
  const { courses, assessments, sessions, tasks, settings, academicProfile, weeklyCheckIns } = state;
  const today = todayStr();
  const lines: string[] = [];

  lines.push(`Data de hoje: ${format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}`);
  lines.push(`Semestre: ${settings.semesterName}${state.isDemo ? ' (dados de demonstração)' : ''}`);

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

export const SYSTEM_PROMPT = (context: string, docContext?: string): string => `És um tutor de estudo exigente mas encorajador, a ajudar um estudante universitário a preparar o seu semestre.

Regras:
- Responde sempre em português europeu (pt-PT).
- Sê conciso e concreto: prefere passos, números e prioridades a discursos longos.
- Baseia os conselhos nos dados do resumo e nos documentos anexados abaixo. Se um dado não estiver disponível, diz que não o tens em vez de inventar factos sobre as cadeiras ou o estudante.
- Usa Markdown: títulos curtos (###), listas e **negrito** para destacar o essencial.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta do estudante antes de a corrigir e de avançar.
- Se o estudante pedir algo fora do estudo, responde brevemente e volta ao tema.
${docContext ? `\n${docContext}\n` : ''}
Resumo do semestre do estudante (dados da app, atuais neste momento):
"""
${context}
"""`;
