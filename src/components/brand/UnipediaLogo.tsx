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
