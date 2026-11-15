import { sessionMinutes, studyStreak } from './selectors';
import type {
  Course,
  StudyLogEntry,
  StudySession,
  Task,
  UniPetId,
  UniSkinId,
  WeeklyCheckIn,
} from '../types';

export type { UniPetId, UniSkinId };

export interface UniSkinMeta {
  id: UniSkinId;
  name: string;
  tagline: string;
  unlockHint: string;
  swatchHex: string;
  badgeText: string;
  starter?: boolean;
}

export const UNI_SKINS: UniSkinMeta[] = [
  {
    id: 'classic',
    name: 'Uni Salva Clássica',
    tagline: 'Papel salva e marcador coral de origem',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#C9DC9F',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'sky',
    name: 'Uni Céu de Abril',
    tagline: 'Azul claro de manhã tranquila de biblioteca',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#C4E0FD',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'peach',
    name: 'Uni Pêssego Caderno',
    tagline: 'Tom pêssego quente para leituras leves',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#FAD6BA',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'blush',
    name: 'Uni Rosa Papelaria',
    tagline: 'Nota adesiva rosada de rascunho gentil',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#F9C5BE',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'mint',
    name: 'Uni Menta Suave',
    tagline: 'Verde-água calmo para resumos e fichas',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#BCEEE0',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'cream',
    name: 'Uni Papel Creme',
    tagline: 'Papel de algodão minimalista com tinta nítida',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#EFE6D5',
    badgeText: 'Inicial',
    starter: true,
  },
  {
    id: 'butter',
    name: 'Uni Manteiga Solar',
    tagline: 'Tom de post-it luminoso para semanas bem planeadas',
    unlockHint: 'Faz 1 Check-in Semanal ou 3 sessões de estudo',
    swatchHex: '#FCE99F',
    badgeText: 'Plano',
  },
  {
    id: 'crimson',
    name: 'Uni Coral Vivo',
    tagline: 'Edição viva com marcador creme — marca de ritmo aceso',
    unlockHint: 'Conclui 3 recalls ativos ou 3 dias seguidos',
    swatchHex: '#EF6249',
    badgeText: 'Ritmo',
  },
  {
    id: 'sage',
    name: 'Uni Botânico SRS',
    tagline: 'Esmeralda botânica de revisão espaçada',
    unlockHint: 'Completa 5 revisões de recall ativo em tópicos',
    swatchHex: '#74C69D',
    badgeText: 'Memória',
  },
  {
    id: 'terracotta',
    name: 'Uni Terracota FCT',
    tagline: 'Barro quente de fim de tarde no campus',
    unlockHint: 'Conclui 6 sessões de estudo',
    swatchHex: '#D97757',
    badgeText: 'Constância',
  },
  {
    id: 'espresso',
    name: 'Uni Café de Estudo',
    tagline: 'Castanho expresso para longas horas focadas',
    unlockHint: 'Acumula 150 minutos de estudo concluídos',
    swatchHex: '#8D6E63',
    badgeText: 'Foco',
  },
  {
    id: 'ink',
    name: 'Uni Noturno Dourado',
    tagline: 'Edição escura dourada para domínio completo',
    unlockHint: 'Alcança 1 tópico em nível 21d (ou 7 dias seguidos)',
    swatchHex: '#24221F',
    badgeText: 'Mestre',
  },
];

export interface UniPetMeta {
  id: Exclude<UniPetId, 'none'>;
  name: string;
  species: string;
  tagline: string;
  unlockHint: string;
  accentHex: string;
  starter?: boolean;
}

