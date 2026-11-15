import type {
  Assessment,
  Course,
  Material,
  StudyLogEntry,
  StudyLogKind,
  Topic,
  WeeklyCheckIn,
} from '../types';

export interface ParsedCheckInUnderstanding {
  kind: StudyLogKind;
  feeling: string;
  feelingLabel: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  matchedTopicIds: string[];
  newTopicsToAdd: string[];
  scopeLabel?: string;
  studyFocus?: string;
  topicTitle?: string;
  studiedSummary?: string;
  difficulties?: string;
  notes: string;
  weekMood?: WeeklyCheckIn['mood'];
  understoodTopics: string[];
  classDifficulties: string[];
  pendingNextWeek: string[];
  hardCourseIds: string[];
  prepProgress?: 'ainda_nao' | 'parcial' | 'revisto';
}

const stripDiacritics = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const cleanSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();

const FEELING_LABELS: Record<string, string> = {
  clara: 'Entendi bem',
  mais_ou_menos: 'Algumas dúvidas',
  dificil: 'Difícil',
  faltei: 'Faltei / rever',
  produtivo: 'Produtivo',
  normal: 'Normal',
  cansado: 'Cansado',
  confiante: 'Confiante',
  estavel: 'Estável',
  pressionado: 'Pressionado',
  atrasado: 'Com atraso',
  ansioso: 'Ansioso',
};

export function feelingDisplayLabel(feeling: string): string {
  return FEELING_LABELS[feeling] ?? feeling;
}

function isAdminCourseFile(title: string): boolean {
  const n = stripDiacritics(title);
  return /\b(funcionamento|programa|ementa|syllabus|apresentacao|calendario)\b/.test(n);
}

/** Extrai o número ordinal de um tópico ou ficheiro ("Aula T08 - ...", "Slide 5", "Cap. 3"). */
export function extractOrdinalNumber(title: string): number | null {
  const clean = stripDiacritics(title);
  const explicitUnit = clean.match(
    /\b(?:slide|aula|cap[ií]?tulo|cap|tema|m[oó]dulo|ficha|parte|lecture|l)\s*0*(\d{1,2})[a-z]?\b/,
  );
  if (explicitUnit?.[1]) return Number(explicitUnit[1]);

  const codePrefix = clean.match(/\b(?:t|tp|p|s)\s*0*(\d{1,2})[a-z]?\b/);
  if (codePrefix?.[1]) return Number(codePrefix[1]);

  const leadingNum = clean.match(/^0*(\d{1,2})\s*[-–.:)\s]/);
  if (leadingNum?.[1]) return Number(leadingNum[1]);

  return null;
}

/** Limpa nome de material ("Aula T05 - Aspetos Fenomenológicos Pt+Ing.pdf" -> "Aula T05 - Aspetos Fenomenológicos"). */
function humanizeMaterialTopicTitle(rawTitle: string): string {
  return cleanSpaces(
    rawTitle
      .replace(/\.(pdf|docx?|pptx?|txt|md|png|jpe?g)$/i, '')
      .replace(/\bPt\s*\+\s*Ing\b/gi, '')
      .replace(/[_]+/g, ' ')
      .replace(/\s*-\s*$/, ''),
  ).slice(0, 72);
}

/** Deteta pedidos de intervalo até slide/aula/capítulo N (ex.: "cai até ao slide 8", "slides 1 a 5", "até T07"). */
export function detectUpToBoundary(text: string): { maxNumber: number; unitLabel: string } | null {
  const norm = stripDiacritics(text);

  // "slides 1 a 8", "aulas 2-6", "de 1 até 8"
  const rangeMatch = norm.match(
    /\b(slides?|aulas?|caps?|capitulos?|temas?|modulos?|fichas?)\s*(?:de\s*)?0*\d{1,2}\s*(?:a|ao|ate|-|–)\s*0*(\d{1,2})\b/,
  );
  if (rangeMatch?.[2]) {
    const n = Number(rangeMatch[2]);
    if (n >= 1 && n <= 40) {
      return { maxNumber: n, unitLabel: rangeMatch[1].replace(/s$/, '') };
    }
  }

  // "cai até ao slide 8", "vai até à T08", "até aula 5", "so ate o slide 6"
  const upToMatch = norm.match(
    /\b(?:ate|sai|cai|vai|dado)\s*(?:ate\s*)?(?:ao|a|o|na|no|em)?\s*(?:(slide|aula|capitulo|cap\.?|tema|modulo|ficha|t|tp|p)\s*0*(\d{1,2})|(?:^|\s)0*(\d{1,2})\s*(?:o|a)?\s*(slide|aula))\b/,
  );
  if (upToMatch) {
    const numStr = upToMatch[2] ?? upToMatch[3];
    const unitRaw = upToMatch[1] ?? upToMatch[4] ?? 'slide';
    const n = Number(numStr);
    if (Number.isFinite(n) && n >= 1 && n <= 40) {
      const unitMap: Record<string, string> = {
        t: 'Aula T',
        tp: 'Aula TP',
        p: 'Aula P',
      };
      return {
        maxNumber: n,
        unitLabel: unitMap[unitRaw] ?? unitRaw.replace('.', ''),
      };
    }
  }

  return null;
}

