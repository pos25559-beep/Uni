// Ajudas puras para a transcrição da Voz Live: juntar bocados de fala e esconder etiquetas técnicas.

/** Junta um bocado novo à fala, sem espaços em falta nem a dobrar. */
export function joinTranscriptFragment(current: string, fragment: string): string {
  if (!current) return fragment.trimStart();
  if (/^[\s,.;:!?)»]/.test(fragment) || /[\s(«]$/.test(current)) return current + fragment;
  return `${current} ${fragment}`;
}

/** Texto a mostrar: sem etiquetas <uni-tool>/<uni-sync>, completas ou ainda a chegar. */
export function visibleLiveText(raw: string): string {
  return raw
    .replace(/<uni-(?:tool|sync)>[\s\S]*?<\/uni-(?:tool|sync)>/gi, ' ')
    .replace(/<uni-(?:tool|sync)>[\s\S]*$/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
