import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { UniFormId } from '../../lib/localDb';
import type { UniSkinId } from '../../types';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { cx } from '../../lib/uiHelpers';
import { UNIPEDIA_BOUNCE_SPRING, UNIPEDIA_SPRING } from '../../lib/motionTokens';
import { useStore } from '../../store/useStore';
import LottieAccent from '../motion/LottieAccent';
import { UniBuddy, UniPetBuddy, type BuddyMood } from './UnipediaMarks';

export type UniDuoContext = 'files' | 'sync' | 'thinking' | 'reading';

interface BeatPose {
  leftX: number;
  leftY: number;
  leftRotate: number;
  leftMood: BuddyMood;
  rightX: number;
  rightY: number;
  rightRotate: number;
  rightMood: BuddyMood;
  showProp: boolean;
}

const SCRIPT_BEATS: Record<UniDuoContext, readonly BeatPose[]> = {
  files: [
    {
      leftX: -2,
      leftY: 0,
      leftRotate: -4,
      leftMood: 'curious',
      rightX: 2,
      rightY: 0,
      rightRotate: 3,
      rightMood: 'peek',
      showProp: true,
    },
    {
      leftX: 4,
      leftY: -3,
      leftRotate: 6,
      leftMood: 'happy',
      rightX: -2,
      rightY: -1,
      rightRotate: -4,
      rightMood: 'curious',
      showProp: true,
    },
    {
      leftX: 0,
      leftY: 0,
      leftRotate: 0,
      leftMood: 'calm',
      rightX: -4,
      rightY: -4,
      rightRotate: -5,
      rightMood: 'happy',
      showProp: true,
    },
    {
      leftX: 2,
      leftY: -4,
      leftRotate: -3,
      leftMood: 'celebrate',
      rightX: -2,
      rightY: -4,
      rightRotate: 4,
      rightMood: 'celebrate',
      showProp: false,
    },
  ],
  thinking: [
    {
      leftX: 0,
      leftY: 0,
      leftRotate: -3,
      leftMood: 'thinking',
      rightX: 0,
      rightY: -1,
      rightRotate: 4,
      rightMood: 'curious',
      showProp: false,
    },
    {
      leftX: 3,
      leftY: -2,
      leftRotate: 4,
      leftMood: 'curious',
      rightX: -4,
      rightY: -2,
      rightRotate: -6,
      rightMood: 'speaking',
      showProp: true,
    },
    {
      leftX: 2,
      leftY: -4,
      leftRotate: 2,
      leftMood: 'happy',
      rightX: -3,
      rightY: -3,
      rightRotate: -3,
      rightMood: 'happy',
      showProp: true,
    },
    {
      leftX: 0,
      leftY: -2,
      leftRotate: -2,
      leftMood: 'celebrate',
      rightX: 0,
      rightY: -3,
      rightRotate: 3,
      rightMood: 'curious',
      showProp: true,
    },
  ],
  sync: [
    {
      leftX: -2,
      leftY: 0,
      leftRotate: -4,
      leftMood: 'listening',
      rightX: 2,
      rightY: 0,
      rightRotate: 4,
      rightMood: 'curious',
      showProp: true,
    },
    {
      leftX: 2,
      leftY: -3,
      leftRotate: 3,
      leftMood: 'speaking',
      rightX: -1,
      rightY: -1,
      rightRotate: -2,
      rightMood: 'listening',
      showProp: true,
    },
    {
      leftX: 0,
      leftY: -1,
      leftRotate: -2,
      leftMood: 'listening',
      rightX: -3,
      rightY: -3,
      rightRotate: -4,
      rightMood: 'speaking',
      showProp: true,
    },
    {
      leftX: 1,
      leftY: -4,
      leftRotate: 2,
      leftMood: 'happy',
      rightX: -1,
      rightY: -4,
      rightRotate: -2,
      rightMood: 'happy',
      showProp: false,
    },
  ],
  reading: [
    {
      leftX: 0,
      leftY: 0,
      leftRotate: -2,
      leftMood: 'calm',
      rightX: 3,
      rightY: 1,
      rightRotate: 6,
      rightMood: 'peek',
      showProp: true,
    },
    {
      leftX: 2,
      leftY: -1,
      leftRotate: 2,
      leftMood: 'curious',
      rightX: -3,
      rightY: -2,
      rightRotate: -5,
      rightMood: 'curious',
      showProp: true,
    },
    {
      leftX: 0,
      leftY: -2,
      leftRotate: -2,
      leftMood: 'happy',
      rightX: -2,
      rightY: -1,
      rightRotate: 2,
      rightMood: 'happy',
      showProp: true,
    },
    {
      leftX: -1,
      leftY: 0,
      leftRotate: 0,
      leftMood: 'calm',
      rightX: 0,
      rightY: -3,
      rightRotate: -3,
      rightMood: 'celebrate',
      showProp: false,
    },
  ],
};

