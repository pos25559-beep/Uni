import { format, parseISO, startOfWeek } from 'date-fns';
import type { Course, StudyLogEntry, StudyLogKind, StudyLogMessage } from '../types';
import { extractStudyFocusPhrase, feelingDisplayLabel, type ParsedCheckInUnderstanding } from './uniCheckInNlu';

export const UNI_CHECKIN_DRAFTS_KEY = 'uni-checkin-drafts-v1';
const MAX_DRAFTS = 20;

export interface CheckInDraftRecord {
  updatedAt: string;
  turns: StudyLogMessage[];
  inputText: string;
  understanding: ParsedCheckInUnderstanding | null;
}

type DraftMap = Record<string, CheckInDraftRecord>;

function readDraftMap(): DraftMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(UNI_CHECKIN_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as DraftMap) : {};
  } catch {
    return {};
  }
}

function writeDraftMap(map: DraftMap): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(map)
      .sort((a, b) => (b[1]?.updatedAt ?? '').localeCompare(a[1]?.updatedAt ?? ''))
      .slice(0, MAX_DRAFTS);
    if (entries.length === 0) {
      window.localStorage.removeItem(UNI_CHECKIN_DRAFTS_KEY);
      return;
    }
    window.localStorage.setItem(UNI_CHECKIN_DRAFTS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Quota/storage bloqueado: continua sem crash
  }
}

export function buildCheckInContextKey(args: {
  kind: StudyLogKind;
  today: string;
  weekKey: string;
  courseId?: string;
  classSlotId?: string;
  assessmentId?: string;
}): string {
  const { kind, today, weekKey, courseId, classSlotId, assessmentId } = args;
  if (kind === 'exam_prep') return `exam_prep:${assessmentId || courseId || 'default'}`;
  if (kind === 'class') return `class:${classSlotId || courseId || 'default'}:${today}`;
  if (kind === 'week') return `week:${weekKey}`;
  return `day:${today}`;
}

export function loadCheckInDraft(contextKey: string): CheckInDraftRecord | null {
  const draft = readDraftMap()[contextKey];
  if (!draft || (!Array.isArray(draft.turns) && !draft.inputText?.trim())) return null;
  return draft;
}

export function saveCheckInDraft(contextKey: string, draft: Omit<CheckInDraftRecord, 'updatedAt'>): void {
  const hasContent = draft.turns.some((t) => t.role === 'user') || draft.inputText.trim().length > 0;
  const map = readDraftMap();
  if (!hasContent) {
    if (contextKey in map) {
      delete map[contextKey];
      writeDraftMap(map);
    }
    return;
  }
  map[contextKey] = {
    updatedAt: new Date().toISOString(),
    turns: draft.turns.slice(-30),
    inputText: draft.inputText,
    understanding: draft.understanding,
  };
  writeDraftMap(map);
}

export function clearCheckInDraft(contextKey: string): void {
  const map = readDraftMap();
  if (contextKey in map) {
    delete map[contextKey];
    writeDraftMap(map);
  }
}

export function findSavedCheckInEntry(args: {
  studyLogs: StudyLogEntry[];
  kind: StudyLogKind;
  today: string;
  weekKey: string;
  courseId?: string;
  assessmentId?: string;
}): StudyLogEntry | undefined {
  const { studyLogs, kind, today, weekKey, courseId, assessmentId } = args;
  return studyLogs.find((l) => {
    if (l.kind !== kind) return false;
    if (kind === 'exam_prep') {
      if (assessmentId) return l.assessmentId === assessmentId;
      return courseId ? l.courseId === courseId : true;
    }
    if (kind === 'class') {
      return l.date === today && (!courseId || l.courseId === courseId);
    }
    if (kind === 'week') {
      try {
        const logWeek = format(startOfWeek(parseISO(`${l.date}T12:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return logWeek === weekKey;
      } catch {
        return l.date === today;
      }
    }
    return l.date === today;
  });
}

export function buildTurnsFromSavedEntry(
  entry: StudyLogEntry,
  greeting: string,
  course?: Course,
): StudyLogMessage[] {
  if (Array.isArray(entry.messages) && entry.messages.length > 0) {
    return entry.messages;
  }

  const parts = [
    entry.topicTitle ? `Matéria/tópico: ${entry.topicTitle}` : '',
    entry.studiedSummary ? `Estudei/avancei: ${entry.studiedSummary}` : '',
    entry.difficulties ? `Dúvidas/dificuldades: ${entry.difficulties}` : '',
    !entry.topicTitle && !entry.studiedSummary && !entry.difficulties && entry.notes ? entry.notes : '',
  ].filter(Boolean);

  const userSummary =
    parts.join(' · ') || `${feelingDisplayLabel(entry.feeling)}${entry.rating ? ` (${entry.rating}/5)` : ''}`;
  const cname = course?.shortName || course?.name || 'a cadeira';
  const modelConfirm = `Registo guardado para **${cname}** (${feelingDisplayLabel(entry.feeling)}) e plano alinhado. Se quiseres acrescentar mais algum detalhe ou dúvida, escreve abaixo para atualizar.`;

  return [
    { id: `saved-greet-${entry.id}`, role: 'model', text: greeting },
    { id: `saved-user-${entry.id}`, role: 'user', text: userSummary },
    { id: `saved-model-${entry.id}`, role: 'model', text: modelConfirm },
  ];
}

export function buildUnderstandingFromSavedEntry(entry: StudyLogEntry): ParsedCheckInUnderstanding {
  const inferredFocus =
    entry.studyFocus?.trim() ||
    extractStudyFocusPhrase(
      [
        entry.studiedSummary,
        entry.notes,
        ...(entry.messages?.filter((m) => m.role === 'user').map((m) => m.text) ?? []),
      ]
        .filter(Boolean)
        .join('. '),
    );
  return {
    kind: entry.kind,
    feeling: entry.feeling,
    feelingLabel: feelingDisplayLabel(entry.feeling),
    rating: entry.rating,
    matchedTopicIds: entry.topicIds ?? [],
    newTopicsToAdd: [],
    ...(inferredFocus ? { studyFocus: inferredFocus } : {}),
    topicTitle: entry.topicTitle,
    studiedSummary: entry.studiedSummary,
    difficulties: entry.difficulties,
    notes: entry.notes ?? '',
    understoodTopics: [],
    classDifficulties: entry.difficulties ? [entry.difficulties] : [],
    pendingNextWeek: [],
    hardCourseIds: entry.courseId && (entry.feeling === 'dificil' || entry.feeling === 'ansioso') ? [entry.courseId] : [],
  };
}
