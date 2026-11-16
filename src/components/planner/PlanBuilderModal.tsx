import { CalendarDays, Clock, Flame, PauseCircle, RotateCcw, Sparkles, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weekdayShort } from '../../lib/colors';
import { generatePlan, planSummary } from '../../lib/planner';
import { fmtMinutes } from '../../lib/selectors';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  PlannerDayPeriod,
  PlannerPreferences,
  PlannerStrategy,
  Settings,
  StudyLogEntry,
  StudySession,
  WeeklyCheckIn,
} from '../../types';
import { Badge, Button, CourseChip, Modal } from '../ui';
import { cx } from '../../lib/uiHelpers';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_PREFS: PlannerPreferences = {
  horizonDays: 14,
  preferredPeriod: 'auto',
  blockMinutes: 50,
  strategy: 'balanced',
  boostCourseIds: [],
  pausedCourseIds: [],
  includeOverdue: true,
};

const STRATEGIES: { id: PlannerStrategy; label: string; hint: string }[] = [
  { id: 'balanced', label: 'Equilibrado', hint: 'Adapta provas, SRS e dificuldade' },
  { id: 'exams_first', label: 'Foco provas', hint: 'Intensifica exames nos próximos 14d' },
  { id: 'srs_focus', label: 'Memória SRS', hint: 'Até 2 revisões espaçadas/dia' },
  { id: 'catch_up', label: 'Recuperar', hint: 'Prioriza atrasos nos slots livres' },
];

const PERIODS: { id: PlannerDayPeriod; label: string; sub: string }[] = [
  { id: 'auto', label: 'Automático', sub: '17h+ útil / 10h+ fds' },
  { id: 'morning', label: 'Manhã', sub: '08:30+' },
  { id: 'afternoon', label: 'Tarde', sub: '14:00+' },
  { id: 'evening', label: 'Noite', sub: '17:30+' },
];

const BLOCK_DURATIONS: (25 | 35 | 50 | 75)[] = [25, 35, 50, 75];
const HORIZONS: (7 | 14 | 21)[] = [7, 14, 21];
const DAILY_PRESETS = [60, 90, 120, 180, 240, 300];

interface Props {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  sessions: StudySession[];
  settings: Settings;
  difficultCourseIds?: ID[];
  weeklyCheckIns: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  extraActivities?: ExtraActivity[];
  today: string;
  overdueCount: number;
  hasPendingGenerated: boolean;
  onApply: (args: {
    prefs: PlannerPreferences;
    dailyStudyMinutes: number;
    studyDays: number[];
    plan: StudySession[];
  }) => void;
}

