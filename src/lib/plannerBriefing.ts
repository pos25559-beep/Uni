import { weekdayShort } from './colors';
import { detectUpToBoundary, extractOrdinalNumber, extractStudyFocusPhrase } from './uniCheckInNlu';
import type {
  Course,
  ID,
  Material,
  PlannerDayPeriod,
  PlannerPreferences,
  PlannerWindowMode,
  PreExamMarathonConfig,
  Settings,
  Topic,
  WeekdayAvailability,
} from '../types';

const stripDiacritics = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const cleanSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();

export type WeekdayPresetId = 'light_week_strong_weekend' | 'evenings_week' | 'uniform';

/** Constrói mapa Seg–Dom a partir das definições antigas (retrocompatível). */
export function buildDefaultWeekdaySchedule(
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>,
  preferredPeriod: PlannerDayPeriod = 'auto',
): Record<string, WeekdayAvailability> {
  const baseMin = Math.max(30, settings.dailyStudyMinutes || 120);
  const activeSet = new Set(settings.studyDays.length > 0 ? settings.studyDays : [1, 2, 3, 4, 5, 6]);
  const out: Record<string, WeekdayAvailability> = {};
  for (let d = 0; d <= 6; d++) {
    const weekend = d === 0 || d === 6;
    out[String(d)] = {
      enabled: activeSet.has(d),
      minutes: weekend && baseMin < 180 ? Math.min(360, baseMin + 60) : baseMin,
      window: preferredPeriod,
    };
  }
  return out;
}

/** Garante um mapa completo Seg–Dom preenchendo eventuais dias em falta. */
export function normalizeWeekdaySchedule(
  existing: Record<string, WeekdayAvailability> | undefined,
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>,
  preferredPeriod: PlannerDayPeriod = 'auto',
): Record<string, WeekdayAvailability> {
  const fallback = buildDefaultWeekdaySchedule(settings, preferredPeriod);
  if (!existing) return fallback;
  const merged: Record<string, WeekdayAvailability> = {};
  for (let d = 0; d <= 6; d++) {
    const k = String(d);
    const cur = existing[k];
    merged[k] = cur
      ? {
          enabled: Boolean(cur.enabled),
          minutes: Math.max(0, Math.min(720, Math.round(cur.minutes || fallback[k].minutes))),
          window: cur.window ?? fallback[k].window,
          ...(cur.blockedPeriods && cur.blockedPeriods.length > 0
            ? { blockedPeriods: [...new Set(cur.blockedPeriods)] }
            : {}),
        }
      : fallback[k];
  }
  return merged;
}

export function resolveWeekdayAvailability(
  weekday: number,
  settings: Pick<Settings, 'dailyStudyMinutes' | 'studyDays'>,
  weekdaySchedule?: Record<string, WeekdayAvailability>,
  preferredPeriod: PlannerDayPeriod = 'auto',
): WeekdayAvailability {
  const entry = weekdaySchedule?.[String(weekday)];
  if (entry) return entry;
  return {
    enabled: settings.studyDays.includes(weekday),
    minutes: Math.max(30, settings.dailyStudyMinutes || 120),
    window: preferredPeriod,
  };
}

export function applyWeekdayPreset(preset: WeekdayPresetId): Record<string, WeekdayAvailability> {
  const out: Record<string, WeekdayAvailability> = {};
  for (let d = 0; d <= 6; d++) {
    const weekend = d === 0 || d === 6;
    if (preset === 'light_week_strong_weekend') {
      out[String(d)] = weekend
        ? { enabled: true, minutes: 240, window: 'all_day' }
        : { enabled: true, minutes: 90, window: 'evening' };
    } else if (preset === 'evenings_week') {
      out[String(d)] = weekend
        ? { enabled: d === 6, minutes: d === 6 ? 210 : 90, window: 'morning' }
        : { enabled: true, minutes: 120, window: 'evening' };
    } else {
      out[String(d)] = {
        enabled: d !== 0,
        minutes: 120,
        window: 'auto',
      };
    }
  }
  return out;
}

export type BriefingInsightKind =
  | 'marathon'
  | 'mid_semester'
  | 'availability'
  | 'topic_mastered'
  | 'course_boost'
  | 'course_pause'
  | 'course_focus';

