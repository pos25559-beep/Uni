import { motion } from 'motion/react';
import type { UniAccessoryId } from '../../lib/uniAccessories';

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
      <rect width="64" height="64" rx="18" fill="#157F58" />
      <rect x="13" y="16" width="38" height="33" rx="7" fill="#FAF8F2" />
      <rect x="30" y="16" width="4" height="33" fill="#E6DFD3" />
      <path d="M40 16V30L43.5 27.5L47 30V16H40Z" fill="#E04F33" />
      <rect x="18" y="24" width="8.5" height="2.6" rx="1.3" fill="#141312" />
      <rect x="18" y="30.5" width="9" height="2.4" rx="1.2" fill="#157F58" fillOpacity="0.65" />
      <rect x="18" y="37" width="6.5" height="2.4" rx="1.2" fill="#C9DC9F" />
      <circle cx="50" cy="13" r="4.5" fill="#FCE99F" stroke="#141312" strokeWidth="1.6" />
    </svg>
  );
}

export type BuddyMood = 'happy' | 'curious' | 'celebrate' | 'calm' | 'thinking' | 'shy' | 'peek';

/**
 * O Uni — mascote exclusivo e companheiro IA da Unipedia ("Clippy do caderno").
 * Criado originalmente em SVG vetorial com respiração contínua, piscar natural,
 * estados reativos (a pensar, a esconder os olhos na palavra-passe, a celebrar) e toque tátil.
 */
