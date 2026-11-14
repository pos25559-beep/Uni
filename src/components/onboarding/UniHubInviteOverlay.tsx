import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { hapticTap } from '../../lib/nativeBridge';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import { useHubUiStore } from '../../store/useHubUiStore';
import { UniBuddy } from '../brand/UnipediaMarks';
import { UNIPEDIA_BOUNCE_SPRING } from '../motion/Primitives';
import { Button } from '../ui';

const EXPLORE_DELAY_MS = 10_000;
const SESSION_KEY = 'unipedia.hubInviteShown';

/**
 * Pop-up flutuante centrado com o Uni a convidar o estudante a completar o Hub
 * após explorar a app livremente durante alguns segundos depois do guia inicial.
 */
export default function UniHubInviteOverlay() {
  const onboardingCompleted = useStore((s) => s.academicProfile.onboardingCompleted);
  const degreeName = useStore((s) => s.academicProfile.degreeName);
  const firstCourseName = useStore((s) => s.courses[0]?.name);
  const settings = useStore((s) => s.settings);
  const modalOpen = useHubUiStore((s) => s.modalOpen);
  const openModal = useHubUiStore((s) => s.openModal);
  const reducedMotion = useReducedMotion();

  const [visible, setVisible] = useState(false);

  const uniAccessory = useMemo(
    () => resolveUniAccessory(settings.uniAccessory, degreeName, firstCourseName),
    [settings.uniAccessory, degreeName, firstCourseName],
  );

  const eligible =
    Boolean(onboardingCompleted) &&
    Boolean(settings.tourCompleted) &&
    !settings.hubSetupCompleted &&
    !settings.hubSetupDismissed;

  useEffect(() => {
    if (!eligible || modalOpen) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {
      // ignore storage access failure
    }

    const timer = window.setTimeout(() => {
      if (useHubUiStore.getState().modalOpen) return;
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // ignore storage access failure
      }
      setVisible(true);
    }, EXPLORE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [eligible, modalOpen]);

  const dismissInvite = () => {
    void hapticTap();
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore storage access failure
    }
    setVisible(false);
  };

  const acceptInvite = () => {
    void hapticTap();
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore storage access failure
    }
    setVisible(false);
    openModal(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="uni-hub-invite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="uni-hub-invite-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-5 py-6"
        >
          {/* Véu atmosférico suave — permite ver a app por trás */}
          <div
            onClick={dismissInvite}
            aria-hidden="true"
            className="absolute inset-0 bg-[#141311]/45 backdrop-blur-[3px]"
          />

          {/* Uni flutuando acima do balão orgânico (não é apenas uma caixa) */}
          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.94 }}
            transition={UNIPEDIA_BOUNCE_SPRING}
            className="relative z-10 flex w-full max-w-md flex-col items-center"
          >
            {/* Halo + Uni livre fora do balão */}
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
              }
              className="relative z-20 -mb-3 flex flex-col items-center"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-3 -z-10 h-20 rounded-full bg-pastel-sage/90 blur-xl dark:bg-[#2E4633]"
              />
              <UniBuddy mood="happy" accessory={uniAccessory} size={104} interactive={false} />
            </motion.div>

            {/* Rabicho orgânico do balão apontando para o Uni */}
            <svg
              width="42"
              height="20"
              viewBox="0 0 42 20"
              fill="none"
              aria-hidden="true"
              className="relative z-20 -mb-0.5 text-[#FAF8F2] drop-shadow-sm dark:text-[#1D1B18]"
            >
              <path
                d="M21 0C24.5 9 32 16 42 20H0C10 16 17.5 9 21 0Z"
                fill="currentColor"
              />
            </svg>

            {/* Balão de conversa em forma de nuvem macia */}
            <div className="relative w-full rounded-[36px] bg-[#FAF8F2] px-6 pt-6 pb-6 text-center text-[#141312] shadow-2xl ring-1 ring-black/5 dark:bg-[#1D1B18] dark:text-[#FAF6EC] dark:ring-white/10 sm:px-8">
              <button
                type="button"
                onClick={dismissInvite}
                aria-label="Fechar convite do Uni"
                className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
              >
                <X size={17} />
              </button>

              <h2
                id="uni-hub-invite-title"
                className="px-8 pt-1 font-display text-xl font-bold leading-snug tracking-tight sm:px-8 sm:text-2xl"
              >
                Ei! Vamos completar o teu Hub para poderes{' '}
                <span className="font-serif font-medium italic text-accent">começar a estudar</span>?
              </h2>

              <p className="mt-2.5 text-sm leading-relaxed text-muted">
                Junta aqui o horário, os prints dos testes, Drives partilhados e Gemini Notebook para eu organizar o teu ritmo logo hoje.
              </p>

              <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button
                  size="md"
                  variant="primary"
                  onClick={acceptInvite}
                  className="w-full min-h-[48px] px-6 sm:w-auto"
                >
                  Completar o Hub <ArrowRight size={16} />
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  onClick={dismissInvite}
                  className="w-full min-h-[44px] sm:w-auto"
                >
                  Explorar mais um pouco
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
