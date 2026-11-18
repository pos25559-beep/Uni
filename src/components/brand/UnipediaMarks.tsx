import { motion } from 'motion/react';
import type { UniFormId, UniStage } from '../../lib/localDb';
import type { UniAccessoryId } from '../../lib/uniAccessories';
import type { UniPetId, UniSkinId } from '../../lib/uniCollectibles';
import { useStore } from '../../store/useStore';

/**
 * Identidade gráfica oficial Unipedia v3 ("Estúdio Caderno Vivo"):
 * Verde Floresta Caderno (#157F58) + Papel Creme (#FAF8F2) + Coral Marcador (#E04F33) + Manteiga (#FCE99F).
 * Zero roxo/indigo AI-slop.
 */
export function UnipediaLogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Fundo emblema Verde Floresta Caderno */}
      <rect width="64" height="64" rx="18" fill="#157F58" />
      {/* Marcador coral no topo do Uni */}
      <path
        d="M29 14.5V7.5L32.5 10.5L36 7.5V14.5"
        fill="#E04F33"
        stroke="#141312"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Rosto / corpo em nuvem icónica do Uni */}
      <path
        d="M32 13.5C36.4 13.5 39.6 16.3 42.1 17.7C45.1 19.3 48.7 19.9 50.5 23.1C52.3 26.2 51.1 30 51.9 33.5C52.7 37 55.2 40.2 53.7 43.9C52.2 47.4 48.2 48.7 45.2 50.9C42.2 53.1 39.7 56.8 35.7 57C31.8 57.1 28.9 53.9 25.3 53C21.7 52.1 17.2 53.4 14.5 50.6C11.9 47.7 13 43.2 12 39.4C11 35.7 8.4 32.3 9.9 28.5C11.3 24.8 15.6 24.2 18.3 21.3C21 18.4 22.1 14.5 26 13.7C28.1 13.3 30.1 13.5 32 13.5Z"
        fill="#C9DC9F"
        stroke="#141312"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* Bochechas */}
      <circle cx="22.8" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      <circle cx="41.2" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      {/* Olhos */}
      <circle cx="25.2" cy="32.4" r="2.4" fill="#141312" />
      <circle cx="38.8" cy="32.4" r="2.4" fill="#141312" />
      <circle cx="26" cy="31.5" r="0.8" fill="#FFFFFF" />
      <circle cx="39.6" cy="31.5" r="0.8" fill="#FFFFFF" />
      {/* Sorriso */}
      <path
        d="M27.4 38.4C29.1 41.7 34.9 41.7 36.6 38.4"
        stroke="#141312"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Faísca manteiga */}
      <circle cx="51" cy="13.5" r="4" fill="#FCE99F" stroke="#141312" strokeWidth="1.5" />
    </svg>
  );
}

export type BuddyMood =
  | 'happy'
  | 'curious'
  | 'celebrate'
  | 'calm'
  | 'thinking'
  | 'shy'
  | 'peek'
  | 'sleeping'
  | 'listening'
  | 'speaking';

/**
 * O Uni — mascote exclusivo e companheiro IA da Unipedia ("Clippy do caderno").
 * Criado originalmente em SVG vetorial com respiração contínua, piscar natural,
 * estados reativos (a pensar, a esconder os olhos na palavra-passe, a celebrar) e toque tátil.
 */
const SKIN_PALETTE_MAP: Record<
  UniSkinId,
  { fill: string; celebrateFill?: string; darkInk?: boolean; bookmark: string; cheek: string; cheekOpacity: number }
