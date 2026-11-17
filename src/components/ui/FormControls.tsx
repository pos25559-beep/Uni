import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { hapticTap } from '../../lib/nativeBridge';
import { cx } from '../../lib/uiHelpers';
import { useSheetSwipeDismiss } from '../../lib/useSheetSwipeDismiss';

const control =
  'w-full rounded-[14px] border border-line bg-surface-2/85 px-3.5 text-sm text-fg placeholder:text-muted/75 focus:border-accent focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-55';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-coral">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Input({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={cx(control, 'h-11', error && 'border-coral focus:border-coral', className)}
    />
  );
}

interface ParsedSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

function parseSelectChildren(children: ReactNode, group?: string): ParsedSelectOption[] {
  const list: ParsedSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'optgroup') {
      const props = child.props as { label?: string; children?: ReactNode };
      list.push(...parseSelectChildren(props.children, props.label));
      return;
    }
    if (child.type === 'option') {
      const props = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      };
      const label = nodeText(props.children).trim();
      const rawValue = props.value !== undefined ? String(props.value) : label;
      list.push({
        value: rawValue,
        label: label || rawValue,
        disabled: Boolean(props.disabled),
        group,
      });
      return;
    }
    const nested = (child.props as { children?: ReactNode })?.children;
    if (nested) list.push(...parseSelectChildren(nested, group));
  });
  return list;
}

/**
 * Seletor tátil Unipedia v4 (substitui <select> nativo do browser/SO).
 * Mantém API compatível com <option> children + value + onChange, mas abre
 * em folha inferior tátil no telemóvel e popover posicionado no desktop.
 */
