import type { StudySession } from '../../types';

export const COMPACT_WEEK_MAX_BLOCKS = 6;

function parseHhMmToMinutes(start?: string): number | null {
  if (!start) return null;
  const m = start.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface CompactDayWindow {
  visible: StudySession[];
  extraCount: number;
  rolledOffCount: number;
  allPassedToday: boolean;
}

/**
 * Seleciona até `limit` (6 por omissão) blocos para cada coluna semanal desktop.
 * Em `isToday`, blocos concluídos ou cujo horário de fim já passou saem da lista
 * compacta para que os próximos subam; todos os blocos mantêm-se na aba do dia.
 */
export function selectCompactDaySessions(
  sessions: StudySession[],
  opts: { isToday: boolean; nowMinutes: number; limit?: number },
): CompactDayWindow {
  const limit = opts.limit ?? COMPACT_WEEK_MAX_BLOCKS;
  if (!opts.isToday) {
    const visible = sessions.slice(0, limit);
    return {
      visible,
      extraCount: Math.max(0, sessions.length - visible.length),
      rolledOffCount: 0,
      allPassedToday: false,
    };
  }

  const upcoming = sessions.filter((s) => {
    if (s.done) return false;
    const startMin = parseHhMmToMinutes(s.start);
    if (startMin === null) return true;
    return startMin + s.minutes > opts.nowMinutes;
  });

  const rolledOffCount = sessions.length - upcoming.length;
  const visible = upcoming.slice(0, limit);
  return {
    visible,
    extraCount: Math.max(0, upcoming.length - visible.length),
    rolledOffCount,
    allPassedToday: sessions.length > 0 && upcoming.length === 0,
  };
}
