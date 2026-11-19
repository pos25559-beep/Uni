// Seletores táteis Top Layer Unipedia v4 (substituem <input type="time|date|datetime-local"> nativos).
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { appDateLocale as pt, fullDatePattern } from '../lib/dateLocale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Keyboard, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { hapticTap } from '../lib/nativeBridge';
import { cx } from '../lib/uiHelpers';
import { useSheetSwipeDismiss } from '../lib/useSheetSwipeDismiss';

const CONTROL_CLS =
  'w-full rounded-[14px] border border-line bg-surface-2/85 px-3.5 text-sm text-fg placeholder:text-muted/75 focus:border-accent focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-55';

const HOURS_ALL = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_STEP5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const WEEKDAY_KEYS = ['1', '2', '3', '4', '5', '6', '0'] as const;

interface DialogCoords {
  isMobile: boolean;
  top?: number;
  bottom?: number;
  left?: number;
  width?: number;
}

function computeDialogCoords(
  el: HTMLElement | null,
  desktopWidth = 340,
  desktopHeight = 460,
): DialogCoords {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const rect = el?.getBoundingClientRect();
  if (!isMobile && rect) {
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const width = Math.min(Math.max(rect.width, desktopWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    if (spaceBelow >= desktopHeight) {
      return { isMobile: false, left, width, top: rect.bottom + 6 };
    }
    if (spaceAbove >= desktopHeight) {
      return { isMobile: false, left, width, bottom: window.innerHeight - rect.top + 6 };
    }
    const clampedTop = Math.max(12, window.innerHeight - desktopHeight - 12);
    return { isMobile: false, left, width, top: clampedTop };
  }
  return { isMobile: true };
}

function TopLayerPickerDialog({
  open,
  onClose,
  coords,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  coords: DialogCoords;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('common');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useSheetSwipeDismiss({
    ref: sheetRef,
    open: open && coords.isMobile,
    onClose,
    maxViewportWidth: 640,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !wasOpenRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog && dialog.open) {
      dialog.close();
    }
    if (!open && wasOpenRef.current) {
      const target = previousFocusRef.current;
      previousFocusRef.current = null;
      if (target && target.isConnected) {
        requestAnimationFrame(() => target.focus());
      }
    }
    wasOpenRef.current = open;
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className={cx(
        'fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-fg outline-none',
        coords.isMobile
          ? 'backdrop:bg-black/45 backdrop:backdrop-blur-[2px]'
          : 'backdrop:bg-transparent',
      )}
    >
      <div
        onClick={onClose}
        className={cx('h-full w-full', coords.isMobile && 'flex items-end justify-center')}
      >
        <div
          ref={coords.isMobile ? sheetRef : undefined}
          onClick={(e) => e.stopPropagation()}
          style={
            coords.isMobile
              ? undefined
              : {
                  position: 'fixed',
                  left: coords.left,
                  width: coords.width,
                  top: coords.top,
                  bottom: coords.bottom,
                }
          }
          className={cx(
            coords.isMobile
              ? 'rise max-h-[82dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float'
              : 'rise max-h-[calc(100vh-24px)] overflow-y-auto overscroll-contain rounded-[22px] border border-line bg-surface p-3.5 shadow-float',
          )}
        >
          <div
            data-sheet-handle={coords.isMobile ? '' : undefined}
            className={cx('mb-3', coords.isMobile && '-mx-4 -mt-3 px-4 pt-3 touch-none')}
          >
            {coords.isMobile && (
              <div className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-line" aria-hidden="true" />
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-bold text-fg">{title}</p>
              {!coords.isMobile && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('ui.dateTime.closePicker')}
                  className="flex size-11 -mr-2 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function parseHhMm(raw: string | undefined): { hour: string; minute: string } {
  const m = (raw || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (m) return { hour: m[1]!, minute: m[2]! };
  return { hour: '09', minute: '00' };
}

function isValidHhMm(raw: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw.trim());
}

function TimePanel({
  value,
  onSelect,
  onDone,
}: {
  value: string;
  onSelect: (hhmm: string) => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation('common');
  const { hour, minute } = parseHhMm(value);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState(`${hour}:${minute}`);
  const [manualErr, setManualErr] = useState(false);

  const commitManual = () => {
    const clean = manualText.trim();
    if (!isValidHhMm(clean)) {
      setManualErr(true);
      return;
    }
    setManualErr(false);
    void hapticTap();
    onSelect(clean);
    onDone?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-accent" aria-hidden="true" />
          <span className="font-mono text-lg font-bold tracking-tight tabular text-fg">
            {hour}:{minute}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setManualText(`${hour}:${minute}`);
            setManualErr(false);
            setManualOpen((v) => !v);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-fg transition hover:bg-surface-2"
        >
          <Keyboard size={14} aria-hidden="true" />
          {manualOpen ? t('ui.dateTime.quickGrid') : t('ui.dateTime.exactTime')}
        </button>
      </div>

      {manualOpen ? (
        <div className="space-y-2.5">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted">{t('ui.dateTime.manualHint')}</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={manualText}
              onChange={(e) => {
                setManualText(e.target.value);
                setManualErr(false);
              }}
              placeholder="08:30"
              className={cx(CONTROL_CLS, 'h-11 font-mono tabular', manualErr && 'border-coral')}
            />
          </label>
          {manualErr && (
            <p className="text-xs font-medium text-danger">{t('ui.dateTime.manualError')}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={commitManual}
              className="min-h-11 rounded-full bg-ink-cta px-4 text-xs font-semibold text-ink-cta-fg"
            >
              {t('ui.dateTime.applyTime')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{t('ui.dateTime.hour')}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {HOURS_ALL.map((h) => {
                const active = h === hour;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      onSelect(`${h}:${minute}`);
                    }}
                    className={cx(
                      'min-h-[44px] rounded-xl font-mono text-xs font-semibold tabular transition',
                      active
                        ? 'bg-accent text-accent-fg shadow-card'
                        : 'bg-surface-2/80 text-fg hover:bg-surface-2',
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">{t('ui.dateTime.minutes')}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {MINUTES_STEP5.map((m) => {
                const active = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      onSelect(`${hour}:${m}`);
                      onDone?.();
                    }}
                    className={cx(
                      'min-h-[44px] rounded-xl font-mono text-xs font-semibold tabular transition',
                      active
                        ? 'bg-ink-cta text-ink-cta-fg shadow-card'
                        : 'bg-surface-2/80 text-fg hover:bg-surface-2',
                    )}
                  >
                    :{m}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function parseYyyyMmDd(raw: string | undefined): Date | null {
  if (!raw || raw.length < 10) return null;
  const d = parseISO(raw.slice(0, 10));
  return isValid(d) ? d : null;
}

function DatePanel({
  value,
  onSelect,
  clearable,
  onClear,
}: {
  value: string;
  onSelect: (yyyyMmDd: string) => void;
  clearable?: boolean;
  onClear?: () => void;
}) {
  const { t } = useTranslation('common');
  const selected = parseYyyyMmDd(value);
  const [today] = useState(() => new Date());
  const todayKey = format(today, 'yyyy-MM-dd');
  const [cursorMonth, setCursorMonth] = useState<Date>(() => selected ?? today);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursorMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursorMonth]);

  const pickDate = (d: Date) => {
    void hapticTap();
    onSelect(format(d, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => pickDate(today)}
          className="min-h-11 rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:bg-surface"
        >
          {t('ui.dateTime.today')}
        </button>
        <button
          type="button"
          onClick={() => pickDate(addDays(today, 1))}
          className="min-h-11 rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:bg-surface"
        >
          {t('ui.dateTime.tomorrow')}
        </button>
        <button
          type="button"
          onClick={() => pickDate(addDays(today, 7))}
          className="min-h-11 rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:bg-surface"
        >
          {t('ui.dateTime.plus7Days')}
        </button>
        {clearable && value && onClear && (
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              onClear();
            }}
            className="ml-auto min-h-11 rounded-full px-3.5 text-xs font-semibold text-danger hover:bg-danger/10"
          >
            {t('ui.dateTime.clear')}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('ui.dateTime.prevMonth')}
          onClick={() => setCursorMonth((m) => subMonths(m, 1))}
          className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="font-display text-sm font-bold capitalize text-fg">
          {format(cursorMonth, 'MMMM yyyy', { locale: pt })}
        </p>
        <button
          type="button"
          aria-label={t('ui.dateTime.nextMonth')}
          onClick={() => setCursorMonth((m) => addMonths(m, 1))}
          className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="pb-1 text-xs font-semibold text-muted">
            {t(`labels.weekdayShort.${key}`)}
          </span>
        ))}
        {days.map((day) => {
          const ds = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, cursorMonth);
          const isSelected = ds === value.slice(0, 10);
          const isToday = ds === todayKey;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => pickDate(day)}
              aria-label={format(day, fullDatePattern(), { locale: pt })}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              className={cx(
                'grid min-h-[44px] place-items-center rounded-xl text-xs font-semibold tabular transition',
                isSelected
                  ? 'bg-accent text-accent-fg shadow-card'
                  : isToday
                    ? 'border border-accent/60 bg-accent-soft text-accent-ink'
                    : inMonth
                      ? 'text-fg hover:bg-surface-2'
                      : 'text-muted hover:bg-surface-2',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimeField({
  value,
  onChange,
  className,
  error,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<DialogCoords>({ isMobile: true });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openPicker = () => {
    if (disabled) return;
    void hapticTap();
    setCoords(computeDialogCoords(triggerRef.current, 320, 520));
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || t('ui.dateTime.selectTimeAria', { val: value || t('ui.dateTime.empty') })}
        onClick={openPicker}
        className={cx(
          CONTROL_CLS,
          'flex min-h-11 items-center justify-between gap-2 text-left',
          error && 'border-coral focus:border-coral',
          className,
        )}
      >
        <span className={cx('font-mono tabular', !value && 'font-sans text-muted')}>
          {value || 'HH:MM'}
        </span>
        <Clock size={15} className="shrink-0 text-muted" aria-hidden="true" />
      </button>

      <TopLayerPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        coords={coords}
        title={ariaLabel || t('ui.dateTime.chooseTime')}
      >
        <TimePanel
          value={value}
          onSelect={onChange}
          onDone={() => setOpen(false)}
        />
      </TopLayerPickerDialog>
    </>
  );
}

export function DateField({
  value,
  onChange,
  className,
  error,
  disabled,
  clearable = false,
  placeholder,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const { t } = useTranslation('common');
  const resolvedPlaceholder = placeholder ?? t('ui.dateTime.chooseDate');
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<DialogCoords>({ isMobile: true });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = parseYyyyMmDd(value);
  const display = parsed ? format(parsed, 'd MMM yyyy', { locale: pt }) : '';

  const openPicker = () => {
    if (disabled) return;
    void hapticTap();
    setCoords(computeDialogCoords(triggerRef.current, 336));
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || t('ui.dateTime.selectDateAria', { val: display || resolvedPlaceholder })}
        onClick={openPicker}
        className={cx(
          CONTROL_CLS,
          'flex min-h-11 items-center justify-between gap-2 text-left',
          error && 'border-coral focus:border-coral',
          className,
        )}
      >
        <span className={cx('truncate', !display && 'text-muted')}>
          {display || resolvedPlaceholder}
        </span>
        <CalendarDays size={15} className="shrink-0 text-muted" aria-hidden="true" />
      </button>

      <TopLayerPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        coords={coords}
        title={ariaLabel || t('ui.dateTime.chooseDate')}
      >
        <DatePanel
          value={value}
          clearable={clearable}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          onClear={() => {
            onChange('');
            setOpen(false);
          }}
        />
      </TopLayerPickerDialog>
    </>
  );
}

export function DateTimeField({
  value,
  onChange,
  className,
  error,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'date' | 'time'>('date');
  const [coords, setCoords] = useState<DialogCoords>({ isMobile: true });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [fallbackDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const datePart = value && value.length >= 10 ? value.slice(0, 10) : fallbackDate;
  const timePart =
    value && value.includes('T') && isValidHhMm(value.slice(11, 16))
      ? value.slice(11, 16)
      : '09:00';
  const parsedDate = parseYyyyMmDd(datePart);
  const display = parsedDate
    ? `${format(parsedDate, 'd MMM yyyy', { locale: pt })} · ${timePart}`
    : t('ui.dateTime.chooseDateTime');

  const openPicker = () => {
    if (disabled) return;
    void hapticTap();
    setTab('date');
    setCoords(computeDialogCoords(triggerRef.current, 350, 520));
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel || t('ui.dateTime.selectDateTimeAria', { val: display })}
        onClick={openPicker}
        className={cx(
          CONTROL_CLS,
          'flex min-h-11 items-center justify-between gap-2 text-left',
          error && 'border-coral focus:border-coral',
          className,
        )}
      >
        <span className={cx('truncate', !value && 'text-muted')}>{display}</span>
        <CalendarDays size={15} className="shrink-0 text-muted" aria-hidden="true" />
      </button>

      <TopLayerPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        coords={coords}
        title={ariaLabel || t('ui.dateTime.chooseDateTime')}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setTab('date')}
              className={cx(
                'min-h-11 rounded-xl px-3 text-xs font-semibold transition',
                tab === 'date' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
              )}
            >
              {t('ui.dateTime.dayTab', {
                day: parsedDate ? format(parsedDate, 'd MMM', { locale: pt }) : '—',
              })}
            </button>
            <button
              type="button"
              onClick={() => setTab('time')}
              className={cx(
                'min-h-11 rounded-xl px-3 font-mono text-xs font-semibold tabular transition',
                tab === 'time' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
              )}
            >
              {t('ui.dateTime.timeTab', { time: timePart })}
            </button>
          </div>

          {tab === 'date' ? (
            <DatePanel
              value={datePart}
              onSelect={(d) => {
                onChange(`${d}T${timePart}`);
                setTab('time');
              }}
            />
          ) : (
            <TimePanel
              value={timePart}
              onSelect={(t) => onChange(`${datePart}T${t}`)}
              onDone={() => setOpen(false)}
            />
          )}

          <div className="flex justify-end border-t border-line pt-2.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-full bg-ink-cta px-5 text-xs font-semibold text-ink-cta-fg"
            >
              {t('actions.done')}
            </button>
          </div>
        </div>
      </TopLayerPickerDialog>
    </>
  );
}