function detectFeeling(
  kind: StudyLogKind,
  text: string,
  hasDifficultiesHint: boolean,
): { feeling: string; rating?: 1 | 2 | 3 | 4 | 5; weekMood?: WeeklyCheckIn['mood'] } {
  const n = stripDiacritics(text);

  const ratingMatch = n.match(/\b([1-5])\s*(?:\/|de|em)\s*5\b|\bnota\s*([1-5])\b/);
  const explicitRating = ratingMatch
    ? (Number(ratingMatch[1] ?? ratingMatch[2]) as 1 | 2 | 3 | 4 | 5)
    : undefined;

  if (kind === 'class') {
    if (/\b(faltei|nao fui|não fui|perdi a aula|faltar)\b/.test(n)) {
      return { feeling: 'faltei', rating: explicitRating };
    }
    if (/\b(dificil|difícil|pesada|pesado|impossivel|nao percebi nada|não percebi|horrivel|muito complicado)\b/.test(n)) {
      return { feeling: 'dificil', rating: explicitRating };
    }
    if (
      hasDifficultiesHint ||
      /\b(duvida|duvidas|dúvida|dúvidas|mais ou menos|travei|confuso|confusa|meio perdido|complicado|rever)\b/.test(n)
    ) {
      return { feeling: 'mais_ou_menos', rating: explicitRating };
    }
    if (/\b(entendi|clara|claro|tranquilo|tranquila|facil|fácil|corrido|correu bem|otimo|ótimo|bom)\b/.test(n)) {
      return { feeling: 'clara', rating: explicitRating };
    }
    return { feeling: 'clara', rating: explicitRating };
  }

  if (kind === 'day') {
    if (/\b(cansado|cansada|exausto|exausta|sem energia|morto|morta|esgotado|pouco|nao estudei|não estudei|pesado)\b/.test(n)) {
      return { feeling: 'cansado', rating: explicitRating ?? 2 };
    }
    if (/\b(produtivo|produtiva|rendeu|muito bom|otimo|ótimo|consegui|avancei|focado|focada|top|excelente)\b/.test(n)) {
      return { feeling: 'produtivo', rating: explicitRating ?? 4 };
    }
    if (explicitRating && explicitRating <= 2) return { feeling: 'cansado', rating: explicitRating };
    if (explicitRating && explicitRating >= 4) return { feeling: 'produtivo', rating: explicitRating };
    return { feeling: 'normal', rating: explicitRating ?? 3 };
  }

  if (kind === 'week') {
    if (/\b(atrasado|atrasada|acumulou|atrasei|perdido|perdida)\b/.test(n)) {
      return { feeling: 'atrasado', weekMood: 'atrasado', rating: explicitRating };
    }
    if (/\b(pressionado|pressionada|pressao|pressão|ansioso|ansiosa|apertado|apertada|sobrecarregado)\b/.test(n)) {
      return { feeling: 'pressionado', weekMood: 'pressionado', rating: explicitRating };
    }
    if (/\b(confiante|otima|ótima|excelente|produtiva|bem preparada|em dia|dominado)\b/.test(n)) {
      return { feeling: 'confiante', weekMood: 'confiante', rating: explicitRating };
    }
    return { feeling: 'estavel', weekMood: 'estavel', rating: explicitRating };
  }

  // exam_prep
  if (/\b(ansioso|ansiosa|nervoso|nervosa|medo|panico|pânico|apertado|preocupado|inseguro)\b/.test(n)) {
    return { feeling: 'ansioso', rating: explicitRating };
  }
  if (/\b(atrasado|atrasada|nao comecei|não comecei|muito atraso|zero)\b/.test(n)) {
    return { feeling: 'atrasado', rating: explicitRating };
  }
  if (/\b(confiante|tranquilo|tranquila|preparado|preparada|seguro|dominado|pronto|pronta)\b/.test(n)) {
    return { feeling: 'confiante', rating: explicitRating };
  }
  return { feeling: 'estavel', rating: explicitRating };
}

