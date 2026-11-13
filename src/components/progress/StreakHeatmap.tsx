import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Fragment, useMemo } from 'react';
import { fmtMinutes, studyStreak } from '../../lib/selectors';
import type { StudySession } from '../../types';
import { ChartCard } from './ChartCard';
import { cx } from '../ui';
import { heatmap, plural } from './data';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
/** Opacidade de cada um dos 5 degraus (0 = sem estudo, usa surface-2). */
const STEP_OPACITY = [0, 0.25, 0.45, 0.7, 1];

interface Props {
  sessions: StudySession[];
  now: Date;
}

/** "Constância" — mapa de calor das últimas 12 semanas, segunda a domingo. */
export function StreakHeatmap({ sessions, now }: Props) {
  const map = useMemo(() => heatmap(sessions, now, 12), [sessions, now]);
  const streak = useMemo(() => studyStreak(sessions), [sessions]);

  const levelOf = (minutes: number) =>
    minutes <= 0 || map.max <= 0 ? 0 : 1 + Math.min(3, Math.floor((minutes / map.max) * 4));

  return (
    <ChartCard
      title="Constância"
      isEmpty={map.activeDays === 0}
      emptyTitle="Ainda sem estudo registado"
      emptyHint="Cada dia com sessões concluídas aparece aqui."
      takeaway={
        <>
          Sequência atual: <span className="tabular">{plural(streak, 'dia', 'dias')}</span> ·{' '}
          <span className="tabular">{plural(map.activeDays, 'dia ativo', 'dias ativos')}</span> nas últimas 12 semanas
        </>
      }
    >
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: 'auto repeat(12, minmax(0, 1fr))' }}>
        {WEEKDAYS.map((label, d) => (
          <Fragment key={label}>
            <span className="pr-1 text-right text-[11px] leading-none tabular text-muted">{label}</span>
            {map.columns.map((column, w) => {
              const cell = column[d];
              const level = levelOf(cell.minutes);
              const title = `${format(parseISO(cell.date), 'EEE d MMM', { locale: pt })} · ${
                cell.minutes > 0 ? fmtMinutes(cell.minutes) : 'sem estudo'}`;
              return (
                <div
                  key={`${w}-${d}`}
                  title={cell.future ? undefined : title}
                  aria-label={cell.future ? undefined : title}
                  className={cx(
                    'aspect-square rounded-full transition-transform hover:scale-110',
                    cell.future ? 'bg-transparent' : level === 0 ? 'bg-surface-2' : 'bg-accent',
                  )}
                  style={cell.future || level === 0 ? undefined : { opacity: STEP_OPACITY[level] }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
        <span>menos</span>
        {STEP_OPACITY.map((opacity, i) => (
          <span
            key={i}
            className={cx('size-3 rounded-full', i === 0 ? 'bg-surface-2' : 'bg-accent')}
            style={i === 0 ? undefined : { opacity }}
          />
        ))}
        <span>mais</span>
      </div>
    </ChartCard>
  );
}
