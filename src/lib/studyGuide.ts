// Guia de Estudo estruturado: tipos, leitura segura do JSON do modelo e conversão para Markdown.

export interface StudyGuideSource {
  title: string;
  page?: string;
}

export interface StudyGuideTopic {
  title: string;
  keyIdeas: string[];
  formulas: string[];
  pitfalls: string[];
  sources: StudyGuideSource[];
}

export interface StudyGuideRevisionStep {
  day: string;
  task: string;
  minutes: number;
}

export interface StudyGuideCheck {
  question: string;
  answer: string;
}

export interface StudyGuide {
  title: string;
  goal: string;
  topics: StudyGuideTopic[];
  examTraps: string[];
  revisionPlan: StudyGuideRevisionStep[];
  selfCheck: StudyGuideCheck[];
}

export interface StudyGuideLabels {
  goal: string;
  keyIdeas: string;
  formulas: string;
  pitfalls: string;
  sources: string;
  examTraps: string;
  revisionPlan: string;
  selfCheck: string;
  answer: string;
  minutes: (n: number) => string;
  page: (p: string) => string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Remove cercas de código soltas e isola o primeiro objeto JSON. */
function extractJsonText(raw: string): string {
  const unfenced = raw.replace(/```(?:json)?/gi, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  return start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced;
}

function parseSource(s: unknown): StudyGuideSource | null {
  if (!isRecord(s)) return null;
  const title = str(s.title);
  if (!title) return null;
  const page = str(s.page);
  return page ? { title, page } : { title };
}

function parseTopic(x: unknown): StudyGuideTopic | null {
  if (!isRecord(x)) return null;
  const title = str(x.title);
  if (!title) return null;
  return {
    title,
    keyIdeas: strList(x.keyIdeas),
    formulas: strList(x.formulas),
    pitfalls: strList(x.pitfalls),
    sources: (Array.isArray(x.sources) ? x.sources : [])
      .map(parseSource)
      .filter((s): s is StudyGuideSource => s !== null),
  };
}

function parseStep(x: unknown): StudyGuideRevisionStep | null {
  if (!isRecord(x)) return null;
  const task = str(x.task);
  if (!task) return null;
  const minutes = Number(x.minutes);
  return {
    day: str(x.day),
    task,
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0,
  };
}

function parseCheck(x: unknown): StudyGuideCheck | null {
  if (!isRecord(x)) return null;
  const question = str(x.question);
  const answer = str(x.answer);
  return question && answer ? { question, answer } : null;
}

/** Lê o guia devolvido pelo modelo. Devolve null se o JSON for inválido ou sem tópicos. */
export function parseStudyGuide(raw: string | null | undefined): StudyGuide | null {
  if (!raw || !raw.trim()) return null;
  let data: unknown;
  try {
    data = JSON.parse(extractJsonText(raw));
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  const topics = (Array.isArray(data.topics) ? data.topics : [])
    .map(parseTopic)
    .filter((t): t is StudyGuideTopic => t !== null);
  if (topics.length === 0) return null;

  return {
    title: str(data.title),
    goal: str(data.goal),
    topics,
    examTraps: strList(data.examTraps),
    revisionPlan: (Array.isArray(data.revisionPlan) ? data.revisionPlan : [])
      .map(parseStep)
      .filter((x): x is StudyGuideRevisionStep => x !== null),
    selfCheck: (Array.isArray(data.selfCheck) ? data.selfCheck : [])
      .map(parseCheck)
      .filter((x): x is StudyGuideCheck => x !== null),
  };
}

export function formatSourceChip(src: StudyGuideSource, pageLabel: (p: string) => string): string {
  return src.page ? `${src.title} · ${pageLabel(src.page)}` : src.title;
}

/** Fórmulas já em LaTeX: embrulha em $$ se o modelo não o fez. */
export function asDisplayMath(formula: string): string {
  const f = formula.trim();
  if (f.startsWith('$') || f.startsWith('\\[')) return f;
  return `$$${f}$$`;
}

export function studyGuideToMarkdown(guide: StudyGuide, labels: StudyGuideLabels): string {
  const out: string[] = [];
  if (guide.title) out.push(`# ${guide.title}`, '');
  if (guide.goal) out.push(`**${labels.goal}:** ${guide.goal}`, '');

  for (const topic of guide.topics) {
    out.push(`## ${topic.title}`, '');
    if (topic.keyIdeas.length) {
      out.push(`**${labels.keyIdeas}**`, ...topic.keyIdeas.map((i) => `- ${i}`), '');
    }
    if (topic.formulas.length) {
      out.push(`**${labels.formulas}**`, '', ...topic.formulas.flatMap((f) => [asDisplayMath(f), '']));
    }
    if (topic.pitfalls.length) {
      out.push(`**${labels.pitfalls}**`, ...topic.pitfalls.map((i) => `- ${i}`), '');
    }
    if (topic.sources.length) {
      out.push(
        `**${labels.sources}:** ${topic.sources.map((s) => formatSourceChip(s, labels.page)).join('; ')}`,
        '',
      );
    }
  }

  if (guide.examTraps.length) {
    out.push(`## ${labels.examTraps}`, ...guide.examTraps.map((i) => `- ${i}`), '');
  }
  if (guide.revisionPlan.length) {
    out.push(
      `## ${labels.revisionPlan}`,
      ...guide.revisionPlan.map(
        (s) => `- [ ] ${s.day ? `${s.day}: ` : ''}${s.task}${s.minutes ? ` (${labels.minutes(s.minutes)})` : ''}`,
      ),
      '',
    );
  }
  if (guide.selfCheck.length) {
    out.push(`## ${labels.selfCheck}`, '');
    guide.selfCheck.forEach((c, i) => {
      out.push(`${i + 1}. ${c.question}`, `   - ${labels.answer}: ${c.answer}`);
    });
    out.push('');
  }
  return out.join('\n').trim();
}