function matchTopicsAndMaterialsByText(args: {
  text: string;
  course?: Course;
  materials: Material[];
  existingSelectedIds?: string[];
}): {
  matchedTopicIds: string[];
  newTopicsToAdd: string[];
  scopeLabel?: string;
} {
  const { text, course, materials, existingSelectedIds = [] } = args;
  const matchedIds = new Set<string>(existingSelectedIds);
  const newTopics: string[] = [];
  const normText = stripDiacritics(text);
  const courseTopics: Topic[] = course?.topics ?? [];
  const courseMaterials = course
    ? materials.filter((m) => m.courseId === course.id)
    : [];

  let scopeLabel: string | undefined;

  // 1) Verifica intervalo numérico explícito ("até ao slide 8", "até T07", "aulas 1 a 5")
  const boundary = detectUpToBoundary(text);
  if (boundary) {
    const { maxNumber, unitLabel } = boundary;
    scopeLabel = `Até ${unitLabel} ${maxNumber}`;

    // Tópicos já existentes com número <= maxNumber
    let matchedAnyNumberedTopic = false;
    for (const t of courseTopics) {
      const ord = extractOrdinalNumber(t.title);
      if (ord !== null && ord >= 0 && ord <= maxNumber) {
        if (!isAdminCourseFile(t.title) || ord > 1) {
          matchedIds.add(t.id);
          matchedAnyNumberedTopic = true;
        }
      }
    }

    // Materiais numerados do curso até maxNumber (ex.: Aula T02..Aula T08)
    const numberedMats = courseMaterials
      .map((m) => ({ mat: m, ord: extractOrdinalNumber(m.title), clean: humanizeMaterialTopicTitle(m.title) }))
      .filter(
        (x): x is { mat: Material; ord: number; clean: string } =>
          x.ord !== null && x.ord >= 1 && x.ord <= maxNumber && !isAdminCourseFile(x.clean),
      )
      .sort((a, b) => a.ord - b.ord);

    for (const item of numberedMats) {
      const normClean = stripDiacritics(item.clean);
      const existingTopic = courseTopics.find((t) => {
        const nt = stripDiacritics(t.title);
        return nt === normClean || nt.includes(normClean) || normClean.includes(nt) || extractOrdinalNumber(t.title) === item.ord;
      });
      if (existingTopic) {
        matchedIds.add(existingTopic.id);
      } else if (newTopics.length < 10 && !newTopics.some((n) => stripDiacritics(n) === normClean)) {
        newTopics.push(item.clean);
      }
    }

    // Se havia tópicos não numerados no plano da cadeira e nenhum material numerado, alinha pelos primeiros N
    if (!matchedAnyNumberedTopic && numberedMats.length === 0 && courseTopics.length > 0) {
      for (const t of courseTopics.slice(0, Math.min(maxNumber, courseTopics.length))) {
        matchedIds.add(t.id);
      }
    }

    // Se mesmo assim não houve correspondência nenhuma (cadeira sem tópicos nem ficheiros numerados)
    if (matchedIds.size === 0 && newTopics.length === 0) {
      newTopics.push(`Matéria até ${unitLabel} ${maxNumber}`);
    }
  }

  // 2) Correspondência nominal direta com tópicos existentes
  for (const t of courseTopics) {
    const nt = stripDiacritics(t.title);
    if (nt.length >= 4 && normText.includes(nt)) {
      matchedIds.add(t.id);
    } else {
      const words = nt.split(/\s+/).filter((w) => w.length >= 5);
      if (words.length >= 2 && words.filter((w) => normText.includes(w)).length >= Math.min(2, words.length)) {
        matchedIds.add(t.id);
      }
    }
  }

  return {
    matchedTopicIds: [...matchedIds],
    newTopicsToAdd: newTopics,
    scopeLabel,
  };
}

