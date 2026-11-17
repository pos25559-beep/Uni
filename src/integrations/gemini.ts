// Cliente híbrido da API Gemini: usa Firebase AI Logic de forma nativa (sem chave API manual)
// com App Check e quota conservadora, ou chave pessoal opcional em Definições → Avançado.

import { format, parseISO } from 'date-fns';
import type { Content, GenerationConfig, SchemaRequest } from 'firebase/ai';
import { tr } from '../i18n/tr';
import {
  parseStudyGuide,
  parseStudyGuideTopic,
  studyGuideToMarkdown,
  type StudyGuideTopic,
  type StudyGuide,
  type StudyGuideLabels,
} from '../lib/studyGuide';
import { CONTEXT_COPY } from './gemini/contextCopy';
import { normalizeAppLanguage, resolveDateFnsLocale } from '../lib/grading';
import type {
  TopicSheetRecord,
  UniAgentExpedition,
  UniAgentRecord,
  UniExpeditionQuestion,
} from '../lib/localDb';
import type { NotebookDeltaProposal } from '../lib/uniMastery';
import { CustomKeyError, friendlyCustomKeyError } from '../lib/geminiErrors';

export { CustomKeyError, friendlyCustomKeyError };
import { readNormalizedScreenshot } from '../lib/imageUpload';
import {
  daysUntil,
  fmtGrade,
  fmtMinutes,
  gradeSummary,
  minutesThisWeek,
  readiness,
  studyStreak,
  todayStr,
  upcomingAssessments,
} from '../lib/selectors';
import type { UniAccessoryId, UniPersonaMode } from '../lib/uniAccessories';
import {
  extractUniCheckInSyncBlock,
  mergeParsedUnderstandingWithAi,
  type ParsedCheckInUnderstanding,
} from '../lib/uniCheckInNlu';
import {
  parseHistoryJsonText,
  parseScheduleJsonText,
  type ExtractedHistoryItem,
  type ExtractedScheduleAssessment,
  type ExtractedSchedulePayload,
  type ExtractedScheduleSlot,
} from '../lib/visionParsers';
import { useStore } from '../store/useStore';
import type { AppState } from '../store/useStore';
import type { AppLanguage, AppTone, Material } from '../types';
import type { ChatAttachment } from './gemini/core';
import {
  buildContentsWithAttachments,
  callDirectRest,
  callDirectRestStream,
  getCustomGeminiKey,
  resolveGeminiConfig,
  runNativeGenerate,
  runNativeStream,
  withQuotaAndFallback,
} from './gemini/core';
import {
  CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS,
  CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS,
  FALLBACK_TIMEOUT_MS,
  PRIMARY_TIMEOUT_MS,
  THINKING_BALANCED,
  THINKING_DEEP,
  THINKING_FAST,
  resolveChatThinkingConfig,
} from './gemini/models';
import {
  NOTEBOOK_MEMORY_DELTA_SCHEMA,
  PRACTICE_SET_SCHEMA,
  RECALL_CHALLENGE_SCHEMA,
  STUDY_GUIDE_SCHEMA,
  STUDY_GUIDE_TOPIC_SCHEMA,
  TOPIC_SHEET_SCHEMA,
  UNI_EXPEDITION_SCHEMA,
  UNI_RECALL_EVAL_SCHEMA,
  UNI_RECALL_PROMPT_SCHEMA,
} from './gemini/schemas';

export type {
  ExtractedHistoryItem,
  ExtractedScheduleAssessment,
  ExtractedSchedulePayload,
  ExtractedScheduleSlot,
};
export { parseHistoryJsonText, parseScheduleJsonText };
export { AiConsentRequiredError } from './gemini/models';
export { getCustomGeminiKey } from './gemini/core';
export {
  extractScheduleFromText,
  parseAcademicHistoryFromScreenshot,
  parseTimetableFromScreenshot,
} from './gemini/vision';
export type { KnownCourseHint } from './gemini/vision';
export type { ChatAttachment } from './gemini/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** ISO datetime */
  at: string;
  sourceDocTitles?: string[];
  attachmentNames?: string[];
}

const MAX_CONTEXT_CHARS = 4500;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function hasCustomGeminiKey(): boolean {
  return Boolean(getCustomGeminiKey());
}

/** Converte uma imagem ou PDF anexado pelo utilizador em parte multimodal pronta e leve para o Gemini. */
export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) {
    throw new Error(tr('common:errors.attUnsupported', { name: file.name }));
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(tr('common:errors.attTooLarge', { name: file.name }));
  }

  if (isImage) {
    try {
      const normalized = await readNormalizedScreenshot(file);
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: normalized.mimeType,
        dataBase64: normalized.base64,
        sizeBytes: Math.round((normalized.base64.length * 3) / 4),
      };
    } catch {
      // fallback abaixo se descodificação canvas falhar
    }
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(tr('common:errors.attReadFail', { name: file.name })));
    reader.readAsDataURL(file);
  });

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    mimeType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
    dataBase64,
    sizeBytes: file.size,
  };
}

export async function askGemini(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.65,
    thinkingConfig: resolveChatThinkingConfig(model),
  };

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        })
      : runNativeGenerate({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        }),
  );

  if (!text) throw new Error(tr('common:errors.aiEmptyReply'));
  return text;
}