export interface ParsedBriefingInsight {
  id: string;
  kind: BriefingInsightKind;
  label: string;
  courseId?: ID;
  weekday?: number;
  blockedPeriod?: 'morning' | 'afternoon' | 'evening';
  setWindow?: PlannerWindowMode;
  setEnabled?: boolean;
  setMinutes?: number;
  topicUpdates?: Array<{ courseId: ID; topicId: ID; status: Topic['status']; confidence: Topic['confidence'] }>;
  focusNote?: string;
  marathon?: PreExamMarathonConfig;
  activateCatchUp?: boolean;
}

export interface ParsedPlannerBriefing {
  rawText: string;
  midSemesterCatchUp: boolean;
  suggestedMarathon?: PreExamMarathonConfig;
  insights: ParsedBriefingInsight[];
  topicUpdates: Array<{ courseId: ID; topicId: ID; status: Topic['status']; confidence: Topic['confidence'] }>;
  boostCourseIds: ID[];
  pausedCourseIds: ID[];
  briefingCourseFocus: Record<string, string>;
  weekdayUpdates: Array<{
    weekday: number;
    enabled?: boolean;
    window?: PlannerWindowMode;
    minutes?: number;
    blockedPeriod?: 'morning' | 'afternoon' | 'evening';
  }>;
}

const WEEKDAY_PATTERNS: Array<{ weekday: number; re: RegExp }> = [
  { weekday: 1, re: /\b(?:segundas?(?:-feira)?|2\.?a(?:\s*feira)?|mondays?|lunes)\b/i },
  { weekday: 2, re: /\b(?:tercas?(?:-feira)?|3\.?a(?:\s*feira)?|tuesdays?|martes)\b/i },
  { weekday: 3, re: /\b(?:quartas?(?:-feira)?|4\.?a(?:\s*feira)?|wednesdays?|miercoles)\b/i },
  { weekday: 4, re: /\b(?:quintas?(?:-feira)?|5\.?a(?:\s*feira)?|thursdays?|jueves)\b/i },
  { weekday: 5, re: /\b(?:sextas?(?:-feira)?|6\.?a(?:\s*feira)?|fridays?|viernes)\b/i },
  { weekday: 6, re: /\b(?:sabados?|sab\.?|saturdays?)\b/i },
  { weekday: 0, re: /\b(?:domingos?|dom\.?|sundays?)\b/i },
];

const WEEKEND_RE = /\b(?:fins?\s+de\s+semana|fim\s+de\s+semana|fds|weekends?)\b/i;
const WEEKDAYS_RE = /\b(?:dias?\s+uteis|durante\s+a\s+semana|semana\s+toda|weekdays?)\b/i;

