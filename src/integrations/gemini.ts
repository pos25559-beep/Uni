// Cliente mínimo da API Gemini (generateContent) e construção do contexto de estudo.
// A chave vive apenas nas Definições (localStorage) e é enviada só no cabeçalho do pedido.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useStore } from '../store/useStore';
import type { AppState } from '../store/useStore';
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
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CONTEXT_CHARS = 2500;

export async function askGemini(args: {
  messages: ChatMessage[];
  system: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { geminiApiKey, geminiModel } = useStore.getState().settings;
  const key = geminiApiKey.trim();
  if (!key) throw new Error('Falta a chave da API Gemini. Configura-a nas Definições.');

  const res = await fetch(`${API_BASE}/${encodeURIComponent(geminiModel)}:generateContent`, {
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

/** Resumo em texto simples do estado da app, enviado ao modelo (máx. ~2500 caracteres). */
export function buildStudyContext(state: AppState): string {
  const { courses, assessments, sessions, tasks, settings } = state;
  const today = todayStr();
  const lines: string[] = [];

  lines.push(`Data de hoje: ${format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}`);
  lines.push(`Semestre: ${settings.semesterName}${state.isDemo ? ' (dados de demonstração)' : ''}`);

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
    lines.push(`- ${c.name} (${c.ects} ECTS): ${current}; objetivo ${fmtGrade(c.targetGrade)}${needed}.`);
    if (c.topics.length > 0) {
      const topics = c.topics.map((t) => `${t.title} [${statusLabel[t.status].toLowerCase()}, confiança ${t.confidence}/5]`);
      lines.push(`  Matéria: ${topics.join('; ')}.`);
    }
  }

  lines.push('', 'PRÓXIMAS AVALIAÇÕES:');
  const upcoming = upcomingAssessments(assessments).slice(0, 8);
  if (upcoming.length === 0) lines.push('- Nenhuma avaliação futura registada.');
  for (const a of upcoming) {
    const course = courses.find((c) => c.id === a.courseId);
    const days = daysUntil(a.date);
    const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias (${format(parseISO(a.date), 'd MMM', { locale: pt })})`;
    const ready = Math.round(readiness(a, course) * 100);
    lines.push(`- ${course?.shortName ?? 'Geral'} – ${a.title} (${a.kind}) ${when}; peso ${a.weight}%; preparação ${ready}%.`);
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

export const SYSTEM_PROMPT = (context: string): string => `És um tutor de estudo exigente mas encorajador, a ajudar um estudante universitário a preparar o seu semestre.

Regras:
- Responde sempre em português europeu (pt-PT).
- Sê conciso e concreto: prefere passos, números e prioridades a discursos longos.
- Baseia os conselhos nos dados do resumo abaixo. Se um dado não estiver no resumo (por exemplo, o conteúdo de uma aula ou a matéria de uma avaliação), diz que não o tens, em vez de inventar factos sobre as cadeiras ou o estudante.
- Usa Markdown: títulos curtos (###), listas e **negrito** para destacar o essencial.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta do estudante antes de a corrigir e de avançar.
- Se o estudante pedir algo fora do estudo, responde brevemente e volta ao tema.

Resumo do semestre do estudante (dados da app, atuais neste momento):
"""
${context}
"""`;