export function extractStudyFocusPhrase(text: string): string | undefined {
  const n = stripDiacritics(text);
  if (!n) return undefined;
  if (
    /\b(?:refazer|resolver|fazer|praticar|rever|estudar)\b[^.!?\n]{0,35}\b(?:testes?\s+(?:antigos?|anteriores|passados?)|provas?\s+(?:antigas?|anteriores|passadas?|modelo))\b/.test(n) ||
    /\b(?:testes?|provas?)\s+(?:antigos?|anteriores|passados?|modelo)\b/.test(n)
  ) {
    return 'Refazer testes antigos';
  }
  if (
    /\b(?:exames?\s+(?:antigos?|anteriores|passados?|modelo)|enunciados?\s+(?:antigos?|anteriores)|provas?\s+anteriores)\b/.test(n) ||
    /\b(?:refazer|resolver|fazer)\b[^.!?\n]{0,25}\bexames?\b/.test(n)
  ) {
    return 'Resolver exames antigos';
  }
  if (/\b(?:resolver|fazer|praticar)\b[^.!?\n]{0,25}\b(?:exercicios?(?:\s+de\s+(?:exame|teste))?|fichas?(?:\s+praticas?)?|problemas?)\b/.test(n)) {
    return 'Resolver exercícios práticos';
  }
  if (/\b(?:fazer|rever|preparar)\b[^.!?\n]{0,25}\b(?:resumos?|formulario|apontamentos?|slides?)\b/.test(n)) {
    return 'Rever resumos e slides';
  }
  const custom = text.match(
    /(?:quero\s+focar(?:-me)?\s+(?:em|no|na|nos|nas)|focar(?:-me)?\s+(?:em|no|na|nos|nas)|prefiro\s+focar\s+(?:em|no|na)|foco\s+(?:principal\s+)?(?:em|para|no|na)|vou\s+focar\s+(?:em|no|na))\s+([^.;!?\n]{4,70})/i,
  );
  if (custom?.[1]) {
    const trimmedClause = custom[1].split(/\s*(?:,\s*(?:mas|estou|sinto|e\s+(?:estou|sinto))|\s+(?:mas|e\s+estou|e\s+sinto)\b)/i)[0];
    const cleaned = cleanSpaces(trimmedClause ?? '').replace(/^(?:o|a|os|as)\s+/i, '');
    if (cleaned.length >= 4) {
      return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 80);
    }
  }
  return undefined;
}

function extractDifficultiesPhrase(text: string): string | undefined {
  const m = text.match(
    /(?:d[úu]vidas?\s+(?:em|sobre|no|na|nos|nas)|travei\s+(?:em|no|na)|dificuldade(?:s)?\s+(?:em|com|no|na)|custou(?:-me)?\s+(?:a|o)?|n[ãa]o\s+percebi\s+(?:bem\s+)?)\s*([^.;!?\n]{3,90})/i,
  );
  return m?.[1] ? cleanSpaces(m[1]) : undefined;
}

function extractStudiedPhrase(text: string): { summary?: string; progress?: 'ainda_nao' | 'parcial' | 'revisto' } {
  const n = stripDiacritics(text);
  if (/\b(ainda nao comecei|nao comecei|nada estudado|nao revi nada)\b/.test(n)) {
    return { summary: 'Ainda por começar', progress: 'ainda_nao' };
  }
  const m = text.match(
    /(?:j[áa]\s+(?:estudei|revi|li|fiz|vi)|estudei|revi)\s+([^.;!?\n]{2,90})/i,
  );
  const fullReview = /\b(revi tudo|ja revi bem|estudei tudo|pronto|dominado)\b/.test(n);
  if (m?.[1]) {
    return {
      summary: cleanSpaces(`Já estudei ${m[1]}`),
      progress: fullReview ? 'revisto' : 'parcial',
    };
  }
  if (fullReview) {
    return { summary: 'Matéria já revista', progress: 'revisto' };
  }
  return {};
}

