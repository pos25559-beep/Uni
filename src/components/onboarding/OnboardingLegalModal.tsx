import { ExternalLink, X } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGAL_INFO } from '../../lib/legal';
import { useSheetSwipeDismiss } from '../../lib/useSheetSwipeDismiss';

export function OnboardingLegalModal(props: {
  legalPreview: 'privacy' | 'terms' | null;
  onClose: () => void;
}) {
  const { legalPreview, onClose } = props;
  const { t } = useTranslation('onboarding');
  const legalSheetRef = useRef<HTMLDivElement>(null);

  useSheetSwipeDismiss({
    ref: legalSheetRef,
    open: Boolean(legalPreview),
    onClose,
    maxViewportWidth: 640,
  });

  if (!legalPreview) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={legalPreview === 'privacy' ? t('shell.privacy') : t('shell.terms')}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={legalSheetRef}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6"
      >
        <div
          data-sheet-handle=""
          className="-mx-5 -mt-5 touch-none px-5 pt-3 sm:mx-0 sm:mt-0 sm:touch-auto sm:p-0"
        >
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <h3 className="font-display text-lg font-bold text-fg">
              {legalPreview === 'privacy' ? t('shell.privacy') : t('shell.terms')}
            </h3>
            <button
              type="button"
              aria-label={t('shell.closeLegal')}
              onClick={onClose}
              className="hidden size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg sm:flex"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted sm:text-sm">
          {legalPreview === 'privacy' ? (
            <>
              <p>
                <strong className="text-fg">{t('shell.legalPreview.controller')}</strong>{' '}
                {LEGAL_INFO.controllerName} ({LEGAL_INFO.country}) ·{' '}
                <span className="font-mono">{LEGAL_INFO.contactEmail}</span>
              </p>
              <p>{t('shell.legalPreview.local')}</p>
              <p>{t('shell.legalPreview.ai')}</p>
            </>
          ) : (
            <p>{t('shell.legalPreview.terms', { app: LEGAL_INFO.appName })}</p>
          )}
          <div className="pt-2">
            <a
              href={legalPreview === 'privacy' ? '/privacidade' : '/termos'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-ink hover:underline"
            >
              {t('shell.legalPreview.open')} <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