/** Resposta em tempo real (streaming palavra a palavra) para o Tutor com suporte multimodal. */
export async function streamGeminiChat(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.65,
    thinkingConfig: resolveChatThinkingConfig(model),
  };
  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  const primaryTimeoutMs = hasAttachments
    ? CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS
    : PRIMARY_TIMEOUT_MS;
  const fallbackTimeoutMs = hasAttachments
    ? CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS
    : FALLBACK_TIMEOUT_MS;

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRestStream({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          fallbackTimeoutMs,
          overloadRetries: 1,
          onToken: args.onToken,
        })
      : runNativeStream({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          fallbackTimeoutMs,
          overloadRetries: 1,
          onToken: args.onToken,
        }),
  );

  if (!text) throw new Error(tr('common:errors.aiEmptyReply'));
  return text;
}

/** Resumo em texto simples do estado da app, enviado ao modelo. */
export function buildStudyContext(state: AppState): string {
  const { courses, assessments, sessions, tasks, settings, academicProfile, weeklyCheckIns, studyLogs } = state;
  const lang = normalizeAppLanguage(settings.language);
  const copy = CONTEXT_COPY[lang];
  const dateLocale = resolveDateFnsLocale(lang);
  const scale = settings.gradingScale ?? 'pt20';
  const today = todayStr();
  const lines: string[] = [];

  lines.push(`${copy.todayDate}: ${format(new Date(), copy.todayPattern, { locale: dateLocale })}`);
  lines.push(`${copy.semesterLabel}: ${settings.semesterName}`);

  if (academicProfile) {
    lines.push('', copy.profileHeader);
    const schoolLabel = [academicProfile.universityName, academicProfile.degreeName]
      .filter(Boolean)
      .join(' — ');
    if (schoolLabel) {
      lines.push(`- ${copy.schoolLabel}: ${schoolLabel}`);
    }
    const yearDesc =
      academicProfile.activeYears && academicProfile.activeYears.length > 1
        ? `${copy.activeYearsLabel}: ${academicProfile.activeYears.map((y) => (y > 3 ? copy.mastersLabel(y - 3) : copy.yearLabel(y))).join(', ')}`
        : academicProfile.currentAcademicYear > 3
          ? `${copy.currentYearLabel}: ${copy.mastersLabel(academicProfile.currentAcademicYear - 3)}`
          : typeof academicProfile.currentAcademicYear === 'number'
            ? `${copy.currentYearLabel}: ${copy.yearLabel(academicProfile.currentAcademicYear)}`
            : '';
    const entryPart = academicProfile.entryYear ? `${copy.entryLabel}: ${academicProfile.entryYear}` : '';
    const semPart = academicProfile.currentSemester ? copy.semesterOrdinal(academicProfile.currentSemester) : '';
    const termSummary = [entryPart, [yearDesc, semPart].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    if (termSummary) {
      lines.push(`- ${termSummary}`);
    }
    if (typeof academicProfile.targetTotalEcts === 'number' && academicProfile.targetTotalEcts > 0) {
      const doneEcts = academicProfile.completedEcts ?? 0;
      const pct = Math.min(100, Math.round((doneEcts / academicProfile.targetTotalEcts) * 100));
      lines.push(copy.ectsLabel(doneEcts, academicProfile.targetTotalEcts, pct));
    }
    if (academicProfile.learningChallenges && academicProfile.learningChallenges.length > 0) {
      lines.push(`${copy.challengesLabel} ${academicProfile.learningChallenges.join(', ')}`);
    }
    if (academicProfile.extraActivities && academicProfile.extraActivities.length > 0) {
      const extraDesc = academicProfile.extraActivities
        .map((a) => `${a.label} (~${a.hoursPerWeek}${copy.extraPerWeek})`)
        .join(', ');
      lines.push(copy.extraLabel(extraDesc));
    }
    const difficultIds = academicProfile.difficultCourseIds ?? [];
    const completedList = academicProfile.completedCourses ?? [];
    if (difficultIds.length > 0) {
      const hardNames = difficultIds
        .map(
          (id) =>
            courses.find((c) => c.id === id)?.shortName ??
            completedList.find((c) => c.id === id)?.code ??
            completedList.find((c) => c.id === id)?.name,
        )
        .filter((v): v is string => Boolean(v));
      if (hardNames.length > 0) {
        lines.push(`${copy.hardCoursesLabel} ${hardNames.join(', ')}`);
      }
    }
    if (academicProfile.difficultTopicsNotes?.trim()) {
      lines.push(`${copy.studentDifficultiesLabel} ${academicProfile.difficultTopicsNotes.trim()}`);
    }
    const approved = completedList.filter((c) => c.status === 'aprovada');
    if (approved.length > 0) {
      const preview = approved
        .slice(0, 12)
        .map((c) => `${c.code}${typeof c.grade === 'number' ? ` (${fmtGrade(c.grade, scale, lang)})` : ''}`)
        .join(', ');
      lines.push(`${copy.completedHistoryLabel(approved.length)} ${preview}`);
    }
  }

  lines.push('', copy.coursesHeader);
  if (courses.length === 0) lines.push(copy.noCourses);
  for (const c of courses) {
    const g = gradeSummary(c, assessments);
    const needed = g.needed === null
      ? ''
      : g.needed > 20
        ? copy.impossibleGoal
        : copy.neededGoal(fmtGrade(g.needed, scale, lang));
    const current = g.current === null
      ? copy.noGradesYet
      : copy.currentAvg(fmtGrade(g.current, scale, lang), Math.round(g.gradedWeight));
    const hardTag = academicProfile?.difficultCourseIds?.includes(c.id) ? copy.priorityTag : '';
    const goalWord = lang === 'en' ? 'target' : lang === 'pt-BR' ? 'meta' : 'objetivo';
    lines.push(
      `- ${c.name} (${c.ects} ECTS)${hardTag}: ${current}; ${goalWord} ${fmtGrade(c.targetGrade, scale, lang)}${needed}.`,
    );
    if (c.topics.length > 0) {
      const topics = c.topics.map((t) => {
        const st = tr(`common:labels.status.${t.status}`, {}, lang).toLowerCase();
        return `${t.title} [${st}, ${copy.confidenceLabel} ${t.confidence}/5]`;
      });
      lines.push(`  ${copy.topicsLabel}: ${topics.join('; ')}.`);
    }
  }

  lines.push('', copy.upcomingHeader);
  const upcoming = upcomingAssessments(assessments).slice(0, 8);
  const urgentSoon = upcoming.filter((a) => daysUntil(a.date) <= 10);
  if (urgentSoon.length === 1) {
    const c = courses.find((x) => x.id === urgentSoon[0].courseId);
    lines.push(copy.examModeSingle(c?.shortName ?? urgentSoon[0].title, urgentSoon[0].title));
  } else if (urgentSoon.length >= 2) {
    const names = urgentSoon.map((a) => courses.find((c) => c.id === a.courseId)?.shortName ?? a.title);
    lines.push(copy.examModeMulti(urgentSoon.length, names.join(' vs ')));
  }
  if (upcoming.length === 0) lines.push(copy.noUpcoming);
  for (const a of upcoming) {
    const course = courses.find((c) => c.id === a.courseId);
    const days = daysUntil(a.date);
    const parsedDate = parseISO(a.date);
    const hasTime = a.date.includes('T');
    const dateStamp = format(
      parsedDate,
      hasTime ? copy.dateTimePattern : copy.dateOnlyPattern,
      { locale: dateLocale },
    );
    const when =
      days === 0
        ? copy.todayWhen(dateStamp)
        : days === 1
          ? copy.tomorrowWhen(dateStamp)
          : copy.inDaysWhen(days, dateStamp);
    const ready = Math.round(readiness(a, course) * 100);
    const coveredTitles =
      course && a.topicIds.length > 0
        ? course.topics
            .filter((t) => a.topicIds.includes(t.id))
            .map((t) => t.title)
        : [];
    const scopeInfo =
      coveredTitles.length > 0
        ? `; ${copy.topicScopePrefix}: ${coveredTitles.join(', ')}`
        : '';
    const kindName = lang === 'pt-PT' ? a.kind : tr(`common:labels.kind.${a.kind}`, {}, lang).toLowerCase();
    lines.push(
      copy.assessmentLine(
        course?.shortName ?? copy.generalCourse,
        a.title,
        kindName,
        when,
        a.weight,
        ready,
        scopeInfo,
      ),
    );
  }

  if (weeklyCheckIns && weeklyCheckIns.length > 0) {
    const latest = weeklyCheckIns[0];
    lines.push('', copy.checkInHeader(latest.weekOf));
    lines.push(`${copy.moodLabel} ${latest.mood}`);
    if (latest.understoodTopics.length > 0) {
      lines.push(`${copy.consolidatedLabel} ${latest.understoodTopics.join(', ')}`);
    }
    if (latest.classDifficulties.length > 0) {
      lines.push(`${copy.missedInClassLabel} ${latest.classDifficulties.join(', ')}`);
    }
    if (latest.pendingNextWeek.length > 0) {
      lines.push(`${copy.pendingNextWeekLabel} ${latest.pendingNextWeek.join(', ')}`);
    }
    if (latest.notes.trim()) {
      lines.push(`${copy.studentNotesLabel} ${latest.notes.trim()}`);
    }
  }

  if (studyLogs && studyLogs.length > 0) {
    lines.push('', copy.logsHeader);
    for (const log of studyLogs.slice(0, 8)) {
      const course = log.courseId ? courses.find((c) => c.id === log.courseId) : undefined;
      const resolvedTopics =
        course && log.topicIds && log.topicIds.length > 0
          ? course.topics.filter((t) => log.topicIds!.includes(t.id)).map((t) => t.title)
          : [];
      const parts = [
        `[${copy.logKinds[log.kind]} · ${log.date}${course ? ` · ${course.shortName}` : ''}]`,
        `${copy.logState}=${log.feeling}${log.rating ? ` (${log.rating}/5)` : ''}`,
      ];
      if (log.topicTitle) parts.push(`${copy.logTopicGiven}="${log.topicTitle}"`);
      if (resolvedTopics.length > 0) parts.push(`${copy.logMarkedTopics}=[${resolvedTopics.join(', ')}]`);
      if (log.studiedSummary) parts.push(`${copy.logStudied}="${log.studiedSummary}"`);
      if (log.difficulties) parts.push(`${copy.logDifficulties}="${log.difficulties}"`);
      if (log.notes) parts.push(`${copy.logNote}="${log.notes}"`);
      lines.push(`- ${parts.join(' · ')}`);
    }
  }

  lines.push('', copy.todayPlanHeader);
  const todays = sessions.filter((s) => s.date === today);
  if (todays.length === 0) lines.push(copy.noTodaySessions);
  for (const s of todays) {
    const course = courses.find((c) => c.id === s.courseId);
    const topic = course?.topics.find((t) => t.id === s.topicId)?.title;
    const label = `${course?.shortName ?? copy.generalCourse}${topic ? ` – ${topic}` : ''}`;
    const status = s.done
      ? copy.sessionDone(fmtMinutes(s.actualMinutes ?? s.minutes))
      : copy.sessionTodo(fmtMinutes(s.minutes));
    lines.push(`- ${label}: ${status}.`);
  }

  const weeklyGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  lines.push('', copy.studyHeader);
  lines.push(copy.weeklySummary(fmtMinutes(minutesThisWeek(sessions)), fmtMinutes(weeklyGoal)));
  lines.push(copy.streakLine(studyStreak(sessions)));

  lines.push('', copy.tasksHeader);
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, 8);
  if (pending.length === 0) lines.push(copy.noTasks);
  for (const t of pending) {
    const course = courses.find((c) => c.id === t.courseId);
    const due = t.due
      ? `, ${copy.duePrefix} ${format(parseISO(t.due), copy.shortDatePattern, { locale: dateLocale })}${t.due < today ? copy.overdueSuffix : ''}`
      : '';
    lines.push(`- ${t.title}${course ? ` (${course.shortName})` : ''}${due}.`);
  }

  const text = lines.join('\n');
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS - 20)}\n${copy.truncatedTag}` : text;
}

export interface DocumentContextOptions {
  activeCourseName?: string;
  courseMaterials?: Material[];
  resolvedExcerpts?: Array<{ title: string; provider: string; content: string }>;
  notebookNotes?: string;
  maxFiles?: number;
}

const CATEGORY_LABELS_BY_LANG: Record<AppLanguage, Record<string, string>> = {
  'pt-PT': {
    teste_antigo: 'Teste antigo',
    exame_antigo: 'Exame antigo',
    ficha: 'Ficha de exercícios',
    slide_oficial: 'Slides',
    sebenta: 'Sebenta',
    relatorio: 'Relatório',
    outro: 'Material',
  },
  'pt-BR': {
    teste_antigo: 'Prova antiga',
    exame_antigo: 'Exame antigo',
    ficha: 'Lista de exercícios',
    slide_oficial: 'Slides',
    sebenta: 'Apostila',
    relatorio: 'Relatório',
    outro: 'Material',
  },
  es: {
    teste_antigo: 'Parcial anterior',
    exame_antigo: 'Examen anterior',
    ficha: 'Hoja de ejercicios',
    slide_oficial: 'Diapositivas',
    sebenta: 'Apuntes',
    relatorio: 'Informe',
    outro: 'Material',
  },
  en: {
    teste_antigo: 'Past test',
    exame_antigo: 'Past exam',
    ficha: 'Problem set',
    slide_oficial: 'Slides',
    sebenta: 'Course notes',
    relatorio: 'Lab report',
    outro: 'Material',
  },
};

function cleanMaterialTitleForPrompt(title: string): string {
  return title
    .replace(/\s*\[(slide_oficial|teste_antigo|exame_antigo|ficha|sebenta|relatorio|outro)\]/gi, '')
    .trim();
}

/** Resumo dos documentos/materiais associados e excertos extraídos para personalizar o ensino do Uni. */
export function buildDocumentContext(
  materials: Material[],
  options?: DocumentContextOptions,
): string {
  const lang = getActiveAppLanguage();
  const catLabels = CATEGORY_LABELS_BY_LANG[lang];
  const withSolLabel =
    lang === 'en' ? 'with solutions' : lang === 'es' ? 'con solución' : 'com resolução';
  const withSolShort =
    lang === 'en' ? 'w/ solutions' : lang === 'es' ? 'c/ solución' : 'c/ resolução';
  const pinnedLabel = lang === 'en' ? 'pinned' : lang === 'es' ? 'fijado' : 'fixado';
  const sections: string[] = [];

  if (options?.resolvedExcerpts && options.resolvedExcerpts.length > 0) {
    sections.push('CONTEÚDO REAL EXTRAÍDO DOS DOCUMENTOS E APONTAMENTOS:');
    for (const ex of options.resolvedExcerpts) {
      sections.push(
        `### [Fonte: ${cleanMaterialTitleForPrompt(ex.title)}] (${ex.provider.toUpperCase()})\n${ex.content.slice(0, 8000)}`,
      );
    }
  }

  if (options?.notebookNotes?.trim()) {
    sections.push(
      'NOTAS / RESUMO DO CADERNO DO UNI FORNECIDO PELO ESTUDANTE:',
      options.notebookNotes.trim().slice(0, 8000),
    );
  }

  if (materials && materials.length > 0) {
    sections.push('DOCUMENTOS E REFERÊNCIAS SELECIONADOS NESTA CONVERSA:');
    for (const m of materials) {
      const catLabel = m.category ? (catLabels[m.category] ?? m.category) : '';
      const flags = [
        m.provider.toUpperCase(),
        catLabel,
        m.hasSolution ? withSolLabel : '',
        m.pinned ? pinnedLabel : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const cleanTitle = cleanMaterialTitleForPrompt(m.title);
      sections.push(`- [${flags}] ${cleanTitle}${m.url ? ` (${m.url})` : ''}`);
    }
  }

  if (options?.courseMaterials && options.courseMaterials.length > 0) {
    const selectedIds = new Set(materials.map((m) => m.id));
    const libraryPreview = [...options.courseMaterials]
      .filter((m) => !selectedIds.has(m.id))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
      .slice(0, 15);
    if (libraryPreview.length > 0) {
      const limitLabel = hasCustomGeminiKey()
        ? 'todos os PDFs que couberem no orçamento de contexto da chave pessoal'
        : `até ${options?.maxFiles ?? 3} PDFs`;
      sections.push(
        `BIBLIOTECA DISPONÍVEL EM ${options.activeCourseName?.toUpperCase() ?? 'CADEIRA'} (${options.courseMaterials.length} itens no total — podes sugerir ao estudante selecionar ${limitLabel} em «Apontamentos» caso queira que os analises em detalhe):`,
      );
      for (const m of libraryPreview) {
        const catLabel = m.category ? (catLabels[m.category] ?? m.category) : '';
        const meta = [catLabel, m.year, m.hasSolution ? withSolShort : '', m.pinned ? pinnedLabel : '']
          .filter(Boolean)
          .join(', ');
        sections.push(`- ${cleanMaterialTitleForPrompt(m.title)}${meta ? ` (${meta})` : ''}`);
      }
    }
  }

  return sections.join('\n\n');
}

