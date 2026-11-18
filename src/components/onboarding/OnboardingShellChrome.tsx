import { motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UNIPEDIA_SPRING } from '../../lib/motionTokens';
import { cx } from '../../lib/uiHelpers';
import { UnipediaLogoMark } from '../brand/UnipediaMarks';
import { Button } from '../ui';
import { STEP_META } from './onboardingMeta';

export function OnboardingHeader(props: {
  stepIndex: number;
  canSkipDirectly: boolean;
  onClose: () => void;
}) {
  const { stepIndex, canSkipDirectly, onClose } = props;
  const { t } = useTranslation('onboarding');

  return (
    <header className="sticky top-0 z-10 border-b border-line/70 bg-bg/92 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <UnipediaLogoMark size={34} />
          <div>
            <p className="font-display text-sm font-extrabold leading-tight text-fg">
              Unipedia
            </p>
            <p className="font-mono text-xs text-muted tabular">
              {t('shell.stepOf', {
                n: stepIndex + 1,
                total: STEP_META.length,
                label: t(`shell.step.${STEP_META[stepIndex]?.id ?? 'curso'}`),
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEP_META.map((item, idx) => {
              const isActive = idx === stepIndex;
              return (
                <motion.span
                  key={item.id}
                  layout
                  transition={UNIPEDIA_SPRING}
                  className={cx(
                    'h-2 rounded-full transition-colors',
                    isActive
                      ? 'w-7 bg-accent'
                      : idx < stepIndex
                        ? 'w-2.5 bg-accent/45'
                        : 'w-2 bg-line',
                  )}
                />
              );
            })}
          </div>

          {canSkipDirectly && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('shell.close')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function OnboardingFooter(props: {
  stepIndex: number;
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const { stepIndex, isLastStep, onPrev, onNext, onFinish } = props;
  const { t } = useTranslation('onboarding');

  return (
    <footer className="sticky bottom-0 z-10 border-t border-line/70 bg-bg/92 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <Button variant="ghost" onClick={onPrev}>
            <ChevronLeft size={16} /> {t('shell.prev')}
          </Button>
        ) : (
          <span className="text-xs font-medium text-muted">
            {t('shell.later')}
          </span>
        )}

        {!isLastStep ? (
          <motion.button
            type="button"
            layoutId="onboarding-cta"
            transition={UNIPEDIA_SPRING}
            onClick={onNext}
            whileTap={{ scale: 0.94 }}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink-cta px-5 text-sm font-bold text-ink-cta-fg shadow-card transition-opacity hover:opacity-90"
          >
            <span>{t('shell.next')}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </motion.button>
        ) : (
          <motion.button
            type="button"
            layoutId="onboarding-cta"
            transition={UNIPEDIA_SPRING}
            onClick={onFinish}
            whileTap={{ scale: 0.96 }}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink-cta px-6 text-sm font-bold text-ink-cta-fg shadow-card transition-opacity hover:opacity-90"
          >
            <span>{t('shell.start')}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </motion.button>
        )}
      </div>
    </footer>
  );
}