function matchCourseInClause(normClause: string, courses: Course[]): Course[] {
  const matched: Course[] = [];
  for (const c of courses) {
    const tokens = [c.shortName, c.code]
      .map((s) => stripDiacritics(s || '').trim())
      .filter((t) => t.length >= 2);
    const shortHit = tokens.some((tk) =>
      new RegExp(`(^|[^a-z0-9])${tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(
        normClause,
      ),
    );
    if (shortHit) {
      matched.push(c);
      continue;
    }
    const nameWords = stripDiacritics(c.name)
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/^(para|com|dos|das|engenharia|introducao|geral|aplicada)$/.test(w));
    if (nameWords.length > 0 && nameWords.some((w) => normClause.includes(w))) {
      matched.push(c);
    }
  }
  return matched;
}

function periodLabel(p: PlannerWindowMode): string {
  if (p === 'morning') return 'manhã';
  if (p === 'afternoon') return 'tarde';
  if (p === 'evening') return 'noite';
  if (p === 'all_day') return 'dia todo';
  return 'automático';
}

/**
 * Analisa deterministicamente ($0, instantâneo, offline) o texto livre onde o estudante explica
 * a sua realidade ao Uni (entrada a meio do semestre, disponibilidade semanal, maratona pré-teste e domínio prévio).
 */
export function parsePlannerBriefing(args: {
  text: string;
  courses: Course[];
  materials?: Material[];
}): ParsedPlannerBriefing {
  const rawText = cleanSpaces(args.text);
  if (!rawText) {
    return {
      rawText: '',
      midSemesterCatchUp: false,
      insights: [],
      topicUpdates: [],
      boostCourseIds: [],
      pausedCourseIds: [],
      briefingCourseFocus: {},
      weekdayUpdates: [],
    };
  }

  const normAll = stripDiacritics(rawText);
  const insights: ParsedBriefingInsight[] = [];
  const topicUpdates: ParsedBriefingInsight['topicUpdates'] = [];
  const boostCourseSet = new Set<ID>();
  const pausedCourseSet = new Set<ID>();
  const briefingCourseFocus: Record<string, string> = {};
  const weekdayUpdates: ParsedPlannerBriefing['weekdayUpdates'] = [];

  // 1) Meio do semestre / atraso acumulado
  const midSemesterCatchUp =
    /\b(?:meio\s+do\s+semestre|a\s+meio|entrei\s+(?:tarde|agora|depois)|mid[- ]semester|em\s+atraso|atrasado|recuperar\s+materia|pegar\s+(?:tudo|na\s+materia))\b/i.test(
      normAll,
    );
  if (midSemesterCatchUp) {
    insights.push({
      id: 'mid-semester',
      kind: 'mid_semester',
      label: 'Ponto de partida a meio do semestre · priorizar recuperação e lacunas reais',
      activateCatchUp: true,
    });
  }

  // 2) Maratona pré-teste ("fico a estudar o dia todo antes de testes")
  const wantsMarathon =
    /(?:dia\s+(?:todo|inteiro)|maratona|basicamente\s+o\s+dia\s+todo|all\s+day|tudo\s+seguido|intensivo)\s+(?:antes|nos?\s+\d*\s*dias?\s+antes|na\s+vespera|para\s+o?\s*(?:teste|exame|prova))|(?:antes\s+(?:de|dos?|das?)\s+(?:testes?|exames?|provas?).{0,45}(?:dia\s+(?:todo|inteiro)|maratona|8h|6h|10h|o\s+dia\s+todo))|\bmodo\s+maratona\b/i.test(
      normAll,
    );
  let suggestedMarathon: PreExamMarathonConfig | undefined;
  if (wantsMarathon) {
    const daysMatch = normAll.match(/\b([1-3])\s+dias?\s+antes\b/);
    const daysBefore = (daysMatch ? Number(daysMatch[1]) : /\bvespera\b/.test(normAll) ? 1 : 2) as
      | 1
      | 2
      | 3;
    const hoursMatch = normAll.match(/\b(6|7|8|9|10|12)\s*h(?:oras?)?\b/);
    const rawHours = hoursMatch ? Number(hoursMatch[1]) : 8;
    const dailyMinutes: 360 | 480 | 600 = rawHours <= 6 ? 360 : rawHours >= 10 ? 600 : 480;
    suggestedMarathon = {
      enabled: true,
      daysBefore,
      dailyMinutes,
    };
    insights.push({
      id: 'marathon-pre-exam',
      kind: 'marathon',
      label: `Maratona Pré-Teste ativa: ${Math.round(dailyMinutes / 60)}h/dia nos últimos ${daysBefore} dia(s) antes de provas`,
      marathon: suggestedMarathon,
    });
  }

  // Separa em frases/orações para interpretações locais mais precisas
  const clauses = rawText
    .split(
      /(?<=[.!?\n;])|,\s+(?=(?:mas|e|na|no|ao|aos|à|as|quarta|quinta|sexta|sabado|sábado|domingo|segunda|terca|terça|já|ja|em|para)\b)|\s+(?:e|mas|pero|and|but)\s+(?=(?:ao|aos|à|às|na|no|nos|nas|segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo|fins?\s+de\s+semana|fds|dias?\s+uteis|já|ja|quero)\b)/i,
    )
    .map((c) => cleanSpaces(c))
    .filter((c) => c.length >= 3);

  for (let idx = 0; idx < clauses.length; idx++) {
    const clause = clauses[idx]!;
    const nc = stripDiacritics(clause);

    // 3) Disponibilidade por dia da semana
    const matchedWeekdays = WEEKDAY_PATTERNS.filter((p) => p.re.test(nc)).map((p) => p.weekday);
    if (WEEKEND_RE.test(nc)) {
      if (!matchedWeekdays.includes(6)) matchedWeekdays.push(6);
      if (!matchedWeekdays.includes(0)) matchedWeekdays.push(0);
    }
    if (WEEKDAYS_RE.test(nc)) {
      for (const wd of [1, 2, 3, 4, 5]) {
        if (!matchedWeekdays.includes(wd)) matchedWeekdays.push(wd);
      }
    }

    if (matchedWeekdays.length > 0 && !/\bantes\s+(?:de|do|dos)\s+(?:teste|exame|prova)/.test(nc)) {
      const hasMorning = /\b(?:de\s+manha|manha|morning)\b/.test(nc);
      const hasAfternoon = /\b(?:de\s+tarde|a\s+tarde|tarde|afternoon)\b/.test(nc);
      const hasEvening = /\b(?:a\s+noite|de\s+noite|noite|fim\s+do\s+dia|evening|night)\b/.test(nc);
      const hasAllDay = /\b(?:dia\s+todo|dia\s+inteiro|livre|all\s+day)\b/.test(nc);

      const isBlockedClause =
        /\b(?:nao\s+posso|nao\s+consigo|nao\s+estudo|sem\s+estudo|ocupad[oa]|treino|trabalho|bloquead[oa]|descanso|folga|impossivel|evitar)\b/.test(
          nc,
        ) && !/\bso\s+(?:nao\s+posso|consigo)\b.*\bdepois\b/.test(nc);

      const explicitHours = nc.match(/\b(\d(?:[.,]\d)?)\s*h(?:oras?)?\b/);
      const explicitMins = nc.match(/\b(\d{2,3})\s*min\b/);
      const parsedMin = explicitHours
        ? Math.min(600, Math.max(30, Math.round(Number(explicitHours[1].replace(',', '.')) * 60)))
        : explicitMins
          ? Math.min(600, Math.max(30, Number(explicitMins[1])))
          : undefined;

      for (const wd of matchedWeekdays) {
        const dayName = weekdayShort[wd] ?? String(wd);
        if (isBlockedClause && !hasMorning && !hasAfternoon && !hasEvening) {
          weekdayUpdates.push({ weekday: wd, enabled: false, minutes: 0 });
          insights.push({
            id: `avail-off-${wd}-${idx}`,
            kind: 'availability',
            weekday: wd,
            setEnabled: false,
            setMinutes: 0,
            label: `${dayName}: marcado como dia sem estudo`,
          });
        } else if (isBlockedClause && (hasMorning || hasAfternoon || hasEvening)) {
          const blockedPeriod: 'morning' | 'afternoon' | 'evening' = hasMorning
            ? 'morning'
            : hasAfternoon
              ? 'afternoon'
              : 'evening';
          const fallbackWindow: PlannerWindowMode =
            blockedPeriod === 'morning' ? 'afternoon' : blockedPeriod === 'afternoon' ? 'evening' : 'afternoon';
          weekdayUpdates.push({
            weekday: wd,
            enabled: true,
            blockedPeriod,
            window: fallbackWindow,
            ...(parsedMin ? { minutes: parsedMin } : {}),
          });
          insights.push({
            id: `avail-block-${wd}-${blockedPeriod}-${idx}`,
            kind: 'availability',
            weekday: wd,
            blockedPeriod,
            setWindow: fallbackWindow,
            setEnabled: true,
            label: `${dayName}: evitar ${periodLabel(blockedPeriod)} (mover para ${periodLabel(fallbackWindow)})`,
          });
        } else if (hasAllDay || parsedMin || hasMorning || hasAfternoon || hasEvening) {
          const setWindow: PlannerWindowMode = hasAllDay
            ? 'all_day'
            : hasMorning
              ? 'morning'
              : hasAfternoon
                ? 'afternoon'
                : hasEvening
                  ? 'evening'
                  : 'auto';
          const defaultMin = parsedMin ?? (hasAllDay ? 300 : undefined);
          weekdayUpdates.push({
            weekday: wd,
            enabled: true,
            window: setWindow,
            ...(defaultMin ? { minutes: defaultMin } : {}),
          });
          insights.push({
            id: `avail-set-${wd}-${setWindow}-${idx}`,
            kind: 'availability',
            weekday: wd,
            setEnabled: true,
            setWindow,
            ...(defaultMin ? { setMinutes: defaultMin } : {}),
            label: `${dayName}: janela ${periodLabel(setWindow)}${defaultMin ? ` (${Math.round((defaultMin / 60) * 10) / 10}h)` : ''}`,
          });
        }
      }
    }

    // 4) Interpretação por cadeira (matéria já dominada, dúvidas, pausar, foco)
    const mentionedCourses = matchCourseInClause(nc, args.courses);
    if (mentionedCourses.length === 0) continue;

    const saysMastered =
      /\b(?:ja\s+(?:sei|domino|dominei|estudei|revi|dei|li|percebi|tenho)|domino\s+bem|ja\s+esta|dispenso)\b/.test(
        nc,
      );
    const saysPause = /\b(?:pausar|nao\s+precisa|deixar\s+para\s+depois|ja\s+passei|sem\s+focar\s+em)\b/.test(
      nc,
    );
    const saysBoostOrTrouble =
      /\b(?:atrasad[oa]|duvida|duvidas|faltei|dificil|complicad[oa]|preciso\s+(?:muito|focar|rever)|prioridade|focar|tenho\s+teste|reforcar|nao\s+percebi)\b/.test(
        nc,
      );
    const boundary = detectUpToBoundary(clause);
    const focusPhrase = extractStudyFocusPhrase(clause);

    for (const course of mentionedCourses) {
      if (saysPause && !saysBoostOrTrouble) {
        pausedCourseSet.add(course.id);
        insights.push({
          id: `pause-${course.id}-${idx}`,
          kind: 'course_pause',
          courseId: course.id,
          label: `Pausar temporariamente ${course.shortName}`,
        });
        continue;
      }

      if (saysMastered) {
        const picked: NonNullable<ParsedBriefingInsight['topicUpdates']> = [];
        for (const t of course.topics) {
          const ord = extractOrdinalNumber(t.title);
          const normTitle = stripDiacritics(t.title);
          const byBoundary = boundary && ord !== null && ord >= 1 && ord <= boundary.maxNumber;
          const byNominal = normTitle.length >= 4 && nc.includes(normTitle);
          if (byBoundary || byNominal) {
            picked.push({
              courseId: course.id,
              topicId: t.id,
              status: 'done',
              confidence: 5,
            });
          }
        }
        // Fallback: se disse "já sei até 4" sem números nos títulos, marca os primeiros N tópicos
        if (picked.length === 0 && boundary && course.topics.length > 0) {
          for (const t of course.topics.slice(0, Math.min(boundary.maxNumber, course.topics.length))) {
            picked.push({
              courseId: course.id,
              topicId: t.id,
              status: 'done',
              confidence: 5,
            });
          }
        }
        if (picked.length > 0) {
          topicUpdates.push(...picked);
          insights.push({
            id: `mastered-${course.id}-${idx}`,
            kind: 'topic_mastered',
            courseId: course.id,
            topicUpdates: picked,
            label: `${course.shortName}: marcar ${picked.length} tópico(s) como já dominados`,
          });
        }
      }

      if (saysBoostOrTrouble) {
        boostCourseSet.add(course.id);
        insights.push({
          id: `boost-${course.id}-${idx}`,
          kind: 'course_boost',
          courseId: course.id,
          label: `Dar prioridade extra a ${course.shortName}`,
        });
      }

      if (focusPhrase) {
        briefingCourseFocus[course.id] = focusPhrase;
        insights.push({
          id: `focus-${course.id}-${idx}`,
          kind: 'course_focus',
          courseId: course.id,
          focusNote: focusPhrase,
          label: `${course.shortName}: focar em «${focusPhrase}»`,
        });
      }
    }
  }

  return {
    rawText,
    midSemesterCatchUp,
    ...(suggestedMarathon ? { suggestedMarathon } : {}),
    insights,
    topicUpdates,
    boostCourseIds: [...boostCourseSet],
    pausedCourseIds: [...pausedCourseSet],
    briefingCourseFocus,
    weekdayUpdates,
  };
}

/** Constrói estado rápido inicial da matriz de preferências para o construtor. */
export function isCustomPrefsModified(prefs: PlannerPreferences): boolean {
  return (
    (prefs.boostCourseIds?.length ?? 0) > 0 ||
    (prefs.pausedCourseIds?.length ?? 0) > 0 ||
    prefs.strategy !== 'balanced' ||
    prefs.preferredPeriod !== 'auto' ||
    prefs.blockMinutes !== 50 ||
    prefs.horizonDays !== 14 ||
    Boolean(prefs.preExamMarathon?.enabled) ||
    Boolean(prefs.fillClassGaps) ||
    Boolean(prefs.briefingNote?.trim())
  );
}
