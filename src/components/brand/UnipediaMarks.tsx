import { motion } from 'motion/react';

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

export type BuddyMood = 'happy' | 'curious' | 'celebrate' | 'calm';

/**
 * Pequeno mascote expressivo ("Caderno Vivo") em SVG leve,
 * usado em estados vazios, celebrações e no cabeçalho do Tutor.
 */
export function NotebookBuddy({
  mood = 'happy',
  size = 56,
  className,
}: {
  mood?: BuddyMood;
  size?: number;
  className?: string;
}) {
  const bg =
    mood === 'celebrate'
      ? '#FCE99F'
      : mood === 'calm'
        ? '#BCEEE0'
        : mood === 'curious'
          ? '#FAD6BA'
          : '#C9DC9F';

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      initial={{ scale: 0.94 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      aria-hidden="true"
    >
      {/* Aura scalloped / nuvem de caderno */}
      <path
        d="M40 8C46.5 8 51.2 12.2 54.8 14.2C59.2 16.6 64.5 17.5 67.2 22.2C69.8 26.8 68 32.3 69.2 37.5C70.4 42.6 74 47.4 71.8 52.8C69.7 58 63.8 59.8 59.3 63.1C54.9 66.3 51.2 71.8 45.4 72C39.6 72.2 35.4 67.5 30.1 66.2C24.8 64.9 18.2 66.8 14.3 62.6C10.4 58.3 12.1 51.7 10.6 46.2C9.1 40.8 5.2 35.8 7.4 30.2C9.5 24.7 15.8 23.8 19.8 19.6C23.8 15.3 25.4 9.5 31.1 8.4C34.2 7.8 37.2 8 40 8Z"
        fill={bg}
        stroke="#141312"
        strokeWidth="2.2"
      />
      {/* Bochechas */}
      <circle cx="27" cy="43" r="3.4" fill="#E04F33" fillOpacity="0.32" />
      <circle cx="53" cy="43" r="3.4" fill="#E04F33" fillOpacity="0.32" />
      {/* Olhos */}
      {mood === 'celebrate' ? (
        <>
          <path d="M27 36C28.5 33.5 31.5 33.5 33 36" stroke="#141312" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M47 36C48.5 33.5 51.5 33.5 53 36" stroke="#141312" strokeWidth="2.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="30" cy="36" r="3.1" fill="#141312" />
          <circle cx="50" cy="36" r="3.1" fill="#141312" />
          <circle cx="31" cy="34.8" r="1" fill="#FFFFFF" />
          <circle cx="51" cy="34.8" r="1" fill="#FFFFFF" />
        </>
      )}
      {/* Boca */}
      {mood === 'curious' ? (
        <circle cx="40" cy="46" r="2.8" fill="#141312" />
      ) : mood === 'calm' ? (
        <path d="M35 45.5C37.5 47.5 42.5 47.5 45 45.5" stroke="#141312" strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <path
          d="M33.5 44.5C35.8 49 44.2 49 46.5 44.5"
          stroke="#141312"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
      {/* Estrela/brilho quando celebra */}
      {mood === 'celebrate' && (
        <path
          d="M66 10L68 14L72 15L68 16.5L66 20.5L64 16.5L60 15L64 14L66 10Z"
          fill="#E04F33"
          stroke="#141312"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
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
