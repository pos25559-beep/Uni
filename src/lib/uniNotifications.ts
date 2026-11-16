import { kindLabel, weekdayLong } from './colors';
import {
  daysUntil,
  readiness,
  sessionMinutes,
  studyStreak,
  upcomingAssessments,
} from './selectors';
import { isTopicReviewDue } from './spacedRepetition';
import type {
  AppTone,
  Assessment,
  ClassSlot,
  Course,
  NotificationPreferences,
  Settings,
  StudyLogEntry,
  StudySession,
  Topic,
  WeeklyCheckIn,
} from '../types';

export type UniNotificationKind =
  | 'streak'
  | 'srs'
  | 'assessment'
  | 'class'
  | 'post_class'
  | 'evening'
  | 'sunday'
  | 'exam_prep';

export interface ScheduledUniNotification {
  id: number;
  key: string;
  kind: UniNotificationKind;
  title: string;
  body: string;
  fireAt: string;
  route: string;
  courseId?: string;
}

export interface InAppUniNudge {
  key: string;
  kind: UniNotificationKind;
  title: string;
  body: string;
  ctaLabel: string;
  route: string;
}

export interface NotificationPlannerInput {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  sessions: StudySession[];
  studyLogs?: StudyLogEntry[];
  weeklyCheckIns?: WeeklyCheckIn[];
  settings: Partial<Settings>;
  now?: Date;
  horizonHours?: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  streakSaver: true,
  srsDue: true,
  assessments: true,
  classReminders: true,
  postClassCheckIn: true,
  postClassDelayMinutes: 10,
  eveningCheckIn: true,
  eveningHour: 20,
  sundayReview: true,
  sundayHour: 18,
  examPrepCheckIn: true,
  classBeforeMinutes: 15,
  preferredHour: 19,
  quietStart: '22:30',
  quietEnd: '08:30',
  maxDailyNudges: 4,
};

export function resolveNotificationPrefs(
  prefs?: Partial<NotificationPreferences>,
): NotificationPreferences {
  const maxRaw = prefs?.maxDailyNudges;
  const maxDailyNudges: NotificationPreferences['maxDailyNudges'] =
    maxRaw === 1 || maxRaw === 2 || maxRaw === 3 || maxRaw === 4 || maxRaw === 6
      ? maxRaw
      : DEFAULT_NOTIFICATION_PREFS.maxDailyNudges;
  const delayRaw = prefs?.postClassDelayMinutes;
  const postClassDelayMinutes: 5 | 10 | 15 =
    delayRaw === 5 || delayRaw === 15 ? delayRaw : 10;

  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(prefs ?? {}),
    postClassCheckIn: prefs?.postClassCheckIn ?? DEFAULT_NOTIFICATION_PREFS.postClassCheckIn,
    postClassDelayMinutes,
    eveningCheckIn: prefs?.eveningCheckIn ?? DEFAULT_NOTIFICATION_PREFS.eveningCheckIn,
    eveningHour:
      typeof prefs?.eveningHour === 'number' && Number.isFinite(prefs.eveningHour)
        ? Math.max(17, Math.min(22, Math.round(prefs.eveningHour)))
        : DEFAULT_NOTIFICATION_PREFS.eveningHour,
    sundayReview: prefs?.sundayReview ?? DEFAULT_NOTIFICATION_PREFS.sundayReview,
    sundayHour:
      typeof prefs?.sundayHour === 'number' && Number.isFinite(prefs.sundayHour)
        ? Math.max(15, Math.min(21, Math.round(prefs.sundayHour)))
        : DEFAULT_NOTIFICATION_PREFS.sundayHour,
    examPrepCheckIn: prefs?.examPrepCheckIn ?? DEFAULT_NOTIFICATION_PREFS.examPrepCheckIn,
    classBeforeMinutes: prefs?.classBeforeMinutes === 30 ? 30 : 15,
    maxDailyNudges,
    preferredHour:
      typeof prefs?.preferredHour === 'number' && Number.isFinite(prefs.preferredHour)
        ? Math.max(7, Math.min(22, Math.round(prefs.preferredHour)))
        : DEFAULT_NOTIFICATION_PREFS.preferredHour,
  };
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function parseTimeMinutes(hhmm: string, fallbackMinutes = 0): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!match) return fallbackMinutes;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallbackMinutes;
  return h * 60 + m;
}

function calendarDaysUntilDate(examAt: Date, now: Date): number {
  const startExam = new Date(examAt.getFullYear(), examAt.getMonth(), examAt.getDate()).getTime();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startExam - startNow) / (24 * 3600 * 1000));
}

