// Cartão «Consciência do Uni»: avalia o plano atual de forma determinística ($0),
// explica desequilíbrios/pausas/choques e oferece ajustes opcionais num toque com Desfazer.
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, Lightbulb, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reviewPlanWithAi, type PlanAiReview } from '../../integrations/gemini';
import { hasAiAccess } from '../../lib/aiAccess';
import { resolveDateFnsLocale } from '../../lib/grading';
import { hapticTap } from '../../lib/nativeBridge';
import {
  analyzePlanConscience,
  type ConscienceOpinion,
  type PlanConscienceReport,
} from '../../lib/planner';
import { fmtMinutes } from '../../lib/selectors';
import { cx, showToast } from '../../lib/uiHelpers';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { StudySession } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button } from '../ui';

interface PlanConscienceCardProps {
  today: string;
  report?: PlanConscienceReport;
  dismissedIds?: Set<string>;
  onDismiss?: (id: string) => void;
  onCollapse?: () => void;
}

export default function PlanConscienceCard({
  today,
  report: externalReport,
  dismissedIds: externalDismissed,
  onDismiss: externalOnDismiss,
  onCollapse,
}: PlanConscienceCardProps) {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const events = useStore((s) => s.events);
  const materials = useStore((s) => s.materials);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const upsert = useStore((s) => s.upsert);
  const upsertMany = useStore((s) => s.upsertMany);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);

  const [localDismissedIds, setLocalDismissedIds] = useState<Set<string>>(() => new Set());
  const dismissedIds = externalDismissed ?? localDismissedIds;
  const [mountNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<PlanAiReview | null>(null);
  const [aiError, setAiError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const computedReport = useMemo(
    () =>
      externalReport ??
      analyzePlanConscience({
        courses,
        assessments,
        classes,
        events,
        materials,
        sessions,
        settings,
        extraActivities: academicProfile.extraActivities,
        weeklyCheckIns,
        today,
        nowMinutes: mountNowMinutes,
      }),
    [
      externalReport,
      courses,
      assessments,
      classes,
      events,
      materials,
      sessions,
      settings,
      academicProfile.extraActivities,
      weeklyCheckIns,
      today,
      mountNowMinutes,
    ],
  );
  const report = computedReport;

  const visibleOpinions = useMemo(
    () => report.opinions.filter((op) => !dismissedIds.has(op.id)),
    [report.opinions, dismissedIds],
  );

  const uniAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile?.degreeName,
    courses[0]?.name,
  );
  const aiAvailable = hasAiAccess(settings);

  const formatOpinionMessage = (op: ConscienceOpinion): string => {
    const params: Record<string, string | number> = { ...op.messageParams };
    if (typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      try {
        params.date = format(parseISO(params.date), 'EEE d MMM', { locale: dfLocale });
      } catch {
        // mantém ISO
      }
    }
    if (typeof params.minutes === 'number') {
      params.time = fmtMinutes(params.minutes);
    }
    if (typeof params.planned === 'number') {
      params.plannedTime = fmtMinutes(params.planned);
    }
    if (typeof params.budget === 'number') {
      params.budgetTime = fmtMinutes(params.budget);
    }
    return t(op.messageKey, params);
  };

  const applyOpinion = (op: ConscienceOpinion) => {
    const action = op.action;
    if (!action) return;
    void hapticTap();

    if (action.kind === 'remove_sessions') {
      const removed = useStore
        .getState()
        .sessions.filter((s) => action.sessionIds.includes(s.id));
      if (removed.length === 0) return;
      for (const s of removed) remove('sessions', s.id);
      showToast(t('conscience.toast.removed', { count: removed.length }), {
        tone: 'neutral',
        action: {
          label: t('replan.undo'),
          onPress: () => upsertMany('sessions', removed),
        },
      });
      return;
    }

    if (action.kind === 'move_session') {
      const target = useStore.getState().sessions.find((s) => s.id === action.sessionId);
      if (!target) return;
      const prevPatch: Partial<StudySession> = {
        date: target.date,
        start: target.start,
        locked: target.locked,
      };
      patch('sessions', target.id, {
        date: action.targetDate,
        start: action.targetStart,
        locked: true,
      });
      showToast(
        t('conscience.toast.moved', {
          date: format(parseISO(action.targetDate), 'EEE d', { locale: dfLocale }),
          time: action.targetStart,
        }),
        {
          tone: 'ok',
          action: {
            label: t('replan.undo'),
            onPress: () => patch('sessions', target.id, prevPatch),
          },
        },
      );
      return;
    }

    if (action.kind === 'add_session') {
      const created: StudySession = {
        ...action.session,
        id: newId(),
      };
      upsert('sessions', created);
      showToast(
        t('conscience.toast.added', {
          date: format(parseISO(created.date), 'EEE d', { locale: dfLocale }),
          time: created.start ?? '',
        }),
        {
          tone: 'ok',
          action: {
            label: t('replan.undo'),
            onPress: () => remove('sessions', created.id),
          },
        },
      );
    }
  };

  const dismissOpinion = (id: string) => {
    if (externalOnDismiss) {
      externalOnDismiss(id);
      return;
    }
    setLocalDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const askSecondOpinion = async () => {
    if (!aiAvailable || aiLoading) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiLoading(true);
    setAiError(false);
    try {
      const review = await reviewPlanWithAi({
        today,
        courses,
        assessments,
        sessions,
        pausedCourseIds: settings.plannerPrefs?.pausedCourseIds,
        boostCourseIds: settings.plannerPrefs?.boostCourseIds,
        exclusiveTestFocus: settings.plannerPrefs?.exclusiveTestFocus,
        lang: i18n.language,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setAiReview(review);
    } catch {
      if (!controller.signal.aborted) setAiError(true);
    } finally {
      if (!controller.signal.aborted) setAiLoading(false);
    }
  };

  if (report.status === 'empty') return null;

  const isAllGood = visibleOpinions.length === 0;

  return (
    <section
      aria-label={t('conscience.title')}
      className={cx(
        'space-y-3 rounded-2xl border px-4 py-3 shadow-card',
        isAllGood
          ? 'border-line bg-surface'
          : 'border-warn/35 bg-pastel-butter/35 dark:bg-surface',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-pastel-butter/75 dark:bg-surface-2">
            <UniBuddy
              size={24}
              accessory={uniAccessory}
              skin={settings.uniSkin ?? 'classic'}
              mood={aiLoading ? 'thinking' : isAllGood ? 'happy' : 'calm'}
              interactive={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-fg">{t('conscience.title')}</p>
            <p className="text-xs text-muted">
              {isAllGood
                ? t('conscience.status.aligned')
                : t('conscience.status.needsAttention', { count: visibleOpinions.length })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {aiAvailable && (
            <Button
              size="sm"
              variant="secondary"
              disabled={aiLoading}
              onClick={() => void askSecondOpinion()}
            >
              <Sparkles size={14} aria-hidden="true" />
              {aiLoading ? t('conscience.aiLoading') : t('conscience.aiButton')}
            </Button>
          )}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label={t('conscience.collapseAria')}
              title={t('conscience.collapseAria')}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {visibleOpinions.length > 0 && (
        <ul className="space-y-2">
          {visibleOpinions.map((op) => (
            <li
              key={op.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface/90 px-3 py-2.5"
            >
              <div className="flex min-w-[200px] flex-1 items-start gap-2">
                {op.severity === 'warn' ? (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                ) : (
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                )}
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-fg">
                  {formatOpinionMessage(op)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                {op.action && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => applyOpinion(op)}
                  >
                    {t(op.action.labelKey)}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => dismissOpinion(op.id)}
                  aria-label={t('conscience.dismissAria')}
                  title={t('conscience.dismissAria')}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
                >
                  <X size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {aiError && (
        <p className="rounded-xl bg-surface-2/80 px-3 py-2 text-xs text-muted">
          {t('conscience.aiFailed')}
        </p>
      )}

      {aiReview && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-fg">
                {aiReview.headline || t('conscience.aiReviewTitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiReview(null)}
              aria-label={t('conscience.closeReviewAria')}
              className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted transition hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>
          {aiReview.opinions.length > 0 && (
            <ul className="space-y-1.5">
              {aiReview.opinions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-fg">
                  {item.tone === 'good' ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
                  ) : item.tone === 'warn' ? (
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                  ) : (
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{item.summary}</span>
                    {item.suggestion && (
                      <span className="block text-muted">{item.suggestion}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
