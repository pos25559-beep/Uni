// Folha inferior única com as preferências do plano (sem passos nem pré-visualização separada).
// Ao guardar, atualiza as preferências na store e chama `replan('prefs')` — o único caminho do motor.
import { Check, Flame, PauseCircle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePlannerPrefs, DEFAULT_PLANNER_PREFS } from '../../lib/planner/availability';
import { normalizeWeekdaySchedule } from '../../lib/plannerBriefing';
import { cx, showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import type {
  ID,
  PlannerContentMix,
  PlannerPreferences,
  PlannerStrategy,
  PreExamMarathonConfig,
  WeekdayAvailability,
} from '../../types';
import { Button, Modal, Switch } from '../ui';
import MarathonEditor from './MarathonEditor';
import WeekdayAvailabilityEditor from './WeekdayAvailabilityEditor';

const BLOCK_OPTIONS: Array<25 | 35 | 50 | 75> = [25, 35, 50, 75];
const HORIZON_OPTIONS: Array<7 | 14 | 21> = [7, 14, 21];
const STRATEGY_OPTIONS: PlannerStrategy[] = ['balanced', 'exams_first', 'srs_focus', 'catch_up'];
const MIX_OPTIONS: PlannerContentMix[] = ['balanced', 'theory_first', 'practice_first'];

const DEFAULT_MARATHON: PreExamMarathonConfig = {
  enabled: false,
  daysBefore: 2,
  dailyMinutes: 480,
};

export default function PlanPreferencesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('plan');
  const courses = useStore((s) => s.courses);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const replan = useStore((s) => s.replan);

  const initial = resolvePlannerPrefs(settings);

  const [weekdaySchedule, setWeekdaySchedule] = useState<Record<string, WeekdayAvailability>>(() =>
    normalizeWeekdaySchedule(initial.weekdaySchedule, settings, initial.preferredPeriod),
  );
  const [fillClassGaps, setFillClassGaps] = useState<boolean>(Boolean(initial.fillClassGaps));
  const [blockMinutes, setBlockMinutes] = useState<25 | 35 | 50 | 75>(initial.blockMinutes);
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 21>(initial.horizonDays);
  const [strategy, setStrategy] = useState<PlannerStrategy>(initial.strategy);
  const [contentMix, setContentMix] = useState<PlannerContentMix>(initial.contentMix ?? 'balanced');
  const [exclusiveTestFocus, setExclusiveTestFocus] = useState<boolean>(
    Boolean(initial.exclusiveTestFocus),
  );
  const [boostCourseIds, setBoostCourseIds] = useState<ID[]>(initial.boostCourseIds ?? []);
  const [pausedCourseIds, setPausedCourseIds] = useState<ID[]>(initial.pausedCourseIds ?? []);
  const [marathon, setMarathon] = useState<PreExamMarathonConfig>(
    initial.preExamMarathon ?? DEFAULT_MARATHON,
  );

  const cycleCourseState = (id: ID) => {
    const isBoost = boostCourseIds.includes(id);
    const isPaused = pausedCourseIds.includes(id);
    if (!isBoost && !isPaused) {
      setBoostCourseIds([...boostCourseIds, id]);
    } else if (isBoost) {
      setBoostCourseIds(boostCourseIds.filter((c) => c !== id));
      setPausedCourseIds([...pausedCourseIds, id]);
    } else {
      setPausedCourseIds(pausedCourseIds.filter((c) => c !== id));
    }
  };

  const resetDefaults = () => {
    setWeekdaySchedule(normalizeWeekdaySchedule(undefined, settings, 'auto'));
    setFillClassGaps(false);
    setBlockMinutes(DEFAULT_PLANNER_PREFS.blockMinutes);
    setHorizonDays(DEFAULT_PLANNER_PREFS.horizonDays);
    setStrategy(DEFAULT_PLANNER_PREFS.strategy);
    setContentMix('balanced');
    setExclusiveTestFocus(false);
    setBoostCourseIds([]);
    setPausedCourseIds([]);
    setMarathon(DEFAULT_MARATHON);
  };

  const handleSave = () => {
    const prevPrefs = settings.plannerPrefs;
    const nextPrefs: PlannerPreferences = {
      ...(prevPrefs ?? DEFAULT_PLANNER_PREFS),
      horizonDays,
      blockMinutes,
      strategy,
      contentMix,
      exclusiveTestFocus,
      boostCourseIds,
      pausedCourseIds,
      weekdaySchedule,
      fillClassGaps,
      preExamMarathon: marathon,
    };
    updateSettings({ plannerPrefs: nextPrefs }, { replan: false });
    const changed = replan('prefs', { force: true, prevPrefs });
    if (!changed) showToast(t('replan.updated'), 'ok');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('prefs.title')}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={resetDefaults}>
            <RotateCcw size={14} aria-hidden="true" /> {t('prefs.reset')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('prefs.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              <Check size={15} aria-hidden="true" /> {t('prefs.save')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 1. Dias e horas + Intervalos entre aulas */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('prefs.weekly.dayScheduleTitle')}
          </h3>
          <WeekdayAvailabilityEditor
            weekdaySchedule={weekdaySchedule}
            onChangeSchedule={setWeekdaySchedule}
            fillClassGaps={fillClassGaps}
            onChangeFillClassGaps={setFillClassGaps}
          />
        </section>

        {/* 2. Duração dos blocos & 3. Planear para */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('prefs.block')}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {BLOCK_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBlockMinutes(m)}
                  className={cx(
                    'min-h-11 rounded-xl border text-xs font-semibold tabular transition',
                    blockMinutes === m
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('prefs.horizon')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {HORIZON_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={cx(
                    'min-h-11 rounded-xl border text-xs font-semibold tabular transition',
                    horizonDays === d
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {t('prefs.days', { d })}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Estratégia & Mistura teoria/prática */}
        <section className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('prefs.goal')}
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {STRATEGY_OPTIONS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setStrategy(id)}
                className={cx(
                  'min-h-11 rounded-2xl border p-3 text-left transition',
                  strategy === id
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/50 hover:bg-surface-2',
                )}
              >
                <p className="text-sm font-semibold">{t(`prefs.strategy.${id}`)}</p>
                <p className="mt-0.5 text-xs text-muted">{t(`prefs.strategy.${id}Hint`)}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('prefs.mix.title')}
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {MIX_OPTIONS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setContentMix(id)}
                  className={cx(
                    'min-h-11 rounded-2xl border p-3 text-left transition',
                    contentMix === id
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/50 hover:bg-surface-2',
                  )}
                >
                  <p className="text-xs font-semibold">{t(`prefs.mix.${id}`)}</p>
                  <p className="mt-0.5 text-xs text-muted">{t(`prefs.mix.${id}Hint`)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/40 px-4 py-3">
            <p className="min-w-0 flex-1 text-xs font-medium text-fg">
              {t('prefs.mix.exclusiveFocus')}
            </p>
            <Switch
              checked={exclusiveTestFocus}
              onCheckedChange={setExclusiveTestFocus}
              label={t('prefs.mix.exclusiveFocus')}
            />
          </div>
        </section>

        {/* 5. Cadeiras (Normal / Reforçar / Pausa) */}
        {courses.length > 0 && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('prefs.focusByCourse')}
              </span>
              <span className="text-xs text-muted">{t('prefs.toggleHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => {
                const boosted = boostCourseIds.includes(c.id);
                const paused = pausedCourseIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => cycleCourseState(c.id)}
                    className={cx(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition',
                      boosted
                        ? 'border-warn bg-warn/15 text-warn'
                        : paused
                          ? 'border-line bg-surface-2 text-muted line-through opacity-75'
                          : 'border-line bg-surface text-fg hover:border-accent/50',
                    )}
                  >
                    {boosted && <Flame size={13} aria-hidden="true" />}
                    {paused && <PauseCircle size={13} aria-hidden="true" />}
                    <span>{c.shortName || c.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Maratona Pré-Teste */}
        <MarathonEditor marathon={marathon} onChangeMarathon={setMarathon} />
      </div>
    </Modal>
  );
}