export function Select({
  className,
  error,
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  const { t } = useTranslation('common');
  const options = useMemo(() => parseSelectChildren(children), [children]);
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(() =>
    defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ''),
  );
  const currentValue = value !== undefined ? String(value) : uncontrolledValue;
  const selected = options.find((o) => o.value === currentValue) ?? options[0];

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    isMobile: boolean;
    top?: number;
    bottom?: number;
    left?: number;
    width?: number;
  }>({ isMobile: true });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useSheetSwipeDismiss({
    ref: sheetRef,
    open: open && coords.isMobile,
    onClose: () => setOpen(false),
    maxViewportWidth: 640,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleOpen = () => {
    if (disabled || options.length === 0) return;
    void hapticTap();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!isMobile && rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 260 && rect.top > spaceBelow;
      const width = Math.min(Math.max(rect.width, 220), Math.min(360, window.innerWidth - 24));
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setCoords({
        isMobile: false,
        left,
        width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      });
    } else {
      setCoords({ isMobile: true });
    }
    setOpen(true);
  };

  const commitSelect = (nextValue: string) => {
    void hapticTap();
    if (value === undefined) setUncontrolledValue(nextValue);
    if (onChange) {
      const synthetic = {
        target: { value: nextValue, name: name ?? '' },
        currentTarget: { value: nextValue, name: name ?? '' },
      } as unknown as ChangeEvent<HTMLSelectElement>;
      onChange(synthetic);
    }
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || selected?.label || t('ui.selectOption')}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        className={cx(
          control,
          'flex min-h-11 items-center justify-between gap-2 text-left',
          error && 'border-coral focus:border-coral',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? t('ui.selectDots')}</span>
        <ChevronDown
          size={15}
          className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180 text-accent')}
          aria-hidden="true"
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-label={ariaLabel || t('ui.selectOption')}
            onClose={() => setOpen(false)}
            onCancel={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            onClick={(e) => {
              if (e.target === dialogRef.current) setOpen(false);
            }}
            className={cx(
              'fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-fg outline-none',
              coords.isMobile
                ? 'backdrop:bg-black/45 backdrop:backdrop-blur-[2px]'
                : 'backdrop:bg-transparent',
            )}
          >
            <div
              onClick={() => setOpen(false)}
              className={cx(
                'h-full w-full',
                coords.isMobile && 'flex items-end justify-center',
              )}
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
                  ? 'rise w-full max-w-lg overscroll-contain rounded-t-[28px] border-t border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float'
                  : 'rise rounded-[22px] border border-line bg-surface p-1.5 shadow-float',
              )}
            >
              {coords.isMobile && (
                <div data-sheet-handle="" className="-mx-4 -mt-3 mb-2.5 px-4 pt-3 pb-1 touch-none">
                  <div className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-line" aria-hidden="true" />
                  <p className="px-1 font-display text-sm font-bold text-fg">
                    {ariaLabel || t('ui.chooseOption')}
                  </p>
                </div>
              )}

              <div
                role="listbox"
                className={cx(
                  'overflow-y-auto overscroll-contain',
                  coords.isMobile ? 'max-h-[56dvh] space-y-1' : 'max-h-64 space-y-0.5',
                )}
              >
                {options.map((opt, idx) => {
                  const active = opt.value === currentValue;
                  const showGroup = Boolean(opt.group && opt.group !== options[idx - 1]?.group);
                  return (
                    <div key={`${opt.value}-${idx}`}>
                      {showGroup && (
                        <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-muted">
                          {opt.group}
                        </p>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={opt.disabled}
                        onClick={() => commitSelect(opt.value)}
                        className={cx(
                          'flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
                          active
                            ? 'bg-accent-soft font-semibold text-accent-ink'
                            : 'text-fg hover:bg-surface-2',
                        )}
                      >
                        <span className="min-w-0 flex-1 break-words">{opt.label}</span>
                        {active && <Check size={15} className="shrink-0 text-accent" aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

export interface PillSelectOption {
  value: string;
  label: string;
  shortLabel?: string;
  hint?: string;
  dotClass?: string;
}

/**
 * Seletor em pílula nativo do sistema Estúdio Caderno Vivo (substitui <select> do navegador).
 */
export function PillSelect({
  value,
  options,
  onChange,
  icon,
  ariaLabel,
  className,
  placement = 'auto',
}: {
  value: string;
  options: PillSelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  ariaLabel: string;
  className?: string;
  placement?: 'down' | 'up' | 'auto';
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(placement === 'up');
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cx('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          void hapticTap();
          if (!open) {
            if (placement === 'up') setOpenUp(true);
            else if (placement === 'down') setOpenUp(false);
            else {
              const rect = wrapRef.current?.getBoundingClientRect();
              setOpenUp(Boolean(rect && window.innerHeight - rect.bottom < 280));
            }
          }
          setOpen((v) => !v);
        }}
        className={cx(
          'inline-flex min-h-[44px] max-w-[210px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
          open
            ? 'border-accent bg-accent-soft text-accent shadow-card'
            : 'border-line bg-surface text-fg hover:bg-surface-2',
        )}
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        {selected?.dotClass && <span className={cx('size-2 shrink-0 rounded-full', selected.dotClass)} />}
        {selected?.shortLabel ? (
          <>
            <span className="truncate sm:hidden">{selected.shortLabel}</span>
            <span className="hidden truncate sm:inline">{selected.label}</span>
          </>
        ) : (
          <span className="truncate">{selected?.label ?? ''}</span>
        )}
        <ChevronDown
          size={14}
          className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180 text-accent')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={cx(
              'absolute left-0 z-50 max-h-60 min-w-[220px] max-w-[min(280px,82vw)] overflow-y-auto rounded-[22px] border border-line bg-surface p-1.5 shadow-float',
              openUp ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-2 origin-top-left',
            )}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    void hapticTap();
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cx(
                    'flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-2xl px-3 py-2 text-left text-xs transition',
                    active
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'text-fg hover:bg-surface-2',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {opt.dotClass && <span className={cx('size-2.5 shrink-0 rounded-full', opt.dotClass)} />}
                    <div className="min-w-0">
                      <p className="truncate">{opt.label}</p>
                      {opt.hint && <p className="truncate text-xs font-normal text-muted">{opt.hint}</p>}
                    </div>
                  </div>
                  {active && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Textarea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      className={cx(control, 'min-h-24 py-2.5', error && 'border-coral focus:border-coral', className)}
    />
  );
}