export function UniBuddy({
  mood = 'happy',
  accessory = 'default',
  size = 56,
  className,
  interactive = true,
  onClick,
  ariaLabel,
}: {
  mood?: BuddyMood;
  accessory?: UniAccessoryId;
  size?: number;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const bg =
    mood === 'celebrate'
      ? '#FCE99F'
      : mood === 'calm'
        ? '#BCEEE0'
        : mood === 'curious' || mood === 'thinking'
          ? '#FAD6BA'
          : mood === 'shy' || mood === 'peek'
            ? '#C4E0FD'
            : '#C9DC9F';

  const floatAnimate =
    mood === 'celebrate'
      ? { y: [0, -6, 0], rotate: [0, -4, 4, 0], scale: [1, 1.06, 1] }
      : mood === 'thinking'
        ? { y: [0, -4, 0], rotate: [-2.5, 2.5, -2.5] }
        : mood === 'shy'
          ? { y: [0, 2, 0], rotate: [-3, -1, -3] }
          : { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] };

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
        scale: { type: 'spring', stiffness: 360, damping: 20 },
        opacity: { duration: 0.25 },
        y: { repeat: Infinity, duration: mood === 'celebrate' ? 1.8 : 3.4, ease: 'easeInOut' },
        rotate: { repeat: Infinity, duration: mood === 'celebrate' ? 1.8 : 4.2, ease: 'easeInOut' },
      }}
      aria-hidden={onClick ? undefined : true}
    >
      {/* Marcador coral padrão (escondido apenas quando leva chapéu em cima) */}
      {(accessory === 'default' || accessory === 'humanities' || accessory === 'science') && (
        <path d="M36 9V2L40 5.5L44 2V9" fill="#E04F33" stroke="#141312" strokeWidth="1.8" strokeLinejoin="round" />
      )}

      {/* Auscultadores Tech por trás do topo */}
      {accessory === 'tech' && (
        <g>
          <path d="M12 36C12 16 24 4 40 4C56 4 68 16 68 36" stroke="#141312" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M12 36C12 16 24 4 40 4C56 4 68 16 68 36" stroke="#6EE7B7" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {/* Corpo em nuvem / página recortada de caderno */}
      <path
        d="M40 8C46.5 8 51.2 12.2 54.8 14.2C59.2 16.6 64.5 17.5 67.2 22.2C69.8 26.8 68 32.3 69.2 37.5C70.4 42.6 74 47.4 71.8 52.8C69.7 58 63.8 59.8 59.3 63.1C54.9 66.3 51.2 71.8 45.4 72C39.6 72.2 35.4 67.5 30.1 66.2C24.8 64.9 18.2 66.8 14.3 62.6C10.4 58.3 12.1 51.7 10.6 46.2C9.1 40.8 5.2 35.8 7.4 30.2C9.5 24.7 15.8 23.8 19.8 19.6C23.8 15.3 25.4 9.5 31.1 8.4C34.2 7.8 37.2 8 40 8Z"
        fill={bg}
        stroke="#141312"
        strokeWidth="2.2"
      />

      {/* Almofadas dos auscultadores nas laterais (Tech) */}
      {accessory === 'tech' && (
        <g>
          <rect x="3" y="29" width="9" height="17" rx="4.5" fill="#157F58" stroke="#141312" strokeWidth="2" />
          <rect x="68" y="29" width="9" height="17" rx="4.5" fill="#157F58" stroke="#141312" strokeWidth="2" />
        </g>
      )}

      {/* Bochechas */}
      <circle cx="26.5" cy="43.5" r="3.5" fill="#E04F33" fillOpacity="0.35" />
      <circle cx="53.5" cy="43.5" r="3.5" fill="#E04F33" fillOpacity="0.35" />

      {/* Olhos reativos com piscar natural */}
      {mood === 'celebrate' ? (
        <>
          <path d="M26 36.5C28 33 32 33 34 36.5" stroke="#141312" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M46 36.5C48 33 52 33 54 36.5" stroke="#141312" strokeWidth="2.7" strokeLinecap="round" />
        </>
      ) : mood === 'shy' ? (
        <>
          {/* Olhos fechados a proteger a palavra-passe */}
          <path d="M26 36C28.2 38.2 31.8 38.2 34 36" stroke="#141312" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M46 36C48.2 38.2 51.8 38.2 54 36" stroke="#141312" strokeWidth="2.6" strokeLinecap="round" />
          {/* Mãozinhas de papel a tapar */}
          <rect x="21" y="29" width="14" height="9" rx="4.5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <rect x="45" y="29" width="14" height="9" rx="4.5" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
        </>
      ) : mood === 'peek' ? (
        <>
          <rect x="21" y="30" width="14" height="8" rx="4" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
          <circle cx="50" cy="36" r="3.2" fill="#141312" />
          <circle cx="51" cy="34.8" r="1.1" fill="#FFFFFF" />
        </>
      ) : (
        <motion.g
          style={{ transformOrigin: '40px 36px' }}
          animate={{ scaleY: [1, 1, 1, 0.12, 1] }}
          transition={{ repeat: Infinity, duration: 4.5, times: [0, 0.88, 0.92, 0.96, 1] }}
        >
          <circle cx="30" cy="36" r="3.2" fill="#141312" />
          <circle cx="50" cy="36" r="3.2" fill="#141312" />
          <circle cx={mood === 'curious' ? 31.4 : 31} cy="34.8" r="1.05" fill="#FFFFFF" />
          <circle cx={mood === 'curious' ? 51.4 : 51} cy="34.8" r="1.05" fill="#FFFFFF" />
        </motion.g>
      )}

      {/* Boca */}
      {mood === 'curious' || mood === 'thinking' ? (
        <circle cx="40" cy="46.5" r="2.8" fill="#141312" />
      ) : mood === 'shy' || mood === 'peek' ? (
        <path d="M36 46C38.5 47.5 41.5 47.5 44 46" stroke="#141312" strokeWidth="2.4" strokeLinecap="round" />
      ) : mood === 'calm' ? (
        <path d="M35 45.5C37.5 47.5 42.5 47.5 45 45.5" stroke="#141312" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path
          d="M33.5 44.5C35.8 49.2 44.2 49.2 46.5 44.5"
          stroke="#141312"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}

      {/* Faísca coral quando celebra ou pensa */}
      {(mood === 'celebrate' || mood === 'thinking') && (
        <motion.path
          d="M67 9L69 13L73 14L69 15.5L67 19.5L65 15.5L61 14L65 13L67 9Z"
          fill={mood === 'thinking' ? '#157F58' : '#E04F33'}
          stroke="#141312"
          strokeWidth="1.2"
          strokeLinejoin="round"
          animate={{ scale: [0.85, 1.18, 0.85], rotate: [0, 14, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          style={{ transformOrigin: '67px 14px' }}
        />
      )}

      {/* Acessórios por área do conhecimento */}
      {accessory === 'math' && (
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

      {accessory === 'arts' && (
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

      {accessory === 'health' && (
        <g>
          {/* Rebento de saúde no topo + pequeno estetoscópio */}
          <path d="M40 9V0" stroke="#141312" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 2C35 -5 28 -3 29 3C32 6 37 5 40 2Z" fill="#157F58" stroke="#141312" strokeWidth="1.6" />
          <path d="M40 2C45 -5 52 -3 51 3C48 6 43 5 40 2Z" fill="#C9DC9F" stroke="#141312" strokeWidth="1.6" />
          <path d="M26 57C29 66 51 66 54 57" stroke="#141312" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="54" cy="57" r="3.4" fill="#FAF8F2" stroke="#141312" strokeWidth="1.8" />
        </g>
      )}

      {accessory === 'science' && (
        <g>
          {/* Óculos de proteção na testa */}
          <rect x="21" y="13" width="16" height="10" rx="4" fill="#BCEEE0" stroke="#141312" strokeWidth="1.9" />
          <rect x="43" y="13" width="16" height="10" rx="4" fill="#BCEEE0" stroke="#141312" strokeWidth="1.9" />
          <path d="M37 18H43M16 17H21M59 17H64" stroke="#141312" strokeWidth="1.9" strokeLinecap="round" />
        </g>
      )}

      {accessory === 'humanities' && (
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

        {/* Forma circular azul céu inclinada */}
        <circle cx="88" cy="118" r="46" fill="#C4E0FD" stroke="#141312" strokeWidth="2" />
        <rect x="64" y="108" width="48" height="7" rx="3.5" fill="#141312" fillOpacity="0.16" />
        <rect x="70" y="122" width="36" height="6" rx="3" fill="#141312" fillOpacity="0.12" />

        {/* Quadrado manteiga inclinado (caderno/nota) */}
        <g transform="rotate(7 166 86)">
          <rect x="118" y="34" width="96" height="102" rx="22" fill="#FCE99F" stroke="#141312" strokeWidth="2.2" />
          <path d="M180 34V58L187 53L194 58V34H180Z" fill="#E04F33" stroke="#141312" strokeWidth="1.6" />
          <rect x="134" y="58" width="36" height="8" rx="4" fill="#141312" />
          <rect x="134" y="76" width="60" height="7" rx="3.5" fill="#157F58" fillOpacity="0.45" />
          <rect x="134" y="92" width="48" height="7" rx="3.5" fill="#141312" fillOpacity="0.2" />
          <circle cx="192" cy="112" r="10" fill="#157F58" />
          <path d="M188 112L191 115L196.5 109.5" stroke="#FAF8F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Sticker salva/flor a espreitar */}
        <circle cx="72" cy="54" r="24" fill="#C9DC9F" stroke="#141312" strokeWidth="2" />
        <circle cx="66" cy="52" r="2.2" fill="#141312" />
        <circle cx="78" cy="52" r="2.2" fill="#141312" />
        <path d="M68 58C70 61 74 61 76 58" stroke="#141312" strokeWidth="2" strokeLinecap="round" />
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