/** Língua ativa da app (Definições), usada nas gerações que não recebem `language`. */
export function getActiveAppLanguage(): AppLanguage {
  return normalizeAppLanguage(useStore.getState().settings.language);
}

/** Instrução curta e inequívoca de língua de saída para prompts de geração. */
export function outputLanguageInstruction(lang: AppLanguage = getActiveAppLanguage()): string {
  switch (lang) {
    case 'en':
      return 'Write ALL user-facing text in clear English (en). Keep JSON keys exactly as specified.';
    case 'es':
      return 'Escribe TODO el texto para el estudiante en español (es), con términos como «asignatura» y «examen». Mantén las claves JSON tal como se indican.';
    case 'pt-BR':
      return 'Escreva TODO o texto para o estudante em português do Brasil (pt-BR), com termos como «disciplina» e «prova». Mantenha as chaves JSON como indicado.';
    default:
      return 'Escreve TODO o texto para o estudante em português europeu (pt-PT), com termos como «cadeira» e «teste/exame». Mantém as chaves JSON como indicado.';
  }
}

const PERSONA_INSTRUCTIONS_BY_LANG: Record<AppLanguage, Record<UniPersonaMode, string>> = {
  'pt-PT': {
    amigo:
      'Estilo Amigo: caloroso, frases curtas e diretas, explica conceitos difíceis primeiro com analogias e exemplos do dia a dia.',
    exigente:
      'Estilo Exigente (Modo Exame): direto e sem rodeios, rigoroso nas definições e provas da questão em curso, sem nunca contrariar quando o estudante pedir para mudar de grupo ou exercício.',
    calmo:
      'Estilo Anti-Stress: voz tranquila e paciente, valida o esforço do aluno e parte tarefas grandes em micro-passos muito simples (uma ideia de cada vez).',
    curioso:
      'Estilo Curioso (Socrático): entusiasta pela matéria, faz perguntas orientadoras («E se x fosse negativo? O que muda?») para puxar a descoberta pelo estudante.',
    treinador:
      'Estilo Treinador: enérgico e orientado por metas curtas por sessão («Meta de hoje: 5 exercícios seguidos sem erro»), mantendo foco e ritmo claro.',
  },
  'pt-BR': {
    amigo:
      'Estilo Parceiro: leve, próximo e com frases curtas; explica conceitos difíceis começando por analogias e exemplos do dia a dia.',
    exigente:
      'Estilo Direto (Modo Prova): objetivo e rigoroso nas definições e provas da questão atual, sem resistir se o estudante pedir para avançar para outro grupo ou exercício.',
    calmo:
      'Estilo Calmo (Sem estresse): paciente e acolhedor; divide assuntos grandes em passos bem pequenos, uma ideia de cada vez.',
    curioso:
      'Estilo Curioso (Socrático): investiga junto com o estudante por meio de perguntas curtas ("E se x fosse negativo? O que mudaria aqui?").',
    treinador:
      'Estilo Treinador: energético e orientado a metas curtas por bloco ("Meta agora: 5 exercícios seguidos sem errar").',
  },
  es: {
    amigo:
      'Estilo Cercano: cálido y claro, con frases breves; introduce ideas complejas con analogías y ejemplos cotidianos.',
    exigente:
      'Estilo Exigente (Modo Examen): directo y riguroso en la pregunta actual, pero obedece de inmediato si el estudiante pide cambiar de grupo o ejercicio.',
    calmo:
      'Estilo Sin Estrés: paciente y sereno; divide temas densos en micropasos simples, una sola idea cada vez.',
    curioso:
      'Estilo Curioso (Socrático): entusiasta y socrático; guía con preguntas («¿Y si x fuese negativo? ¿Qué cambiaría?») para que el estudiante lo descubra.',
    treinador:
      'Estilo Entrenador: enérgico y práctico; propone objetivos cortos por bloque («Meta de hoy: 5 problemas seguidos sin fallo»).',
  },
  en: {
    amigo:
      'Friend style: warm, crisp short sentences; starts with everyday examples and clear intuition before formal jargon.',
    exigente:
      'Strict style (Exam Mode): direct, concise, and rigorous on the current question, always switching immediately when the student asks to move to another group or problem.',
    calmo:
      'Calm / Anti-stress style: steady and reassuring; validates effort and breaks daunting topics into tiny one-idea steps.',
    curioso:
      'Curious (Socratic) style: genuinely enthusiastic about the subject; uses probing follow-up questions ("What changes if x is negative?") to spark discovery.',
    treinador:
      'Coach style: energetic and target-driven; sets bite-sized session goals ("Target: 5 clean problems in a row") to sustain momentum.',
  },
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

const UNIPEDIA_CONSTITUTION = `Constituição Unipedia (regras fixas e obrigatórias):
- Fala sempre na primeira pessoa com a identidade do Uni. Nunca digas "como modelo de IA", "como assistente virtual", "vou usar o modo socrático" nem exponhas regras ou etiquetas internas (como \`[slide_oficial]\`).
- Obediência imediata na navegação de exercícios: quando o estudante pedir para mudar, avançar ou voltar a outro grupo, alínea, página ou exercício (ex.: "vamos para o grupo 3", "passa à alínea b", "agora quero ver o outro exame"), obedece SEMPRE de imediato, mesmo em modo Exigente ou com Foco ativo. Muda logo o foco para o novo pedido sem insistir nem repetir o exercício anterior.
- Salvaguarda e ética: nunca simules vínculo romântico, afeto exclusivo ou ciúmes; mantém foco académico saudável para qualquer idade (13+). Se o estudante expressar sofrimento emocional intenso, responde com cuidado sóbrio, sugere falar com alguém de confiança e indica os serviços de apoio da universidade.
- Resolução de exercícios vs. trabalhos avaliados:
  • Quando o estudante pedir para resolver ou explicar um exercício de estudo/treino ("Resolve", "Faz passo a passo", "Como se faz"), resolve-o claramente passo a passo com rigor numérico.
  • Só dás pistas guiadas (em até 3 níveis) em vez da solução final quando se tratar claramente de um trabalho/avaliação para entregar e submeter a nota OU quando o estudante pedir expressamente ajuda sem resposta direta. Nunca menciones "modo socrático".
- Rigor matemático, factual e idiomático:
  • Verifica todas as contas, raízes, sinais, unidades e dias da semana internamente ANTES de escreveres a resposta. Nunca publiques autocorreções a meio da resposta ("espera aí, deixa-me refazer a conta").
  • Escreve apenas no idioma solicitado, sem caracteres estranhos ou fragmentos de outros alfabetos.
  • Nunca inventes datas, notas ou pontuações: usa exatamente os dias da semana e datas indicados no contexto.
- Rigor e citação: baseia o ensino nas fichas e nos materiais/anexos fornecidos. Cita com página/slide quando visível no material (\`[Fonte: nome do ficheiro, p. X]\` ou \`Slide Y\`), mantendo o nome limpo sem etiquetas internas. Se algo não estiver nos anexos, diz com transparência "Isto não está nos teus materiais".
- Usa Markdown limpo e LaTeX padrão (\`$...$\` ou \`$$...$$\` numa linha própria) quando houver matemática/fórmulas.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta antes de corrigir.
- Se a conversa sair do estudo, brinca brevemente e redireciona para a cadeira ou plano.`;

export const SYSTEM_PROMPT = (
  context: string,
  docContext?: string,
  opts?: {
    persona?: UniPersonaMode;
    accessory?: UniAccessoryId;
    studentName?: string;
    appTone?: AppTone;
    language?: AppLanguage | string;
    uniAgent?: UniAgentRecord | null;
    retrievedSheets?: TopicSheetRecord[];
    courseName?: string;
  },
): string => {
  const persona = opts?.uniAgent?.personaId ?? opts?.persona ?? 'amigo';
  const accessory = opts?.accessory ?? 'default';
  const appTone = opts?.appTone ?? 'vibrante';
  const firstName = opts?.studentName?.trim().split(/\s+/)[0] || '';
  const agent = opts?.uniAgent ?? null;
  const rawLang = opts?.uniAgent?.language ?? opts?.language ?? 'pt-PT';
  const targetLang: AppLanguage = normalizeAppLanguage(rawLang);
  const personaText = PERSONA_INSTRUCTIONS_BY_LANG[targetLang][persona];

  const toneDirective =
    appTone === 'serio'
      ? targetLang === 'en'
        ? '- App tone (Minimal & Focused): structured, sober, concise, zero hype.'
        : targetLang === 'es'
          ? '- Tono de la app (Minimalista): directo, estructurado y sobrio, sin exclamaciones innecesarias.'
          : targetLang === 'pt-BR'
            ? '- Tom do app (Sério & Minimalista): direto, estruturado, sóbrio e objetivo, sem exclamações em excesso.'
            : '- Tom da app (Sério & Minimalista): direto, estruturado, sóbrio e profissional, sem exclamações excessivas.'
      : targetLang === 'en'
        ? '- Concise, grounded, encouraging tone without filler.'
        : targetLang === 'es'
          ? '- Tono natural y breve, concreto y alentador sin exageraciones.'
          : targetLang === 'pt-BR'
            ? '- Tom natural e direto, concreto e encorajador sem exageros.'
            : '- Tom natural e conciso, concreto e encorajador sem exageros.';

  const languageDirective =
    targetLang === 'en'
      ? '- Mandatory output language: write the ENTIRE reply in clear English (en), keeping technical terms from local notes in parentheses if helpful.'
      : targetLang === 'es'
        ? '- Idioma de respuesta obligatorio: escribe TODA la respuesta en español académico natural (es), usando términos como «asignatura» y «examen».'
        : targetLang === 'pt-BR'
          ? '- Idioma de resposta obrigatório: escreve TODA a resposta em português do Brasil natural (pt-BR), usando termos como «disciplina» e «prova».'
          : '- Idioma de resposta obrigatório: português europeu (pt-PT), usando termos como «cadeira» e «teste/exame».';

  const expertDirective =
    agent && agent.stage >= 3
      ? targetLang === 'en'
        ? '- Specialist/Master stage unlocked: include exam-grade edge cases, past-test rigor, and cross-topic links while keeping your archetype tone.'
        : targetLang === 'es'
          ? '- Nivel Especialista/Maestro desbloqueado: incluye rigor de examen, casos límite y conexiones entre temas manteniendo tu tono.'
          : targetLang === 'pt-BR'
            ? '- Estágio Especialista/Mestre desbloqueado: traga rigor de prova, casos-limite e conexões entre tópicos mantendo o seu tom.'
            : '- Estágio Especialista/Mestre desbloqueado: inclui rigor de nível exame/teste, casos-limite e ligações entre tópicos sem perder o teu tom.'
      : '';

  const layer2Personality = agent
    ? `CAMADA 2 — PERSONALIDADE DO UNI ESPECIALISTA:
- Nome: «${agent.name}»${opts?.courseName ? ` (especialista em ${opts.courseName})` : ''} · Forma: ${agent.formId} · Estágio atual: ${agent.stage} (mestria ${agent.mastery}/100 calculada pela app) · Idioma: ${targetLang}.
- ${personaText}
- Área e estilo: ${AREA_VOICE_HINTS[accessory]}
${languageDirective}
${expertDirective ? `${expertDirective}\n` : ''}${toneDirective}`
    : `CAMADA 2 — PERSONALIDADE DO UNI:
- Tu és o Uni da Unipedia${firstName ? ` a ajudar ${firstName}` : ''}.
- ${personaText}
- Visual e área ativa: ${AREA_VOICE_HINTS[accessory]}
${languageDirective}
${toneDirective}`;

  const layer3Notebook = agent
    ? `\nCAMADA 3 — CADERNO DO UNI (JSON compacto do que o Uni sabe sobre o estudante nesta cadeira):\n${JSON.stringify({
        goals: agent.notebook.goals.slice(0, 8),
        learningStyle: agent.notebook.learningStyle ?? null,
        weakSpots: agent.notebook.weakSpots.slice(0, 6),
        strengths: agent.notebook.strengths.slice(0, 6),
        customNotes: (agent.notebook.customNotes ?? []).slice(0, 6),
        nextAssessment: agent.notebook.nextAssessment ?? null,
      })}`
    : '';

  const sheetsBlock =
    opts?.retrievedSheets && opts.retrievedSheets.length > 0
      ? `\nFICHAS DE TÓPICO GUARDADAS NO CADERNO (${opts.retrievedSheets.length}):\n` +
        opts.retrievedSheets
          .map(
            (sheet, idx) =>
              `### [Ficha ${idx + 1}: ${sheet.title}]\n${sheet.summary.trim().slice(0, 2200)}`,
          )
          .join('\n\n')
      : '';

  return `${UNIPEDIA_CONSTITUTION}

${layer2Personality}${layer3Notebook}

CAMADA 4 — CONTEXTO DO MOMENTO:
- SINCRONIZAÇÃO COM O CADERNO (Calendário, Cadeiras e Plano): sempre que o estudante enviar uma imagem/print ou texto com datas de testes, exames, entregas de projetos ou aulas semanais do horário (ou pedir para guardar/atualizar no resto da app), explica claramente o que encontraste e no FINAL da tua resposta inclui exatamente um bloco técnico (que a interface transforma num cartão de 1 toque):
<uni-sync>{"hasSaturdayColumn":false,"slots":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA","dayHeader":"2ª|3ª|4ª|5ª|6ª|Sáb","type":"T|TP|P|OT","weekday":1,"start":"09:00","end":"11:00","room":"Sala opcional"}],"assessments":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA opcional","title":"1.º Teste","date":"2026-11-25T14:00:00","kind":"teste|exame|trabalho|projeto|quiz","location":"Sala opcional"}]}</uni-sync>
(Regra Portugal + colunas sobrepostas: "2ª"=1, "3ª"=2, "4ª"=3, "5ª"=4, "6ª"=5 — "6ª" é Sexta-feira, NUNCA 6! Se não houver aulas nem avaliações para guardar na app, NÃO incluas <uni-sync>.)
- FERRAMENTAS DO UNI (lista fechada — só emites quando fizer sentido claro no pedido; NUNCA prometas alterar o plano ou calendário em texto sem emitir a ferramenta respetiva):
  • Se o estudante acabou de responder corretamente ou com esforço a um quiz/recall de um tópico, podes registar em silêncio: \`<uni-tool>{"name":"registar_recall","args":{"topicTitle":"Tópico","score":3}}</uni-tool>\` (score: 1=rever já, 2=com esforço, 3=dominei).
  • Para propor ações que escrevem na app (pedem sempre confirmação visual ao estudante antes de guardar), usa:
    - \`<uni-tool>{"name":"focar_plano","args":{"courseId":"SIGLA","exclusive":true,"reason":"Foco total até ao teste"}}</uni-tool>\` (quando o estudante pedir para concentrar/priorizar/mudar o plano de estudo numa cadeira, ex. "quero focar 100% em TEP até sexta")
    - \`<uni-tool>{"name":"criar_sessao","args":{"topicTitle":"Tópico","minutes":35,"date":"yyyy-MM-dd","notes":"Foco sugerido"}}</uni-tool>\`
    - \`<uni-tool>{"name":"criar_flashcards","args":{"topicTitle":"Tópico","cards":[{"front":"Pergunta","back":"Resposta curta"}]}}</uni-tool>\`
    - \`<uni-tool>{"name":"marcar_duvida","args":{"topicTitle":"Tópico","note":"Dúvida objetiva para levar ao professor"}}</uni-tool>\`
  • Estas ações só acontecem quando o estudante confirma o cartão. No texto descreve-as como proposta («Preparei a mudança do plano, confirma abaixo»), nunca como feitas («já registei», «vou deixar em pausa»). Se não emitires a ferramenta, não fales da ação.
${sheetsBlock}${docContext ? `\n${docContext}\n` : ''}
Resumo atual do caderno do estudante${firstName ? ` (${firstName})` : ''}:
"""
${context}
"""`;
};

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
}

