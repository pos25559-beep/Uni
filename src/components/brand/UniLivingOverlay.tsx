import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { studyStreak, todayStr } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { readCollectibleTelemetry } from '../../lib/uniCollectibles';
import { pickNextShyBehavior, pickQuietRouteNote, resolveVisibleUniPeers } from '../../lib/uniPetEngine';
import { useStore } from '../../store/useStore';
import { UniBuddy, type BuddyMood } from './UnipediaMarks';

/**
 * Companheiros Uni discretos («Unis com vergonha»).
 * Ficam nas margens/cantos do ecrã sem bloquear toques nem distrair:
 * escondem-se automaticamente quando o estudante escreve, faz scroll ou ativa o modo sério.
 */
export default function UniLivingOverlay() {
  const { pathname } = useLocation();
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const academicProfile = useStore((s) => s.academicProfile);
  const settings = useStore((s) => s.settings);

  const [tickSeed, setTickSeed] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [blushed, setBlushed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const mode = settings.uniLiveCompanions ?? 'all';
  const appTone = settings.appTone ?? 'vibrante';
  const activeSkin = settings.uniSkin ?? 'classic';

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
      }),
    [activeSkin, telemetry, mode, appTone, tickSeed],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
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
        if (next % 3 === 0) setTickSeed((t) => t + 1);
        return next;
      });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [visibleSkins.length, reducedMotion]);

  useEffect(() => {
    if (!blushed) return;
    const timer = window.setTimeout(() => setBlushed(false), 2600);
    return () => window.clearTimeout(timer);
  }, [blushed]);

  if (visibleSkins.length === 0 || reducedMotion) return null;

  const isHidden = inputFocused || scrolling;
  const behavior = pickNextShyBehavior({
    hasPeer: visibleSkins.length > 1,
    stepCount,
    isFocusActive: isHidden,
  });

  const primaryAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile.degreeName,
    courses[0]?.name,
  );

  const today = todayStr();
  const pendingTodayCount = sessions.filter((s) => s.date === today && !s.done).length;
  const streakDays = studyStreak(sessions);
  const quietNote = pickQuietRouteNote({ pathname, pendingTodayCount, streakDays });

  const primarySkin = visibleSkins[0];
  const peerSkin = visibleSkins.length > 1 ? visibleSkins[1] : undefined;

  const primaryMood: BuddyMood = blushed
    ? 'shy'
    : behavior === 'shy_hide'
      ? 'peek'
      : behavior === 'quiet_meetup'
        ? 'curious'
        : 'peek';

  const horizontalShift =
    behavior === 'edge_walk'
      ? (stepCount % 2 === 0 ? -22 : -6)
      : 0;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none"
    >
      <div
        className="absolute right-3.5 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] flex items-end gap-1.5 transition-all duration-700 ease-out md:right-6 md:bottom-3.5"
        style={{
          opacity: isHidden ? 0 : behavior === 'shy_hide' ? 0.55 : 0.9,
          transform: isHidden
            ? 'translateY(14px)'
            : `translate(${horizontalShift}px, ${behavior === 'shy_hide' ? '7px' : '2px'})`,
        }}
      >
        <AnimatePresence>
          {(behavior === 'tiny_slip' || blushed) && !isHidden && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.22 }}
              className="mb-1.5 max-w-[168px] rounded-xl border border-line/80 bg-surface/95 px-2.5 py-1 text-[10px] font-medium leading-tight text-muted shadow-sm backdrop-blur-sm"
            >
              {blushed ? 'shh… estamos só a espreitar' : quietNote}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Peer secundário silencioso num encontro tímido */}
        {peerSkin && behavior === 'quiet_meetup' && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.9 }}
            animate={{ opacity: 0.92, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.4 }}
            className="mb-0.5"
          >
            <UniBuddy
              mood="curious"
              accessory="default"
              skin={peerSkin}
              size={24}
              interactive={false}
            />
          </motion.div>
        )}

        {/* Companheiro principal encolhido à borda */}
        <button
          type="button"
          tabIndex={-1}
          disabled={isHidden}
          onClick={() => setBlushed(true)}
          aria-label="Companheiro Uni tímido no canto"
          className="pointer-events-auto rounded-full p-0.5 transition-transform hover:scale-105 focus:outline-none"
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