> = {
  classic: { fill: '#C9DC9F', celebrateFill: '#FCE99F', bookmark: '#E04F33', cheek: '#E04F33', cheekOpacity: 0.35 },
  sky: { fill: '#C4E0FD', celebrateFill: '#FCE99F', bookmark: '#1D4ED8', cheek: '#E04F33', cheekOpacity: 0.32 },
  peach: { fill: '#FAD6BA', celebrateFill: '#FCE99F', bookmark: '#E04F33', cheek: '#D97757', cheekOpacity: 0.42 },
  blush: { fill: '#F9C5BE', celebrateFill: '#FCE99F', bookmark: '#B83A22', cheek: '#E04F33', cheekOpacity: 0.45 },
  mint: { fill: '#BCEEE0', celebrateFill: '#FCE99F', bookmark: '#0F766E', cheek: '#E04F33', cheekOpacity: 0.34 },
  cream: { fill: '#EFE6D5', celebrateFill: '#FCE99F', bookmark: '#157F58', cheek: '#E04F33', cheekOpacity: 0.35 },
  crimson: { fill: '#EF6249', celebrateFill: '#F67E66', bookmark: '#FAF8F2', cheek: '#B93822', cheekOpacity: 0.5 },
  butter: { fill: '#FCE99F', bookmark: '#157F58', cheek: '#E04F33', cheekOpacity: 0.38 },
  sage: { fill: '#74C69D', bookmark: '#157F58', cheek: '#E04F33', cheekOpacity: 0.35 },
  terracotta: { fill: '#D97757', celebrateFill: '#E68A6B', bookmark: '#FAF8F2', cheek: '#A33F24', cheekOpacity: 0.45 },
  espresso: { fill: '#8D6E63', darkInk: true, bookmark: '#FCE99F', cheek: '#E04F33', cheekOpacity: 0.42 },
  ink: { fill: '#24221F', darkInk: true, bookmark: '#FCE99F', cheek: '#E04F33', cheekOpacity: 0.4 },
};

