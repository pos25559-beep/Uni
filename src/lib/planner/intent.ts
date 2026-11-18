// «Como está a tua semana?»: o pedido do estudante vira INTENÇÃO (regras com validade),
// não blocos. As regras ficam guardadas nas preferências e o motor gera os blocos — por isso
// nada se perde quando o plano recalcula. Puro e testável; a IA só acrescenta itens.
import { addDays, format } from 'date-fns';
import type {
  Course,
  ID,
  PlannerContentMix,
  PlannerPreferences,
  PlannerStrategy,
  PlannerWindowMode,
  PreExamMarathonConfig,
  Topic,
} from '../../types';
import { parseFocusWindow } from './focusWindow';
import { parseDay } from './slots';
import { DEFAULT_PLANNER_PREFS } from './availability';
import type { ParsedPlannerBriefing } from '../plannerBriefing';

type Period = 'morning' | 'afternoon' | 'evening';

export type IntentItem =
  | { id: string; kind: 'course_mode'; courseId: ID; mode: 'boost' | 'pause'; until?: string }
  | { id: string; kind: 'course_note'; courseId: ID; text: string; from?: string; until: string }
  | {
      id: string;
      kind: 'weekday_rule';
      weekday: number;
      enabled?: boolean;
      minutes?: number;
      window?: PlannerWindowMode;
      blockedPeriod?: Period;
    }
  | { id: string; kind: 'date_override'; date: string; enabled?: boolean; minutes?: number; window?: PlannerWindowMode }
  | { id: string; kind: 'marathon'; marathon: PreExamMarathonConfig }
  | { id: string; kind: 'strategy'; strategy: PlannerStrategy }
  | { id: string; kind: 'content_mix'; mix: PlannerContentMix }
  | {
      id: string;
      kind: 'topic_hint';
      courseId: ID;
      topicId: ID;
      status: Topic['status'];
      confidence: Topic['confidence'];
    };

export interface PlanIntent {
  items: IntentItem[];
  /** true quando a IA também leu o texto (senão é a leitura simples, sem IA). */
  usedAi: boolean;
}

/** Notas sem data escrita valem uma semana (nunca «para sempre»). */
export const DEFAULT_NOTE_DAYS = 7;
const key = (d: Date) => format(d, 'yyyy-MM-dd');

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const WEEKDAY_WORD: Record<number, string> = {
  0: 'domingo|sunday',
  1: 'segunda|monday|lunes',
  2: 'terca|tuesday|martes',
  3: 'quarta|wednesday|miercoles',
  4: 'quinta|thursday|jueves',
  5: 'sexta|friday|viernes',
  6: 'sabado|saturday',
};

/**
 * «esta sexta», «este sábado», «na próxima segunda», «this friday», «este viernes»: refere-se
 * a UMA data, não a todas as semanas. Devolve essa data (a próxima ocorrência a partir de hoje).
 */
export function oneOffDateForWeekday(text: string, weekday: number, today: string): string | undefined {
  const t = normalize(text);
  const words = WEEKDAY_WORD[weekday];
  const re = new RegExp(`\\b(?:esta|este|nesta|neste|proxima|proximo|na proxima|no proximo|this|next|el proximo)\\s+(?:${words})`);
  if (!re.test(t)) return undefined;
  const base = parseDay(today);
  const delta = (weekday - base.getDay() + 7) % 7;
  return key(addDays(base, delta));
}