function extractClassTopicPhrase(text: string): string | undefined {
  const m = text.match(
    /(?:demos|deu|foi sobre|mat[ée]ria\s+(?:de|foi)?|falamos\s+de|fal[áa]mos\s+de|hoje\s+(?:vimos|dei))\s*[:-]?\s*([^.;!?\n]{3,80})/i,
  );
  if (m?.[1]) {
    const trimmedClause = m[1].split(
      /\s*(?:,\s*(?:mas|fiquei|tive|travei|custou|achei|sinto|nao|não|e\s+(?:fiquei|tive|achei))|\s+(?:mas|e\s+fiquei|e\s+tive)\b)/i,
    )[0];
    const cleaned = cleanSpaces(trimmedClause ?? '').replace(/^(?:sobre|a|o|os|as)\s+/i, '');
    return cleaned.length >= 2 ? cleaned : undefined;
  }
  return undefined;
}

/** Interpreta uma mensagem natural do aluno (ex.: "a matéria cai até ao slide 8, já estudei os 3 primeiros e sinto-me ansioso") em dados estruturados para o Diário/Plano/Tutor. */
export function parseConversationalCheckIn(args: {
  kind: StudyLogKind;
  userText: string;
  course?: Course;
  courses: Course[];
  materials: Material[];
  assessment?: Assessment;
  previousTopicIds?: string[];
}): ParsedCheckInUnderstanding {
  const { kind, userText, course, courses, materials, assessment, previousTopicIds } = args;
  const trimmed = cleanSpaces(userText);

  const difficulties = extractDifficultiesPhrase(trimmed);
  const studyFocus = extractStudyFocusPhrase(trimmed);
  const feelingRes = detectFeeling(kind, trimmed, Boolean(difficulties));
  const { matchedTopicIds, newTopicsToAdd, scopeLabel } = matchTopicsAndMaterialsByText({
    text: trimmed,
    course: course ?? (assessment ? courses.find((c) => c.id === assessment.courseId) : undefined),
    materials,
    existingSelectedIds:
      previousTopicIds && previousTopicIds.length > 0
        ? previousTopicIds
        : (assessment?.topicIds ?? []),
  });

  const studied = extractStudiedPhrase(trimmed);
  const explicitClassTopic = kind === 'class' ? extractClassTopicPhrase(trimmed) : undefined;
  const resolvedCourse =
    course ?? (assessment ? courses.find((c) => c.id === assessment.courseId) : undefined);

  // Nome principal da matéria dada na aula
  let topicTitle = explicitClassTopic;
  if (!topicTitle && kind === 'class') {
    const firstMatched = resolvedCourse?.topics.find((t) => matchedTopicIds.includes(t.id));
    topicTitle = firstMatched?.title ?? newTopicsToAdd[0];
    if (!topicTitle && difficulties) topicTitle = difficulties;
  }

  // Cadeiras difíceis mencionadas por sigla no balanço semanal
  const norm = stripDiacritics(trimmed);
  const hardCourseIds = courses
    .filter((c) => {
      const code = stripDiacritics(c.shortName || c.code || '');
      return code.length >= 2 && new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(norm);
    })
    .map((c) => c.id);

  const understoodTopics =
    feelingRes.feeling === 'confiante' || feelingRes.feeling === 'clara'
      ? [topicTitle, scopeLabel].filter((x): x is string => Boolean(x))
      : [];
  const classDifficulties = difficulties ? [difficulties] : [];
  const pendingNextWeek =
    studied.progress === 'ainda_nao' && scopeLabel ? [`Rever ${scopeLabel}`] : [];

  return {
    kind,
    feeling: feelingRes.feeling,
    feelingLabel: feelingDisplayLabel(feelingRes.feeling),
    ...(feelingRes.rating ? { rating: feelingRes.rating } : {}),
    matchedTopicIds,
    newTopicsToAdd,
    ...(scopeLabel ? { scopeLabel } : {}),
    ...(studyFocus ? { studyFocus } : {}),
    ...(topicTitle ? { topicTitle } : {}),
    ...(studied.summary ? { studiedSummary: studied.summary } : {}),
    ...(difficulties ? { difficulties } : {}),
    notes: trimmed,
    ...(feelingRes.weekMood ? { weekMood: feelingRes.weekMood } : {}),
    understoodTopics,
    classDifficulties,
    pendingNextWeek,
    hardCourseIds,
    ...(studied.progress ? { prepProgress: studied.progress } : {}),
  };
}

