// Editor da Maratona Pré-Teste (dia inteiro nos N dias imediatamente antes de avaliações).
import { Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type { PreExamMarathonConfig } from '../../types';
import { Switch } from '../ui';

const MARATHON_DAYS: (1 | 2 | 3)[] = [1, 2, 3];
const MARATHON_MINUTES: (360 | 480 | 600)[] = [360, 480, 600];

interface Props {
  marathon: PreExamMarathonConfig;
  onChangeMarathon: (next: PreExamMarathonConfig) => void;
}

export default function MarathonEditor({ marathon, onChangeMarathon }: Props) {
  const { t } = useTranslation('plan');

  return (
    <section className="space-y-3 rounded-2xl border border-warn/40 bg-pastel-butter/45 p-4 dark:bg-surface-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Flame size={16} className="shrink-0 text-coral" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-fg">
              {t('prefs.weekly.marathonTitle')}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {t('prefs.weekly.marathonHint')}
          </p>
        </div>
        <Switch
          checked={marathon.enabled}
          onCheckedChange={(enabled) => onChangeMarathon({ ...marathon, enabled })}
          label={t('prefs.weekly.marathonActiveLabel')}
        />
      </div>

      {marathon.enabled && (
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">
              {t('prefs.weekly.marathonDays')}
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
                  {t('prefs.weekly.marathonDaysOption', { d })}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted">
              {t('prefs.weekly.marathonLoad')}
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
  );
}