/** Converte a leitura determinística (`parsePlannerBriefing`) em itens de intenção. */
export function intentFromParsedBriefing(parsed: ParsedPlannerBriefing, today: string): PlanIntent {
  const items: IntentItem[] = [];
  const text = parsed.rawText ?? '';

  for (const u of parsed.weekdayUpdates) {
    const date = oneOffDateForWeekday(text, u.weekday, today);
    if (date) {
      items.push({
        id: `date-${date}`,
        kind: 'date_override',
        date,
        ...(u.enabled !== undefined ? { enabled: u.enabled } : {}),
        ...(u.minutes !== undefined ? { minutes: u.minutes } : {}),
        ...(u.window ? { window: u.window } : {}),
      });
    } else {
      items.push({
        id: `weekday-${u.weekday}`,
        kind: 'weekday_rule',
        weekday: u.weekday,
        ...(u.enabled !== undefined ? { enabled: u.enabled } : {}),
        ...(u.minutes !== undefined ? { minutes: u.minutes } : {}),
        ...(u.window ? { window: u.window } : {}),
        ...(u.blockedPeriod ? { blockedPeriod: u.blockedPeriod } : {}),
      });
    }
  }

  for (const id of parsed.boostCourseIds) {
    const clause = parsed.courseModeClauses?.[id];
    const window = clause ? parseFocusWindow(clause, today) : undefined;
    items.push({
      id: `mode-${id}`,
      kind: 'course_mode',
      courseId: id,
      mode: 'boost',
      ...(window ? { until: window.until } : {}),
    });
  }
  for (const id of parsed.pausedCourseIds) {
    if (parsed.boostCourseIds.includes(id)) continue;
    const clause = parsed.courseModeClauses?.[id];
    const window = clause ? parseFocusWindow(clause, today) : undefined;
    items.push({
      id: `mode-${id}`,
      kind: 'course_mode',
      courseId: id,
      mode: 'pause',
      ...(window ? { until: window.until } : {}),
    });
  }

  for (const [courseId, note] of Object.entries(parsed.briefingCourseFocus)) {
    const window = parseFocusWindow(note, today) ?? parseFocusWindow(text, today);
    items.push({
      id: `note-${courseId}`,
      kind: 'course_note',
      courseId,
      text: note.slice(0, 80),
      ...(window ? { from: window.from, until: window.until } : { until: key(addDays(parseDay(today), DEFAULT_NOTE_DAYS)) }),
    });
  }

  if (parsed.suggestedMarathon?.enabled) {
    items.push({ id: 'marathon', kind: 'marathon', marathon: parsed.suggestedMarathon });
  }
  if (parsed.midSemesterCatchUp) {
    items.push({ id: 'strategy', kind: 'strategy', strategy: 'catch_up' });
  }
  if (parsed.contentMix) {
    items.push({ id: 'content_mix', kind: 'content_mix', mix: parsed.contentMix });
  }
  for (const u of parsed.topicUpdates) {
    items.push({ id: `topic-${u.topicId}`, kind: 'topic_hint', ...u });
  }

  return { items: dedupeById(items), usedAi: false };
}

function dedupeById(items: IntentItem[]): IntentItem[] {
  const map = new Map<string, IntentItem>();
  for (const it of items) map.set(it.id, it);
  return [...map.values()];
}

/** Junta a leitura da IA à leitura simples: a IA acrescenta e, no mesmo id, prevalece. */
export function mergeIntents(base: PlanIntent, ai: IntentItem[]): PlanIntent {
  return { items: dedupeById([...base.items, ...ai]), usedAi: true };
}

/**
 * Valida itens vindos da IA: ids de cadeiras/tópicos conhecidos, datas entre hoje e +21 dias,
 * minutos 0–720, notas ≤ 80 caracteres. Itens inválidos são descartados (nunca inventa).
 */
