import { studyStreak } from './selectors';
import type { Course, StudySession, WeeklyCheckIn } from '../types';

export type UniSkinId = 'classic' | 'crimson' | 'butter' | 'sage' | 'ink';

export interface UniSkinMeta {
  id: UniSkinId;
  name: string;
  tagline: string;
  unlockHint: string;
  swatchHex: string;
  badgeText: string;
}

export const UNI_SKINS: UniSkinMeta[] = [
  {
    id: 'classic',
    name: 'Uni Clássico',
    tagline: 'Papel salva e marcador coral de origem',
    unlockHint: 'Disponível desde o primeiro dia',
    swatchHex: '#C9DC9F',
    badgeText: 'Base',
  },
  {
    id: 'crimson',
    name: 'Uni Vermelho Coral',
    tagline: 'Edição viva com marcador creme — marca de ritmo aceso',
    unlockHint: 'Conclui 3 blocos com recall ativo ou 3 dias seguidos',
    swatchHex: '#E04F33',
    badgeText: 'Ritmo',
  },
  {
    id: 'butter',
    name: 'Uni Manteiga',
    tagline: 'Tom de post-it luminoso para planeamento semanal',
    unlockHint: 'Faz 1 Check-in Semanal e 5 sessões de estudo',
    swatchHex: '#FCE99F',
    badgeText: 'Plano',
  },
  {
    id: 'sage',
    name: 'Uni Botânico SRS',
    tagline: 'Menta de revisão espaçada — memória de longo prazo',
    unlockHint: 'Completa 5 revisões de recall ativo em tópicos',
    swatchHex: '#9EE5C9',
    badgeText: 'Memória',
  },
  {
    id: 'ink',
    name: 'Uni Noturno',
    tagline: 'Edição escura dourada para domínio completo',
    unlockHint: 'Alcança 1 tópico em nível 21d (ou 7 dias seguidos)',
    swatchHex: '#24221F',
    badgeText: 'Mestre',
  },
];

export interface UniCollectibleProgress {
  skin: UniSkinMeta;
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
}

export function readCollectibleTelemetry(
  sessions: StudySession[],
  courses: Course[],
  weeklyCheckIns: WeeklyCheckIn[],
): CollectibleTelemetry {
  const completedSessions = sessions.filter((s) => s.done).length;
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
  };
}

/** Calcula o estado e progresso real de desbloqueio de cada colecionável do Uni. */
export function getUniCollectibleStates(telemetry: CollectibleTelemetry): UniCollectibleProgress[] {
  const { completedSessions, totalRecalls, streakDays, checkInsCount, mastered21dCount } = telemetry;

  return UNI_SKINS.map((skin) => {
    if (skin.id === 'classic') {
      return { skin, unlocked: true, progressCurrent: 1, progressTarget: 1, progressLabel: 'Desbloqueado' };
    }
    if (skin.id === 'crimson') {
      const unlocked = totalRecalls >= 3 || streakDays >= 3;
      const cur = Math.min(3, Math.max(totalRecalls, streakDays));
      return {
        skin,
        unlocked,
        progressCurrent: cur,
        progressTarget: 3,
        progressLabel: unlocked ? 'Desbloqueado' : `${cur}/3 recalls ou dias`,
      };
    }
    if (skin.id === 'butter') {
      const unlocked = checkInsCount >= 1 && completedSessions >= 5;
      const cur = (checkInsCount >= 1 ? 1 : 0) + Math.min(5, completedSessions);
      return {
        skin,
        unlocked,
        progressCurrent: cur,
        progressTarget: 6,
        progressLabel: unlocked ? 'Desbloqueado' : `${completedSessions}/5 sessões · ${checkInsCount}/1 check-in`,
      };
    }
    if (skin.id === 'sage') {
      const unlocked = totalRecalls >= 5;
      const cur = Math.min(5, totalRecalls);
      return {
        skin,
        unlocked,
        progressCurrent: cur,
        progressTarget: 5,
        progressLabel: unlocked ? 'Desbloqueado' : `${cur}/5 recalls ativos`,
      };
    }
    // 'ink'
    const unlocked = mastered21dCount >= 1 || streakDays >= 7 || completedSessions >= 10;
    const cur = mastered21dCount >= 1 ? 7 : Math.min(7, Math.max(streakDays, Math.round((completedSessions / 10) * 7)));
    return {
      skin,
      unlocked,
      progressCurrent: cur,
      progressTarget: 7,
      progressLabel: unlocked ? 'Desbloqueado' : `${streakDays}/7 dias ou nível SRS 21d`,
    };
  });
}
