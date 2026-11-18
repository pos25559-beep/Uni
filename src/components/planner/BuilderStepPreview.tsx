import { addDays, format, parseISO } from 'date-fns';
import {
  FileText,
  Flame,
  Lock,
  LockOpen,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDateFnsLocale } from '../../lib/grading';
import { planSummary, resolveDayPlanProfile } from '../../lib/planner';
import {
  capitalizeFirst,
  fmtMinutes,
  formatSessionDisplay,
  formatSessionReason,
} from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type {
  Assessment,
  Course,
  ID,
  Material,
  PlannerDayPeriod,
  PreExamMarathonConfig,
  Settings,
  StudySession,
  WeekdayAvailability,
} from '../../types';
import { Badge, CourseChip, Select } from '../ui';

interface Props {
  courses: Course[];
  assessments: Assessment[];
  materials: Material[];
  settings: Settings;
  today: string;
  horizonDays: number;
  weekdaySchedule: Record<string, WeekdayAvailability>;
  preferredPeriod: PlannerDayPeriod;
  marathon: PreExamMarathonConfig;
  pausedCourseIds: ID[];
  previewSessions: StudySession[];
  existingLockedFutureCount: number;
  lockedPreviewIds: string[];
  excludedCount: number;
  onToggleLockPreview: (id: string) => void;
  onMovePreviewToDate: (session: StudySession, targetDate: string) => void;
  onRemovePreview: (id: string) => void;
  onResetExcluded: () => void;
}

function cleanMaterialTitle(title: string): string {
  return title
    .replace(/\s*\[(slide_oficial|teste_antigo|exame_antigo|ficha|sebenta|relatorio|outro)\]/gi, '')
    .trim();
}

