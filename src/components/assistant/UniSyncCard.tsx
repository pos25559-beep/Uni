import { CalendarDays, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { kindLabel, weekdayLong } from '../../lib/colors';
import type { ResolvedScheduleSyncBundle } from '../../lib/scheduleSync';
import { cx } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { Badge, Button, Select } from '../ui';

interface UniSyncCardProps {
  bundle: ResolvedScheduleSyncBundle;
  onChange: (next: ResolvedScheduleSyncBundle) => void;
  onApply: () => void;
  onOpenCalendar: () => void;
}

/**
 * Cartão interativo dentro da resposta do Uni para aplicar aulas e avaliações no Calendário e Plano.
 */
export default function UniSyncCard({
  bundle,
  onChange,
  onApply,
  onOpenCalendar,
}: UniSyncCardProps) {
  const { t } = useTranslation('assistant');
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const selectedCount =
    bundle.slots.filter((s) => s.selected).length +
    bundle.assessments.filter((a) => a.selected).length;

  return (
    <div
      data-testid="uni-sync-card"
      className={cx(
        'mt-3 rounded-[20px] p-4',
        isMinimal
          ? 'border border-accent/25 bg-surface-2/80'
          : 'bg-pastel-mint/55 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-accent" />
          <span className="text-xs font-semibold text-fg">
            {t('sync.title')}
          </span>
        </div>
        <Badge tone={bundle.applied ? 'accent' : 'neutral'}>
          {bundle.applied
            ? t('sync.applied')
            : t('sync.counts', {
                assessments: bundle.assessments.length,
                classes: bundle.slots.length,
              })}
        </Badge>
      </div>

      {bundle.applied ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-accent-soft/60 px-3 py-2 text-xs text-accent">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Check size={14} />
            {bundle.appliedSummary || t('sync.defaultSummary')}
          </span>
          <Button size="sm" variant="primary" onClick={onOpenCalendar}>
            {t('sync.openCalendar')}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
            {bundle.assessments.map((a, idx) => (
              <div
                key={a.id}
                onClick={() => {
                  const next = bundle.assessments.map((item, i) =>
                    i === idx ? { ...item, selected: !item.selected } : item,
                  );
                  onChange({ ...bundle, assessments: next });
                }}
                role="checkbox"
                aria-checked={a.selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const next = bundle.assessments.map((item, i) =>
                      i === idx ? { ...item, selected: !item.selected } : item,
                    );
                    onChange({ ...bundle, assessments: next });
                  }
                }}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 transition',
                  a.selected
                    ? 'border-accent/40 bg-surface'
                    : 'border-line bg-surface/50 opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cx(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition',
                      a.selected
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-muted/40 bg-surface',
                    )}
                  >
                    {a.selected && <Check size={10} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">
                      {a.courseName} · {a.title || kindLabel[a.kind]}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.date}
                      {a.location ? ` · ${t('sync.room', { room: a.location })}` : ''}
                    </p>
                  </div>
                </div>
                <Badge tone={a.matchedCourse ? 'accent' : 'neutral'}>
                  {a.matchedCourse
                    ? t('sync.linksTo', { name: a.matchedCourse.shortName || a.matchedCourse.name })
                    : t('sync.createsCourse')}
                </Badge>
              </div>
            ))}

            {bundle.slots.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => {
                  const next = bundle.slots.map((item, i) =>
                    i === idx ? { ...item, selected: !item.selected } : item,
                  );
                  onChange({ ...bundle, slots: next });
                }}
                role="checkbox"
                aria-checked={s.selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const next = bundle.slots.map((item, i) =>
                      i === idx ? { ...item, selected: !item.selected } : item,
                    );
                    onChange({ ...bundle, slots: next });
                  }
                }}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 transition',
                  s.selected
                    ? 'border-accent/40 bg-surface'
                    : 'border-line bg-surface/50 opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cx(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition',
                      s.selected
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-muted/40 bg-surface',
                    )}
                  >
                    {s.selected && <Check size={10} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">
                      {s.courseName} · {s.type}
                    </p>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"
                    >
                      <Select
                        aria-label={t('sync.weekdayAria', { course: s.courseName })}
                        value={s.weekday}
                        onChange={(e) => {
                          const nextWeekday = Number(e.target.value);
                          const next = bundle.slots.map((item, i) =>
                            i === idx ? { ...item, weekday: nextWeekday } : item,
                          );
                          onChange({ ...bundle, slots: next });
                        }}
                        className="!min-h-11 !rounded-lg !px-2.5 !py-1 !text-xs font-medium"
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                          <option key={wd} value={wd}>
                            {weekdayLong[wd]}
                          </option>
                        ))}
                      </Select>
                      <span>
                        {s.start}–{s.end}
                        {s.room ? ` · ${t('sync.room', { room: s.room })}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge tone={s.matchedCourse ? 'accent' : 'neutral'}>
                  {s.matchedCourse
                    ? t('sync.linksTo', { name: s.matchedCourse.shortName || s.matchedCourse.name })
                    : t('sync.createsCourse')}
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {t('sync.hint')}
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={selectedCount === 0}
              onClick={onApply}
              className="gap-1.5"
            >
              <Check size={13} />
              {t('sync.applyBtn', { count: selectedCount })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