export function UniBuddy({
  mood = 'happy',
  accessory = 'default',
  form = 'nuvem',
  stage,
  dormant = false,
  skin,
  size = 56,
  className,
  interactive = true,
  onClick,
  ariaLabel,
}: {
  mood?: BuddyMood;
  accessory?: UniAccessoryId;
  form?: UniFormId;
  stage?: UniStage;
  dormant?: boolean;
  skin?: UniSkinId;
  size?: number;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const savedSkin = useStore((s) => s.settings.uniSkin ?? 'classic');
  const activeSkin: UniSkinId = skin ?? savedSkin;
  const palette = SKIN_PALETTE_MAP[activeSkin] ?? SKIN_PALETTE_MAP.classic;
  const isDarkSkin = Boolean(palette.darkInk);
  const ink = isDarkSkin ? '#FAF8F2' : '#141312';
  const pupilHighlight = isDarkSkin ? '#FCE99F' : '#FFFFFF';
  const bookmarkFill = palette.bookmark;
  const effectiveAccessory: UniAccessoryId =
    stage !== undefined && stage < 2 ? 'default' : accessory;

  const isSleeping = Boolean(dormant || mood === 'sleeping');
  const classicMoodFill: Partial<Record<BuddyMood, string>> = {
    celebrate: '#FCE99F',
    calm: '#BCEEE0',
    sleeping: '#C9DC9F',
    curious: '#FAD6BA',
    thinking: '#FAD6BA',
    listening: '#BCEEE0',
    speaking: '#FCE99F',
    shy: '#C4E0FD',
    peek: '#C4E0FD',
  };
  const bg =
    mood === 'celebrate' && palette.celebrateFill
      ? palette.celebrateFill
      : !skin && activeSkin === 'classic'
        ? classicMoodFill[mood] ?? palette.fill
        : palette.fill;

  const floatAnimate = isSleeping
    ? { y: [0, -1.5, 0], rotate: [0, 0.5, 0] }
    : mood === 'celebrate'
      ? { y: [0, -6, 0], rotate: [0, -4, 4, 0], scale: [1, 1.06, 1] }
      : mood === 'speaking'
        ? { y: [0, -3, 0], scale: [1, 1.03, 1] }
        : mood === 'listening'
          ? { y: [0, -2, 0], rotate: [-1, 1, -1] }
          : mood === 'thinking'
            ? { y: [0, -4, 0], rotate: [-2.5, 2.5, -2.5] }
            : mood === 'shy'
              ? { y: [0, 2, 0], rotate: [-3, -1, -3] }
              : { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] };

  const FORM_BODY_PATHS: Record<UniFormId, string> = {
    nuvem:
      'M40 8C46.5 8 51.2 12.2 54.8 14.2C59.2 16.6 64.5 17.5 67.2 22.2C69.8 26.8 68 32.3 69.2 37.5C70.4 42.6 74 47.4 71.8 52.8C69.7 58 63.8 59.8 59.3 63.1C54.9 66.3 51.2 71.8 45.4 72C39.6 72.2 35.4 67.5 30.1 66.2C24.8 64.9 18.2 66.8 14.3 62.6C10.4 58.3 12.1 51.7 10.6 46.2C9.1 40.8 5.2 35.8 7.4 30.2C9.5 24.7 15.8 23.8 19.8 19.6C23.8 15.3 25.4 9.5 31.1 8.4C34.2 7.8 37.2 8 40 8Z',
    gota:
      'M40 8C48 16 68 32 68 50C68 63.5 55.5 72 40 72C24.5 72 12 63.5 12 50C12 32 32 16 40 8Z',
    estrela:
      'M40 7C44 17 50 19 62 20C70 21 71 29 63 36C59 40 60 46 65 56C69 65 62 71 53 66C45 62 35 62 27 66C18 71 11 65 15 56C20 46 21 40 17 36C9 29 10 21 18 20C30 19 36 17 40 7Z',
    cristal:
      'M40 7L64 20C67.5 22 69 25 69 29L67 52C66.5 56.5 64 59 60 61L40 72L20 61C16 59 13.5 56.5 13 52L11 29C11 25 12.5 22 16 20Z',
    folha:
      'M40 8C56 12 69 26 68 46C67 62 54 71 40 72C26 71 13 62 12 46C11 26 24 12 40 8Z',
  };
  const bodyPath = FORM_BODY_PATHS[form] ?? FORM_BODY_PATHS.nuvem;

  const hasKeyframeScale = !isSleeping && (mood === 'celebrate' || mood === 'speaking');

  const svg = (
    <motion.svg
      width={size}
      height={size}
      viewBox="-4 -14 88 94"
      fill="none"
      className={className}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        ...floatAnimate,
      }}
      transition={{
        scale: hasKeyframeScale
          ? { repeat: Infinity, duration: mood === 'celebrate' ? 1.8 : 1.1, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 360, damping: 20 },
        opacity: { duration: 0.25 },
        y: { repeat: Infinity, duration: mood === 'celebrate' ? 1.8 : 3.4, ease: 'easeInOut' },
        rotate: { repeat: Infinity, duration: mood === 'celebrate' ? 1.8 : 4.2, ease: 'easeInOut' },
      }}
      aria-hidden={onClick ? undefined : true}
    >
      {/* Halo suave quando está a ouvir em Voz Live */}
      {mood === 'listening' && (
        <motion.circle
          cx="40"
          cy="40"
          r="38"
          stroke="#157F58"
          strokeWidth="1.8"
          strokeDasharray="5 4"
          initial={{ scale: 0.94, opacity: 0.35 }}
          animate={{ scale: [0.94, 1.05, 0.94], opacity: [0.35, 0.75, 0.35] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          style={{ transformOrigin: '40px 40px' }}
        />
      )}

      {/* Marcador coral padrão (escondido apenas quando leva chapéu em cima) */}
      {(effectiveAccessory === 'default' || effectiveAccessory === 'humanities' || effectiveAccessory === 'science') && (
        <path d="M36 9V2L40 5.5L44 2V9" fill={bookmarkFill} stroke="#141312" strokeWidth="1.8" strokeLinejoin="round" />
      )}

      {/* Auscultadores Tech por trás do topo */}
      {effectiveAccessory === 'tech' && (
        <g>
          <path d="M12 36C12 16 24 4 40 4C56 4 68 16 68 36" stroke="#141312" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M12 36C12 16 24 4 40 4C56 4 68 16 68 36" stroke="#6EE7B7" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {/* Corpo do Uni (5 formas base de papelaria) */}
      <path
        d={bodyPath}
        fill={bg}
        stroke={isDarkSkin ? '#FCE99F' : '#141312'}
        strokeWidth="2.2"
      />

      {/* Facetas discretas nas formas Cristal e Folha */}
      {form === 'cristal' && (
        <path
          d="M16 21L40 28L64 21M40 7V28"
          stroke={ink}
          strokeWidth="1.2"
          strokeOpacity="0.22"
          strokeLinecap="round"
        />
      )}
      {form === 'folha' && (
        <path
          d="M40 16V68M40 31L51 24M40 44L29 37"
          stroke={ink}
          strokeWidth="1.2"
          strokeOpacity="0.18"
          strokeLinecap="round"
        />
      )}

      {/* Estágio 0 (Ovo): casca de papel creme protetora na base */}
      {stage === 0 && (
        <path
          d="M15 49L22 44L29 49L35 44L40 49L46 44L52 49L58 44L65 49C64 62 54 71 40 71C26 71 16 62 15 49Z"
          fill="#FAF8F2"
          stroke="#141312"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Estágio 3 (Especialista): selo dourado de exame no colarinho */}
      {stage !== undefined && stage >= 3 && (
        <g>
          <path
            d="M32 63L40 67L48 63L45 73L40 70L35 73Z"
            fill="#FCE99F"
            stroke="#141312"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="64" r="3.4" fill="#157F58" stroke="#141312" strokeWidth="1.5" />
        </g>
      )}

      {/* Estágio 4 (Mestre): louros de graduação */}
      {stage !== undefined && stage >= 4 && (
        <g>
          <path
            d="M11 49C9 58 14 66 23 69M69 49C71 58 66 66 57 69"
            stroke="#157F58"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M13 54L18 52M15 61L20 58M67 54L62 52M65 61L60 58"
            stroke="#C9DC9F"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M66 5L68 9L72 10L68 11.5L66 15.5L64 11.5L60 10L64 9Z"
            fill="#FCE99F"
            stroke="#141312"
            strokeWidth="1.2"
          />
        </g>
      )}

      {/* Almofadas dos auscultadores nas laterais (Tech) */}
      {effectiveAccessory === 'tech' && (
        <g>
          <rect x="3" y="29" width="9" height="17" rx="4.5" fill="#157F58" stroke="#141312" strokeWidth="2" />
          <rect x="68" y="29" width="9" height="17" rx="4.5" fill="#157F58" stroke="#141312" strokeWidth="2" />
        </g>
      )}

      {/* Bochechas */}
      <circle cx="26.5" cy="43.5" r="3.5" fill={palette.cheek} fillOpacity={palette.cheekOpacity} />
      <circle cx="53.5" cy="43.5" r="3.5" fill={palette.cheek} fillOpacity={palette.cheekOpacity} />

      {/* Olhos reativos com piscar natural (ou repouso em Ovo/dormente/a dormir) */}
      {isSleeping || stage === 0 ? (
        <>
          <path d="M26 36C28.2 38 31.8 38 34 36" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M46 36C48.2 38 51.8 38 54 36" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : mood === 'celebrate' ? (
        <>
          <path d="M26 36.5C28 33 32 33 34 36.5" stroke={ink} strokeWidth="2.7" strokeLinecap="round" />
          <path d="M46 36.5C48 33 52 33 54 36.5" stroke={ink} strokeWidth="2.7" strokeLinecap="round" />
        </>
      ) : mood === 'shy' ? (
        <>
          {/* Olhos fechados a proteger a palavra-passe */}
          <path d="M26 36C28.2 38.2 31.8 38.2 34 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M46 36C48.2 38.2 51.8 38.2 54 36" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          {/* Mãozinhas de papel a tapar */}
          <rect x="21" y="29" width="14" height="9" rx="4.5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <rect x="45" y="29" width="14" height="9" rx="4.5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
        </>
      ) : mood === 'peek' ? (
        <>
          <rect x="21" y="30" width="14" height="8" rx="4" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <circle cx="50" cy="36" r="3.2" fill={ink} />
          <circle cx="51" cy="34.8" r="1.1" fill={pupilHighlight} />
        </>
      ) : (
        <motion.g
          style={{ transformOrigin: '40px 36px' }}
          animate={{ scaleY: [1, 1, 1, 0.12, 1] }}
          transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.88, 0.92, 0.96, 1] }}
        >
          <circle cx="30" cy="36" r={mood === 'listening' ? 3.5 : 3.2} fill={ink} />
          <circle cx="50" cy="36" r={mood === 'listening' ? 3.5 : 3.2} fill={ink} />
          <circle
            cx={mood === 'curious' ? 31.4 : 31}
            cy={mood === 'thinking' ? 33.9 : 34.8}
            r="1.05"
            fill={pupilHighlight}
          />
          <circle
            cx={mood === 'curious' ? 51.4 : 51}
            cy={mood === 'thinking' ? 33.9 : 34.8}
            r="1.05"
            fill={pupilHighlight}
          />
        </motion.g>
      )}

      {/* Boca reativa */}
      {mood === 'speaking' ? (
        <motion.ellipse
          cx="40"
          cy="46.2"
          rx="4.2"
          ry="2.6"
          fill={ink}
          animate={{ ry: [1.6, 3.4, 2.0, 3.1, 1.6] }}
          transition={{ repeat: Infinity, duration: 0.65, ease: 'easeInOut' }}
        />
      ) : mood === 'curious' || mood === 'thinking' ? (
        <circle cx="40" cy="46.5" r="2.8" fill={ink} />
      ) : mood === 'shy' || mood === 'peek' ? (
        <path d="M36 46C38.5 47.5 41.5 47.5 44 46" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      ) : mood === 'calm' || isSleeping || mood === 'listening' ? (
        <path d="M35 45.5C37.5 47.5 42.5 47.5 45 45.5" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path
          d="M33.5 44.5C35.8 49.2 44.2 49.2 46.5 44.5"
          stroke={ink}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}

      {/* Indicador calmo Zzz quando a dormir */}
      {isSleeping && (
        <motion.g
          animate={{ y: [0, -3, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
          stroke={ink}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M61 12H66.5L61 17.5H66.5" />
          <path d="M69 5H73L69 9H73" />
        </motion.g>
      )}

      {/* Órbita de 3 pontos quando está a pensar */}
      {mood === 'thinking' && (
        <motion.g
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
        >
          <circle cx="62" cy="18" r="1.8" fill="#157F58" />
          <circle cx="67" cy="14" r="2.2" fill="#157F58" />
          <circle cx="72.5" cy="9.5" r="2.6" fill="#E04F33" />
        </motion.g>
      )}

      {/* Faísca coral quando celebra */}
      {mood === 'celebrate' && (
        <motion.path
          d="M67 9L69 13L73 14L69 15.5L67 19.5L65 15.5L61 14L65 13L67 9Z"
          fill="#E04F33"
          stroke="#141312"
          strokeWidth="1.2"
          strokeLinejoin="round"
          animate={{ scale: [0.85, 1.18, 0.85], rotate: [0, 14, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          style={{ transformOrigin: '67px 14px' }}
        />
      )}

      {/* Acessórios por área do conhecimento (visíveis sempre que global ou a partir de Explorador) */}
      {effectiveAccessory === 'math' && (
        <g>
          {/* Chapéu pontiagudo de matemática com Pi */}
          <path
            d="M24 12L40 -9L56 12C50 15 30 15 24 12Z"
            fill="#C4E0FD"
            stroke="#141312"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="40" cy="-10" r="3" fill="#FCE99F" stroke="#141312" strokeWidth="1.6" />
          <path d="M36 4.5H44M38 4.5V9.5M42 4.5V9.5" stroke="#141312" strokeWidth="1.7" strokeLinecap="round" />
          {mood !== 'shy' && mood !== 'peek' && (
            <g stroke="#141312" strokeWidth="1.7">
              <rect x="23" y="30" width="14" height="11" rx="3" fill="#FFFFFF" fillOpacity="0.28" />
              <rect x="43" y="30" width="14" height="11" rx="3" fill="#FFFFFF" fillOpacity="0.28" />
              <path d="M37 35H43" />
            </g>
          )}
        </g>
      )}

      {effectiveAccessory === 'arts' && (
        <g transform="rotate(-10 40 8)">
          {/* Boina artística coral */}
          <path
            d="M21 12C20 1 32 -5 45 -3C57 -1 63 6 58 13C47 16 32 16 21 12Z"
            fill="#E04F33"
            stroke="#141312"
            strokeWidth="2"
          />
          <path d="M40 -3L42 -7" stroke="#141312" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="24" y="11" width="31" height="4" rx="2" fill="#141312" />
        </g>
      )}

      {effectiveAccessory === 'health' && (
        <g>
          {/* Rebento de saúde no topo + pequeno estetoscópio */}
          <path d="M40 9V0" stroke="#141312" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 2C35 -5 28 -3 29 3C32 6 37 5 40 2Z" fill="#157F58" stroke="#141312" strokeWidth="1.6" />
          <path d="M40 2C45 -5 52 -3 51 3C48 6 43 5 40 2Z" fill="#C9DC9F" stroke="#141312" strokeWidth="1.6" />
          <path d="M26 57C29 66 51 66 54 57" stroke="#141312" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="54" cy="57" r="3.4" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
        </g>
      )}

      {effectiveAccessory === 'science' && (
        <g>
          {/* Óculos de proteção na testa */}
          <rect x="21" y="13" width="16" height="10" rx="4" fill="#BCEEE0" stroke="#141312" strokeWidth="1.9" />
          <rect x="43" y="13" width="16" height="10" rx="4" fill="#BCEEE0" stroke="#141312" strokeWidth="1.9" />
          <path d="M37 18H43M16 17H21M59 17H64" stroke="#141312" strokeWidth="1.9" strokeLinecap="round" />
        </g>
      )}

      {effectiveAccessory === 'humanities' && (
        <g>
          {mood !== 'shy' && mood !== 'peek' && (
            <g stroke="#141312" strokeWidth="1.7">
              <circle cx="30" cy="36" r="6.5" fill="#FAF8F2" fillOpacity="0.22" />
              <circle cx="50" cy="36" r="6.5" fill="#FAF8F2" fillOpacity="0.22" />
              <path d="M36.5 36H43.5" />
            </g>
          )}
          {/* Pequeno laço académico */}
          <path d="M34 59L40 62L34 65V59ZM46 59L40 62L46 65V59Z" fill="#E04F33" stroke="#141312" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="40" cy="62" r="2" fill="#FCE99F" stroke="#141312" strokeWidth="1.3" />
        </g>
      )}
    </motion.svg>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || 'Falar com o Uni'}
        whileHover={interactive ? { scale: 1.07, rotate: 3 } : undefined}
        whileTap={interactive ? { scale: 0.88, rotate: -6 } : undefined}
        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {svg}
      </motion.button>
    );
  }

  return interactive ? (
    <motion.div
      whileHover={{ scale: 1.06, rotate: 3 }}
      whileTap={{ scale: 0.9, rotate: -6 }}
      transition={{ type: 'spring', stiffness: 420, damping: 20 }}
      className="inline-flex shrink-0 items-center justify-center"
    >
      {svg}
    </motion.div>
  ) : (
    svg
  );
}

/** Alias mantido para compatibilidade com importações existentes. */
export const NotebookBuddy = UniBuddy;

/**
 * Micropets originais de papelaria/origami ao estilo Finch que caminham ao lado do Uni.
 */
export function UniPetBuddy({
  pet,
  size = 24,
  className,
}: {
  pet: Exclude<UniPetId, 'none'>;
  size?: number;
  className?: string;
}) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      animate={{ y: [0, -2.5, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {pet === 'cat' && (
        <g>
          <path
            d="M11 24L13 11L21 17H27L35 11L37 24C39 33 34 40 24 40C14 40 9 33 11 24Z"
            fill="#FAD6BA"
            stroke="#141312"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M15 17L14.5 13L18 16M33 17L33.5 13L30 16" stroke="#E04F33" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="19" cy="26" r="2.1" fill="#141312" />
          <circle cx="29" cy="26" r="2.1" fill="#141312" />
          <path d="M22.5 30L24 31.5L25.5 30" stroke="#E04F33" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 27H15M33 27H38" stroke="#141312" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </g>
      )}
      {pet === 'owl' && (
        <g>
          <ellipse cx="24" cy="26" rx="14" ry="15" fill="#D97757" stroke="#141312" strokeWidth="2.2" />
          <ellipse cx="24" cy="31" rx="8" ry="8" fill="#FAF8F2" />
          <circle cx="19" cy="22" r="5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <circle cx="29" cy="22" r="5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <circle cx="19.5" cy="22" r="2" fill="#141312" />
          <circle cx="28.5" cy="22" r="2" fill="#141312" />
          <path d="M22 26L24 29L26 26Z" fill="#FCE99F" stroke="#141312" strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      )}
      {pet === 'fox' && (
        <g>
          <path
            d="M10 13L19 19H29L38 13L39 27C39 34 32 40 24 40C16 40 9 34 9 27L10 13Z"
            fill="#E04F33"
            stroke="#141312"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M10 28C15 31 19 36 24 40C29 36 33 31 38 28C35 36 30 40 24 40C18 40 13 36 10 28Z" fill="#FAF8F2" />
          <circle cx="19" cy="25" r="2.1" fill="#141312" />
          <circle cx="29" cy="25" r="2.1" fill="#141312" />
          <circle cx="24" cy="31" r="2.3" fill="#141312" />
        </g>
      )}
      {pet === 'turtle' && (
        <g>
          <ellipse cx="22" cy="34" rx="13" ry="5" fill="#C9DC9F" stroke="#141312" strokeWidth="2" />
          <path
            d="M10 31C10 21 15 16 22 16C29 16 34 21 34 31Z"
            fill="#157F58"
            stroke="#141312"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="38" cy="28" r="5" fill="#C9DC9F" stroke="#141312" strokeWidth="2" />
          <circle cx="39.5" cy="27" r="1.4" fill="#141312" />
          <path d="M17 22H27M22 18V29" stroke="#FCE99F" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
      {pet === 'rabbit' && (
        <g>
          <ellipse cx="18" cy="14" rx="3.8" ry="9" fill="#FCE99F" stroke="#141312" strokeWidth="2" />
          <ellipse cx="30" cy="14" rx="3.8" ry="9" fill="#FCE99F" stroke="#141312" strokeWidth="2" />
          <ellipse cx="24" cy="29" rx="12.5" ry="11.5" fill="#FCE99F" stroke="#141312" strokeWidth="2.2" />
          <circle cx="19.5" cy="27" r="2" fill="#141312" />
          <circle cx="28.5" cy="27" r="2" fill="#141312" />
          <circle cx="24" cy="30.5" r="1.8" fill="#E04F33" />
          <circle cx="16.5" cy="31" r="2" fill="#E04F33" fillOpacity="0.35" />
          <circle cx="31.5" cy="31" r="2" fill="#E04F33" fillOpacity="0.35" />
        </g>
      )}
    </motion.svg>
  );
}

export type OnboardingSceneKey = 'welcome' | 'privacy' | 'curriculum' | 'rhythm';

/**
 * Cenas geométricas vivas de papelaria & formas táteis para o Onboarding,
 * inspiradas em formas empilhadas + stickers + orbitadores suaves (sem copiar grafismos externos).
 */
export function OnboardingSceneArt({
  scene,
  className,
}: {
  scene: OnboardingSceneKey;
  className?: string;
}) {
  if (scene === 'welcome') {
    return (
      <svg viewBox="0 0 260 190" fill="none" className={className} aria-hidden="true">
        {/* Orbitadores suaves de fundo */}
        <circle cx="42" cy="46" r="14" fill="#BCEEE0" />
        <circle cx="222" cy="140" r="11" fill="#FAD6BA" />
        <path d="M214 34L217 41L224 44L217 47L214 54L211 47L204 44L211 41L214 34Z" fill="#FCE99F" stroke="#141312" strokeWidth="1.4" />
        {/* Medalhão central do Uni */}
        <circle cx="130" cy="96" r="56" fill="#FCE99F" stroke="#141312" strokeWidth="2.2" />
        <g transform="translate(86 48) scale(1.1)">
          <path d="M36 9V2L40 5.5L44 2V9" fill="#E04F33" stroke="#141312" strokeWidth="1.8" strokeLinejoin="round" />
          <path
            d="M40 8C46.5 8 51.2 12.2 54.8 14.2C59.2 16.6 64.5 17.5 67.2 22.2C69.8 26.8 68 32.3 69.2 37.5C70.4 42.6 74 47.4 71.8 52.8C69.7 58 63.8 59.8 59.3 63.1C54.9 66.3 51.2 71.8 45.4 72C39.6 72.2 35.4 67.5 30.1 66.2C24.8 64.9 18.2 66.8 14.3 62.6C10.4 58.3 12.1 51.7 10.6 46.2C9.1 40.8 5.2 35.8 7.4 30.2C9.5 24.7 15.8 23.8 19.8 19.6C23.8 15.3 25.4 9.5 31.1 8.4C34.2 7.8 37.2 8 40 8Z"
            fill="#C9DC9F"
            stroke="#141312"
            strokeWidth="2.2"
          />
          <circle cx="26.5" cy="43.5" r="3.4" fill="#E04F33" fillOpacity="0.4" />
          <circle cx="53.5" cy="43.5" r="3.4" fill="#E04F33" fillOpacity="0.4" />
          <circle cx="30" cy="36" r="3.2" fill="#141312" />
          <circle cx="50" cy="36" r="3.2" fill="#141312" />
          <circle cx="31" cy="34.8" r="1.05" fill="#FFFFFF" />
          <circle cx="51" cy="34.8" r="1.05" fill="#FFFFFF" />
          <path d="M33.5 44.5C35.8 49.2 44.2 49.2 46.5 44.5" stroke="#141312" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (scene === 'privacy') {
    return (
      <svg viewBox="0 0 260 190" fill="none" className={className} aria-hidden="true">
        <circle cx="48" cy="138" r="13" fill="#FAD6BA" />
        <circle cx="216" cy="48" r="10" fill="#C4E0FD" />
        <rect x="44" y="34" width="172" height="122" rx="26" fill="#BCEEE0" stroke="#141312" strokeWidth="2.2" />
        {/* Caderno fechado com cadeado simpático */}
        <rect x="86" y="54" width="88" height="84" rx="18" fill="#FAF8F2" stroke="#141312" strokeWidth="2.2" />
        <path d="M115 84V74C115 65.7 121.7 59 130 59C138.3 59 145 65.7 145 74V84" stroke="#157F58" strokeWidth="4.5" strokeLinecap="round" />
        <rect x="108" y="82" width="44" height="36" rx="11" fill="#157F58" stroke="#141312" strokeWidth="2" />
        <circle cx="130" cy="97" r="4" fill="#FCE99F" />
        <path d="M130 100V107" stroke="#FCE99F" strokeWidth="2.6" strokeLinecap="round" />
        {/* Selo coral */}
        <circle cx="174" cy="54" r="14" fill="#FCE99F" stroke="#141312" strokeWidth="2" />
        <path d="M169 54L172.5 57.5L179.5 50.5" stroke="#157F58" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (scene === 'curriculum') {
    return (
      <svg viewBox="0 0 260 190" fill="none" className={className} aria-hidden="true">
        {/* Pastas empilhadas com abas */}
        <rect x="50" y="32" width="160" height="44" rx="16" fill="#FCE99F" stroke="#141312" strokeWidth="2" />
        <rect x="44" y="58" width="172" height="48" rx="16" fill="#C4E0FD" stroke="#141312" strokeWidth="2" />
        <rect x="38" y="86" width="184" height="68" rx="20" fill="#C9DC9F" stroke="#141312" strokeWidth="2.2" />
        <rect x="56" y="106" width="84" height="10" rx="5" fill="#141312" />
        <rect x="56" y="124" width="114" height="8" rx="4" fill="#141312" fillOpacity="0.25" />
        <circle cx="192" cy="120" r="16" fill="#FAF8F2" stroke="#141312" strokeWidth="2" />
        <path d="M186 120L190.5 124.5L199 115.5" stroke="#157F58" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // scene === 'rhythm'
  return (
    <svg viewBox="0 0 260 190" fill="none" className={className} aria-hidden="true">
      <circle cx="52" cy="48" r="12" fill="#C9DC9F" />
      <rect x="38" y="40" width="184" height="114" rx="24" fill="#FAD6BA" stroke="#141312" strokeWidth="2.2" />
      {/* Mini gráfico de pílulas semanais */}
      {[
        { x: 64, h: 36, c: '#FAF8F2' },
        { x: 88, h: 52, c: '#157F58' },
        { x: 112, h: 64, c: '#FCE99F' },
        { x: 136, h: 46, c: '#FAF8F2' },
        { x: 160, h: 72, c: '#157F58' },
        { x: 184, h: 58, c: '#E04F33' },
      ].map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={132 - b.h}
          width="16"
          height={b.h}
          rx="8"
          fill={b.c}
          stroke="#141312"
          strokeWidth="1.8"
        />
      ))}
      <circle cx="188" cy="52" r="13" fill="#FCE99F" stroke="#141312" strokeWidth="1.8" />
      <path d="M188 46V52.5L192 55" stroke="#141312" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