export interface StudyGuideResult {
  /** Guia estruturado; null quando o modelo não devolveu JSON válido (então `markdown` é o texto livre). */
  guide: StudyGuide | null;
  markdown: string;
}

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

  // Pedidos grandes (muitos PDFs, raciocínio profundo): tempo próprio e novas tentativas
  // quando a Google responde «high demand», em vez dos 10 s pensados para o chat.
  const longCall = {
    primaryTimeoutMs: NOTEBOOK_TIMEOUT_MS,
    fallbackTimeoutMs: NOTEBOOK_TIMEOUT_MS,
    overloadRetries: 2,
  };
  return customKey
    ? callDirectRest({ key: customKey, model, contents, system, generationConfig, ...longCall })
    : runNativeGenerate({ model, contents, system, generationConfig, ...longCall });
}

/** Tempo máximo por pedido do caderno/guia (cada modelo da cadeia). */
const NOTEBOOK_TIMEOUT_MS = 150_000;

export function assertNotebookInputs(args: NotebookBriefArgs): void {
  const hasText = args.sources.some((s) => s.content.trim());
  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  if (!hasText && !hasAttachments) {
    throw new Error(tr('common:errors.notebookEmptySources'));
  }
}

const GUIDE_MARKDOWN_PROMPT =
  'Cria um **Guia de Estudo Estruturado** claro com conceitos-chave, armadilhas comuns de teste e plano rápido de revisão, citando sempre as fontes como [Fonte N] ou o nome do ficheiro.';