function pickComplementaryPeerSkin(primary: UniSkinId): UniSkinId {
  const map: Record<UniSkinId, UniSkinId> = {
    classic: 'sky',
    sky: 'peach',
    peach: 'mint',
    blush: 'butter',
    mint: 'blush',
    cream: 'sage',
    butter: 'sky',
    crimson: 'cream',
    sage: 'peach',
    terracotta: 'mint',
    espresso: 'butter',
    ink: 'butter',
  };
  return map[primary] ?? 'sky';
}

interface Props {
  context?: UniDuoContext;
  label?: string;
  sublabel?: string;
  compact?: boolean;
  form?: UniFormId;
  className?: string;
}

/**
 * Palco scriptado com dois Unis vivos (respeitando a skin, forma, acessório e micropet
 * do estudante) que interagem por batidas cronometradas durante carregamentos assíncronos.
 */
export default function UniDuoStage({
  context = 'reading',
  label,
  sublabel,
  compact = false,
  form = 'nuvem',
  className,
}: Props) {
  const reducedMotion = useReducedMotion();
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const courses = useStore((s) => s.courses);

  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setBeatIndex((idx) => (idx + 1) % 4);
    }, 1700);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const beats = SCRIPT_BEATS[context];
  const activeBeat = reducedMotion ? beats[0] : beats[beatIndex % beats.length];

  const primarySkin = settings.uniSkin ?? 'classic';
  const peerSkin = pickComplementaryPeerSkin(primarySkin);
  const primaryForm = form;
  const primaryAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile.degreeName,
    courses[0]?.name,
  );
  const activePet = settings.uniPet ?? 'cat';

  const primarySize = compact ? 34 : 48;
  const peerSize = compact ? 28 : 40;
  const lottieKind =
    context === 'files'
      ? 'pagePass'
      : context === 'sync'
        ? 'syncWave'
        : 'spark';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-2' : 'gap-3 py-5',
        className,
      )}
    >
      <div
        className={cx(
          'relative flex items-end justify-center',
          compact ? 'gap-2.5 px-2' : 'gap-4 px-4',
        )}
      >
        <motion.div
          animate={
            reducedMotion
              ? undefined
              : {
                  x: activeBeat.leftX,
                  y: activeBeat.leftY,
                  rotate: activeBeat.leftRotate,
                }
          }
          transition={UNIPEDIA_BOUNCE_SPRING}
          className="relative z-10"
        >
          <UniBuddy
            mood={activeBeat.leftMood}
            skin={primarySkin}
            form={primaryForm}
            accessory={primaryAccessory}
            size={primarySize}
            interactive={false}
          />
        </motion.div>

        {/* Adereço animado Lottie entre os dois Unis conforme o script */}
        <motion.div
          animate={
            reducedMotion
              ? { opacity: 0.9, scale: 1 }
              : activeBeat.showProp
                ? { opacity: 1, scale: 1, y: context === 'thinking' ? -10 : -2 }
                : { opacity: 0.25, scale: 0.85, y: 0 }
          }
          transition={UNIPEDIA_SPRING}
          className="pointer-events-none flex items-center justify-center self-center"
        >
          <LottieAccent
            kind={lottieKind}
            className={cx(
              context === 'files'
                ? compact
                  ? 'h-8 w-12'
                  : 'h-10 w-16'
                : compact
                  ? 'size-8'
                  : 'size-11',
            )}
          />
        </motion.div>

        <motion.div
          animate={
            reducedMotion
              ? undefined
              : {
                  x: activeBeat.rightX,
                  y: activeBeat.rightY,
                  rotate: activeBeat.rightRotate,
                }
          }
          transition={UNIPEDIA_BOUNCE_SPRING}
          className="relative z-10"
        >
          <UniBuddy
            mood={activeBeat.rightMood}
            skin={peerSkin}
            accessory="default"
            size={peerSize}
            interactive={false}
          />
        </motion.div>

        {activePet !== 'none' && !compact && (
          <motion.div
            animate={
              reducedMotion
                ? undefined
                : {
                    y: beatIndex % 2 === 0 ? -3 : 0,
                    rotate: beatIndex % 2 === 0 ? 4 : -3,
                  }
            }
            transition={UNIPEDIA_SPRING}
            className="-ml-1 mb-0.5"
          >
            <UniPetBuddy pet={activePet} size={22} />
          </motion.div>
        )}
      </div>

      {(label || sublabel) && (
        <div className="space-y-0.5">
          {label && (
            <p className={cx('font-medium text-fg', compact ? 'text-xs' : 'text-sm')}>
              {label}
            </p>
          )}
          {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}