export function sanitizeIntentItems(raw: unknown, courses: Course[], today: string): IntentItem[] {
  if (!Array.isArray(raw)) return [];
  const courseIds = new Set(courses.map((c) => c.id));
  const topicCourse = new Map<ID, ID>();
  for (const c of courses) for (const t of c.topics) topicCourse.set(t.id, c.id);
  const maxDate = key(addDays(parseDay(today), 21));
  const okDate = (d: unknown): d is string =>
    typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today && d <= maxDate;
  const okWindow = (w: unknown): w is PlannerWindowMode =>
    w === 'auto' || w === 'morning' || w === 'afternoon' || w === 'evening' || w === 'all_day';
  const mins = (m: unknown) =>
    typeof m === 'number' && Number.isFinite(m) ? Math.max(0, Math.min(720, Math.round(m))) : undefined;

  const out: IntentItem[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue;
    switch (r.kind) {
      case 'course_mode':
        if (typeof r.courseId === 'string' && courseIds.has(r.courseId) && (r.mode === 'boost' || r.mode === 'pause')) {
          out.push({
            id: `mode-${r.courseId}`,
            kind: 'course_mode',
            courseId: r.courseId,
            mode: r.mode,
            ...(okDate(r.until) ? { until: r.until } : {}),
          });
        }
        break;
      case 'course_note':
        if (typeof r.courseId === 'string' && courseIds.has(r.courseId) && typeof r.text === 'string' && r.text.trim()) {
          out.push({
            id: `note-${r.courseId}`,
            kind: 'course_note',
            courseId: r.courseId,
            text: r.text.trim().slice(0, 80),
            ...(okDate(r.from) ? { from: r.from } : {}),
            until: okDate(r.until) ? r.until : key(addDays(parseDay(today), DEFAULT_NOTE_DAYS)),
          });
        }
        break;
      case 'weekday_rule': {
        const wd = Number(r.weekday);
        if (Number.isInteger(wd) && wd >= 0 && wd <= 6) {
          const m = mins(r.minutes);
          out.push({
            id: `weekday-${wd}`,
            kind: 'weekday_rule',
            weekday: wd,
            ...(typeof r.enabled === 'boolean' ? { enabled: r.enabled } : {}),
            ...(m !== undefined ? { minutes: m } : {}),
            ...(okWindow(r.window) ? { window: r.window } : {}),
          });
        }
        break;
      }
      case 'date_override':
        if (okDate(r.date)) {
          const m = mins(r.minutes);
          out.push({
            id: `date-${r.date}`,
            kind: 'date_override',
            date: r.date,
            ...(typeof r.enabled === 'boolean' ? { enabled: r.enabled } : {}),
            ...(m !== undefined ? { minutes: m } : {}),
            ...(okWindow(r.window) ? { window: r.window } : {}),
          });
        }
        break;
      case 'strategy':
        if (r.strategy === 'balanced' || r.strategy === 'exams_first' || r.strategy === 'srs_focus' || r.strategy === 'catch_up') {
          out.push({ id: 'strategy', kind: 'strategy', strategy: r.strategy });
        }
        break;
      case 'content_mix': {
        const mix = r.contentMix ?? r.mix;
        if (mix === 'balanced' || mix === 'theory_first' || mix === 'practice_first') {
          out.push({ id: 'content_mix', kind: 'content_mix', mix });
        }
        break;
      }
      case 'topic_hint': {
        const cid = typeof r.topicId === 'string' ? topicCourse.get(r.topicId) : undefined;
        const status = r.status;
        if (cid && (status === 'todo' || status === 'learning' || status === 'review' || status === 'done')) {
          const conf = Math.max(1, Math.min(5, Math.round(Number(r.confidence) || 3))) as Topic['confidence'];
          out.push({ id: `topic-${r.topicId}`, kind: 'topic_hint', courseId: cid, topicId: r.topicId as string, status, confidence: conf });
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/**
 * Aplica os itens ligados às preferências. Regras por dia da semana são permanentes;
 * exceções por data valem só nesse dia; reforços/pausas e notas podem ter fim.
 */
export function applyPlanIntent(
  prefs: PlannerPreferences | undefined,
  items: IntentItem[],
): {
  prefs: PlannerPreferences;
  topicUpdates: Array<{ courseId: ID; topicId: ID; changes: Partial<Topic> }>;
} {
  const next: PlannerPreferences = { ...DEFAULT_PLANNER_PREFS, ...(prefs ?? {}) };
  const boost = new Set(next.boostCourseIds ?? []);
  const paused = new Set(next.pausedCourseIds ?? []);
  const modeUntil = { ...(next.courseModeUntil ?? {}) };
  const notes = { ...(next.courseNotes ?? {}) };
  const overrides = { ...(next.dateOverrides ?? {}) };
  const schedule = { ...(next.weekdaySchedule ?? {}) };
  const topicUpdates: Array<{ courseId: ID; topicId: ID; changes: Partial<Topic> }> = [];
  let touchedSchedule = false;

  for (const it of items) {
    switch (it.kind) {
      case 'course_mode':
        if (it.mode === 'boost') {
          boost.add(it.courseId);
          paused.delete(it.courseId);
        } else {
          paused.add(it.courseId);
          boost.delete(it.courseId);
        }
        if (it.until) modeUntil[it.courseId] = it.until;
        else delete modeUntil[it.courseId];
        break;
      case 'course_note':
        notes[it.courseId] = {
          text: it.text,
          ...(it.from ? { from: it.from } : {}),
          until: it.until,
          source: 'briefing',
        };
        break;
      case 'weekday_rule': {
        const k = String(it.weekday);
        const cur = schedule[k] ?? { enabled: true, minutes: 120, window: 'auto' as const };
        const blocked = new Set(cur.blockedPeriods ?? []);
        if (it.blockedPeriod) blocked.add(it.blockedPeriod);
        schedule[k] = {
          ...cur,
          ...(it.enabled !== undefined ? { enabled: it.enabled } : {}),
          ...(it.minutes !== undefined ? { minutes: it.minutes } : {}),
          ...(it.window ? { window: it.window } : {}),
          ...(blocked.size > 0 ? { blockedPeriods: [...blocked] } : {}),
        };
        touchedSchedule = true;
        break;
      }
      case 'date_override':
        overrides[it.date] = {
          ...(it.enabled !== undefined ? { enabled: it.enabled } : {}),
          ...(it.minutes !== undefined ? { minutes: it.minutes } : {}),
          ...(it.window ? { window: it.window } : {}),
        };
        break;
      case 'marathon':
        next.preExamMarathon = it.marathon;
        break;
      case 'strategy':
        next.strategy = it.strategy;
        break;
      case 'content_mix':
        next.contentMix = it.mix;
        break;
      case 'topic_hint':
        topicUpdates.push({
          courseId: it.courseId,
          topicId: it.topicId,
          changes: { status: it.status, confidence: it.confidence },
        });
        break;
    }
  }

  next.boostCourseIds = [...boost];
  next.pausedCourseIds = [...paused];
  next.courseModeUntil = modeUntil;
  next.courseNotes = notes;
  next.dateOverrides = overrides;
  if (touchedSchedule) next.weekdaySchedule = schedule;
  // A nota antiga sem validade deixa de ser usada a partir do primeiro briefing novo.
  delete next.briefingCourseFocus;
  return { prefs: next, topicUpdates };
}
