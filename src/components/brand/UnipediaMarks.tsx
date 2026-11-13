import { motion } from 'motion/react';
import { cx } from '../ui';

const FLOAT_SPRING = {
  duration: 3.6,
  repeat: Infinity,
  repeatType: 'reverse' as const,
  ease: 'easeInOut' as const,
};

/** Emblema oficial Unipedia (Livro aberto + Bússola de progressão + Faísca). */
export function UnipediaLogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cx('shrink-0', className)}
    >
      <rect width="64" height="64" rx="18" className="fill-accent" />
      <path
        d="M14 43.5V22.5C14 20.567 15.567 19 17.5 19H28.5C30.433 19 32 20.567 32 22.5V45.5C30.4 44.1 28.4 43.5 26 43.5H14Z"
        className="fill-white/95"
      />
      <path
        d="M50 43.5V22.5C50 20.567 48.433 19 46.5 19H35.5C33.567 19 32 20.567 32 22.5V45.5C33.6 44.1 35.6 43.5 38 43.5H50Z"
        fill="#E0E7FF"
      />
      <path
        d="M29 36L46 15L39 30L29 36Z"
        fill="#FCEB9C"
        stroke="#111318"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="46.5" cy="14" r="3.2" fill="#A9F5B8" />
    </svg>
  );
}

export type OnboardingSceneKey = 'welcome' | 'privacy' | 'curriculum' | 'rhythm';

