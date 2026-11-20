import {
  UNI_BOOKMARK_PATH,
  UNI_EGG_PATH,
  UNI_FORM_BODY_PATHS,
  UNI_FORM_FACETS,
  UNI_SMILE_PATH,
  type UniShapeId,
} from '@app/components/brand/uniShapes';
import { motion, useReducedMotion } from 'motion/react';

/**
 * O Uni no site: mesmos traçados da app (`uniShapes`), com respiração e piscar.
 * `stage` 0 desenha o ovo; 4 junta os louros de Mestre (como na app).
 */
export function UniLive({
  shape = 'nuvem',
  fill = '#C9DC9F',
  size = 96,
  stage,
  delay = 0,
  className,
}: {
  shape?: UniShapeId;
  fill?: string;
  size?: number;
  stage?: 0 | 1 | 2 | 3 | 4;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ink = '#141312';
  const facets = UNI_FORM_FACETS[shape];
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="-4 -14 88 94"
      fill="none"
      aria-hidden="true"
      className={className}
      animate={reduce ? undefined : { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{ overflow: 'visible' }}
    >
      {stage === 0 ? (
        <g>
          <path d={UNI_EGG_PATH} fill="#FAF8F2" stroke={ink} strokeWidth="2.2" />
          <ellipse cx="31" cy="17" rx="2.6" ry="2" fill={fill} stroke={ink} strokeWidth="0.6" />
          <ellipse cx="49" cy="23" rx="1.8" ry="1.4" fill="#FCE99F" stroke={ink} strokeWidth="0.6" />
          <ellipse cx="37" cy="30" rx="1.5" ry="1.2" fill={fill} />
          <ellipse cx="25" cy="53" rx="2.2" ry="1.7" fill="#E04F33" fillOpacity={0.45} />
          <ellipse cx="52" cy="59" rx="2.6" ry="2" fill={fill} stroke={ink} strokeWidth="0.6" />
          <ellipse cx="43" cy="66" rx="1.6" ry="1.3" fill="#C4E0FD" />
          <path d="M26 14C23.5 18 22 23 21.3 28" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      ) : (
        <>
          <path d={UNI_BOOKMARK_PATH} fill="#E04F33" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />
          <path d={UNI_FORM_BODY_PATHS[shape]} fill={fill} stroke={ink} strokeWidth="2.2" />
          {facets && <path d={facets} stroke={ink} strokeWidth="1.2" strokeOpacity="0.2" strokeLinecap="round" />}
          {stage !== undefined && stage >= 3 && (
            <g>
              <path d="M32 63L40 67L48 63L45 73L40 70L35 73Z" fill="#FCE99F" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="40" cy="64" r="3.4" fill="#157F58" stroke={ink} strokeWidth="1.5" />
            </g>
          )}
          {stage === 4 && (
            <g>
              <path d="M11 49C9 58 14 66 23 69M69 49C71 58 66 66 57 69" stroke="#157F58" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M13 54L18 52M15 61L20 58M67 54L62 52M65 61L60 58" stroke="#C9DC9F" strokeWidth="2" strokeLinecap="round" />
              <path d="M66 5L68 9L72 10L68 11.5L66 15.5L64 11.5L60 10L64 9Z" fill="#FCE99F" stroke={ink} strokeWidth="1.2" />
            </g>
          )}
          <circle cx="26.5" cy="43.5" r="3.5" fill="#E04F33" fillOpacity={0.35} />
          <circle cx="53.5" cy="43.5" r="3.5" fill="#E04F33" fillOpacity={0.35} />
          <motion.g
            style={{ transformOrigin: '40px 36px' }}
            animate={reduce ? undefined : { scaleY: [1, 1, 1, 0.12, 1] }}
            transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.88, 0.92, 0.96, 1], delay }}
          >
            <circle cx="30" cy="36" r="3.2" fill={ink} />
            <circle cx="50" cy="36" r="3.2" fill={ink} />
            <circle cx="31" cy="34.8" r="1.05" fill="#FFFFFF" />
            <circle cx="51" cy="34.8" r="1.05" fill="#FFFFFF" />
          </motion.g>
          <path d={UNI_SMILE_PATH} stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
    </motion.svg>
  );
}

/** Cores das peles «clássicas» da app (Salva, Céu, Pêssego, Menta, Manteiga). */
export const UNI_FILLS: Record<UniShapeId, string> = {
  nuvem: '#C9DC9F',
  gota: '#C4E0FD',
  estrela: '#FCE99F',
  cristal: '#BCEEE0',
  folha: '#FAD6BA',
};
