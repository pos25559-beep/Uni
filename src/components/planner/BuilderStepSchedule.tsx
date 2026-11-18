import { Flame, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { weekdayShort } from '../../lib/colors';
import { applyWeekdayPreset, type WeekdayPresetId } from '../../lib/plannerBriefing';
import { fmtMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type {
  PlannerWindowMode,
  PreExamMarathonConfig,
  WeekdayAvailability,
} from '../../types';
import { Select, Switch } from '../ui';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const MINUTES_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600];
const WINDOW_OPTIONS: PlannerWindowMode[] = ['all_day', 'auto', 'morning', 'afternoon', 'evening'];
const MARATHON_DAYS: (1 | 2 | 3)[] = [1, 2, 3];
const MARATHON_MINUTES: (360 | 480 | 600)[] = [360, 480, 600];

interface Props {
  weekdaySchedule: Record<string, WeekdayAvailability>;
  onChangeSchedule: (next: Record<string, WeekdayAvailability>) => void;
  fillClassGaps: boolean;
  onChangeFillClassGaps: (next: boolean) => void;
  marathon: PreExamMarathonConfig;
  onChangeMarathon: (next: PreExamMarathonConfig) => void;
}

export default function BuilderStepSchedule({
  weekdaySchedule,
  onChangeSchedule,
  fillClassGaps,
  onChangeFillClassGaps,
  marathon,
  onChangeMarathon,
}: Props) {
  const { t } = useTranslation('plan');

  const updateDay = (day: number, patch: Partial<WeekdayAvailability>) => {
    const k = String(day);
    const cur = weekdaySchedule[k] ?? { enabled: true, minutes: 120, window: 'auto' };
    if (patch.enabled === false) {
      const enabledCount = DAY_ORDER.filter((d) => weekdaySchedule[String(d)]?.enabled).length;
      if (enabledCount <= 1 && cur.enabled) return;
    }
    onChangeSchedule({
      ...weekdaySchedule,
      [k]: { ...cur, ...patch },
    });
  };

  const removeBlockedPeriod = (day: number, period: 'morning' | 'afternoon' | 'evening') => {
    const cur = weekdaySchedule[String(day)];
    if (!cur?.blockedPeriods) return;
    const next = cur.blockedPeriods.filter((p) => p !== period);
    updateDay(day, { blockedPeriods: next.length > 0 ? next : undefined });
  };

  const presets: Array<{ id: WeekdayPresetId; label: string }> = [
    { id: 'light_week_strong_weekend', label: t('builder.weekly.presetLightWeek') },
    { id: 'evenings_week', label: t('builder.weekly.presetEvenings') },
    { id: 'uniform', label: t('builder.weekly.presetUniform') },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Presets de ritmo semanal */}
      <section className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t('builder.weekly.presetsTitle')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChangeSchedule(applyWeekdayPreset(p.id))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2/65 px-3.5 text-xs font-semibold text-fg transition hover:border-accent/50 hover:bg-surface"
            >
              <Sparkles size={13} className="text-accent" aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* 2. Disponibilidade real Seg-Dom */}
      <section className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {t('builder.weekly.dayScheduleTitle')}
        </span>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {DAY_ORDER.map((day) => {
            const avail = weekdaySchedule[String(day)] ?? {
              enabled: true,
              minutes: 120,
              window: 'auto' as const,
            };
            const dayName = weekdayShort[day];

            return (
              <div
                key={day}
                className={cx(
                  'flex flex-col gap-2 px-3.5 py-2.5 transition sm:flex-row sm:items-center sm:justify-between',
                  !avail.enabled && 'bg-surface-2/40 opacity-75',
                )}
              >
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={avail.enabled}
                      onCheckedChange={(checked) => updateDay(day, { enabled: checked })}
                      label={dayName}
                    />
                    <span className="w-10 text-sm font-bold text-fg">{dayName}</span>
                  </div>
                  {!avail.enabled && (
                    <span className="text-xs font-medium text-muted sm:hidden">
                      {t('builder.weekly.dayOff')}
                    </span>
                  )}
                </div>

                {avail.enabled ? (
                  <div className="flex flex-1 flex-col gap-1.5 sm:items-end">
                    <div className="grid grid-cols-2 gap-2 sm:w-auto sm:min-w-[280px]">
                      <Select
                        aria-label={t('builder.weekly.minutesAria', { day: dayName })}
                        value={String(
                          MINUTES_OPTIONS.includes(avail.minutes)
                            ? avail.minutes
                            : MINUTES_OPTIONS.reduce((prev, curr) =>
                                Math.abs(curr - avail.minutes) < Math.abs(prev - avail.minutes)
                                  ? curr
                                  : prev,
                              ),
                        )}
                        onChange={(e) =>
                          updateDay(day, { minutes: Number(e.target.value) })
                        }
                      >
                        {MINUTES_OPTIONS.map((m) => (
                          <option key={m} value={String(m)}>
                            {fmtMinutes(m)}
                          </option>
                        ))}
                      </Select>

                      <Select
                        aria-label={t('builder.weekly.windowAria', { day: dayName })}
                        value={avail.window}
                        onChange={(e) =>
                          updateDay(day, {
                            window: e.target.value as PlannerWindowMode,
                          })
                        }
                      >
                        {WINDOW_OPTIONS.map((w) => (
                          <option key={w} value={w}>
                            {t(`builder.weekly.windows.${w}`)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {avail.blockedPeriods && avail.blockedPeriods.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {avail.blockedPeriods.map((bp) => (
                          <button
                            key={bp}
                            type="button"
                            onClick={() => removeBlockedPeriod(day, bp)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-coral/35 bg-coral-soft px-2.5 text-xs font-semibold text-coral-ink"
                          >
                            <span>− {t(`builder.weekly.windows.${bp}`)}</span>
                            <X size={12} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="hidden text-xs font-medium text-muted sm:inline">
                    {t('builder.weekly.dayOff')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Furos entre aulas */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg">
            {t('builder.weekly.fillClassGaps')}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {t('builder.weekly.fillClassGapsHint')}
          </p>
        </div>
        <Switch
          checked={fillClassGaps}
          onCheckedChange={onChangeFillClassGaps}
          label={t('builder.weekly.fillClassGaps')}
        />
      </div>

      {/* 4. Reta Final · Maratona Pré-Teste */}
      <section className="space-y-3 rounded-2xl border border-warn/40 bg-pastel-butter/45 p-4 dark:bg-surface-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Flame size={16} className="shrink-0 text-coral" aria-hidden="true" />
              <h3 className="font-display text-sm font-bold text-fg">
                {t('builder.weekly.marathonTitle')}
              </h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t('builder.weekly.marathonHint')}
            </p>
          </div>
          <Switch
            checked={marathon.enabled}
            onCheckedChange={(enabled) => onChangeMarathon({ ...marathon, enabled })}
            label={t('builder.weekly.marathonActiveLabel')}
          />
        </div>

        {marathon.enabled && (
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted">
                {t('builder.weekly.marathonDays')}
              </span>
              <div className="flex gap-1.5">
                {MARATHON_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChangeMarathon({ ...marathon, daysBefore: d })}
                    className={cx(
                      'min-h-11 flex-1 rounded-xl border px-2 text-xs font-semibold tabular transition',
                      marathon.daysBefore === d
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    {t('builder.weekly.marathonDaysOption', { d })}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted">
                {t('builder.weekly.marathonLoad')}
              </span>
              <div className="flex gap-1.5">
                {MARATHON_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeMarathon({ ...marathon, dailyMinutes: m })}
                    className={cx(
                      'min-h-11 flex-1 rounded-xl border px-2 text-xs font-semibold tabular transition',
                      marathon.dailyMinutes === m
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    {fmtMinutes(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