function parseAssessmentDateTime(iso: string): Date | null {
  const datePart = iso.slice(0, 10);
  const [y, mo, d] = datePart.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const timeMatch = /T(\d{1,2}):(\d{2})/.exec(iso);
  const hh = timeMatch ? Number(timeMatch[1]) : 9;
  const mm = timeMatch ? Number(timeMatch[2]) : 0;
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

/** Verifica se um instante cai dentro da janela de silêncio configurada. */
export function isWithinQuietHours(date: Date, prefs: NotificationPreferences): boolean {
  const cur = date.getHours() * 60 + date.getMinutes();
  const start = parseTimeMinutes(prefs.quietStart, 22 * 60 + 30);
  const end = parseTimeMinutes(prefs.quietEnd, 8 * 60 + 30);
  if (start === end) return false;
  if (start < end) {
    return cur >= start && cur < end;
  }
  return cur >= start || cur < end;
}

/** Ajusta um timestamp para fora da janela de silêncio, avançando para `quietEnd`. */
export function clampOutOfQuietHours(date: Date, prefs: NotificationPreferences): Date {
  if (!isWithinQuietHours(date, prefs)) return new Date(date.getTime());

  const start = parseTimeMinutes(prefs.quietStart, 22 * 60 + 30);
  const end = parseTimeMinutes(prefs.quietEnd, 8 * 60 + 30);
  const cur = date.getHours() * 60 + date.getMinutes();
  const out = new Date(date.getTime());
  const endH = Math.floor(end / 60);
  const endM = end % 60;

  if (start > end && cur >= start) {
    out.setDate(out.getDate() + 1);
  }
  out.setHours(endH, endM, 0, 0);
  return out;
}

function stableNotificationId(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1000 + (Math.abs(hash) % 900000000);
}

type Persona = NonNullable<Settings['uniPersona']>;

function resolvePersona(settings: Partial<Settings>): Persona {
  return settings.uniPersona ?? 'amigo';
}

function resolveTone(settings: Partial<Settings>): AppTone {
  return settings.appTone ?? 'vibrante';
}

function formatStreakCopy(streak: number, persona: Persona, tone: AppTone): { title: string; body: string } {
  if (tone === 'serio') {
    return {
      title: streak > 0 ? `Sequência de ${streak} dia(s) pendente` : 'Sessão diária pendente',
      body: 'Regista uma sessão de estudo hoje para manteres a continuidade.',
    };
  }
  if (persona === 'exigente') {
    return {
      title: streak > 0 ? `${streak} dia(s) de sequência em risco.` : 'Ainda sem estudo hoje.',
      body: 'Fecha pelo menos 25 minutos agora antes que o dia acabe.',
    };
  }
  if (persona === 'calmo') {
    return {
      title: streak > 0 ? `Mantém o ritmo suave (${streak}d)` : 'Um bloco curto já conta',
      body: '10 a 15 minutos hoje bastam para fechar o dia sem pressão.',
    };
  }
  return {
    title: streak > 0 ? `Não deixes a chama de ${streak}d apagar` : 'O Uni guardou-te 15 minutos',
    body:
      streak > 0
        ? 'Faz uma revisão rápida hoje para proteger a tua sequência.'
        : 'Passa no Plano e fecha o primeiro bloco de estudo do dia.',
  };
}

function formatSrsCopy(dueCount: number, persona: Persona, tone: AppTone): { title: string; body: string } {
  const plural = dueCount === 1 ? '1 tópico pronto' : `${dueCount} tópicos prontos`;
  if (tone === 'serio') {
    return {
      title: `Revisão espaçada: ${plural}`,
      body: 'Tópicos com revisão prevista para hoje aguardam validação.',
    };
  }
  if (persona === 'exigente') {
    return {
      title: `${plural} a expirar na memória`,
      body: 'Revê agora para não perderes retenção na curva espaçada.',
    };
  }
  if (persona === 'calmo') {
    return {
      title: `${plural} para rever ao teu ritmo`,
      body: 'Uma passada leve hoje evita acumular matéria antes dos testes.',
    };
  }
  return {
    title: `O Uni separou ${plural}`,
    body: 'Uma revisão rápida agora fixa a matéria antes de esquecer.',
  };
}

function formatAssessmentCopy(
  a: Assessment,
  courseName: string,
  pct: number,
  bucket: '72h' | '24h' | '2h',
  persona: Persona,
  tone: AppTone,
): { title: string; body: string } {
  const kind = kindLabel[a.kind] || a.kind;
  const whenLabel = bucket === '2h' ? 'daqui a 2h' : bucket === '24h' ? 'amanhã' : 'em 3 dias';
  if (tone === 'serio') {
    return {
      title: `${courseName} · ${kind} ${whenLabel}`,
      body: `${a.title}. Preparação atual estimada em ${pct}%.`,
    };
  }
  if (persona === 'exigente') {
    return {
      title: `${courseName}: ${a.title} (${whenLabel})`,
      body: `Preparação em ${pct}%. Fecha os tópicos em falta hoje.`,
    };
  }
  if (persona === 'calmo') {
    return {
      title: `${courseName} ${whenLabel} — passo a passo`,
      body: `${a.title} está com ${pct}% preparado. Faz uma revisão curta e segura.`,
    };
  }
  return {
    title: `${courseName}: ${kind} ${whenLabel}`,
    body: `${a.title} · preparação em ${pct}%. Vamos afinar os últimos pontos?`,
  };
}

function formatClassCopy(
  c: ClassSlot,
  courseName: string,
  minsBefore: number,
  tone: AppTone,
): { title: string; body: string } {
  const room = c.room ? ` · Sala ${c.room}` : '';
  if (tone === 'serio') {
    return {
      title: `Aula em ${minsBefore} min: ${courseName}`,
      body: `${c.type} às ${c.start}${room}.`,
    };
  }
  return {
    title: `${courseName} começa em ${minsBefore} min`,
    body: `${c.type} às ${c.start}${room}.`,
  };
}

function formatPostClassCopy(
  c: ClassSlot,
  courseName: string,
  persona: Persona,
  tone: AppTone,
): { title: string; body: string } {
  if (tone === 'serio') {
    return {
      title: `Registo pós-aula · ${courseName}`,
      body: `Como decorreu ${c.type} (${c.end}) e que matéria foi abordada?`,
    };
  }
  if (persona === 'exigente') {
    return {
      title: `Fim de ${c.type} de ${courseName}: o que ficou dado?`,
      body: 'Anota em 10s a matéria dada e eventuais dúvidas para alinhar o plano.',
    };
  }
  return {
    title: `Como foi a aula de ${courseName}?`,
    body: `Terminou ${c.type} às ${c.end}. Conta ao Uni que matéria deu hoje!`,
  };
}

function formatEveningCopy(persona: Persona, tone: AppTone): { title: string; body: string } {
  if (tone === 'serio') {
    return {
      title: 'Balanço diário de estudo',
      body: 'Regista como correu o dia para calibrar o plano de amanhã.',
    };
  }
  if (persona === 'calmo') {
    return {
      title: 'Como foi o teu dia hoje?',
      body: '15 segundos com o Uni para fechar o dia leve e ajustar amanhã.',
    };
  }
  return {
    title: 'Como correu o dia e o estudo hoje?',
    body: 'Regista no Diário do Uni, ganha energia no Ninho e alinha amanhã.',
  };
}

function formatSundayCopy(tone: AppTone): { title: string; body: string } {
  if (tone === 'serio') {
    return {
      title: 'Revisão semanal de domingo',
      body: 'Revê matéria compreendida, dificuldades e prioridades da próxima semana.',
    };
  }
  return {
    title: 'Balanço de domingo com o Uni',
    body: 'Como foi a semana? Alinha o que ficou pendente antes de começar segunda.',
  };
}

function formatExamPrepCopy(
  a: Assessment,
  courseName: string,
  daysLeft: number,
  tone: AppTone,
): { title: string; body: string } {
  const when = daysLeft === 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft}d`;
  if (tone === 'serio') {
    return {
      title: `Modo Teste (${courseName} · ${when})`,
      body: `Confirma até que matéria sai em "${a.title}", o que já estudaste e como te sentes.`,
    };
  }
  return {
    title: `Modo Teste: até que matéria sai em ${courseName}?`,
    body: `${a.title} (${when}) — diz ao Uni o que já estudaste e como te sentes.`,
  };
}

function startOfWeekMondayYmd(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return toLocalYmd(copy);
}

function hasLoggedPostClass(logs: StudyLogEntry[], classSlotId: string, ymd: string): boolean {
  return logs.some(
    (l) => l.kind === 'class' && l.date === ymd && l.classSlotId === classSlotId,
  );
}

function hasLoggedDay(logs: StudyLogEntry[], ymd: string): boolean {
  return logs.some((l) => l.kind === 'day' && l.date === ymd);
}

function hasLoggedWeek(logs: StudyLogEntry[], weeklyCheckIns: WeeklyCheckIn[], refDate: Date): boolean {
  const weekKey = startOfWeekMondayYmd(refDate);
  if (weeklyCheckIns.some((w) => w.weekOf >= weekKey)) return true;
  return logs.some((l) => l.kind === 'week' && l.date >= weekKey);
}

function hasRecentExamPrep(logs: StudyLogEntry[], assessmentId: string, now: Date): boolean {
  const cutoffMs = now.getTime() - 48 * 3600 * 1000;
  return logs.some(
    (l) =>
      l.kind === 'exam_prep' &&
      l.assessmentId === assessmentId &&
      new Date(l.createdAt).getTime() >= cutoffMs,
  );
}

interface CandidateNotification {
  key: string;
  kind: UniNotificationKind;
  priority: number;
  title: string;
  body: string;
  rawFireAt: Date;
  latestValidAt?: Date;
  route: string;
  courseId?: string;
}

function minutesStudiedOnDay(sessions: StudySession[], ymd: string): number {
  return sessions
    .filter((s) => s.done && s.date === ymd)
    .reduce((sum, s) => sum + sessionMinutes(s), 0);
}

function collectTopics(courses: Course[]): Topic[] {
  return courses.flatMap((c) => c.topics ?? []);
}

/**
 * Planeia notificações adaptativas respeitando consentimento, janela de silêncio e limite diário.
 * Cancela automaticamente o alerta de sequência de hoje se o estudante já tiver estudado hoje.
 */
export function planSmartNotifications(input: NotificationPlannerInput): ScheduledUniNotification[] {
  const prefs = resolveNotificationPrefs(input.settings.notifications);
  if (!prefs.enabled) return [];

  const now = input.now ? new Date(input.now.getTime()) : new Date();
  const horizonHours = input.horizonHours ?? 72;
  const horizonEnd = new Date(now.getTime() + horizonHours * 3600 * 1000);
  const todayYmd = toLocalYmd(now);
  const persona = resolvePersona(input.settings);
  const tone = resolveTone(input.settings);
  const courseMap = new Map(input.courses.map((c) => [c.id, c]));

  const candidates: CandidateNotification[] = [];

  // 1) Proteção de sequência (Streak Saver)
  if (prefs.streakSaver) {
    const minutesToday = minutesStudiedOnDay(input.sessions, todayYmd);
    const streak = studyStreak(input.sessions);

    if (minutesToday === 0) {
      const todayFire = new Date(now.getTime());
      todayFire.setHours(prefs.preferredHour, 0, 0, 0);
      if (todayFire.getTime() > now.getTime() + 60 * 1000 && todayFire.getTime() <= horizonEnd.getTime()) {
        const copy = formatStreakCopy(streak, persona, tone);
        candidates.push({
          key: `streak-${todayYmd}`,
          kind: 'streak',
          priority: 75,
          title: copy.title,
          body: copy.body,
          rawFireAt: todayFire,
          route: '/plano',
        });
      }
    }

    if (horizonHours >= 24) {
      const tomorrow = addDaysLocal(now, 1);
      const tomorrowYmd = toLocalYmd(tomorrow);
      tomorrow.setHours(prefs.preferredHour, 0, 0, 0);
      if (tomorrow.getTime() <= horizonEnd.getTime()) {
        const projectedStreak = minutesToday > 0 ? Math.max(1, streak) : streak;
        const copy = formatStreakCopy(projectedStreak, persona, tone);
        candidates.push({
          key: `streak-${tomorrowYmd}`,
          kind: 'streak',
          priority: 70,
          title: copy.title,
          body: copy.body,
          rawFireAt: tomorrow,
          route: '/plano',
        });
      }
    }
  }

  // 2) Digest de revisão espaçada (SRS)
  if (prefs.srsDue) {
    const dueCount = collectTopics(input.courses).filter((t) => isTopicReviewDue(t, todayYmd)).length;
    if (dueCount > 0) {
      const srsHour = Math.min(prefs.preferredHour, 10);
      const todayFire = new Date(now.getTime());
      todayFire.setHours(srsHour, 15, 0, 0);
      const targetFire =
        todayFire.getTime() > now.getTime() + 60 * 1000
          ? todayFire
          : addDaysLocal(todayFire, 1);

      if (targetFire.getTime() <= horizonEnd.getTime()) {
        const copy = formatSrsCopy(dueCount, persona, tone);
        candidates.push({
          key: `srs-${toLocalYmd(targetFire)}`,
          kind: 'srs',
          priority: 60,
          title: copy.title,
          body: copy.body,
          rawFireAt: targetFire,
          route: '/plano',
        });
      }
    }
  }

  // 3) Contagem decrescente de avaliações (72h, 24h, 2h)
  if (prefs.assessments) {
    // Usa o relógio de `now` (e não a data real) para decidir o que ainda está por vir.
    const upcoming = input.assessments
      .filter((a) => a.grade === undefined)
      .sort((x, y) => x.date.localeCompare(y.date));
    for (const a of upcoming) {
      const examAt = parseAssessmentDateTime(a.date);
      if (!examAt || examAt.getTime() <= now.getTime()) continue;

      const course = courseMap.get(a.courseId);
      const courseName = course?.code || course?.name || 'Cadeira';
      const pct = Math.round(readiness(a, course) * 100);

      const offsets: Array<{ bucket: '72h' | '24h' | '2h'; hoursBefore: number; priority: number }> = [
        { bucket: '2h', hoursBefore: 2, priority: 100 },
        { bucket: '24h', hoursBefore: 24, priority: 90 },
        { bucket: '72h', hoursBefore: 72, priority: 55 },
      ];

      for (const off of offsets) {
        const fire = new Date(examAt.getTime() - off.hoursBefore * 3600 * 1000);
        if (fire.getTime() <= now.getTime() + 60 * 1000 || fire.getTime() > horizonEnd.getTime()) {
          continue;
        }
        const copy = formatAssessmentCopy(a, courseName, pct, off.bucket, persona, tone);
        candidates.push({
          key: `assessment-${a.id}-${off.bucket}`,
          kind: 'assessment',
          priority: off.priority,
          title: copy.title,
          body: copy.body,
          rawFireAt: fire,
          latestValidAt: examAt,
          route: `/cadeiras/${a.courseId}`,
          courseId: a.courseId,
        });
      }
    }
  }

  // 4) Lembretes de aulas com sala
  if (prefs.classReminders) {
    const dayOffsets = [0, 1, 2];
    for (const offset of dayOffsets) {
      const dayDate = addDaysLocal(now, offset);
      const weekday = dayDate.getDay();
      const ymd = toLocalYmd(dayDate);

      for (const c of input.classes) {
        if (c.weekday !== weekday) continue;
        const startMins = parseTimeMinutes(c.start, -1);
        if (startMins < 0) continue;

        const classStart = new Date(
          dayDate.getFullYear(),
          dayDate.getMonth(),
          dayDate.getDate(),
          Math.floor(startMins / 60),
          startMins % 60,
          0,
          0,
        );
        const fireAt = new Date(classStart.getTime() - prefs.classBeforeMinutes * 60 * 1000);
        if (fireAt.getTime() <= now.getTime() + 60 * 1000 || fireAt.getTime() > horizonEnd.getTime()) {
          continue;
        }

        const course = courseMap.get(c.courseId);
        const courseName = course?.code || course?.name || 'Aula';
        const copy = formatClassCopy(c, courseName, prefs.classBeforeMinutes, tone);

        candidates.push({
          key: `class-${c.id}-${ymd}`,
          kind: 'class',
          priority: 86,
          title: copy.title,
          body: copy.body,
          rawFireAt: fireAt,
          latestValidAt: classStart,
          route: '/calendario',
          courseId: c.courseId,
        });
      }
    }
  }

  const logs = input.studyLogs ?? [];
  const checkIns = input.weeklyCheckIns ?? [];
  const hasPriorActivity =
    input.sessions.length > 0 || logs.length > 0 || checkIns.length > 0;

  // 5) Notificação pós-aula: como foi a aula e que matéria deu
  if (prefs.postClassCheckIn) {
    const delayMins = prefs.postClassDelayMinutes ?? 10;
    const dayOffsets = [0, 1, 2];
    for (const offset of dayOffsets) {
      const dayDate = addDaysLocal(now, offset);
      const weekday = dayDate.getDay();
      const ymd = toLocalYmd(dayDate);

      for (const c of input.classes) {
        if (c.weekday !== weekday) continue;
        if (offset === 0 && hasLoggedPostClass(logs, c.id, ymd)) continue;
        const endMins = parseTimeMinutes(c.end, -1);
        if (endMins < 0) continue;

        const classEnd = new Date(
          dayDate.getFullYear(),
          dayDate.getMonth(),
          dayDate.getDate(),
          Math.floor(endMins / 60),
          endMins % 60,
          0,
          0,
        );
        const fireAt = new Date(classEnd.getTime() + delayMins * 60 * 1000);
        if (fireAt.getTime() <= now.getTime() + 60 * 1000 || fireAt.getTime() > horizonEnd.getTime()) {
          continue;
        }

        const course = courseMap.get(c.courseId);
        const courseName = course?.code || course?.shortName || course?.name || 'Aula';
        const copy = formatPostClassCopy(c, courseName, persona, tone);

        candidates.push({
          key: `post-class-${c.id}-${ymd}`,
          kind: 'post_class',
          priority: 83,
          title: copy.title,
          body: copy.body,
          rawFireAt: fireAt,
          route: `/?uniLog=class&courseId=${encodeURIComponent(c.courseId)}&classSlotId=${encodeURIComponent(c.id)}`,
          courseId: c.courseId,
        });
      }
    }
  }

  // 6) Balanço do final do dia (como foi o dia e o estudo)
  if (prefs.eveningCheckIn) {
    const eveningHour = prefs.eveningHour ?? 20;
    for (const offset of [0, 1]) {
      const dayDate = addDaysLocal(now, offset);
      const ymd = toLocalYmd(dayDate);
      if (offset === 0 && hasLoggedDay(logs, ymd)) continue;

      const fireAt = new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        eveningHour,
        30,
        0,
        0,
      );
      if (fireAt.getTime() <= now.getTime() + 60 * 1000 || fireAt.getTime() > horizonEnd.getTime()) {
        continue;
      }
      const copy = formatEveningCopy(persona, tone);
      candidates.push({
        key: `evening-${ymd}`,
        kind: 'evening',
        priority: 78,
        title: copy.title,
        body: copy.body,
        rawFireAt: fireAt,
        route: '/?uniLog=day',
      });
    }
  }

  // 7) Balanço semanal de domingo (nunca no dia 1 de uma conta sem atividade prévia)
  if (prefs.sundayReview && hasPriorActivity) {
    const sundayHour = prefs.sundayHour ?? 18;
    for (const offset of [0, 1, 2]) {
      const dayDate = addDaysLocal(now, offset);
      if (dayDate.getDay() !== 0) continue;
      if (hasLoggedWeek(logs, checkIns, dayDate)) continue;

      const ymd = toLocalYmd(dayDate);
      const fireAt = new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        sundayHour,
        30,
        0,
        0,
      );
      if (fireAt.getTime() <= now.getTime() + 60 * 1000 || fireAt.getTime() > horizonEnd.getTime()) {
        continue;
      }
      const copy = formatSundayCopy(tone);
      candidates.push({
        key: `sunday-${ymd}`,
        kind: 'sunday',
        priority: 82,
        title: copy.title,
        body: copy.body,
        rawFireAt: fireAt,
        route: '/?uniLog=week',
      });
    }
  }

  // 8) Modo Teste (< 10 dias): perguntar até que matéria sai, o que já estudou e como se sente
  if (prefs.examPrepCheckIn) {
    const urgent = input.assessments
      .filter((a) => {
        if (a.grade !== undefined) return false;
        const examAt = parseAssessmentDateTime(a.date);
        if (!examAt || examAt.getTime() <= now.getTime()) return false;
        const days = calendarDaysUntilDate(examAt, now);
        return days >= 0 && days <= 10;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const targetAssessment = urgent.find(
      (a) => a.topicIds.length === 0 || !hasRecentExamPrep(logs, a.id, now),
    );
    if (targetAssessment) {
      const examAt = parseAssessmentDateTime(targetAssessment.date);
      const candidateTime = new Date(now.getTime() + 2 * 3600 * 1000);
      if (
        candidateTime.getTime() <= horizonEnd.getTime() &&
        (!examAt || candidateTime.getTime() < examAt.getTime() - 3 * 3600 * 1000)
      ) {
        const course = courseMap.get(targetAssessment.courseId);
        const courseName = course?.code || course?.shortName || course?.name || 'Cadeira';
        const daysLeft = examAt ? Math.max(0, calendarDaysUntilDate(examAt, now)) : 0;
        const copy = formatExamPrepCopy(targetAssessment, courseName, daysLeft, tone);
        candidates.push({
          key: `exam-prep-${targetAssessment.id}-${todayYmd}`,
          kind: 'exam_prep',
          priority: 88,
          title: copy.title,
          body: copy.body,
          rawFireAt: candidateTime,
          ...(examAt ? { latestValidAt: examAt } : {}),
          route: `/?uniLog=exam_prep&assessmentId=${encodeURIComponent(targetAssessment.id)}&courseId=${encodeURIComponent(targetAssessment.courseId)}`,
          courseId: targetAssessment.courseId,
        });
      }
    }
  }

  // Aplicar janela de silêncio e descartar avisos que expirariam após o evento real
  const clamped: Array<CandidateNotification & { fireAtDate: Date }> = [];
  for (const item of candidates) {
    const adjusted = clampOutOfQuietHours(item.rawFireAt, prefs);
    if (item.latestValidAt && adjusted.getTime() >= item.latestValidAt.getTime()) {
      continue;
    }
    if (adjusted.getTime() <= now.getTime() + 30 * 1000 || adjusted.getTime() > horizonEnd.getTime()) {
      continue;
    }
    clamped.push({ ...item, fireAtDate: adjusted });
  }

  // Orçamento diário (maxDailyNudges): mantém os mais urgentes por dia
  const byDay = new Map<string, Array<CandidateNotification & { fireAtDate: Date }>>();
  for (const item of clamped) {
    const dayKey = toLocalYmd(item.fireAtDate);
    const list = byDay.get(dayKey) ?? [];
    list.push(item);
    byDay.set(dayKey, list);
  }

  const selected: ScheduledUniNotification[] = [];
  for (const [, dayItems] of byDay) {
    dayItems.sort((a, b) => b.priority - a.priority || a.fireAtDate.getTime() - b.fireAtDate.getTime());
    for (const item of dayItems.slice(0, prefs.maxDailyNudges)) {
      selected.push({
        id: stableNotificationId(item.key),
        key: item.key,
        kind: item.kind,
        title: item.title,
        body: item.body,
        fireAt: item.fireAtDate.toISOString(),
        route: item.route,
        courseId: item.courseId,
      });
    }
  }

  selected.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  return selected;
}

/** Constrói uma notificação realista imediata para o botão "Testar notificação agora". */
export function buildSampleUniNotification(input: NotificationPlannerInput): ScheduledUniNotification {
  const persona = resolvePersona(input.settings);
  const tone = resolveTone(input.settings);
  const courseMap = new Map(input.courses.map((c) => [c.id, c]));
  const nextAssessment = upcomingAssessments(input.assessments)[0];

  if (nextAssessment) {
    const course = courseMap.get(nextAssessment.courseId);
    const courseName = course?.code || course?.name || 'Cadeira';
    const pct = Math.round(readiness(nextAssessment, course) * 100);
    const days = Math.max(0, daysUntil(nextAssessment.date));
    const bucket: '72h' | '24h' | '2h' = days <= 1 ? '24h' : '72h';
    const copy = formatAssessmentCopy(nextAssessment, courseName, pct, bucket, persona, tone);
    return {
      id: 999901,
      key: 'sample-assessment',
      kind: 'assessment',
      title: copy.title,
      body: copy.body,
      fireAt: new Date().toISOString(),
      route: `/cadeiras/${nextAssessment.courseId}`,
      courseId: nextAssessment.courseId,
    };
  }

  const firstClass = input.classes[0];
  if (firstClass) {
    const course = courseMap.get(firstClass.courseId);
    const courseName = course?.code || course?.name || 'Cadeira';
    const dayName = weekdayLong[firstClass.weekday] || 'Próxima aula';
    const copy = formatClassCopy(firstClass, `${courseName} (${dayName})`, 15, tone);
    return {
      id: 999902,
      key: 'sample-class',
      kind: 'class',
      title: copy.title,
      body: copy.body,
      fireAt: new Date().toISOString(),
      route: '/calendario',
      courseId: firstClass.courseId,
    };
  }

  const streak = Math.max(1, studyStreak(input.sessions));
  const copy = formatStreakCopy(streak, persona, tone);
  return {
    id: 999903,
    key: 'sample-streak',
    kind: 'streak',
    title: copy.title,
    body: copy.body,
    fireAt: new Date().toISOString(),
    route: '/plano',
  };
}

/** Escolhe no máximo 1 lembrete discreto dentro da app para o ecrã Hoje (sem duplicar o alerta de testes). */
export function pickActiveInAppNudge(input: NotificationPlannerInput): InAppUniNudge | null {
  const prefs = resolveNotificationPrefs(input.settings.notifications);
  const now = input.now ? new Date(input.now.getTime()) : new Date();
  const todayYmd = toLocalYmd(now);
  const persona = resolvePersona(input.settings);
  const tone = resolveTone(input.settings);
  const courseMap = new Map(input.courses.map((c) => [c.id, c]));
  const logs = input.studyLogs ?? [];
  const checkIns = input.weeklyCheckIns ?? [];
  const hasPriorActivity =
    input.sessions.length > 0 || logs.length > 0 || checkIns.length > 0;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const weekday = now.getDay();

  // 1) Aula a começar nos próximos 60 minutos
  if (prefs.classReminders) {
    for (const cl of input.classes) {
      if (cl.weekday !== weekday) continue;
      const startMins = parseTimeMinutes(cl.start, -1);
      const diff = startMins - nowMins;
      if (diff >= 5 && diff <= 60) {
        const course = courseMap.get(cl.courseId);
        const courseName = course?.code || course?.name || 'Aula';
        const copy = formatClassCopy(cl, courseName, diff, tone);
        return {
          key: `inapp-class-${cl.id}-${todayYmd}`,
          kind: 'class',
          title: copy.title,
          body: copy.body,
          ctaLabel: 'Ver calendário',
          route: '/calendario',
        };
      }
    }
  }

  // 2) Pergunta pós-aula se terminou nos últimos 180 minutos e ainda não foi registada
  if (prefs.postClassCheckIn) {
    for (const cl of input.classes) {
      if (cl.weekday !== weekday) continue;
      if (hasLoggedPostClass(logs, cl.id, todayYmd)) continue;
      const endMins = parseTimeMinutes(cl.end, -1);
      const minsSinceEnd = nowMins - endMins;
      const delay = prefs.postClassDelayMinutes ?? 10;
      if (endMins >= 0 && minsSinceEnd >= delay && minsSinceEnd <= 180) {
        const course = courseMap.get(cl.courseId);
        const courseName = course?.code || course?.shortName || course?.name || 'Aula';
        const copy = formatPostClassCopy(cl, courseName, persona, tone);
        return {
          key: `inapp-postclass-${cl.id}-${todayYmd}`,
          kind: 'post_class',
          title: copy.title,
          body: copy.body,
          ctaLabel: 'Registar aula',
          route: `/?uniLog=class&courseId=${encodeURIComponent(cl.courseId)}&classSlotId=${encodeURIComponent(cl.id)}`,
        };
      }
    }
  }

  // 3) Modo Teste: alinhar até que matéria sai, o que já estudou e como se sente
  if (prefs.examPrepCheckIn) {
    const urgent = input.assessments
      .filter((a) => {
        if (a.grade !== undefined) return false;
        const examAt = parseAssessmentDateTime(a.date);
        if (!examAt || examAt.getTime() < now.getTime()) return false;
        const d = calendarDaysUntilDate(examAt, now);
        return d >= 0 && d <= 10;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const needsPrep = urgent.find(
      (a) => a.topicIds.length === 0 || !hasRecentExamPrep(logs, a.id, now),
    );
    if (needsPrep) {
      const course = courseMap.get(needsPrep.courseId);
      const courseName = course?.code || course?.shortName || course?.name || 'Cadeira';
      const examAt = parseAssessmentDateTime(needsPrep.date);
      const daysLeft = examAt ? Math.max(0, calendarDaysUntilDate(examAt, now)) : 0;
      const copy = formatExamPrepCopy(needsPrep, courseName, daysLeft, tone);
      return {
        key: `inapp-examprep-${needsPrep.id}-${todayYmd}`,
        kind: 'exam_prep',
        title: copy.title,
        body: copy.body,
        ctaLabel: 'Alinhar matéria',
        route: `/?uniLog=exam_prep&assessmentId=${encodeURIComponent(needsPrep.id)}&courseId=${encodeURIComponent(needsPrep.courseId)}`,
      };
    }
  }

  // 4) Balanço semanal de domingo (apenas quando já existe atividade prévia do aluno)
  if (prefs.sundayReview && hasPriorActivity && weekday === 0 && now.getHours() >= 15 && !hasLoggedWeek(logs, checkIns, now)) {
    const copy = formatSundayCopy(tone);
    return {
      key: `inapp-sunday-${todayYmd}`,
      kind: 'sunday',
      title: copy.title,
      body: copy.body,
      ctaLabel: 'Balanço semanal',
      route: '/?uniLog=week',
    };
  }

  // 5) Check-in de fim do dia
  if (prefs.eveningCheckIn && now.getHours() >= (prefs.eveningHour ?? 20) && !hasLoggedDay(logs, todayYmd)) {
    const copy = formatEveningCopy(persona, tone);
    return {
      key: `inapp-evening-${todayYmd}`,
      kind: 'evening',
      title: copy.title,
      body: copy.body,
      ctaLabel: 'Fechar o dia',
      route: '/?uniLog=day',
    };
  }

  // 6) Sequência em risco se já passou das 15h sem estudo concluído hoje
  const streak = studyStreak(input.sessions);
  const minutesToday = minutesStudiedOnDay(input.sessions, todayYmd);
  if (prefs.streakSaver && streak >= 2 && minutesToday === 0 && now.getHours() >= 15) {
    const copy = formatStreakCopy(streak, persona, tone);
    return {
      key: `inapp-streak-${todayYmd}`,
      kind: 'streak',
      title: copy.title,
      body: copy.body,
      ctaLabel: 'Estudar agora',
      route: '/plano',
    };
  }

  // 7) Revisões espaçadas (SRS) em atraso ou para hoje
  const dueCount = collectTopics(input.courses).filter((t) => isTopicReviewDue(t, todayYmd)).length;
  if (prefs.srsDue && dueCount >= 1) {
    const copy = formatSrsCopy(dueCount, persona, tone);
    return {
      key: `inapp-srs-${todayYmd}`,
      kind: 'srs',
      title: copy.title,
      body: copy.body,
      ctaLabel: 'Abrir revisões',
      route: '/plano',
    };
  }

  return null;
}
