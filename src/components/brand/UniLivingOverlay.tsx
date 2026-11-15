import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { hapticTap } from '../../lib/nativeBridge';
import { studyStreak, todayStr } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import {
  computeUniCompanionState,
  readCollectibleTelemetry,
  recordUniPetCare,
} from '../../lib/uniCollectibles';
import {
  pickNextNomadPlacement,
  pickNextShyBehavior,
  pickQuietRouteNote,
  resolveVisibleUniPeers,
  type PetAnchorZone,
} from '../../lib/uniPetEngine';
import { useHubUiStore } from '../../store/useHubUiStore';
import { useStore } from '../../store/useStore';
import { cx } from '../ui';
import { UniBuddy, UniPetBuddy, type BuddyMood } from './UnipediaMarks';

const ZONE_CONTAINER_CLASS: Record<PetAnchorZone, string> = {
  bottom_right: 'right-3 bottom-[88px] md:right-6 md:bottom-4 items-end flex-row',
  bottom_left: 'left-3 bottom-[88px] md:left-[248px] md:bottom-4 items-end flex-row-reverse',
  right_edge_peek: 'right-0 top-[44%] translate-x-1 items-center flex-row',
  left_edge_peek: 'left-0 top-[42%] -translate-x-1 md:left-[228px] items-center flex-row-reverse',
  top_right_corner: 'right-3 top-14 md:right-6 md:top-4 items-start flex-row',
  top_left_corner: 'left-3 top-14 md:left-[248px] md:top-4 items-start flex-row-reverse',
};

/**
 * Companheiros Uni nómadas e discretos (+ Micropet equipado).
 * Passeiam por diferentes margens e cantos em Desktop e Telemóvel sem bloquear toques:
 * escondem-se automaticamente quando o estudante escreve, faz scroll ou ativa o modo sério.
 */
