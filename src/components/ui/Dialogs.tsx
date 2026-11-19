import { useTranslation } from 'react-i18next';
import { Info, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UNIPEDIA_SPRING } from '../../lib/motionTokens';
import { hapticTap } from '../../lib/nativeBridge';
import { cx, dismissToast, getToastQueue, subscribeToasts, type ToastItem } from '../../lib/uiHelpers';
import { useSheetSwipeDismiss } from '../../lib/useSheetSwipeDismiss';
import { UniBuddy } from '../brand/UnipediaMarks';
import LottieAccent from '../motion/LottieAccent';
import { Button } from './Button';

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = 'sm:max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useSheetSwipeDismiss({
    ref: dialogRef,
    open,
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
      // Move focus to the non-editable modal title so mobile sheets don't auto-focus text inputs and pop up the keyboard.
      titleRef.current?.focus({ preventScroll: true });
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

  if (!open) return null;

  const isOutsideDialog = (clientX: number, clientY: number) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        if (!('closedBy' in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutsideDialog(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (
          !('closedBy' in HTMLDialogElement.prototype) &&
          pressedOutsideRef.current &&
          isOutsideDialog(e.clientX, e.clientY)
        ) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      {...({ closedby: 'any' } as Record<string, unknown>)}
      className={cx(
        'rise m-auto mb-0 w-full max-w-none open:flex max-h-[90dvh] flex-col overscroll-contain rounded-t-[26px] border border-line bg-surface p-0 text-fg shadow-float backdrop:bg-black/45 backdrop:backdrop-blur-[2px] sm:mb-auto sm:rounded-[24px]',
        maxWidthClass,
      )}
    >
      <div data-sheet-handle="" className="touch-none sm:touch-auto">
        <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-base font-bold focus:outline-none">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="hidden size-11 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg sm:flex"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="space-y-4 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/** Folha de ações móvel para menus compactos sem sobrecarregar ecrãs pequenos. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ReadonlyArray<{
    id: string;
    label: string;
    hint?: string;
    icon?: ReactNode;
    danger?: boolean;
    onSelect: () => void;
  }>;
}) {
  const { t } = useTranslation('common');
  const sheetRef = useRef<HTMLDivElement>(null);
  useSheetSwipeDismiss({ ref: sheetRef, open, onClose });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title || t('ui.actionsTitle')}>
          <motion.button
            type="button"
            aria-label={t('ui.closeOptions')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 w-full max-w-md"
          >
            <div
              ref={sheetRef}
              className="w-full overscroll-contain rounded-t-[28px] border border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-[26px] sm:pb-4"
            >
              <div
                data-sheet-handle=""
                className="-mx-4 -mt-3 mb-2 cursor-grab touch-none px-4 pt-3 pb-1 active:cursor-grabbing sm:cursor-auto sm:touch-auto"
              >
                <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-line sm:hidden" aria-hidden="true" />
                {title && <p className="px-2 font-display text-sm font-bold text-fg">{title}</p>}
              </div>
              <div className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-bg">
                {actions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      onClose();
                      item.onSelect();
                    }}
                    className="flex min-h-[54px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
                  >
                    {item.icon && (
                      <span className={cx('shrink-0', item.danger ? 'text-coral' : 'text-fg')}>
                        {item.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cx('block text-sm font-semibold', item.danger ? 'text-coral' : 'text-fg')}>
                        {item.label}
                      </span>
                      {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>
              <Button variant="secondary" className="mt-3 w-full" onClick={onClose}>
                {t('actions.cancel')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ToastViewport() {
  const { t } = useTranslation('common');
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<ToastItem[]>(() => getToastQueue());

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          const isDanger = item.tone === 'danger';
          const isOk = item.tone === 'ok';
          const isCelebrate = isOk && (item.effect === 'celebrate' || item.effect === 'confetti');

          return (
            <motion.div
              key={item.id}
              layout
              role="status"
              aria-live="polite"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.94 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.94 }}
              transition={UNIPEDIA_SPRING}
              className={cx(
                'pointer-events-auto flex min-h-11 max-w-sm items-center rounded-full border text-left text-xs font-semibold shadow-float',
                isDanger
                  ? 'border-coral/40 bg-coral-soft text-coral-ink'
                  : isOk
                    ? 'border-accent/35 bg-ink-cta text-ink-cta-fg'
                    : 'border-line bg-surface text-fg',
              )}
            >
              {/* Zona da mensagem: tocar fecha o aviso (botão irmão da ação, nunca aninhado). */}
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label={`${item.message} — ${t('actions.close')}`}
                className={cx(
                  'flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pl-3.5 text-left transition active:opacity-80',
                  item.action ? 'rounded-l-full pr-2' : 'rounded-full pr-3.5',
                )}
              >
                {isDanger ? (
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    <UniBuddy mood="shy" size={22} interactive={false} />
                    <LottieAccent kind="alertPulse" loop={false} className="size-4" />
                  </span>
                ) : isOk ? (
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    {isCelebrate && <UniBuddy mood="celebrate" size={24} interactive={false} />}
                    <LottieAccent kind="checkBurst" loop={false} className="size-5" />
                  </span>
                ) : (
                  <Info size={15} className="shrink-0 text-muted" aria-hidden="true" />
                )}
                <span className="min-w-0 leading-snug">{item.message}</span>
              </button>
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    const act = item.action;
                    dismissToast(item.id);
                    act?.onPress();
                  }}
                  className="mr-1 flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-xs font-bold underline underline-offset-2 transition hover:bg-black/10 active:scale-[0.97]"
                >
                  {item.action.label}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

