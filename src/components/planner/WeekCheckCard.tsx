// Cartão «Como está a tua semana?»: pedido em linguagem natural que vira INTENÇÃO
// (regras com validade), nunca blocos diretos, com revisão antes de aplicar.
import { format, parseISO } from 'date-fns';
import { Check, MessageSquareText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanBriefing } from '../../hooks/usePlanBriefing';
import { resolveDateFnsLocale } from '../../lib/grading';
import type { IntentItem } from '../../lib/planner/intent';
import { fmtMinutes } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import type { Course, Topic } from '../../types';
import { Button, Switch, Textarea } from '../ui';

function formatShortDate(isoDate: string, locale: ReturnType<typeof resolveDateFnsLocale>): string {
  try {
    return format(parseISO(isoDate), 'EEE d', { locale });
  } catch {
    return isoDate;
  }
}

export default function WeekCheckCard() {
  const { t, i18n } = useTranslation('plan');
  const dfLocale = resolveDateFnsLocale(i18n.language);
  const courses = useStore((s) => s.courses);
  const lastBriefingNote = useStore((s) => s.settings.plannerPrefs?.briefingNote ?? '');
  const {
    status,
    intent,
    disabledIds,
    enabledItems,
    simpleReason,
    lastText,
    read,
    toggle,
    apply,
    reset,
  } = usePlanBriefing();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => lastBriefingNote);
  const [appliedCount, setAppliedCount] = useState(0);

  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]));
  const topicMap = new Map<string, Topic>(
    courses.flatMap((c) => c.topics.map((tp) => [tp.id, tp] as const)),
  );

  const describeItem = (item: IntentItem): { label: string; validity?: string } => {
    switch (item.kind) {
      case 'course_mode': {
        const course = courseMap.get(item.courseId)?.shortName ?? item.courseId;
        return {
          label: t(item.mode === 'boost' ? 'weekCheck.item.boost' : 'weekCheck.item.pause', { course }),
          validity: item.until
            ? t('weekCheck.until', { date: formatShortDate(item.until, dfLocale) })
            : t('weekCheck.everyWeek'),
        };
      }
      case 'exclusive_focus': {
        const course = courseMap.get(item.courseId)?.shortName ?? item.courseId;
        return {
          label: t('weekCheck.item.exclusiveFocus', { course }),
          validity: item.until
            ? t('weekCheck.until', { date: formatShortDate(item.until, dfLocale) })
            : t('weekCheck.everyWeek'),
        };
      }
      case 'course_note': {
        const course = courseMap.get(item.courseId)?.shortName ?? item.courseId;
        return {
          label: t('weekCheck.item.note', { course, text: item.text }),
          validity: item.from
            ? t('weekCheck.range', {
                from: formatShortDate(item.from, dfLocale),
                until: formatShortDate(item.until, dfLocale),
              })
            : t('weekCheck.until', { date: formatShortDate(item.until, dfLocale) }),
        };
      }
      case 'weekday_rule': {
        const day = format(new Date(2024, 0, 7 + item.weekday), 'EEE', { locale: dfLocale });
        const label =
          item.enabled === false
            ? t('weekCheck.item.dayOff', { day })
            : item.blockedPeriod
              ? t('weekCheck.item.dayBlocked', {
                  day,
                  period: t(`weekCheck.period.${item.blockedPeriod}`),
                })
              : item.minutes !== undefined
                ? t('weekCheck.item.dayMinutes', { day, time: fmtMinutes(item.minutes) })
                : t('weekCheck.item.dayWindow', {
                    day,
                    period: t(`weekCheck.period.${item.window ?? 'auto'}`),
                  });
        return { label, validity: t('weekCheck.everyWeek') };
      }
      case 'date_override': {
        const day = formatShortDate(item.date, dfLocale);
        const label =
          item.enabled === false
            ? t('weekCheck.item.dayOff', { day })
            : item.minutes !== undefined
              ? t('weekCheck.item.dayMinutes', { day, time: fmtMinutes(item.minutes) })
              : t('weekCheck.item.dayWindow', {
                  day,
                  period: t(`weekCheck.period.${item.window ?? 'auto'}`),
                });
        return { label, validity: t('weekCheck.onlyOn', { date: day }) };
      }
      case 'marathon':
        return {
          label: t('weekCheck.item.marathon', {
            time: fmtMinutes(item.marathon.dailyMinutes),
            days: item.marathon.daysBefore,
          }),
        };
      case 'strategy':
        return { label: t(`weekCheck.strategy.${item.strategy}`) };
      case 'content_mix':
        return {
          label: t('weekCheck.item.contentMix', { mix: t(`weekCheck.mix.${item.mix}`) }),
        };
      case 'topic_hint': {
        const topic = topicMap.get(item.topicId)?.title ?? item.topicId;
        return {
          label: t('weekCheck.item.topic', {
            topic,
            status: t(`weekCheck.topicStatus.${item.status}`),
          }),
        };
      }
    }
  };

  // Fechado (idle): uma linha e botão «Contar ao Uni»
  if (status === 'idle' && !editing) {
    const shownLast = (lastText || lastBriefingNote).trim();
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
            <MessageSquareText size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{t('weekCheck.title')}</p>
            <p className="truncate text-xs text-muted">
              {shownLast
                ? t('weekCheck.hintLast', { text: shownLast })
                : t('weekCheck.hintEmpty')}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(shownLast);
            setEditing(true);
          }}
        >
          {t('weekCheck.open')}
        </Button>
      </section>
    );
  }

  // Aplicado: resumo de uma linha e «Alterar»
  if (status === 'applied' && !editing) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok/35 bg-ok/10 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Check size={16} className="shrink-0 text-ok" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs font-semibold text-fg">
            {t('weekCheck.applied', { count: appliedCount })}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setDraft(lastText || lastBriefingNote);
            setEditing(true);
          }}
        >
          {t('weekCheck.change')}
        </Button>
      </section>
    );
  }

  // Revisão: «O Uni percebeu» com interruptor + validade + Aplicar / Editar texto
  if (status === 'review' && intent && !editing) {
    const items = intent.items;
    return (
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-fg">
            <Sparkles size={15} className="text-accent" aria-hidden="true" />
            {t('weekCheck.understood')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{t('weekCheck.understoodHint')}</p>
        </div>

        {simpleReason && (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            {simpleReason === 'no_consent'
              ? t('weekCheck.simpleNoConsent')
              : t('weekCheck.simpleAiFailed')}
          </p>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
            {t('weekCheck.nothing')}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-2/40">
            {items.map((item) => {
              const active = !disabledIds.has(item.id);
              const { label, validity } = describeItem(item);
              return (
                <li
                  key={item.id}
                  className={cx(
                    'flex min-h-[52px] items-center justify-between gap-3 px-3.5 py-2.5 transition',
                    !active && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-xs font-semibold text-fg sm:text-sm', !active && 'line-through')}>
                      {label}
                    </p>
                    {validity && <p className="mt-0.5 text-xs text-muted">{validity}</p>}
                  </div>
                  <div className="flex min-h-11 items-center">
                    <Switch
                      checked={active}
                      onCheckedChange={() => toggle(item.id)}
                      label={label}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(lastText);
              setEditing(true);
            }}
          >
            {t('weekCheck.edit')}
          </Button>
          {items.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              disabled={enabledItems.length === 0}
              onClick={() => {
                const count = enabledItems.length;
                if (apply()) {
                  setAppliedCount(count);
                  setEditing(false);
                }
              }}
            >
              <Check size={14} aria-hidden="true" /> {t('weekCheck.apply')}
            </Button>
          )}
        </div>
      </section>
    );
  }

  // Aberto: caixa de texto + Ler + Cancelar
  const reading = status === 'reading';
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-fg">{t('weekCheck.title')}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            if (status === 'reading') reset();
          }}
        >
          {t('weekCheck.cancel')}
        </Button>
      </div>

      <Textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('weekCheck.placeholder')}
        aria-label={t('weekCheck.inputAria')}
        className="bg-surface-2/40"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t('weekCheck.hintEmpty')}</p>
        <Button
          size="sm"
          variant="primary"
          disabled={reading || draft.trim().length < 2}
          onClick={() => {
            setEditing(false);
            void read(draft);
          }}
        >
          <Sparkles size={14} aria-hidden="true" />{' '}
          {reading ? t('weekCheck.reading') : t('weekCheck.read')}
        </Button>
      </div>
    </section>
  );
}