export default function UniLivingOverlay() {
  const { pathname } = useLocation();
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const tasks = useStore((s) => s.tasks);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const academicProfile = useStore((s) => s.academicProfile);
  const settings = useStore((s) => s.settings);
  const focusTimerOpen = useHubUiStore((s) => s.focusTimerOpen);
  const hubModalOpen = useHubUiStore((s) => s.modalOpen);

  const [tickSeed, setTickSeed] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [blushed, setBlushed] = useState(false);
  const [hugFeedback, setHugFeedback] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  const mode = settings.uniLiveCompanions ?? 'all';
  const appTone = settings.appTone ?? 'vibrante';
  const activeSkin = settings.uniSkin ?? 'classic';
  const activePet = settings.uniPet ?? 'cat';
  const autoRotate = settings.uniSkinAutoRotate ?? true;

  const telemetry = useMemo(
    () => readCollectibleTelemetry(sessions, courses, weeklyCheckIns),
    [sessions, courses, weeklyCheckIns],
  );

  const visibleSkins = useMemo(
    () =>
      resolveVisibleUniPeers({
        activeSkin,
        telemetry,
        mode,
        appTone,
        tickSeed,
        autoRotate,
        pathname,
      }),
    [activeSkin, telemetry, mode, appTone, tickSeed, autoRotate, pathname],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const isField = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target)) setInputFocused(true);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        setInputFocused(isField(document.activeElement));
      }, 120);
    };

    let scrollTimer: number | undefined;
    const onScroll = () => {
      setScrolling(true);
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => setScrolling(false), 1800);
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onScroll, true);
      if (scrollTimer) window.clearTimeout(scrollTimer);
    };
  }, []);

  useEffect(() => {
    if (visibleSkins.length === 0 || reducedMotion) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setStepCount((c) => {
        const next = c + 1;
        if (next % 2 === 0) setTickSeed((t) => t + 1);
        return next;
      });
    }, 10000);
    return () => window.clearInterval(interval);
  }, [visibleSkins.length, reducedMotion]);

  useEffect(() => {
    if (!blushed) return;
    const timer = window.setTimeout(() => setBlushed(false), 2600);
    return () => window.clearTimeout(timer);
  }, [blushed]);

  if (visibleSkins.length === 0 || reducedMotion || focusTimerOpen || hubModalOpen) return null;

  const isHidden = inputFocused || scrolling;
  const behavior = pickNextShyBehavior({
    hasPeer: visibleSkins.length > 1,
    stepCount,
    isFocusActive: isHidden,
  });
  const placement = pickNextNomadPlacement({ pathname, stepCount });

  const primaryAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile.degreeName,
    courses[0]?.name,
  );

  const today = todayStr();
  const companion = computeUniCompanionState({
    sessions,
    tasks,
    weeklyCheckIns,
    today,
  });
  const pendingTodayCount = sessions.filter((s) => s.date === today && !s.done).length;
  const streakDays = studyStreak(sessions);
  const quietNote = pickQuietRouteNote({
    pathname,
    pendingTodayCount,
    streakDays,
    adventureDone: companion.adventureDone,
  });

  const primarySkin = visibleSkins[0];
  const peerSkin = visibleSkins.length > 1 ? visibleSkins[1] : undefined;

  const primaryMood: BuddyMood = blushed
    ? 'celebrate'
    : behavior === 'shy_hide'
      ? 'peek'
      : behavior === 'quiet_meetup'
        ? 'curious'
        : companion.adventureDone
          ? 'happy'
          : 'peek';

  const handleTapUni = () => {
    void hapticTap();
    const prev = companion.dailyHugs;
    const next = recordUniPetCare(today);
    setHugFeedback(next > prev ? 'Carinho! +3 energia ⚡' : 'Aqui ao teu lado!');
    setBlushed(true);
    window.dispatchEvent(new CustomEvent('uni-companion-care-updated'));
  };

  return (
    <div
      aria-hidden="true"
      data-uni-anchor={placement.zone}
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none"
    >
      <div
        className={cx(
          'absolute flex gap-1.5 transition-all duration-700 ease-out',
          ZONE_CONTAINER_CLASS[placement.zone],
        )}
        style={{
          opacity: isHidden ? 0 : behavior === 'shy_hide' ? 0.62 : 0.94,
          transform: isHidden
            ? 'scale(0.92) translateY(10px)'
            : `translate(${placement.zone.includes('edge') ? 0 : placement.offsetPx}px, ${placement.zone.includes('edge') ? placement.offsetPx : behavior === 'shy_hide' ? 5 : 0}px) rotate(${placement.tiltDeg}deg)`,
        }}
      >
        <AnimatePresence>
          {(behavior === 'tiny_slip' || blushed) && !isHidden && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.22 }}
              className="mb-1 flex max-w-[175px] items-center gap-1 rounded-xl border border-line/80 bg-surface/95 px-2.5 py-1 text-xs font-medium leading-tight text-fg shadow-sm backdrop-blur-sm"
            >
              {blushed && <Heart size={11} className="shrink-0 fill-coral text-coral" />}
              <span>{blushed ? hugFeedback ?? 'Carinho!' : quietNote}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Peer secundário colorido num encontro amigável */}
        {peerSkin && behavior === 'quiet_meetup' && !placement.zone.includes('edge') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 0.92, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4 }}
            className="mb-0.5"
          >
            <UniBuddy
              mood="curious"
              accessory="default"
              skin={peerSkin}
              size={22}
              interactive={false}
            />
          </motion.div>
        )}

        {/* Micropet equipado ao lado do Uni (estilo Finch) */}
        {activePet !== 'none' && mode !== 'off' && !placement.zone.includes('edge') && (
          <div className="mb-0.5">
            <UniPetBuddy pet={activePet} size={22} />
          </div>
        )}

        {/* Companheiro principal discreto e nómada */}
        <button
          type="button"
          tabIndex={-1}
          disabled={isHidden}
          onClick={handleTapUni}
          aria-label="Fazer carinho no Uni discreto"
          className="pointer-events-auto rounded-full p-0.5 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
        >
          <UniBuddy
            mood={primaryMood}
            accessory={primaryAccessory}
            skin={primarySkin}
            size={28}
            interactive={false}
          />
        </button>
      </div>
    </div>
  );
}