export const UNI_PETS: UniPetMeta[] = [
  {
    id: 'cat',
    name: 'Miau',
    species: 'Gatinho de Tinta',
    tagline: 'Enrola-se perto do caderno enquanto organizas ideias',
    unlockHint: 'Disponível desde o primeiro dia',
    accentHex: '#FAD6BA',
    starter: true,
  },
  {
    id: 'owl',
    name: 'Pio',
    species: 'Mochinho da Sebenta',
    tagline: 'Adora revisões rápidas e apontamentos bem resumidos',
    unlockHint: 'Completa 2 sessões ou 2 recalls ativos',
    accentHex: '#D97757',
  },
  {
    id: 'fox',
    name: 'Kiko',
    species: 'Raposa Origami',
    tagline: 'Salta alegre entre prazos sem deixar acumular matéria',
    unlockHint: 'Mantém 3 dias seguidos ou 4 sessões',
    accentHex: '#E04F33',
  },
  {
    id: 'turtle',
    name: 'Tuga',
    species: 'Tartaruga Pomodoro',
    tagline: 'Carapaça de papel firme para ritmo constante sem pressa',
    unlockHint: 'Conclui 5 sessões de estudo',
    accentHex: '#157F58',
  },
  {
    id: 'rabbit',
    name: 'Lino',
    species: 'Coelhinho de Post-it',
    tagline: 'Saltita em blocos curtos quando dominas os tópicos',
    unlockHint: 'Conclui 8 sessões ou 1 tópico nível 21d',
    accentHex: '#FCE99F',
  },
];

export interface UniCollectibleProgress {
  skin: UniSkinMeta;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string;
}

export interface UniPetProgress {
  pet: UniPetMeta;
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressLabel: string;
}

export interface CollectibleTelemetry {
  completedSessions: number;
  totalRecalls: number;
  streakDays: number;
  checkInsCount: number;
  mastered21dCount: number;
  totalStudyMinutes?: number;
}

export function readCollectibleTelemetry(
  sessions: StudySession[],
  courses: Course[],
  weeklyCheckIns: WeeklyCheckIn[],
): CollectibleTelemetry {
  const doneSessions = sessions.filter((s) => s.done);
  const completedSessions = doneSessions.length;
  const totalStudyMinutes = doneSessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const topics = courses.flatMap((c) => c.topics);
  const totalRecalls = topics.reduce((sum, t) => sum + (t.recallCount ?? 0), 0);
  const mastered21dCount = topics.filter((t) => (t.srsIntervalDays ?? 0) >= 21).length;
  const streakDays = studyStreak(sessions);
  return {
    completedSessions,
    totalRecalls,
    streakDays,
    checkInsCount: weeklyCheckIns.length,
    mastered21dCount,
    totalStudyMinutes,
  };
}

function makeProgress(
  current: number,
  target: number,
  unlocked: boolean,
  lockedText: string,
): { unlocked: boolean; progressCurrent: number; progressTarget: number; progressLabel: string } {
  const bounded = unlocked ? target : Math.min(target, Math.max(0, current));
  return {
    unlocked,
    progressCurrent: bounded,
    progressTarget: target,
    progressLabel: unlocked ? 'Desbloqueado' : lockedText,
  };
}

