import { format, parseISO } from 'date-fns';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDateFnsLocale } from '../../lib/grading';
import { fmtMinutes, studyStreak } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { StudySession } from '../../types';
import { ChartCard } from './ChartCard';
import { heatmap, plural } from './data';

/** Segunda (1) a domingo (0), matching common:labels.weekdayShort.0..6 */
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0] as const;
/** Opacidade de cada um dos 5 degraus (0 = sem estudo, usa surface-2). */
const STEP_OPACITY = [0, 0.25, 0.45, 0.7, 1];

interface Props {
  sessions: StudySession[];
  now: Date;
}

/** "Constância" — mapa de calor das últimas 12 semanas, segunda a domingo. */
export function StreakHeatmap({ sessions, now }: Props) {
  const { t, i18n } = useTranslation(['progress', 'common']);
  const dateLocale = resolveDateFnsLocale(i18n.language);
  const map = useMemo(() => heatmap(sessions, now, 12), [sessions, now]);
  const streak = useMemo(() => studyStreak(sessions), [sessions]);

  const levelOf = (minutes: number) =>
    minutes <= 0 || map.max <= 0 ? 0 : 1 + Math.min(3, Math.floor((minutes / map.max) * 4));

  const streakLabel = plural(
    streak,
    t('progress:charts.plural.dayOne'),
    t('progress:charts.plural.dayMany'),
  );
  const activeLabel = plural(
    map.activeDays,
    t('progress:charts.plural.activeDayOne'),
    t('progress:charts.plural.activeDayMany'),
  );

  return (
    <ChartCard
      tone="butter"
      title={t('progress:charts.streakHeatmap.title')}
      isEmpty={map.activeDays === 0}
      emptyTitle={t('progress:charts.streakHeatmap.emptyTitle')}
      emptyHint={t('progress:charts.streakHeatmap.emptyHint')}
      takeaway={
        <span className="tabular">
          {t('progress:charts.streakHeatmap.takeaway', {
            streak: streakLabel,
            active: activeLabel,
          })}
        </span>
      }
    >
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: 'auto repeat(12, minmax(0, 1fr))' }}>
        {WEEKDAY_NUMS.map((dayNum, d) => {
          const label = t(`common:labels.weekdayShort.${dayNum}`);
          return (
            <Fragment key={dayNum}>
              <span className="pr-1 text-right text-xs leading-none tabular text-muted">{label}</span>
              {map.columns.map((column, w) => {
                const cell = column[d];
                const level = levelOf(cell.minutes);
                const title = `${format(parseISO(cell.date), 'EEE d MMM', { locale: dateLocale })} · ${
                  cell.minutes > 0 ? fmtMinutes(cell.minutes) : t('progress:charts.streakHeatmap.noStudy')
                }`;
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
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted">
        <span>{t('progress:charts.streakHeatmap.less')}</span>
        {STEP_OPACITY.map((opacity, i) => (
          <span
            key={i}
            className={cx('size-3 rounded-full', i === 0 ? 'bg-surface-2' : 'bg-accent')}
            style={i === 0 ? undefined : { opacity }}
          />
        ))}
        <span>{t('progress:charts.streakHeatmap.more')}</span>
      </div>
    </ChartCard>
  );
}