export default function PlanBuilderModal({
  open,
  onClose,
  courses,
  assessments,
  classes,
  events,
  sessions,
  settings,
  difficultCourseIds,
  weeklyCheckIns,
  studyLogs = [],
  extraActivities,
  today,
  overdueCount,
  hasPendingGenerated,
  onApply,
}: Props) {
  const { t } = useTranslation('plan');
  const initial = settings.plannerPrefs ?? DEFAULT_PREFS;
  const [strategy, setStrategy] = useState<PlannerStrategy>(initial.strategy);
  const [horizonDays, setHorizonDays] = useState<7 | 14 | 21>(initial.horizonDays);
  const [preferredPeriod, setPreferredPeriod] = useState<PlannerDayPeriod>(initial.preferredPeriod);
  const [blockMinutes, setBlockMinutes] = useState<25 | 35 | 50 | 75>(initial.blockMinutes);
  const [dailyMinutes, setDailyMinutes] = useState<number>(settings.dailyStudyMinutes || 120);
  const [studyDays, setStudyDays] = useState<number[]>(
    settings.studyDays.length > 0 ? settings.studyDays : [1, 2, 3, 4, 5, 6],
  );
  const [boostIds, setBoostIds] = useState<ID[]>(initial.boostCourseIds ?? []);
  const [pausedIds, setPausedIds] = useState<ID[]>(initial.pausedCourseIds ?? []);
  const [includeOverdue, setIncludeOverdue] = useState<boolean>(
    initial.includeOverdue ?? true,
  );
  const [nowAnchor] = useState(() => new Date());

  const cycleCourseFocus = (courseId: ID) => {
    if (boostIds.includes(courseId)) {
      setBoostIds((prev) => prev.filter((id) => id !== courseId));
      setPausedIds((prev) => [...prev, courseId]);
    } else if (pausedIds.includes(courseId)) {
      setPausedIds((prev) => prev.filter((id) => id !== courseId));
    } else {
      setBoostIds((prev) => [...prev, courseId]);
    }
  };

  const toggleDay = (day: number) => {
    const active = studyDays.includes(day);
    if (active && studyDays.length === 1) return;
    setStudyDays((prev) =>
      active ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const previewSettings = useMemo<Settings>(
    () => ({
      ...settings,
      dailyStudyMinutes: dailyMinutes,
      studyDays,
    }),
    [settings, dailyMinutes, studyDays],
  );

  const effectiveStrategy: PlannerStrategy =
    strategy === 'catch_up' ? 'catch_up' : strategy;

  const previewPlan = useMemo(() => {
    if (!open || courses.length === 0) return [];
    return generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings: previewSettings,
      from: today,
      nowMinutes: nowAnchor.getHours() * 60 + nowAnchor.getMinutes(),
      days: horizonDays,
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
      difficultCourseIds,
      weeklyCheckIns,
      studyLogs,
      extraActivities,
      preferredPeriod,
      blockMinutes,
      strategy: effectiveStrategy,
      boostCourseIds: boostIds,
      pausedCourseIds: pausedIds,
    });
  }, [
    open,
    courses,
    assessments,
    classes,
    events,
    previewSettings,
    today,
    nowAnchor,
    horizonDays,
    sessions,
    difficultCourseIds,
    weeklyCheckIns,
    studyLogs,
    extraActivities,
    preferredPeriod,
    blockMinutes,
    effectiveStrategy,
    boostIds,
    pausedIds,
  ]);

  const previewTotalMinutes = useMemo(
    () => previewPlan.reduce((sum, s) => sum + s.minutes, 0),
    [previewPlan],
  );

  const previewByCourse = useMemo(
    () => planSummary(previewPlan, courses).filter((r) => r.planned > 0),
    [previewPlan, courses],
  );

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const handleApply = () => {
    onApply({
      prefs: {
        horizonDays,
        preferredPeriod,
        blockMinutes,
        strategy,
        boostCourseIds: boostIds,
        pausedCourseIds: pausedIds,
        includeOverdue,
      },
      dailyStudyMinutes: dailyMinutes,
      studyDays,
      plan: previewPlan,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('builder.title')}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted">
            {hasPendingGenerated
              ? t('builder.keepDone')
              : t('builder.adjustLater')}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('builder.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleApply}
              disabled={courses.length === 0 || (previewPlan.length === 0 && pausedIds.length === courses.length)}
            >
              <Sparkles size={15} /> {t('builder.apply', { n: previewPlan.length })}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Pré-visualização ao vivo */}
        <section className="rounded-[22px] bg-pastel-sage/65 p-4 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70">{t('builder.preview')}</p>
              <p className="mt-0.5 font-display text-xl font-bold tabular">
                {t('builder.sessionsTotal', { n: previewPlan.length, time: fmtMinutes(previewTotalMinutes) })}
              </p>
            </div>
            <Badge tone="ok">{t('builder.badge', { d: horizonDays, m: blockMinutes })}</Badge>
          </div>
          {previewByCourse.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {previewByCourse.map((row) => (
                <div
                  key={row.courseId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium dark:bg-black/25"
                >
                  <CourseChip course={courseById.get(row.courseId)} />
                  <span className="font-mono tabular text-muted">{fmtMinutes(row.planned)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs opacity-80">
              {pausedIds.length === courses.length
                ? t('builder.allPaused')
                : t('builder.allCovered')}
            </p>
          )}
        </section>

        {/* Estratégia */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">{t('builder.goal')}</label>
          <div className="grid grid-cols-2 gap-2">
            {STRATEGIES.map((st) => {
              const active = strategy === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStrategy(st.id)}
                  className={cx(
                    'flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2 text-left transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface hover:bg-surface-2',
                  )}
                >
                  <span className="text-xs font-bold">{t(`builder.strategy.${st.id}`)}</span>
                  <span className="mt-0.5 text-xs opacity-75">{t(`builder.strategy.${st.id}Hint`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horizonte + Duração do bloco */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <CalendarDays size={13} /> {t('builder.horizon')}
            </span>
            <div className="flex gap-1.5">
              {HORIZONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={cx(
                    'min-h-[44px] flex-1 rounded-xl border text-xs font-semibold tabular transition',
                    horizonDays === d
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {t('builder.days', { d })}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <Clock size={13} /> {t('builder.block')}
            </span>
            <div className="flex gap-1.5">
              {BLOCK_DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBlockMinutes(m)}
                  className={cx(
                    'min-h-[44px] flex-1 rounded-xl border text-xs font-semibold tabular transition',
                    blockMinutes === m
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {m === 25 ? '25m 🍅' : `${m}m`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Período do dia */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('builder.periodTitle')}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreferredPeriod(p.id)}
                className={cx(
                  'flex min-h-[48px] flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition',
                  preferredPeriod === p.id
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-fg hover:bg-surface-2',
                )}
              >
                <span className="text-xs font-bold">{t(`builder.period.${p.id}`)}</span>
                <span className="text-xs text-muted">{p.id === 'auto' ? t('builder.period.autoSub') : p.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Carga diária + Dias ativos */}
        <div className="space-y-2.5 rounded-2xl border border-line bg-surface-2/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-fg">
              {t('builder.dailyGoal')} <span className="font-mono tabular text-accent-ink dark:text-accent">{fmtMinutes(dailyMinutes)}</span>
            </span>
            <div className="flex flex-wrap gap-1">
              {DAILY_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDailyMinutes(m)}
                  className={cx(
                    'min-h-[36px] rounded-full px-2.5 text-xs font-semibold tabular transition',
                    dailyMinutes === m ? 'bg-ink-cta text-ink-cta-fg' : 'bg-surface text-muted hover:text-fg',
                  )}
                >
                  {fmtMinutes(m)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((day) => {
              const on = studyDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={cx(
                    'min-h-[44px] min-w-10 flex-1 rounded-xl border text-xs font-semibold transition',
                    on
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface text-muted',
                  )}
                >
                  {weekdayShort[day]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Foco por Cadeira */}
        {courses.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('builder.focusByCourse')}
              </span>
              <span className="text-xs text-muted">{t('builder.toggleHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => {
                const boosted = boostIds.includes(c.id);
                const paused = pausedIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => cycleCourseFocus(c.id)}
                    className={cx(
                      'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                      boosted
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : paused
                          ? 'border-dashed border-line bg-surface-2/60 text-muted line-through opacity-75'
                          : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    <CourseChip course={c} />
                    {boosted && <Star size={13} className="fill-current" />}
                    {paused && <PauseCircle size={13} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recuperar atrasos */}
        {overdueCount > 0 && (
          <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-pastel-butter/50 px-3.5 py-2 text-xs dark:bg-surface-2">
            <span className="flex items-center gap-2 font-medium text-fg">
              <Flame size={15} className="shrink-0 text-coral" />
              {t('builder.overdue', { count: overdueCount })}
            </span>
            <input
              type="checkbox"
              checked={includeOverdue}
              onChange={(e) => setIncludeOverdue(e.target.checked)}
              className="size-5 accent-[var(--accent)]"
            />
          </label>
        )}

        {(boostIds.length > 0 || pausedIds.length > 0 || strategy !== 'balanced' || preferredPeriod !== 'auto' || blockMinutes !== 50 || horizonDays !== 14) && (
          <button
            type="button"
            onClick={() => {
              setStrategy(DEFAULT_PREFS.strategy);
              setHorizonDays(DEFAULT_PREFS.horizonDays);
              setPreferredPeriod(DEFAULT_PREFS.preferredPeriod);
              setBlockMinutes(DEFAULT_PREFS.blockMinutes);
              setBoostIds([]);
              setPausedIds([]);
            }}
            className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
          >
            <RotateCcw size={13} /> {t('builder.reset')}
          </button>
        )}
      </div>
    </Modal>
  );
}