/** Calcula o estado e progresso real de desbloqueio de cada cor colecionável do Uni. */
export function getUniCollectibleStates(telemetry: CollectibleTelemetry): UniCollectibleProgress[] {
  const {
    completedSessions,
    totalRecalls,
    streakDays,
    checkInsCount,
    mastered21dCount,
    totalStudyMinutes = completedSessions * 45,
  } = telemetry;

  return UNI_SKINS.map((skin) => {
    if (skin.starter) {
      return { skin, ...makeProgress(1, 1, true, 'Desbloqueado') };
    }
    if (skin.id === 'butter') {
      const unlocked = checkInsCount >= 1 || completedSessions >= 3;
      const cur = Math.max(checkInsCount >= 1 ? 3 : 0, Math.min(3, completedSessions));
      return { skin, ...makeProgress(cur, 3, unlocked, `${completedSessions}/3 sessões ou 1 check-in`) };
    }
    if (skin.id === 'crimson') {
      const unlocked = totalRecalls >= 3 || streakDays >= 3;
      const cur = Math.max(totalRecalls, streakDays);
      return { skin, ...makeProgress(cur, 3, unlocked, `${Math.min(3, cur)}/3 recalls ou dias`) };
    }
    if (skin.id === 'sage') {
      const unlocked = totalRecalls >= 5;
      return { skin, ...makeProgress(totalRecalls, 5, unlocked, `${Math.min(5, totalRecalls)}/5 recalls ativos`) };
    }
    if (skin.id === 'terracotta') {
      const unlocked = completedSessions >= 6;
      return { skin, ...makeProgress(completedSessions, 6, unlocked, `${Math.min(6, completedSessions)}/6 sessões`) };
    }
    if (skin.id === 'espresso') {
      const unlocked = totalStudyMinutes >= 150;
      return {
        skin,
        ...makeProgress(totalStudyMinutes, 150, unlocked, `${Math.min(150, totalStudyMinutes)}/150 min`),
      };
    }
    // 'ink'
    const unlocked = mastered21dCount >= 1 || streakDays >= 7 || completedSessions >= 10;
    const cur = mastered21dCount >= 1 ? 7 : Math.max(streakDays, Math.round((completedSessions / 10) * 7));
    return { skin, ...makeProgress(cur, 7, unlocked, `${streakDays}/7 dias ou nível SRS 21d`) };
  });
}

/** Calcula o desbloqueio de cada Micropet companheiro do Uni. */
export function getUniPetStates(telemetry: CollectibleTelemetry): UniPetProgress[] {
  const { completedSessions, totalRecalls, streakDays, mastered21dCount } = telemetry;
  return UNI_PETS.map((pet) => {
    if (pet.starter) {
      return { pet, ...makeProgress(1, 1, true, 'Desbloqueado') };
    }
    if (pet.id === 'owl') {
      const unlocked = completedSessions >= 2 || totalRecalls >= 2;
      const cur = Math.max(completedSessions, totalRecalls);
      return { pet, ...makeProgress(cur, 2, unlocked, `${Math.min(2, cur)}/2 sessões ou recalls`) };
    }
    if (pet.id === 'fox') {
      const unlocked = streakDays >= 3 || completedSessions >= 4;
      const cur = Math.max(streakDays, Math.round((completedSessions / 4) * 3));
      return { pet, ...makeProgress(cur, 3, unlocked, `${Math.min(3, streakDays)}/3 dias seguidos`) };
    }
    if (pet.id === 'turtle') {
      const unlocked = completedSessions >= 5;
      return { pet, ...makeProgress(completedSessions, 5, unlocked, `${Math.min(5, completedSessions)}/5 sessões`) };
    }
    // 'rabbit'
    const unlocked = completedSessions >= 8 || mastered21dCount >= 1;
    const cur = mastered21dCount >= 1 ? 8 : completedSessions;
    return { pet, ...makeProgress(cur, 8, unlocked, `${Math.min(8, cur)}/8 sessões`) };
  });
}

// ---------- Sistema Companheiro estilo Finch (Energia Diária, Crescimento, Carinho & Descoberta) ----------

export type UniGrowthStageId = 'semente' | 'explorador' | 'estudioso' | 'sabio';

export interface UniGrowthStage {
  id: UniGrowthStageId;
  label: string;
  nextLabel?: string;
  minutesRequired: number;
  nextMinutesRequired?: number;
}

export interface UniCompanionState {
  stage: UniGrowthStage;
  totalStudyMinutes: number;
  dailyEnergy: number;
  dailyEnergyGoal: number;
  adventureDone: boolean;
  dailyHugs: number;
  maxDailyHugs: number;
  discoveryNote?: string;
}

export const DAILY_ENERGY_GOAL = 40;
export const MAX_DAILY_HUGS = 3;
const CARE_STORAGE_KEY = 'uni-companion-care-v1';

