// Guia de Estudo estruturado: tipos, leitura segura do JSON do modelo e conversão para Markdown.
import { normalizeLatexFormula, normalizePlainMathText } from './plainMath';

export interface StudyGuideSource {
  title: string;
  page?: string;
}

/** Fórmula explicada: LaTeX, o que é cada símbolo, unidades e quando se pode usar. */
export interface StudyGuideFormula {
  latex: string;
  meaning: string;
  units?: string;
  validity?: string;
}

/** Exemplo resolvido tirado dos materiais (enunciado, passos e resultado). */
export interface StudyGuideWorkedExample {
  statement: string;
  steps: string[];
  result: string;
  source?: StudyGuideSource;
}

export interface StudyGuideTopic {
  title: string;
  /** Explicação de 5 a 8 linhas do tópico. */
  summary?: string;
  keyIdeas: string[];
  /** Fórmulas simples (formato antigo); as novas vêm em formulaDetails. */
  formulas: string[];
  formulaDetails?: StudyGuideFormula[];
  workedExample?: StudyGuideWorkedExample;
  /** Como o tópico costuma aparecer nos testes antigos. */
  examPattern?: string;
  pitfalls: string[];
  practice?: StudyGuideCheck[];
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
  units?: string;
  validity?: string;
  workedExample?: string;
  examPattern?: string;
  practice?: string;
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
    ...(str(x.summary) ? { summary: str(x.summary) } : {}),
    keyIdeas: strList(x.keyIdeas),
    formulas: strList(x.formulas),
    ...(parseFormulas(x.formulaDetails).length ? { formulaDetails: parseFormulas(x.formulaDetails) } : {}),
    ...(parseExample(x.workedExample) ? { workedExample: parseExample(x.workedExample)! } : {}),
    ...(str(x.examPattern) ? { examPattern: str(x.examPattern) } : {}),
    pitfalls: strList(x.pitfalls),
    ...(parseChecks(x.practice).length ? { practice: parseChecks(x.practice) } : {}),
    sources: (Array.isArray(x.sources) ? x.sources : [])
      .map(parseSource)
      .filter((s): s is StudyGuideSource => s !== null),
  };
}

function parseFormulas(v: unknown): StudyGuideFormula[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f): StudyGuideFormula | null => {
      if (!isRecord(f)) return null;
      const latex = str(f.latex);
      const meaning = str(f.meaning);
      if (!latex) return null;
      return {
        latex,
        meaning,
        ...(str(f.units) ? { units: str(f.units) } : {}),
        ...(str(f.validity) ? { validity: str(f.validity) } : {}),
      };
    })
    .filter((f): f is StudyGuideFormula => f !== null);
}

function parseExample(v: unknown): StudyGuideWorkedExample | null {
  if (!isRecord(v)) return null;
  const statement = str(v.statement);
  const steps = strList(v.steps);
  if (!statement || steps.length === 0) return null;
  const source = parseSource(v.source);
  return { statement, steps, result: str(v.result), ...(source ? { source } : {}) };
}

function parseChecks(v: unknown): StudyGuideCheck[] {
  return (Array.isArray(v) ? v : []).map(parseCheck).filter((x): x is StudyGuideCheck => x !== null);
}

/** Junta a secção de um tópico (gerada à parte) ao guia, sem duplicar títulos. */
export function parseStudyGuideTopic(raw: string | null | undefined): StudyGuideTopic | null {
  if (!raw || !raw.trim()) return null;
  try {
    const topic = parseTopic(JSON.parse(extractJsonText(raw)));
    return topic ? normalizeTopicMath(topic) : null;
  } catch {
    return null;
  }
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

  return normalizeGuideMath({
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
  });
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
    if (topic.summary) out.push(topic.summary, '');
    if (topic.keyIdeas.length) {
      out.push(`**${labels.keyIdeas}**`, ...topic.keyIdeas.map((i) => `- ${i}`), '');
    }
    if (topic.formulaDetails?.length) {
      out.push(`**${labels.formulas}**`, '');
      for (const f of topic.formulaDetails) {
        out.push(asDisplayMath(f.latex), '');
        if (f.meaning) out.push(f.meaning, '');
        if (f.units) out.push(`- ${labels.units ?? 'Unidades'}: ${f.units}`);
        if (f.validity) out.push(`- ${labels.validity ?? 'Quando se aplica'}: ${f.validity}`);
        if (f.units || f.validity) out.push('');
      }
    } else if (topic.formulas.length) {
      out.push(`**${labels.formulas}**`, '', ...topic.formulas.flatMap((f) => [asDisplayMath(f), '']));
    }
    if (topic.workedExample) {
      const ex = topic.workedExample;
      out.push(`**${labels.workedExample ?? 'Exemplo resolvido'}**`, '', ex.statement, '');
      ex.steps.forEach((step, i) => out.push(`${i + 1}. ${step}`));
      out.push('');
      if (ex.result) out.push(`**${ex.result}**`, '');
      if (ex.source) out.push(`*${formatSourceChip(ex.source, labels.page)}*`, '');
    }
    if (topic.examPattern) {
      out.push(`**${labels.examPattern ?? 'Como costuma sair no teste'}:** ${topic.examPattern}`, '');
    }
    if (topic.pitfalls.length) {
      out.push(`**${labels.pitfalls}**`, ...topic.pitfalls.map((i) => `- ${i}`), '');
    }
    if (topic.practice?.length) {
      out.push(`**${labels.practice ?? 'Treina este tópico'}**`, '');
      topic.practice.forEach((c, i) => out.push(`${i + 1}. ${c.question}`, `   - ${labels.answer}: ${c.answer}`));
      out.push('');
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

const m = normalizePlainMathText;
const mList = (xs: string[]) => xs.map(m);
const mChecks = (xs: StudyGuideCheck[]) => xs.map((c) => ({ question: m(c.question), answer: m(c.answer) }));

/**
 * O modelo às vezes escreve «sigma_y», «sqrt(3)» ou «integral(...)» em texto simples.
 * Converte para LaTeX antes de mostrar, para o KaTeX desenhar as fórmulas.
 */
export function normalizeTopicMath(topic: StudyGuideTopic): StudyGuideTopic {
  return {
    ...topic,
    ...(topic.summary ? { summary: m(topic.summary) } : {}),
    keyIdeas: mList(topic.keyIdeas),
    formulas: topic.formulas.map(normalizeLatexFormula),
    ...(topic.formulaDetails
      ? {
          formulaDetails: topic.formulaDetails.map((f) => ({
            ...f,
            latex: normalizeLatexFormula(f.latex),
            meaning: m(f.meaning),
            ...(f.validity ? { validity: m(f.validity) } : {}),
          })),
        }
      : {}),
    ...(topic.workedExample
      ? {
          workedExample: {
            ...topic.workedExample,
            statement: m(topic.workedExample.statement),
            steps: mList(topic.workedExample.steps),
            result: m(topic.workedExample.result),
          },
        }
      : {}),
    ...(topic.examPattern ? { examPattern: m(topic.examPattern) } : {}),
    pitfalls: mList(topic.pitfalls),
    ...(topic.practice ? { practice: mChecks(topic.practice) } : {}),
  };
}

export function normalizeGuideMath(guide: StudyGuide): StudyGuide {
  return {
    ...guide,
    topics: guide.topics.map(normalizeTopicMath),
    examTraps: mList(guide.examTraps),
    selfCheck: mChecks(guide.selfCheck),
  };
}