/**
 * Guia de Estudo estruturado (JSON estrito). Se o modelo devolver JSON inválido, recorre ao
 * caminho antigo em Markdown dentro da mesma quota (só se cobra uma geração).
 */
/** Máximo de tópicos aprofundados num guia (um pedido ao modelo por tópico). */
const STUDY_GUIDE_MAX_DEEP_TOPICS = 6;
/** Pedidos de secção em paralelo (equilíbrio entre rapidez e limites de pedidos por minuto). */
const STUDY_GUIDE_CONCURRENCY = 3;

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

/** Junta a secção aprofundada ao tópico do mapa, mantendo as fontes de ambos. */
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

export interface StudyGuideProgress {
  phase: 'mapping' | 'topics';
  done: number;
  total: number;
}

/**
 * Guia de Estudo em duas fases: primeiro um mapa do teste (tópicos, fontes, plano, perguntas
 * gerais) e depois uma secção completa por tópico, com fórmulas explicadas, exemplo resolvido
 * e como sai no teste. Conta como uma única geração do caderno. Se o JSON do mapa falhar,
 * recorre ao Markdown; se uma secção falhar, esse tópico fica com a versão do mapa.
 */
export async function generateStudyGuide(
  args: Omit<NotebookBriefArgs, 'mode'> & { onProgress?: (p: StudyGuideProgress) => void },
): Promise<StudyGuideResult & { failedTopics: number }> {
  const { customKey, model } = resolveGeminiConfig();
  const { onProgress, ...rest } = args;
  const full: NotebookBriefArgs = { ...rest, mode: 'guide' };
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
      } catch {
        section = null;
      }
      if (!section) failed += 1;
      done += 1;
      onProgress?.({ phase: 'topics', done, total: deepTopics.length });
      return section;
    });

    const guide: StudyGuide = {
      ...outline,
      topics: outline.topics.map((tp, i) => (i < sections.length ? mergeGuideTopic(tp, sections[i]) : tp)),
    };
    return { guide, markdown: studyGuideToMarkdown(guide, getStudyGuideLabels()), failedTopics: failed };
  });

  if (!result.markdown) throw new Error(tr('common:errors.notebookGenFail'));
  return result;
}