const CAMPUS_DISCOVERIES = [
  'Encontrou uma mesa ao sol perto da biblioteca com tomada livre!',
  'Observou uma família de pardais no jardim entre aulas.',
  'Guardou um marcador amarelo novo para a tua próxima ficha.',
  'Descobriu um atalho silencioso para os apontamentos da semana.',
  'Anotou três fórmulas difíceis num post-it bem arrumado.',
  'Celebrou o teu ritmo com uma chávena imaginária de chá de menta.',
];

export function readDailyPetCareCount(todayKey: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(CARE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date?: string; hugs?: number };
    if (parsed.date !== todayKey || typeof parsed.hugs !== 'number') return 0;
    return Math.max(0, Math.min(MAX_DAILY_HUGS, parsed.hugs));
  } catch {
    return 0;
  }
}

export function recordUniPetCare(todayKey: string): number {
  const next = Math.min(MAX_DAILY_HUGS, readDailyPetCareCount(todayKey) + 1);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify({ date: todayKey, hugs: next }));
    } catch {
      // ignora quota
    }
  }
  return next;
}

export function computeGrowthStage(totalStudyMinutes: number): UniGrowthStage {
  if (totalStudyMinutes >= 900) {
    return { id: 'sabio', label: 'Sábio do Campus', minutesRequired: 900 };
  }
  if (totalStudyMinutes >= 360) {
    return {
      id: 'estudioso',
      label: 'Estudioso',
      nextLabel: 'Sábio do Campus',
      minutesRequired: 360,
      nextMinutesRequired: 900,
    };
  }
  if (totalStudyMinutes >= 120) {
    return {
      id: 'explorador',
      label: 'Explorador',
      nextLabel: 'Estudioso',
      minutesRequired: 120,
      nextMinutesRequired: 360,
    };
  }
  return {
    id: 'semente',
    label: 'Semente',
    nextLabel: 'Explorador',
    minutesRequired: 0,
    nextMinutesRequired: 120,
  };
}

export function computeUniCompanionState(args: {
  sessions: StudySession[];
  tasks: Task[];
  weeklyCheckIns: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  today: string;
  dailyHugs?: number;
}): UniCompanionState {
  const { sessions, tasks, weeklyCheckIns, today } = args;
  const doneSessions = sessions.filter((s) => s.done);
  const totalStudyMinutes = doneSessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
  const doneTodaySessions = doneSessions.filter((s) => s.date === today).length;
  const doneTodayTasks = tasks.filter(
    (t) => t.done && (!t.due || t.due === today),
  ).length;
  const hasTodayCheckIn = weeklyCheckIns.some((w) => w.createdAt.slice(0, 10) === today);
  const todayLogsCount = (args.studyLogs ?? []).filter((l) => l.date === today).length;
  const dailyHugs = Math.max(0, Math.min(MAX_DAILY_HUGS, args.dailyHugs ?? readDailyPetCareCount(today)));

  const rawEnergy =
    doneTodaySessions * 20 +
    Math.min(2, doneTodayTasks) * 8 +
    (hasTodayCheckIn ? 10 : 0) +
    Math.min(3, todayLogsCount) * 4 +
    dailyHugs * 3;
  const dailyEnergy = Math.min(DAILY_ENERGY_GOAL, rawEnergy);
  const adventureDone = dailyEnergy >= DAILY_ENERGY_GOAL;

  const dayHash = today.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const discoveryNote = adventureDone
    ? CAMPUS_DISCOVERIES[dayHash % CAMPUS_DISCOVERIES.length]
    : undefined;

  return {
    stage: computeGrowthStage(totalStudyMinutes),
    totalStudyMinutes,
    dailyEnergy,
    dailyEnergyGoal: DAILY_ENERGY_GOAL,
    adventureDone,
    dailyHugs,
    maxDailyHugs: MAX_DAILY_HUGS,
    discoveryNote,
  };
}
