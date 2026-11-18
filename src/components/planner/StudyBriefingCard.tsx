import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen,
  MessageSquareText,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStudyBriefingPlan } from '../../hooks/useStudyBriefingPlan';
import { resolveDateFnsLocale } from '../../lib/grading';
import { capitalizeFirst, fmtMinutes, formatSessionDisplay, formatSessionReason } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  Settings,
  StudyLogEntry,
  StudySession,
  WeeklyCheckIn,
} from '../../types';
import { Button, CourseChip, Textarea } from '../ui';

interface Props {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials: Material[];
  sessions: StudySession[];
  settings: Settings;
  today: string;
  difficultCourseIds?: ID[];
  weeklyCheckIns?: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  extraActivities?: ExtraActivity[];
  hasExistingPlan: boolean;
  onApplyPlan: (sessions: StudySession[], briefingNote: string) => void;
  onOpenStudio: () => void;
}

function cleanMaterialTitle(title: string): string {
  return title
    .replace(/\s*\[(slide_oficial|teste_antigo|exame_antigo|ficha|sebenta|relatorio|outro)\]/gi, '')
    .trim();
}

export default function StudyBriefingCard({
  courses,
  assessments,
  classes,
  events,
  materials,
  sessions,
  settings,
  today,
  difficultCourseIds,
  weeklyCheckIns,
  studyLogs,
  extraActivities,
  hasExistingPlan,
  onApplyPlan,
  onOpenStudio,
}: Props) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState<boolean>(() => !hasExistingPlan);

  const {
    briefingText,
    setBriefingText,
    status,
    errorMessage,
    needsAiConsent,
    isOfflinePreview,
    strategySummary,
    suggestedFollowUps,
    refinementsApplied,
    effectivePreviewSessions,
    lockedIds,
    excludedIds,
    generateFromBriefing,
    refinePreview,
    generateOfflineFallback,
    cancelLoading,
    toggleLock,
    excludeSession,
    restoreExcluded,
    discardPreview,
  } = useStudyBriefingPlan({
    courses,
    assessments,
    classes,
    events,
    materials,
    sessions,
    settings,
    today,
    difficultCourseIds,
    weeklyCheckIns,
    studyLogs,
    extraActivities,
  });

  const isExpanded = expanded || status === 'loading' || status === 'preview' || status === 'error';

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const topicById = useMemo(
    () => new Map(courses.flatMap((c) => c.topics.map((tp) => [tp.id, tp] as const))),
    [courses],
  );
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);
  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of effectivePreviewSessions) {
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return [...map.entries()];
  }, [effectivePreviewSessions]);

  const totalPreviewMinutes = useMemo(
    () => effectivePreviewSessions.reduce((sum, s) => sum + s.minutes, 0),
    [effectivePreviewSessions],
  );

  const starterPrompts = [
    t('studyBriefing.sampleTest3Days'),
    t('studyBriefing.sampleMidSemester'),
    t('studyBriefing.sampleEveningsOnly'),
  ];

  const followUpOptions = useMemo(() => {
    const defaults = [
      t('studyBriefing.followUpLighter'),
      t('studyBriefing.followUpPractice'),
      t('studyBriefing.followUpEarlier'),
      t('studyBriefing.followUpWeekendLight'),
    ];
    const combined = [...suggestedFollowUps, ...defaults];
    const seen = new Set<string>();
    return combined
      .filter((label) => {
        const key = label.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [suggestedFollowUps, t]);

  const savedBriefingPreview = (briefingText || settings.plannerPrefs?.briefingNote || '').trim();
  const collapsedSubtitle = savedBriefingPreview
    ? savedBriefingPreview.length > 90
      ? `${savedBriefingPreview.slice(0, 87)}…`
      : savedBriefingPreview
    : t('studyBriefing.collapsedHint');

  const handleApply = () => {
    if (effectivePreviewSessions.length === 0) return;
    onApplyPlan(effectivePreviewSessions, briefingText.trim().slice(0, 1200));
    discardPreview();
    setExpanded(false);
  };

  return (
    <section
      aria-label={t('studyBriefing.ariaLabel')}
      className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-card"
    >
      {/* Barra superior compacta sempre visível */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-85"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink"
          >
            <MessageSquareText size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold tracking-tight text-fg">
              {t('studyBriefing.title')}{' '}
              <span className="font-serif font-medium italic text-accent">
                {t('studyBriefing.titleAccent')}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {isExpanded ? t('studyBriefing.subtitle') : collapsedSubtitle}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenStudio}
            className="whitespace-nowrap"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">{t('studyBriefing.openStudio')}</span>
            <span className="sm:hidden">{t('studyBriefing.openStudioShort')}</span>
          </Button>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? t('studyBriefing.collapseAria') : t('studyBriefing.expandAria')
            }
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface-2/60 px-2.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Área conversacional expansível */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="study-briefing-body"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="divide-y divide-line border-t border-line"
          >
            {/* 1. Caixa de briefing + sugestões de partida */}
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Textarea
                rows={2}
                value={briefingText}
                onChange={(e) => setBriefingText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && briefingText.trim() && status !== 'loading') {
                    e.preventDefault();
                    void generateFromBriefing();
                  }
                }}
                placeholder={t('studyBriefing.placeholder')}
                aria-label={t('studyBriefing.inputAria')}
                className="bg-surface-2/40"
              />

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {starterPrompts.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setBriefingText(sample)}
                      className="min-h-11 rounded-xl border border-line bg-surface-2/50 px-3 py-1.5 text-left text-xs font-medium text-muted transition hover:border-accent/45 hover:text-fg"
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                <Button
                  variant="primary"
                  disabled={courses.length === 0 || !briefingText.trim() || status === 'loading'}
                  onClick={() => void generateFromBriefing()}
                  className="shrink-0 whitespace-nowrap"
                >
                  <Sparkles size={15} />
                  {status === 'loading'
                    ? t('studyBriefing.generatingBtn')
                    : t('studyBriefing.generateBtn')}
                </Button>
              </div>
            </div>

            {/* 2. Estado de carregamento (Skeleton com geometria compatível) */}
            {status === 'loading' && (
              <div className="space-y-3 px-4 py-4 sm:px-5" aria-busy="true">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-fg">{t('studyBriefing.loadingTitle')}</p>
                  <Button size="sm" variant="ghost" onClick={cancelLoading}>
                    {t('studyBriefing.cancel')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {[0, 1, 2].map((row) => (
                    <div
                      key={row}
                      className="flex h-14 items-center justify-between gap-3 rounded-xl bg-surface-2/70 px-3.5 animate-pulse"
                    >
                      <div className="h-3 w-48 rounded bg-line" />
                      <div className="h-3 w-16 rounded bg-line" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Estado de erro honesto + fallback offline explícito */}
            {status === 'error' && errorMessage && (
              <div role="alert" className="space-y-3 bg-coral-soft/55 px-4 py-4 sm:px-5">
                <div className="flex items-start gap-2.5 text-xs text-fg">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {needsAiConsent ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate('/definicoes')}
                    >
                      {t('studyBriefing.openAiSettings')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void generateFromBriefing()}
                    >
                      {t('studyBriefing.retry')}
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={generateOfflineFallback}>
                    {t('studyBriefing.useOffline')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={discardPreview}>
                    {t('studyBriefing.dismiss')}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Pré-visualização interativa de 7 dias + chips de seguimento */}
            {status === 'preview' && (
              <div className="divide-y divide-line">
                {/* Resumo estratégico e métricas */}
                <div className="space-y-3 bg-pastel-sage/35 px-4 py-3.5 dark:bg-surface-2/50 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-accent-ink">
                        {isOfflinePreview
                          ? t('studyBriefing.offlineSummaryLabel')
                          : t('studyBriefing.aiSummaryLabel')}
                      </p>
                      <p className="text-sm leading-relaxed text-fg">
                        {strategySummary || t('studyBriefing.defaultStrategySummary')}
                      </p>
                    </div>
                    <div className="shrink-0 font-mono text-xs font-semibold text-fg tabular">
                      {t('studyBriefing.previewTotals', {
                        count: effectivePreviewSessions.length,
                        time: fmtMinutes(totalPreviewMinutes),
                      })}
                    </div>
                  </div>

                  {/* Chips conversacionais de seguimento */}
                  {!isOfflinePreview && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted">
                        {t('studyBriefing.followUpTitle')}
                        {refinementsApplied.length > 0 && (
                          <span>
                            {' · '}
                            {t('studyBriefing.refinementsCount', { count: refinementsApplied.length })}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {followUpOptions.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => void refinePreview(chip)}
                            className="min-h-11 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista dos próximos 7 dias */}
                {effectivePreviewSessions.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-muted sm:px-5">
                    {t('studyBriefing.allExcluded')}
                  </div>
                ) : (
                  <div className="max-h-[360px] divide-y divide-line overflow-y-auto">
                    {groupedByDay.map(([dateKey, daySessions]) => {
                      const dayTotal = daySessions.reduce((sum, s) => sum + s.minutes, 0);
                      return (
                        <div key={dateKey} className="px-4 py-3 sm:px-5">
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
                            <span className="font-display font-bold text-fg">
                              {capitalizeFirst(
                                format(parseISO(dateKey), 'EEE d MMM', { locale: dfLocale }),
                              )}
                            </span>
                            <span className="font-mono tabular">
                              {t('studyBriefing.dayMeta', {
                                count: daySessions.length,
                                time: fmtMinutes(dayTotal),
                              })}
                            </span>
                          </div>

                          <ul className="divide-y divide-line/60">
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
                              const whyText = formatSessionReason(s, assessment, i18n.language);
                              const isLocked = lockedIds.includes(s.id);

                              return (
                                <li
                                  key={s.id}
                                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                                >
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <CourseChip course={course} />
                                      <span className="font-mono text-xs text-muted tabular">
                                        {s.start ?? '--:--'} · {s.minutes}m
                                      </span>
                                    </div>
                                    <p className="truncate text-sm font-medium text-fg">
                                      {display.title}
                                    </p>
                                    {(whyText || material) && (
                                      <p className="truncate text-xs text-muted">
                                        {material ? cleanMaterialTitle(material.title) : ''}
                                        {material && whyText ? ' · ' : ''}
                                        {whyText ? `${t('builder.previewActions.whyPrefix')} ${whyText}` : ''}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleLock(s.id)}
                                      aria-pressed={isLocked}
                                      aria-label={
                                        isLocked
                                          ? t('session.unlock')
                                          : t('session.lock')
                                      }
                                      title={
                                        isLocked
                                          ? t('builder.previewActions.lockedInPreview')
                                          : t('builder.previewActions.lockInPreview')
                                      }
                                      className={cx(
                                        'flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition',
                                        isLocked
                                          ? 'border-accent bg-accent-soft text-accent-ink'
                                          : 'border-line bg-surface-2/50 text-muted hover:text-fg',
                                      )}
                                    >
                                      {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => excludeSession(s.id)}
                                      aria-label={t('builder.previewActions.removeFromPreview')}
                                      title={t('builder.previewActions.removeFromPreview')}
                                      className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-surface-2/50 text-muted transition hover:border-coral/50 hover:text-coral"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rodapé de confirmação */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/35 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={discardPreview}>
                      {t('studyBriefing.discardDraft')}
                    </Button>
                    {excludedIds.length > 0 && (
                      <Button size="sm" variant="secondary" onClick={restoreExcluded}>
                        <RotateCcw size={13} />{' '}
                        {t('builder.previewActions.resetExcluded', { count: excludedIds.length })}
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    disabled={effectivePreviewSessions.length === 0}
                    onClick={handleApply}
                    className="whitespace-nowrap"
                  >
                    <Check size={15} />{' '}
                    {t('studyBriefing.applyWeek', { count: effectivePreviewSessions.length })}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