/**
 * Refaz um tópico do guia com um pedido do estudante («mais exemplos de Tresca»).
 * Conta como uma geração do caderno. Devolve null se o modelo não devolver uma secção válida.
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

export interface RecallChallenge {
  question: string;
  hint: string;
}

export interface GeneratedPracticeCardDraft {
  prompt: string;
  answer: string;
  sourceTitle?: string;
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

/** Gera 1 pergunta curta de recall ativo pós-sessão sobre o tópico estudado. */
export async function generateRecallChallenge(
  topicTitle: string,
  courseName?: string,
): Promise<RecallChallenge> {
  const { customKey, model } = resolveGeminiConfig();
  const lang = getActiveAppLanguage();
  const prompt = `Cria 1 pergunta curta de recordação ativa (active recall) sobre "${topicTitle}"${courseName ? ` (${courseName})` : ''}.
${outputLanguageInstruction(lang)}
Devolve APENAS JSON válido no formato: {"question": "pergunta objetiva em 1-2 frases para testar compreensão sem consultar apontamentos", "hint": "pista curta ou critério de resposta correta em 1 frase"}`;
  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    maxOutputTokens: 320,
    responseMimeType: 'application/json',
    responseSchema: RECALL_CHALLENGE_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<RecallChallenge>;
  const fallbackQ =
    lang === 'en'
      ? `In your own words, explain the core idea or mechanism behind “${topicTitle}”.`
      : lang === 'es'
        ? `Explica con tus palabras la idea o el mecanismo central de «${topicTitle}».`
        : lang === 'pt-BR'
          ? `Explique com suas palavras o mecanismo ou ideia central de «${topicTitle}».`
          : `Explica por palavras tuas o mecanismo ou ideia central de «${topicTitle}».`;
  const fallbackHint =
    lang === 'en'
      ? 'Check whether you can give one concrete example or explain why it works.'
      : lang === 'es'
        ? 'Comprueba si puedes dar un ejemplo concreto o justificar por qué ocurre.'
        : lang === 'pt-BR'
          ? 'Veja se consegue dar 1 exemplo concreto ou justificar por que acontece.'
          : 'Verifica se consegues dar 1 exemplo concreto ou justificar porquê acontece.';
  return {
    question: parsed.question?.trim() || fallbackQ,
    hint: parsed.hint?.trim() || fallbackHint,
  };
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

export interface ExtractedTopicSheetResult {
  title: string;
  summary: string;
  keyConcepts: string[];
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

export interface UniRecallPromptResult {
  question: string;
  hint: string;
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

export interface UniRecallEvaluationResult {
  score: 1 | 2 | 3;
  feedback: string;
  detectedWeakSpot?: { topic: string; note: string };
  matchedStrength?: string;
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