export interface UniCheckInAiSyncPayload {
  feeling?: string;
  scopeLabel?: string;
  studyFocus?: string;
  topicTitle?: string;
  matchedTopicIds?: string[];
  newTopics?: string[];
  studiedSummary?: string;
  difficulties?: string;
  rating?: number;
}

const SYNC_TAG_RE = /<uni-checkin-sync>\s*([\s\S]*?)\s*<\/uni-checkin-sync>/i;

/** Extrai o bloco `<uni-checkin-sync>...</uni-checkin-sync>` da resposta da IA sem o mostrar na bolha do chat. */
export function extractUniCheckInSyncBlock(rawReply: string): {
  visibleReply: string;
  sync: UniCheckInAiSyncPayload | null;
} {
  const match = rawReply.match(SYNC_TAG_RE);
  if (!match) {
    return {
      visibleReply: rawReply.replace(/<uni-checkin-sync>[\s\S]*$/i, '').trim(),
      sync: null,
    };
  }
  let sync: UniCheckInAiSyncPayload | null = null;
  try {
    sync = JSON.parse(match[1]) as UniCheckInAiSyncPayload;
  } catch {
    sync = null;
  }
  const visibleReply = rawReply.replace(SYNC_TAG_RE, '').trim();
  return { visibleReply, sync };
}

/** Mescla saída estruturada opcional do Gemini com o entendimento local sem perder tópicos identificados. */
export function mergeParsedUnderstandingWithAi(
  base: ParsedCheckInUnderstanding,
  sync: UniCheckInAiSyncPayload | null,
  course?: Course,
): ParsedCheckInUnderstanding {
  if (!sync) return base;
  const validTopicIds = new Set((course?.topics ?? []).map((t) => t.id));
  const aiMatched = (sync.matchedTopicIds ?? []).filter((id) => validTopicIds.has(id));
  const mergedTopicIds = [...new Set([...base.matchedTopicIds, ...aiMatched])];
  const mergedNewTopics = [
    ...new Set([
      ...base.newTopicsToAdd,
      ...(sync.newTopics ?? []).map((s) => cleanSpaces(s)).filter((s) => s.length >= 2),
    ]),
  ].slice(0, 12);

  const feeling = sync.feeling && FEELING_LABELS[sync.feeling] ? sync.feeling : base.feeling;
  const rating =
    sync.rating && sync.rating >= 1 && sync.rating <= 5
      ? (Math.round(sync.rating) as 1 | 2 | 3 | 4 | 5)
      : base.rating;

  return {
    ...base,
    feeling,
    feelingLabel: feelingDisplayLabel(feeling),
    ...(rating ? { rating } : {}),
    matchedTopicIds: mergedTopicIds,
    newTopicsToAdd: mergedNewTopics,
    ...(sync.scopeLabel ? { scopeLabel: sync.scopeLabel } : base.scopeLabel ? { scopeLabel: base.scopeLabel } : {}),
    ...(sync.studyFocus?.trim()
      ? { studyFocus: cleanSpaces(sync.studyFocus).slice(0, 80) }
      : base.studyFocus
        ? { studyFocus: base.studyFocus }
        : {}),
    ...(sync.topicTitle ? { topicTitle: sync.topicTitle } : base.topicTitle ? { topicTitle: base.topicTitle } : {}),
    ...(sync.studiedSummary ? { studiedSummary: sync.studiedSummary } : base.studiedSummary ? { studiedSummary: base.studiedSummary } : {}),
    ...(sync.difficulties ? { difficulties: sync.difficulties } : base.difficulties ? { difficulties: base.difficulties } : {}),
  };
}

