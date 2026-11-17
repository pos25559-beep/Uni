// Helpers puros do áudio na interface: tempo da gravação, junção de transcrições e
// texto em Markdown de um tópico (ou do guia todo) para o botão «Ouvir».
import type { StudyGuide, StudyGuideTopic } from '../../lib/studyGuide';

export const MAX_DICTATION_SECONDS = 180;

/** 0:07, 1:05, 12:00. Nunca negativo. */
export function formatElapsed(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Acrescenta a transcrição ao texto que já está no compositor, sem o apagar. */
export function appendTranscript(current: string, transcript: string): string {
  const addition = transcript.trim();
  if (!addition) return current;
  const base = current.replace(/\s+$/, '');
  return base ? `${base} ${addition}` : addition;
}

export interface GuideSpeechLabels {
  keyIdeas: string;
  formulas: string;
  workedExample: string;
  pitfalls: string;
}

/** Markdown de um tópico, pensado para ser lido em voz alta (sem fontes nem perguntas de treino). */
export function studyGuideTopicSpeechMarkdown(topic: StudyGuideTopic, labels: GuideSpeechLabels): string {
  const out: string[] = [`## ${topic.title}`, ''];
  if (topic.summary) out.push(topic.summary, '');
  if (topic.keyIdeas.length) {
    out.push(`**${labels.keyIdeas}**`, ...topic.keyIdeas.map((i) => `- ${i}`), '');
  }
  const formulas = topic.formulaDetails?.length
    ? topic.formulaDetails.map((f) => ({ latex: f.latex, meaning: f.meaning }))
    : topic.formulas.map((latex) => ({ latex, meaning: '' }));
  if (formulas.length) {
    out.push(`**${labels.formulas}**`, '');
    for (const f of formulas) {
      out.push(f.latex.includes('$') ? f.latex : `$${f.latex}$`, '');
      if (f.meaning) out.push(f.meaning, '');
    }
  }
  if (topic.workedExample) {
    const ex = topic.workedExample;
    out.push(`**${labels.workedExample}**`, '', ex.statement, '');
    ex.steps.forEach((step, i) => out.push(`${i + 1}. ${step}`));
    out.push('');
    if (ex.result) out.push(ex.result, '');
  }
  if (topic.pitfalls.length) {
    out.push(`**${labels.pitfalls}**`, ...topic.pitfalls.map((i) => `- ${i}`), '');
  }
  return out.join('\n').trim();
}

/** Título, objetivo e todos os tópicos. */
export function studyGuideSpeechMarkdown(guide: StudyGuide, labels: GuideSpeechLabels): string {
  const out: string[] = [];
  if (guide.title) out.push(`# ${guide.title}`, '');
  if (guide.goal) out.push(guide.goal, '');
  for (const topic of guide.topics) out.push(studyGuideTopicSpeechMarkdown(topic, labels), '');
  return out.join('\n').trim();
}