/** Composições editoriais animadas com Motion para os 4 passos de boas-vindas. */
export function OnboardingSceneArt({ scene, className }: { scene: OnboardingSceneKey; className?: string }) {
  if (scene === 'welcome') {
    return (
      <motion.svg
        viewBox="0 0 280 210"
        className={cx('mx-auto h-44 w-full max-w-[260px]', className)}
        fill="none"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <motion.circle
          cx="140"
          cy="94"
          r="66"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        {/* Bloco nota âmbar */}
        <motion.g animate={{ y: [-3, 3] }} transition={FLOAT_SPRING}>
          <rect x="64" y="68" width="54" height="52" rx="12" fill="#FCEB9C" stroke="#111318" strokeWidth="2" />
          <rect x="76" y="96" width="8" height="14" rx="3" fill="#4F46E5" />
          <rect x="88" y="88" width="8" height="22" rx="3" fill="#A9F5B8" stroke="#111318" strokeWidth="1.2" />
          <rect x="100" y="80" width="8" height="30" rx="3" fill="#4F46E5" />
        </motion.g>
        {/* Bloco progresso menta */}
        <motion.g animate={{ y: [3, -3] }} transition={{ ...FLOAT_SPRING, delay: 0.3 }}>
          <rect x="152" y="54" width="60" height="54" rx="12" fill="#A9F5B8" stroke="#111318" strokeWidth="2" />
          <circle cx="176" cy="81" r="11" fill="#FAF8F5" stroke="#111318" strokeWidth="1.6" />
          <circle cx="188" cy="81" r="11" fill="#4F46E5" fillOpacity="0.88" stroke="#111318" strokeWidth="1.6" />
        </motion.g>
        {/* Bloco meta índigo */}
        <motion.g animate={{ y: [-2, 4] }} transition={{ ...FLOAT_SPRING, delay: 0.6 }}>
          <rect x="116" y="20" width="62" height="34" rx="10" fill="#4F46E5" stroke="#111318" strokeWidth="2" />
          <circle cx="134" cy="37" r="7" stroke="#A9F5B8" strokeWidth="2.5" />
          <path d="M150 42L157 30L164 42H150Z" fill="#FCEB9C" stroke="#111318" strokeWidth="1.4" />
        </motion.g>
        {/* Livro aberto na base */}
        <path
          d="M46 176V138C46 133.582 49.582 130 54 130H130C135.523 130 140 134.477 140 140V182C132 175 121 176 112 176H46Z"
          fill="#FFFFFF"
          stroke="#111318"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M234 176V138C234 133.582 230.418 130 226 130H150C144.477 130 140 134.477 140 140V182C148 175 159 176 168 176H234Z"
          fill="#EEF0FF"
          stroke="#111318"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M140 182L147 195L154 189L161 196L155 180" fill="#FCEB9C" stroke="#111318" strokeWidth="1.8" strokeLinejoin="round" />
        {/* Bússola */}
        <motion.g
          initial={{ rotate: -14 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18 }}
          style={{ originX: '140px', originY: '92px' }}
        >
          <path d="M122 114L172 32L152 104L122 114Z" fill="#4F46E5" stroke="#111318" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="144" cy="84" r="9" fill="#FCEB9C" stroke="#111318" strokeWidth="2" />
          <circle cx="144" cy="84" r="3" fill="#111318" />
        </motion.g>
        <circle cx="204" cy="30" r="4" fill="#FCEB9C" stroke="#111318" strokeWidth="1.5" />
        <circle cx="88" cy="42" r="3.5" fill="#A9F5B8" stroke="#111318" strokeWidth="1.5" />
      </motion.svg>
    );
  }

  if (scene === 'privacy') {
    return (
      <motion.svg
        viewBox="0 0 280 210"
        className={cx('mx-auto h-44 w-full max-w-[260px]', className)}
        fill="none"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <circle cx="140" cy="106" r="76" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
        <motion.circle
          cx="140"
          cy="106"
          r="62"
          stroke="#4F46E5"
          strokeOpacity="0.35"
          strokeDasharray="6 6"
          strokeWidth="1.5"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '140px', originY: '106px' }}
        />
        <path
          d="M140 34L196 54V104C196 142 169 166 140 180C111 166 84 142 84 104V54L140 34Z"
          fill="#FFFFFF"
          stroke="#111318"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M140 34L196 54V104C196 142 169 166 140 180V34Z"
          fill="#DCFCE7"
          fillOpacity="0.7"
        />
        <path
          d="M140 66L168 104L140 144L112 104L140 66Z"
          fill="#4F46E5"
          stroke="#111318"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <motion.g animate={{ y: [-2, 2] }} transition={FLOAT_SPRING}>
          <circle cx="140" cy="95" r="10" fill="#A9F5B8" stroke="#111318" strokeWidth="2" />
          <path d="M140 105V130M140 119H148M140 126H146" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
        <circle cx="70" cy="76" r="5" fill="#BAE6FD" stroke="#111318" strokeWidth="1.5" />
        <circle cx="212" cy="134" r="5" fill="#A9F5B8" stroke="#111318" strokeWidth="1.5" />
        <rect x="118" y="16" width="44" height="16" rx="8" fill="#4F46E5" stroke="#111318" strokeWidth="1.8" />
        <circle cx="151" cy="24" r="4" fill="#A9F5B8" />
      </motion.svg>
    );
  }

  if (scene === 'curriculum') {
    return (
      <motion.svg
        viewBox="0 0 280 210"
        className={cx('mx-auto h-44 w-full max-w-[260px]', className)}
        fill="none"
        aria-hidden="true"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
      >
        <path d="M98 48H166M190 94V136H158" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.8" strokeLinecap="round" />
        {/* Janela lista */}
        <rect x="44" y="66" width="96" height="92" rx="14" fill="#FFFFFF" stroke="#111318" strokeWidth="2.2" />
        <path d="M44 84H140" stroke="#111318" strokeWidth="1.8" />
        <circle cx="58" cy="75" r="3" fill="#4F46E5" />
        <circle cx="68" cy="75" r="3" fill="#A9F5B8" />
        <circle cx="78" cy="75" r="3" fill="#FCEB9C" />
        <rect x="58" y="96" width="12" height="12" rx="3" fill="#A9F5B8" stroke="#111318" strokeWidth="1.5" />
        <path d="M78 102H122" stroke="#111318" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="58" y="116" width="12" height="12" rx="3" fill="#EEF0FF" stroke="#111318" strokeWidth="1.5" />
        <path d="M78 122H116" stroke="#111318" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="58" y="136" width="12" height="12" rx="3" fill="#FCEB9C" stroke="#111318" strokeWidth="1.5" />
        <path d="M78 142H112" stroke="#111318" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />

        {/* Bloco 2x2 curso */}
        <rect x="164" y="28" width="66" height="68" rx="14" fill="#FCEB9C" stroke="#111318" strokeWidth="2.2" />
        <rect x="176" y="40" width="18" height="18" rx="5" fill="#E9D5FF" stroke="#111318" strokeWidth="1.5" />
        <rect x="200" y="40" width="18" height="18" rx="5" fill="#A9F5B8" stroke="#111318" strokeWidth="1.5" />
        <rect x="176" y="64" width="18" height="18" rx="5" fill="#A9F5B8" stroke="#111318" strokeWidth="1.5" />
        <rect x="200" y="64" width="18" height="18" rx="5" fill="#4F46E5" stroke="#111318" strokeWidth="1.5" />

        {/* Lupa OCR */}
        <motion.g animate={{ x: [-3, 4], y: [2, -2] }} transition={FLOAT_SPRING}>
          <path d="M122 140L96 172" stroke="#4F46E5" strokeWidth="9" strokeLinecap="round" />
          <path d="M122 140L96 172" stroke="#111318" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="148" cy="112" r="34" fill="#A9F5B8" stroke="#4F46E5" strokeWidth="6" />
          <circle cx="148" cy="112" r="34" stroke="#111318" strokeWidth="2" />
          <path d="M132 104H164M130 112H166M136 120H160" stroke="#111318" strokeWidth="2.5" strokeLinecap="round" />
        </motion.g>

        {/* Selo conclusão */}
        <circle cx="222" cy="156" r="18" fill="#FCEB9C" stroke="#111318" strokeWidth="2" />
        <circle cx="222" cy="156" r="10" fill="#4F46E5" />
        <path d="M217 156L220.5 159.5L228 152" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      viewBox="0 0 280 210"
      className="mx-auto h-44 w-full max-w-[260px]"
      fill="none"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Dial de estudo */}
      <circle cx="102" cy="112" r="46" fill="#FFFFFF" stroke="#111318" strokeWidth="2.2" />
      <circle cx="102" cy="112" r="32" stroke="#111318" strokeOpacity="0.28" strokeDasharray="4 4" strokeWidth="1.6" />
      <path d="M102 66A46 46 0 0 1 148 112" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round" />
      <path d="M56 112A46 46 0 0 1 102 66" stroke="#FED7AA" strokeWidth="10" strokeLinecap="round" />
      <circle cx="102" cy="112" r="5" fill="#A9F5B8" stroke="#111318" strokeWidth="2" />

      {/* Barras verticais em pílula */}
      {[
        { x: 96, h: 30, fill: '#FED7AA' },
        { x: 118, h: 42, fill: '#A9F5B8' },
        { x: 140, h: 58, fill: '#4F46E5' },
        { x: 162, h: 72, fill: '#FED7AA' },
        { x: 184, h: 90, fill: '#A9F5B8' },
        { x: 206, h: 112, fill: '#4F46E5' },
      ].map((bar, idx) => (
        <motion.rect
          key={bar.x}
          x={bar.x}
          y={174 - bar.h}
          width="16"
          height={bar.h}
          rx="8"
          fill={bar.fill}
          stroke="#111318"
          strokeWidth="2"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.08 * idx, type: 'spring', stiffness: 300, damping: 24 }}
          style={{ originY: '174px' }}
        />
      ))}
      <path d="M68 174H234" stroke="#111318" strokeWidth="2" strokeLinecap="round" />
      <motion.path
        d="M106 110C148 106 184 82 212 46"
        stroke="#111318"
        strokeWidth="2.2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7 }}
      />
      <motion.g animate={{ y: [-3, 2] }} transition={FLOAT_SPRING}>
        <path d="M214 26L217 34L225 37L217 40L214 48L211 40L203 37L211 34L214 26Z" fill="#4F46E5" stroke="#111318" strokeWidth="1.5" />
        <path d="M192 40L194 46L200 48L194 50L192 56L190 50L184 48L190 46L192 40Z" fill="#A9F5B8" stroke="#111318" strokeWidth="1.4" />
      </motion.g>
    </motion.svg>
  );
}