export default function BuilderStepPreview({
  courses,
  assessments,
  materials,
  settings,
  today,
  horizonDays,
  weekdaySchedule,
  preferredPeriod,
  marathon,
  pausedCourseIds,
  previewSessions,
  existingLockedFutureCount,
  lockedPreviewIds,
  excludedCount,
  onToggleLockPreview,
  onMovePreviewToDate,
  onRemovePreview,
  onResetExcluded,
}: Props) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const topicById = useMemo(
    () => new Map(courses.flatMap((c) => c.topics.map((tp) => [tp.id, tp] as const))),
    [courses],
  );
  const assessmentById = useMemo(
    () => new Map(assessments.map((a) => [a.id, a])),
    [assessments],
  );
  const materialById = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  );

  const previewTotalMinutes = useMemo(
    () => previewSessions.reduce((sum, s) => sum + s.minutes, 0),
    [previewSessions],
  );

  const previewByCourse = useMemo(
    () => planSummary(previewSessions, courses).filter((r) => r.planned > 0),
    [previewSessions, courses],
  );

  const horizonDateKeys = useMemo(() => {
    const base = parseISO(today);
    return Array.from({ length: horizonDays }, (_, i) =>
      format(addDays(base, i), 'yyyy-MM-dd'),
    );
  }, [today, horizonDays]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    const sorted = [...previewSessions].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
    );
    for (const s of sorted) {
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return [...map.entries()];
  }, [previewSessions]);

  return (
    <div className="space-y-4">
      {/* Resumo agregado */}
      <section className="rounded-[22px] bg-pastel-sage/65 p-4 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">
              {t('builder.preview')}
            </p>
            <p className="mt-0.5 font-display text-xl font-bold tabular">
              {t('builder.sessionsTotal', {
                n: previewSessions.length,
                time: fmtMinutes(previewTotalMinutes),
              })}
            </p>
          </div>
          {existingLockedFutureCount > 0 && (
            <Badge tone="accent">
              <Lock size={11} aria-hidden="true" />{' '}
              {t('builder.previewActions.keptLocked', { count: existingLockedFutureCount })}
            </Badge>
          )}
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
            {pausedCourseIds.length === courses.length
              ? t('builder.allPaused')
              : t('builder.allCovered')}
          </p>
        )}

        {excludedCount > 0 && (
          <button
            type="button"
            onClick={onResetExcluded}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold text-fg"
          >
            <RotateCcw size={13} />{' '}
            {t('builder.previewActions.resetExcluded', { count: excludedCount })}
          </button>
        )}
      </section>

      {/* Lista dia a dia */}
      <div className="space-y-3">
        {groupedByDay.map(([dateKey, daySessions]) => {
          const parsed = parseISO(dateKey);
          const profile = resolveDayPlanProfile({
            dateKey,
            weekday: parsed.getDay(),
            settings,
            assessments,
            pausedCourseIds,
            weekdaySchedule,
            preferredPeriod,
            preExamMarathon: marathon,
          });
          const dayMinutes = daySessions.reduce((sum, s) => sum + s.minutes, 0);

          return (
            <div
              key={dateKey}
              className={cx(
                'overflow-hidden rounded-2xl border border-line bg-surface',
                profile.isMarathonDay && 'border-warn/50',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/45 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-fg">
                    {capitalizeFirst(format(parsed, 'EEEE, d MMM', { locale: dfLocale }))}
                  </span>
                  {profile.isMarathonDay && (
                    <Badge tone="warn">
                      <Flame size={11} aria-hidden="true" />{' '}
                      {t('builder.previewActions.marathonBadge')}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-semibold text-muted tabular">
                  {fmtMinutes(dayMinutes)}
                </span>
              </div>

              <ul className="divide-y divide-line">
                {daySessions.map((s) => {
                  const course = courseById.get(s.courseId);
                  const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                  const assessment = s.assessmentId
                    ? assessmentById.get(s.assessmentId)
                    : undefined;
                  const material = s.materialId
                    ? materialById.get(s.materialId)
                    : undefined;
                  const display = formatSessionDisplay(s, topic, i18n.language);
                  const reasonText = formatSessionReason(s, assessment, i18n.language);
                  const isLocked = lockedPreviewIds.includes(s.id) || Boolean(s.locked);

                  return (
                    <li key={s.id} className="space-y-2 px-3.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-fg tabular">
                            {s.start ?? '—'}
                          </span>
                          <span className="text-xs text-muted tabular">· {s.minutes}m</span>
                          <CourseChip course={course} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onToggleLockPreview(s.id)}
                            aria-pressed={isLocked}
                            className={cx(
                              'inline-flex min-h-11 items-center gap-1 rounded-xl border px-2.5 text-xs font-semibold transition',
                              isLocked
                                ? 'border-accent bg-accent-soft text-accent-ink'
                                : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                            )}
                          >
                            {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                            <span>
                              {isLocked
                                ? t('builder.previewActions.lockedInPreview')
                                : t('builder.previewActions.lockInPreview')}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemovePreview(s.id)}
                            aria-label={t('builder.previewActions.removeFromPreview')}
                            title={t('builder.previewActions.removeFromPreview')}
                            className="grid size-11 place-items-center rounded-xl text-muted hover:bg-danger/12 hover:text-danger"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-fg">{display.title}</p>
                        {reasonText && (
                          <p className="mt-0.5 text-xs text-muted">
                            <span className="font-semibold">
                              {t('builder.previewActions.whyPrefix')}
                            </span>{' '}
                            {reasonText}
                          </p>
                        )}
                        {material && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-accent-ink dark:text-accent">
                            <FileText size={12} className="shrink-0" aria-hidden="true" />
                            <span className="truncate">{cleanMaterialTitle(material.title)}</span>
                          </p>
                        )}
                      </div>

                      <div className="max-w-xs">
                        <Select
                          aria-label={t('builder.previewActions.moveDayAria')}
                          value={s.date}
                          onChange={(e) => onMovePreviewToDate(s, e.target.value)}
                        >
                          {horizonDateKeys.map((dk) => (
                            <option key={dk} value={dk}>
                              {capitalizeFirst(
                                format(parseISO(dk), 'EEE, d MMM', { locale: dfLocale }),
                              )}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