/** Resposta natural imediata do Uni (usada offline, sem chave ou enquanto reserva rápida) mostrando o que entendeu. */
export function buildLocalUniCheckInReply(args: {
  parsed: ParsedCheckInUnderstanding;
  course?: Course;
  assessment?: Assessment;
}): string {
  const { parsed, course, assessment } = args;
  const courseName = course?.shortName || course?.name || 'a cadeira';
  const totalTopics = parsed.matchedTopicIds.length + parsed.newTopicsToAdd.length;

  if (parsed.kind === 'exam_prep') {
    const scopeNote = parsed.scopeLabel
      ? `alinhei o foco (**${parsed.scopeLabel.toLowerCase()}**)`
      : totalTopics > 0
        ? `marquei **${totalTopics} tópico(s)** para o teste`
        : 'registei as tuas notas sobre o alcance do teste';
    const testName = assessment?.title ? `${assessment.title} de ${courseName}` : courseName;
    const empathy =
      parsed.feeling === 'ansioso' || parsed.feeling === 'atrasado'
        ? 'Vou dar prioridade a blocos mais curtos e guiados para baixar essa pressão.'
        : parsed.feeling === 'confiante'
          ? 'Excelente ritmo — mantenho apenas revisões estratégicas para consolidar.'
          : 'Mantenho um ritmo equilibrado até ao dia da prova.';
    const focusNote = parsed.studyFocus ? ` com foco em **${parsed.studyFocus.toLowerCase()}**` : '';
    return `Percebi! Em **${testName}**, ${scopeNote}${focusNote}${parsed.studiedSummary ? ` (${parsed.studiedSummary.toLowerCase()})` : ''}. ${empathy} Se estiver certo, carrega em **Guardar & alinhar** ou corrige-me aqui!`;
  }

  if (parsed.kind === 'class') {
    const topicBit = parsed.topicTitle
      ? ` o tema **«${parsed.topicTitle}»**`
      : totalTopics > 0
        ? ` **${totalTopics} tópico(s)**`
        : ' a aula de hoje';
    const followUp =
      parsed.feeling === 'dificil' || parsed.feeling === 'mais_ou_menos' || parsed.feeling === 'faltei'
        ? `Já marquei **reforço extra** para ${courseName} nos próximos blocos do plano.`
        : `Guardei em ${courseName} com estado positivo para manter o embalo.`;
    return `Anotado em **${courseName}**! Registei${topicBit} (${parsed.feelingLabel.toLowerCase()}). ${followUp}`;
  }

  if (parsed.kind === 'week') {
    return `Obrigado pelo balanço de domingo! Ficou registado como semana **${parsed.feelingLabel.toLowerCase()}**${parsed.hardCourseIds.length > 0 ? ' com atenção reforçada nas cadeiras mencionadas' : ''}. Pronto para alinhar a próxima semana!`;
  }

  // day
  const tiredNote =
    parsed.feeling === 'cansado'
      ? 'Como declaraste cansaço, amanhã o plano modera a duração dos blocos para não sobrecarregar.'
      : parsed.feeling === 'produtivo'
        ? 'Boa energia hoje! Isso entra já para o teu ritmo e para a sequência do Uni.'
        : 'Tudo apontado para calibrar o ritmo de amanhã.';
  return `Registei o teu dia como **${parsed.feelingLabel.toLowerCase()}**${parsed.rating ? ` (${parsed.rating}/5)` : ''}. ${tiredNote}`;
}

export function buildCheckInPreviewSummaryText(
  parsed: ParsedCheckInUnderstanding,
  history: { role: 'user' | 'model'; text: string }[],
  course?: Course,
): string {
  const parts: string[] = [];
  if (course) parts.push(course.shortName || course.name);
  parts.push(parsed.feelingLabel);
  if (parsed.scopeLabel) parts.push(parsed.scopeLabel);
  if (parsed.topicTitle) parts.push(parsed.topicTitle);
  const count = parsed.matchedTopicIds.length + parsed.newTopicsToAdd.length;
  if (count > 0 && !parsed.topicTitle) parts.push(`${count} tópico(s)`);
  if (history.length > 0) parts.push('+4 ⚡');
  return parts.join(' · ');
}

export function studyLogEntryToHumanPrompt(entry: StudyLogEntry, course?: Course): string {
  const cname = course?.shortName || course?.name;
  if (entry.kind === 'exam_prep') {
    return `Alinhei ${cname ?? 'o teste'}: sinto-me ${feelingDisplayLabel(entry.feeling).toLowerCase()}${entry.studiedSummary ? `, ${entry.studiedSummary}` : ''}. Queres montar uma estratégia de revisão?`;
  }
  if (entry.kind === 'class') {
    return `Tive aula de ${cname ?? 'cadeira'} (${feelingDisplayLabel(entry.feeling).toLowerCase()})${entry.topicTitle ? ` sobre "${entry.topicTitle}"` : ''}. Ajudas-me a rever os pontos principais?`;
  }
  return `Sobre o meu registo de hoje (${feelingDisplayLabel(entry.feeling).toLowerCase()}): ${entry.notes ?? 'como devo ajustar o estudo?'}`;
}
