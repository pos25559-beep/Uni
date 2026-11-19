import { ArrowRight, BarChart3, BookOpenCheck, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import UniCollectiblesModal from '../components/brand/UniCollectiblesModal';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { CourseTimeChart } from '../components/progress/CourseTimeChart';
import { GradeBullets } from '../components/progress/GradeBullets';
import { PlannedDoneChart } from '../components/progress/PlannedDoneChart';
import { PERIODS, periodRange, retentionOverview, type Period } from '../components/progress/data';
import { ReadinessChart } from '../components/progress/ReadinessChart';
import { RetentionFocusChart } from '../components/progress/RetentionFocusChart';
import { StreakHeatmap } from '../components/progress/StreakHeatmap';
import { StudyByDayChart } from '../components/progress/StudyByDayChart';
import UniShelfSection from '../components/progress/UniShelfSection';
import { WeaknessChart } from '../components/progress/WeaknessChart';
import ActiveReviewModal from '../components/practice/ActiveReviewModal';
import { Badge, Button, Card, PageHeader, Ring, SegmentedControl } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import type { StudyLogKind } from '../types';
import {
  computeUniCompanionState,
  getUniCollectibleStates,
  getUniPetStates,
  readCollectibleTelemetry,
} from '../lib/uniCollectibles';
import { normalizeAppLanguage } from '../lib/grading';
import { fmtGrade, fmtMinutes, semesterAverage, sessionMinutes, studyStreak, todayStr } from '../lib/selectors';
import { useStore } from '../store/useStore';

export default function ProgressPage() {
  const { t, i18n } = useTranslation(['progress', 'assistant']);
  const appLang = normalizeAppLanguage(i18n.language);
  const [progressTab, setProgressTab] = useState<'week' | 'semester'>('week');
  const [period, setPeriod] = useState<Period>('30d');
  const [logFilter, setLogFilter] = useState<'all' | StudyLogKind>('all');
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [showEmptyCharts, setShowEmptyCharts] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ courseId?: string; topicId?: string } | null>(null);
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const studyLogs = useStore((s) => s.studyLogs);
  const removeStudyLog = useStore((s) => s.removeStudyLog);
  const tasks = useStore((s) => s.tasks);
  const updateSettings = useStore((s) => s.updateSettings);

  const activeSkin = settings.uniSkin ?? 'classic';
  const activePet = settings.uniPet ?? 'cat';
  const gradingScale = settings.gradingScale ?? 'pt20';
  const [now] = useState(() => new Date());
  const today = useMemo(() => todayStr(), []);
  const companion = useMemo(
    () =>
      computeUniCompanionState({
        sessions,
        tasks,
        weeklyCheckIns,
        studyLogs,
        today,
        lang: appLang,
      }),
    [sessions, tasks, weeklyCheckIns, studyLogs, today, appLang],
  );
  const range = useMemo(() => periodRange(period, settings, now), [period, settings, now]);

  const telemetry = useMemo(
    () => readCollectibleTelemetry(sessions, courses, weeklyCheckIns),
    [sessions, courses, weeklyCheckIns],
  );
  const collectibles = useMemo(() => getUniCollectibleStates(telemetry, appLang), [telemetry, appLang]);
  const petStates = useMemo(() => getUniPetStates(telemetry, appLang), [telemetry, appLang]);
  const unlockedCount = collectibles.filter((c) => c.unlocked).length;

  const hasSessions = sessions.length > 0;
  const hasTopics = courses.some((c) => c.topics.length > 0);
  const hasGradesOrAssessments = assessments.length > 0;

  const retention = useMemo(
    () => retentionOverview(courses, sessions, today),
    [courses, sessions, today],
  );

  const summary = useMemo(() => {
    const allTopics = courses.flatMap((c) => c.topics);
    const covered = allTopics.filter((t) => t.status === 'done' || t.status === 'review').length;
    const pct = allTopics.length > 0 ? covered / allTopics.length : 0;
    const totalDoneMin = sessions.filter((s) => s.done).reduce((sum, s) => sum + sessionMinutes(s), 0);
    return {
      pct,
      pctLabel: `${Math.round(pct * 100)}%`,
      covered,
      totalTopics: allTopics.length,
      totalDoneMin,
      avg: semesterAverage(courses, assessments),
      streak: studyStreak(sessions),
    };
  }, [courses, assessments, sessions]);

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        accentTitle={t('accentTitle')}
        subtitle={settings.semesterName.trim() || undefined}
        actions={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <TabGuideHelpButton tabKey="progresso" />
            <SegmentedControl
              layoutId="progress-period-pill"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              items={PERIODS.map((p) => ({ id: p.value, label: t(`periods.${p.value}`) }))}
            />
          </div>
        }
      />

      <TabGuideBanner tabKey="progresso" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          layoutId="progress-section-tabs"
          value={progressTab}
          onChange={(v) => setProgressTab(v as 'week' | 'semester')}
          items={[
            { id: 'week', label: t('tabWeek') },
            { id: 'semester', label: t('tabSemester') },
          ]}
        />
      </div>

      {/* Cartão Hero Bento "Progresso Geral" com anel estilo papelaria */}
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-pastel-sky/75 p-5 text-[#141312] shadow-card dark:bg-[#192A3D] dark:text-[#FAF6EC]">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{t('hero.title')}</p>
          <p className="font-display text-4xl font-bold tracking-tight tabular">{summary.pctLabel}</p>
          <p className="text-xs opacity-80">
            {summary.totalTopics > 0
              ? t('hero.topicsDone', { covered: summary.covered, total: summary.totalTopics })
              : t('hero.addTopicsHint')}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-medium">
            <span className="tabular">{t('avgLabel')}: <strong>{fmtGrade(summary.avg, gradingScale, appLang)}</strong></span>
            <span className="tabular">{t('hero.studied')}: <strong>{fmtMinutes(summary.totalDoneMin)}</strong></span>
            <span className="tabular">{t('streak')}: <strong>{summary.streak}d</strong></span>
            <span className="tabular">
              {t('hero.retention')}:{' '}
              <strong>
                {retention.avgRetentionPct !== null ? `${retention.avgRetentionPct}%` : '—'}
              </strong>
            </span>
            <span className="tabular">
              {t('hero.reviews')}:{' '}
              {retention.dueCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setReviewTarget({})}
                  className="inline-flex min-h-11 items-center font-bold underline decoration-dotted underline-offset-2 hover:opacity-80"
                >
                  {t('hero.reviewsDue', { count: retention.dueCount })}
                </button>
              ) : (
                <strong>{t('hero.upToDate')}</strong>
              )}
            </span>
          </div>
        </div>
        <Ring value={summary.pct} size={88} stroke={8} color="#157F58">
          <span className="font-display text-base font-bold tabular">{summary.pctLabel}</span>
        </Ring>
      </section>

      {/* Estante unificada do Uni (Unis & Diplomas + Aparências & Micropets) */}
      {progressTab === 'semester' && (
        <UniShelfSection
          collectibles={collectibles}
          petStates={petStates}
          unlockedCount={unlockedCount}
          activeSkin={activeSkin}
          activePet={activePet}
          companion={companion}
          onSelectSkin={(skinId) => {
            updateSettings({ uniSkin: skinId });
            showToast(t('logs.skinUpdatedToast'));
          }}
          onSelectPet={(petId) => {
            updateSettings({ uniPet: petId });
            showToast(petId === 'none' ? t('logs.petRemovedToast') : t('logs.petEquippedToast'));
          }}
          onOpenCustomize={() => setCollectiblesOpen(true)}
        />
      )}

      {progressTab === 'week' ? (
      <>
      {!hasSessions && !showEmptyCharts ? (
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-pastel-mint/55 p-5 text-[#141312] shadow-card dark:bg-[#17312B] dark:text-[#FAF6EC]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-lg space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.1em] opacity-75">
                  {t('emptyCharts.eyebrow')}
                </p>
                <h2 className="font-display text-lg font-bold">
                  {t('emptyCharts.title')}
                </h2>
                <p className="text-xs leading-relaxed opacity-85">
                  {t('emptyCharts.body')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/plano">
                  <Button size="sm" variant="primary">
                    {t('emptyCharts.generateBtn')} <ArrowRight size={14} />
                  </Button>
                </Link>
                <Button size="sm" variant="secondary" onClick={() => setShowEmptyCharts(true)}>
                  <BarChart3 size={14} /> {t('emptyCharts.previewBtn')}
                </Button>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/75 p-3 dark:bg-black/20">
                <p className="text-xs font-bold">{t('emptyCharts.card1Title')}</p>
                <p className="mt-1 text-xs opacity-75">{t('emptyCharts.card1Body')}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-3 dark:bg-black/20">
                <p className="text-xs font-bold">{t('emptyCharts.card2Title')}</p>
                <p className="mt-1 text-xs opacity-75">{t('emptyCharts.card2Body')}</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-3 dark:bg-black/20">
                <p className="text-xs font-bold">{t('emptyCharts.card3Title')}</p>
                <p className="mt-1 text-xs opacity-75">{t('emptyCharts.card3Body')}</p>
              </div>
            </div>
          </section>
          {hasTopics && (
            <RetentionFocusChart
              courses={courses}
              sessions={sessions}
              dayKey={today}
              onPracticeTopic={(courseId, topicId) => setReviewTarget({ courseId, topicId })}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(hasSessions || showEmptyCharts) && (
            <>
              <StudyByDayChart courses={courses} sessions={sessions} settings={settings} range={range} />
              <PlannedDoneChart sessions={sessions} range={range} />
              <CourseTimeChart courses={courses} sessions={sessions} range={range} />
            </>
          )}
          {(hasTopics || hasSessions || showEmptyCharts) && (
            <RetentionFocusChart
              courses={courses}
              sessions={sessions}
              dayKey={today}
              onPracticeTopic={(courseId, topicId) => setReviewTarget({ courseId, topicId })}
            />
          )}
        </div>
      )}

      {(hasSessions && (!hasTopics || !hasGradesOrAssessments) && !showEmptyCharts) || showEmptyCharts ? (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => setShowEmptyCharts((v) => !v)}>
            {showEmptyCharts ? t('emptyCharts.hideEmptyBtn') : t('emptyCharts.showEmptyBtn')}
          </Button>
        </div>
      ) : null}

      {/* Diário & Check-ins do Uni (Pós-aula, Fim do dia, Domingos e Modo Teste) */}
      {(() => {
        const weekLogDates = new Set(
          studyLogs.filter((l) => l.kind === 'week').map((l) => l.date),
        );
        const combinedLogs = [
          ...studyLogs.map((l) => ({ ...l, isStudyLog: true as const })),
          ...weeklyCheckIns
            .filter((wc) => !weekLogDates.has(wc.weekOf))
            .map((wc) => ({
              id: `wc-${wc.id}`,
              kind: 'week' as const,
              date: wc.weekOf,
              createdAt: wc.createdAt,
              courseId: wc.hardCourseIds?.[0],
              feeling:
                wc.mood === 'confiante'
                  ? 'bem'
                  : wc.mood === 'estavel'
                    ? 'mais_ou_menos'
                    : 'dificil',
              topicTitle: undefined,
              topicIds: undefined,
              studiedSummary: wc.pendingNextWeek,
              difficulties: wc.classDifficulties,
              notes: wc.notes,
              rating: undefined,
              isStudyLog: false as const,
            })),
        ].sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));

        const visibleLogs =
          logFilter === 'all' ? combinedLogs : combinedLogs.filter((l) => l.kind === logFilter);
        const kindBadges: Record<StudyLogKind, string> = {
          class: t('logs.postClass'),
          day: t('logs.endOfDay'),
          week: t('logs.sunday'),
          exam_prep: t('logs.testMode'),
        };

        return (
          <Card
            title={t('logs.title')}
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => openUniCheckIn({ kind: logFilter === 'all' ? 'day' : logFilter })}
              >
                <Plus size={14} /> {t('logs.newEntryBtn')}
              </Button>
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: t('logs.all', { count: combinedLogs.length }) },
                    { id: 'class', label: t('logs.postClass') },
                    { id: 'day', label: t('logs.endOfDay') },
                    { id: 'week', label: t('logs.sundays') },
                    { id: 'exam_prep', label: t('logs.testMode') },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogFilter(f.id)}
                    className={cx(
                      'min-h-[44px] rounded-full border px-3 py-1 text-xs font-semibold transition',
                      logFilter === f.id
                        ? 'border-[#168A45]/45 bg-pastel-mint/85 text-[#0E2918] dark:border-accent/55 dark:bg-accent-soft dark:text-accent-ink'
                        : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {visibleLogs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line p-5 text-center">
                  <BookOpenCheck size={20} className="text-muted" />
                  <p className="text-xs text-muted">{t('logs.emptyFilter')}</p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {visibleLogs.slice(0, 20).map((log) => {
                    const course = log.courseId ? courses.find((c) => c.id === log.courseId) : undefined;
                    const topicNames =
                      course && log.topicIds && log.topicIds.length > 0
                        ? course.topics.filter((tp) => log.topicIds!.includes(tp.id)).map((tp) => tp.title)
                        : [];
                    const feelingLabel = t(`assistant:checkin.feelings.${log.feeling}`, {
                      defaultValue: log.feeling,
                    });
                    return (
                      <li
                        key={log.id}
                        className={cx(
                          'flex items-start justify-between gap-3 rounded-2xl border p-3.5',
                          log.kind === 'exam_prep'
                            ? 'border-[#DFD2AE] bg-pastel-butter/40 dark:border-warn/25 dark:bg-[#352D14]/45'
                            : 'border-line bg-pastel-mint/25 dark:border-line dark:bg-[#17312B]/35',
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={log.kind === 'exam_prep' ? 'warn' : 'accent'}>
                              {kindBadges[log.kind]}
                            </Badge>
                            {course && <Badge tone="neutral">{course.shortName}</Badge>}
                            <span className="text-xs font-medium text-muted">{log.date}</span>
                            <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-fg">
                              {feelingLabel}
                              {log.rating ? ` · ${log.rating}/5` : ''}
                            </span>
                          </div>
                          {log.topicTitle && (
                            <p className="text-xs text-fg">
                              <strong className="font-semibold">{t('logs.topicLabel')}</strong> {log.topicTitle}
                            </p>
                          )}
                          {topicNames.length > 0 && (
                            <p className="text-xs text-fg">
                              <strong className="font-semibold">{t('logs.alignedTopicsLabel')}</strong>{' '}
                              {topicNames.join(', ')}
                            </p>
                          )}
                          {log.studiedSummary && (
                            <p className="text-xs text-muted">{log.studiedSummary}</p>
                          )}
                          {log.difficulties && (
                            <p className="text-xs text-coral">{t('logs.doubtsLabel', { text: log.difficulties })}</p>
                          )}
                          {log.notes && <p className="text-xs text-muted">{log.notes}</p>}
                        </div>
                        {log.isStudyLog && (
                          <button
                            type="button"
                            onClick={() => {
                              removeStudyLog(log.id);
                              showToast(t('logs.deletedToast'), 'neutral');
                            }}
                            aria-label={t('logs.deleteAria')}
                            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        );
      })()}
      </>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StreakHeatmap sessions={sessions} now={now} />
          <GradeBullets courses={courses} assessments={assessments} />
          <ReadinessChart assessments={assessments} courses={courses} />
          <WeaknessChart courses={courses} />
        </div>
      )}

      <UniCollectiblesModal open={collectiblesOpen} onClose={() => setCollectiblesOpen(false)} />

      <ActiveReviewModal
        open={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        courseId={reviewTarget?.courseId}
        initialTopicId={reviewTarget?.topicId}
      />
    </AnimatedPage>
  );
}
