import { addDays, format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasAiAccess } from '../../lib/aiAccess';
import type { ParsedBriefingInsight } from '../../lib/plannerBriefing';
import { resolveDateFnsLocale } from '../../lib/grading';
import { fmtMinutes } from '../../lib/selectors';
import { cx, showToast } from '../../lib/uiHelpers';
import type { Course, ID, Settings, Topic } from '../../types';
import { Badge, Button, CourseChip, Select, Textarea } from '../ui';

export interface TopicCalibrationOverride {
  status: Topic['status'];
  confidence: Topic['confidence'];
}

interface Props {
  courses: Course[];
  settings: Settings;
  briefingText: string;
  onBriefingChange: (text: string) => void;
  insights: ParsedBriefingInsight[];
  disabledInsightIds: string[];
  onToggleInsight: (insight: ParsedBriefingInsight) => void;
  onRefineWithAi: () => Promise<void>;
  isRefiningAi: boolean;
  topicOverrides: Record<ID, TopicCalibrationOverride>;
  onSetTopicOverride: (topicId: ID, next: TopicCalibrationOverride) => void;
  onMarkFirstNTopics: (course: Course, count: number) => void;
}

export default function BuilderStepBriefing({
  courses,
  settings,
  briefingText,
  onBriefingChange,
  insights,
  disabledInsightIds,
  onToggleInsight,
  onRefineWithAi,
  isRefiningAi,
  topicOverrides,
  onSetTopicOverride,
  onMarkFirstNTopics,
}: Props) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const formatInsightChip = (ins: ParsedBriefingInsight): string => {
    const courseName = ins.courseId ? (courseById.get(ins.courseId)?.shortName ?? ins.courseId) : '';
    const dayName =
      ins.weekday !== undefined
        ? format(new Date(2024, 0, 7 + ins.weekday), 'EEE', { locale: dfLocale })
        : '';
    if (ins.kind === 'mid_semester') return t('weekCheck.strategy.catch_up');
    if (ins.kind === 'content_mix' && ins.contentMix) return t(`weekCheck.mix.${ins.contentMix}`);
    if (ins.kind === 'marathon' && ins.marathon) {
      return t('weekCheck.item.marathon', {
        time: fmtMinutes(ins.marathon.dailyMinutes),
        days: ins.marathon.daysBefore,
      });
    }
    if (ins.kind === 'course_boost') return t('weekCheck.item.boost', { course: courseName });
    if (ins.kind === 'course_pause') return t('weekCheck.item.pause', { course: courseName });
    if (ins.kind === 'course_focus') {
      return t('weekCheck.item.note', { course: courseName, text: ins.focusNote ?? '' });
    }
    if (ins.kind === 'topic_mastered') {
      return `${courseName}: ${(ins.topicUpdates ?? []).length} (${t('weekCheck.topicStatus.done')})`;
    }
    if (ins.kind === 'availability') {
      if (ins.setEnabled === false) return t('weekCheck.item.dayOff', { day: dayName });
      if (ins.blockedPeriod) {
        return t('weekCheck.item.dayBlocked', {
          day: dayName,
          period: t(`weekCheck.period.${ins.blockedPeriod}`),
        });
      }
      if (ins.setMinutes) {
        return t('weekCheck.item.dayMinutes', { day: dayName, time: fmtMinutes(ins.setMinutes) });
      }
      if (ins.setWindow) {
        return t('weekCheck.item.dayWindow', {
          day: dayName,
          period: t(`weekCheck.period.${ins.setWindow}`),
        });
      }
    }
    return ins.id;
  };
  const [expandedCourseId, setExpandedCourseId] = useState<ID | null>(
    () => courses.find((c) => c.topics.length > 0)?.id ?? null,
  );
  const canUseAi = hasAiAccess(settings);

  const appendSample = (phrase: string) => {
    const clean = briefingText.trim();
    if (clean.toLowerCase().includes(phrase.toLowerCase())) return;
    onBriefingChange(clean ? `${clean}. ${phrase}` : phrase);
  };

  const samples = [
    t('builder.briefing.sampleCatchUp'),
    t('builder.briefing.sampleMarathon'),
    t('builder.briefing.sampleWeekend'),
    t('builder.briefing.sampleNightOnly'),
  ];

  // Referência visual só para manter o imports limpos se precisarmos depois
  void addDays;
  void format;
  void parseISO;

  return (
    <div className="space-y-5">
      {/* 1. Explicar ao Uni */}
      <section className="space-y-2.5 rounded-2xl border border-line bg-surface-2/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-fg">
              {t('builder.briefing.title')}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t('builder.briefing.subtitle')}
            </p>
          </div>
          {canUseAi && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isRefiningAi || briefingText.trim().length < 8}
              onClick={() => {
                void onRefineWithAi().catch(() => {
                  showToast(t('builder.briefing.aiRefineError'), 'neutral');
                });
              }}
            >
              <Wand2 size={14} />{' '}
              {isRefiningAi ? t('builder.briefing.refiningAi') : t('builder.briefing.refineAi')}
            </Button>
          )}
        </div>

        <Textarea
          rows={3}
          value={briefingText}
          onChange={(e) => onBriefingChange(e.target.value)}
          placeholder={t('builder.briefing.placeholder')}
          className="bg-surface"
        />

        <div className="flex flex-wrap gap-1.5">
          {samples.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => appendSample(phrase)}
              className="min-h-11 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-fg"
            >
              + {phrase}
            </button>
          ))}
        </div>

        {/* Chips do que o Uni entendeu */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t('builder.briefing.understoodTitle')}
          </p>
          {insights.length === 0 ? (
            <p className="text-xs text-muted">{t('builder.briefing.noInsightsYet')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {insights.map((ins) => {
                const active = !disabledInsightIds.includes(ins.id);
                return (
                  <button
                    key={ins.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggleInsight(ins)}
                    className={cx(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-dashed border-line bg-surface text-muted line-through opacity-70',
                    )}
                  >
                    <Sparkles size={12} aria-hidden="true" />
                    <span>{formatInsightChip(ins)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 2. Calibração rápida de meio do semestre por cadeira */}
      {courses.length > 0 && (
        <section className="space-y-2.5">
          <div>
            <h3 className="font-display text-sm font-bold text-fg">
              {t('builder.briefing.midSemesterTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {t('builder.briefing.midSemesterHint')}
            </p>
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {courses.map((course) => {
              const isOpen = expandedCourseId === course.id;
              const doneCount = course.topics.filter((tp) => {
                const effStatus = topicOverrides[tp.id]?.status ?? tp.status;
                return effStatus === 'done';
              }).length;

              return (
                <div key={course.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedCourseId(isOpen ? null : course.id)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-surface-2/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CourseChip course={course} />
                      <span className="truncate text-sm font-semibold text-fg">
                        {course.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {course.topics.length > 0 && (
                        <Badge tone={doneCount > 0 ? 'ok' : 'neutral'}>
                          {t('builder.briefing.topicsDoneCount', {
                            done: doneCount,
                            total: course.topics.length,
                          })}
                        </Badge>
                      )}
                      {isOpen ? (
                        <ChevronUp size={16} className="text-muted" />
                      ) : (
                        <ChevronDown size={16} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t border-line bg-surface-2/35 px-4 py-3">
                      {course.topics.length === 0 ? (
                        <p className="text-xs text-muted">
                          {t('builder.briefing.noTopicsCourse')}
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted">
                              {t('builder.briefing.markFirstN')}
                            </span>
                            <div className="w-40">
                              <Select
                                aria-label={t('builder.briefing.markFirstN')}
                                value={String(doneCount)}
                                onChange={(e) =>
                                  onMarkFirstNTopics(course, Number(e.target.value))
                                }
                              >
                                {Array.from(
                                  { length: course.topics.length + 1 },
                                  (_, idx) => (
                                    <option key={idx} value={String(idx)}>
                                      {idx} / {course.topics.length}
                                    </option>
                                  ),
                                )}
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {course.topics.map((tp, idx) => {
                              const currentStatus =
                                topicOverrides[tp.id]?.status ?? tp.status;
                              const masteryChoice: 'done' | 'learning' | 'todo' =
                                currentStatus === 'done' || currentStatus === 'review'
                                  ? 'done'
                                  : currentStatus === 'learning'
                                    ? 'learning'
                                    : 'todo';

                              return (
                                <div
                                  key={tp.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-fg">
                                    {masteryChoice === 'done' && (
                                      <CheckCircle2
                                        size={14}
                                        className="shrink-0 text-ok"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="font-mono text-muted tabular">
                                      {idx + 1}.
                                    </span>
                                    <span className="truncate">{tp.title}</span>
                                  </span>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {(
                                      [
                                        {
                                          id: 'done',
                                          status: 'done' as const,
                                          confidence: 4 as const,
                                          label: t('builder.briefing.mastery.done'),
                                        },
                                        {
                                          id: 'learning',
                                          status: 'learning' as const,
                                          confidence: 3 as const,
                                          label: t('builder.briefing.mastery.learning'),
                                        },
                                        {
                                          id: 'todo',
                                          status: 'todo' as const,
                                          confidence: 2 as const,
                                          label: t('builder.briefing.mastery.todo'),
                                        },
                                      ] as const
                                    ).map((opt) => {
                                      const active = masteryChoice === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() =>
                                            onSetTopicOverride(tp.id, {
                                              status: opt.status,
                                              confidence: opt.confidence,
                                            })
                                          }
                                          className={cx(
                                            'min-h-11 rounded-lg border px-2.5 text-xs font-semibold transition',
                                            active
                                              ? opt.id === 'done'
                                                ? 'border-ok bg-accent-soft text-ok-ink'
                                                : opt.id === 'learning'
                                                  ? 'border-warn/60 bg-pastel-butter/70 text-[#6B4800] dark:bg-surface-2 dark:text-fg'
                                                  : 'border-accent bg-accent-soft text-accent-ink'
                                              : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                                          )}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
