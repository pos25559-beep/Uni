import { normalizeAppLanguage } from './grading';
import type { UniPersonaMode } from './uniAccessories';
import type { AppLanguage, UniVoiceConfig, UniVoiceName } from '../types';

export type AiExecutionTier = 'free-native' | 'ai-studio-key' | 'pro-server-future';

export interface UniVoiceCatalogEntry {
  id: UniVoiceName;
  pitchHint: 'warm' | 'bright' | 'deep' | 'calm' | 'firm' | 'clear';
  coHostDefault: UniVoiceName;
  labelKey: string;
  descKey: string;
}

export const UNI_VOICES: readonly UniVoiceCatalogEntry[] = [
  {
    id: 'Aoede',
    pitchHint: 'warm',
    coHostDefault: 'Puck',
    labelKey: 'uni:voice.voices.aoede.name',
    descKey: 'uni:voice.voices.aoede.desc',
  },
  {
    id: 'Puck',
    pitchHint: 'bright',
    coHostDefault: 'Kore',
    labelKey: 'uni:voice.voices.puck.name',
    descKey: 'uni:voice.voices.puck.desc',
  },
  {
    id: 'Kore',
    pitchHint: 'calm',
    coHostDefault: 'Puck',
    labelKey: 'uni:voice.voices.kore.name',
    descKey: 'uni:voice.voices.kore.desc',
  },
  {
    id: 'Fenrir',
    pitchHint: 'firm',
    coHostDefault: 'Zephyr',
    labelKey: 'uni:voice.voices.fenrir.name',
    descKey: 'uni:voice.voices.fenrir.desc',
  },
  {
    id: 'Charon',
    pitchHint: 'deep',
    coHostDefault: 'Aoede',
    labelKey: 'uni:voice.voices.charon.name',
    descKey: 'uni:voice.voices.charon.desc',
  },
  {
    id: 'Zephyr',
    pitchHint: 'clear',
    coHostDefault: 'Charon',
    labelKey: 'uni:voice.voices.zephyr.name',
    descKey: 'uni:voice.voices.zephyr.desc',
  },
] as const;

export const VALID_UNI_VOICE_NAMES = new Set<UniVoiceName>(UNI_VOICES.map((v) => v.id));

export const DEFAULT_VOICE_BY_PERSONA: Record<UniPersonaMode, UniVoiceName> = {
  amigo: 'Aoede',
  exigente: 'Fenrir',
  calmo: 'Kore',
  curioso: 'Puck',
  treinador: 'Charon',
};

export interface VoiceStylePreset {
  id: 'calm_didactic' | 'fast_revision' | 'direct_demanding';
  labelKey: string;
  promptByLang: Record<AppLanguage, string>;
}

export const VOICE_STYLE_PRESETS: readonly VoiceStylePreset[] = [
  {
    id: 'calm_didactic',
    labelKey: 'uni:voice.presets.calmDidactic',
    promptByLang: {
      'pt-PT': 'professor calmo, pausado e muito didático',
      'pt-BR': 'professor calmo, pausado e muito didático',
      es: 'profesor tranquilo, pausado y muy didáctico',
      en: 'calm, steady, clear tutor who explains step by step',
    },
  },
  {
    id: 'fast_revision',
    labelKey: 'uni:voice.presets.fastRevision',
    promptByLang: {
      'pt-PT': 'ritmo ágil de revisão pré-teste, claro e objetivo',
      'pt-BR': 'ritmo ágil de revisão pré-prova, claro e objetivo',
      es: 'ritmo ágil de repaso previo al examen, claro y directo',
      en: 'brisk exam-review pacing, energetic and focused',
    },
  },
  {
    id: 'direct_demanding',
    labelKey: 'uni:voice.presets.directDemanding',
    promptByLang: {
      'pt-PT': 'tom firme, direto e exigente de treinador académico',
      'pt-BR': 'tom firme, direto e exigente de treinador acadêmico',
      es: 'tono firme, directo y exigente de entrenador académico',
      en: 'firm, direct, no-nonsense academic coach tone',
    },
  },
] as const;

/** Fronteira única de capacidade de IA ($0 agora via nativo/chave gratuita; pronto para Play Store Pro). */
export function resolveAiExecutionTier(customKey?: string, futureProToken?: string): AiExecutionTier {
  if (futureProToken && futureProToken.trim().length > 0) {
    return 'pro-server-future';
  }
  if (customKey && customKey.trim().length > 0) {
    return 'ai-studio-key';
  }
  return 'free-native';
}

export function isValidUniVoiceName(name: unknown): name is UniVoiceName {
  return typeof name === 'string' && VALID_UNI_VOICE_NAMES.has(name as UniVoiceName);
}

export function pickCoHostVoice(hostVoice: UniVoiceName, preferred?: UniVoiceName): UniVoiceName {
  if (preferred && isValidUniVoiceName(preferred) && preferred !== hostVoice) {
    return preferred;
  }
  const entry = UNI_VOICES.find((v) => v.id === hostVoice);
  if (entry && entry.coHostDefault !== hostVoice) {
    return entry.coHostDefault;
  }
  return UNI_VOICES.find((v) => v.id !== hostVoice)?.id ?? 'Puck';
}

export function resolveUniVoiceConfig(
  agent?: { voiceConfig?: UniVoiceConfig; personaId?: UniPersonaMode } | null,
  globalVoice?: UniVoiceConfig,
  persona: UniPersonaMode = 'amigo',
): { voiceName: UniVoiceName; coHostVoiceName: UniVoiceName; stylePrompt?: string } {
  const effectivePersona = agent?.personaId ?? persona;
  const candidate = agent?.voiceConfig?.voiceName ?? globalVoice?.voiceName;
  const voiceName: UniVoiceName = isValidUniVoiceName(candidate)
    ? candidate
    : (DEFAULT_VOICE_BY_PERSONA[effectivePersona] ?? 'Aoede');

  const rawStyle = agent?.voiceConfig?.stylePrompt ?? globalVoice?.stylePrompt;
  const stylePrompt = typeof rawStyle === 'string' && rawStyle.trim().length > 0
    ? rawStyle.trim().slice(0, 200)
    : undefined;

  const coHostVoiceName = pickCoHostVoice(
    voiceName,
    agent?.voiceConfig?.coHostVoiceName ?? globalVoice?.coHostVoiceName,
  );

  return { voiceName, coHostVoiceName, stylePrompt };
}

const GREEK_WORDS: Record<string, string> = {
  alpha: 'alfa',
  beta: 'beta',
  gamma: 'gama',
  delta: 'delta',
  Delta: 'delta',
  varepsilon: 'épsilon',
  epsilon: 'épsilon',
  zeta: 'zeta',
  eta: 'eta',
  theta: 'teta',
  Theta: 'teta',
  iota: 'iota',
  kappa: 'capa',
  lambda: 'lambda',
  Lambda: 'lambda',
  mu: 'mi',
  nu: 'ni',
  xi: 'xi',
  pi: 'pi',
  Pi: 'pi',
  rho: 'rô',
  sigma: 'sigma',
  Sigma: 'somatório',
  tau: 'tau',
  phi: 'fi',
  varphi: 'fi',
  Phi: 'fi',
  chi: 'qui',
  psi: 'psi',
  omega: 'ómega',
  Omega: 'ómega',
};

function convertLatexFragment(expr: string, lang: AppLanguage): string {
  const isEn = lang === 'en';
  const overWord = isEn ? 'over' : 'sobre';
  const sqrtWord = isEn ? 'square root of' : isEn ? 'root of' : 'raiz de';
  const sqWord = isEn ? 'squared' : lang === 'es' ? 'al cuadrado' : 'ao quadrado';
  const cubeWord = isEn ? 'cubed' : lang === 'es' ? 'al cubo' : 'ao cubo';
  const powWord = isEn ? 'to the power of' : lang === 'es' ? 'elevado a' : 'elevado a';

  let out = expr.trim();

  // Nested or flat \frac{a}{b}
  for (let i = 0; i < 3; i++) {
    out = out.replace(/\\d?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, a: string, b: string) => `${a} ${overWord} ${b}`);
  }

  // \sqrt{x}
  out = out.replace(/\\sqrt\s*\{([^{}]+)\}/g, (_, inner: string) => `${sqrtWord} ${inner}`);
  out = out.replace(/\\sqrt\s+([A-Za-z0-9]+)/g, (_, inner: string) => `${sqrtWord} ${inner}`);

  // Common operators and relations
  out = out
    .replace(/\\leq?/g, isEn ? ' less than or equal to ' : lang === 'es' ? ' menor o igual que ' : ' menor ou igual a ')
    .replace(/\\geq?/g, isEn ? ' greater than or equal to ' : lang === 'es' ? ' mayor o igual que ' : ' maior ou igual a ')
    .replace(/\\neq/g, isEn ? ' not equal to ' : lang === 'es' ? ' distinto de ' : ' diferente de ')
    .replace(/\\approx/g, isEn ? ' approximately ' : lang === 'es' ? ' aproximadamente ' : ' aproximadamente ')
    .replace(/\\times|\\cdot/g, isEn ? ' times ' : lang === 'es' ? ' por ' : ' vezes ')
    .replace(/\\pm/g, isEn ? ' plus or minus ' : lang === 'es' ? ' más o menos ' : ' mais ou menos ')
    .replace(/\\infty/g, isEn ? ' infinity ' : lang === 'es' ? ' infinito ' : ' infinito ')
    .replace(/\\sum/g, isEn ? ' sum of ' : lang === 'es' ? ' suma de ' : ' somatório de ')
    .replace(/\\int/g, isEn ? ' integral of ' : lang === 'es' ? ' integral de ' : ' integral de ')
    .replace(/\\partial/g, isEn ? ' partial ' : lang === 'es' ? ' parcial ' : ' derivada parcial ')
    .replace(/\\rightarrow|\\to/g, isEn ? ' to ' : lang === 'es' ? ' hacia ' : ' para ')
    .replace(/\\Rightarrow|\\implies/g, isEn ? ' implies ' : lang === 'es' ? ' implica ' : ' implica ');

  // Greek letters
  out = out.replace(/\\([A-Za-z]+)/g, (match, name: string) => {
    if (name in GREEK_WORDS) return ` ${GREEK_WORDS[name]} `;
    if (name === 'text' || name === 'mathrm' || name === 'mathbf') return ' ';
    return match.startsWith('\\') ? ' ' : name;
  });

  // Superscripts & subscripts
  out = out
    .replace(/\^\{2\}|\^2\b/g, ` ${sqWord} `)
    .replace(/\^\{3\}|\^3\b/g, ` ${cubeWord} `)
    .replace(/\^\{([^{}]+)\}/g, ` ${powWord} $1 `)
    .replace(/\^([A-Za-z0-9]+)/g, ` ${powWord} $1 `)
    .replace(/_\{([^{}]+)\}/g, ' $1 ')
    .replace(/_([A-Za-z0-9]+)/g, ' $1 ');

  return out.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converte respostas Markdown com fórmulas LaTeX e citações em texto natural fácil de ouvir.
 */
export function markdownLatexToSpeechText(raw: string, language?: string): string {
  const lang = normalizeAppLanguage(language);
  let text = raw || '';

  // Remove hidden Uni tags if any leaked
  text = text.replace(/<uni-(?:tool|checkin-sync)>[\s\S]*?<\/uni-(?:tool|checkin-sync)>/gi, ' ');

  // Code blocks -> short pause
  text = text.replace(/```[\s\S]*?```/g, '. ');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Block and inline LaTeX
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => ` ${convertLatexFragment(expr, lang)}. `);
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr: string) => ` ${convertLatexFragment(expr, lang)}. `);
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr: string) => ` ${convertLatexFragment(expr, lang)} `);
  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr: string) => ` ${convertLatexFragment(expr, lang)} `);

  // Markdown links & images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Citations like [1], [2], [Fonte 1], [Fonte: nome]
  text = text.replace(/\[(?:Fonte(?::)?\s*[^\]]+|\d+(?:,\s*\d+)*)\]/gi, '');

  // Markdown syntax (headings, lists, bold, italic, hr)
  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '. ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]+/g, '');

  // Clean remaining whitespace and awkward punctuation
  return text
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?])\s*,+/g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface PodcastLine {
  speaker: string;
  text: string;
}

export interface PodcastScript {
  title: string;
  hostName: string;
  coHostName: string;
  lines: PodcastLine[];
}

export function parsePodcastScript(
  raw: string,
  hostName: string,
  coHostName: string,
): PodcastScript | null {
  const match = /\{[\s\S]*\}/.exec(raw || '');
  try {
    const parsed = JSON.parse(match ? match[0] : raw || '{}') as {
      title?: unknown;
      lines?: Array<{ speaker?: unknown; text?: unknown }>;
    };
    const title = typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : 'Podcast de Estudo';
    const rawLines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const lines: PodcastLine[] = rawLines
      .map((item, idx) => {
        const rawText = typeof item?.text === 'string' ? item.text.trim() : '';
        if (!rawText) return null;
        const rawSpeaker = typeof item?.speaker === 'string' ? item.speaker.trim() : '';
        const normalizedSpeaker = rawSpeaker
          ? (rawSpeaker.toLowerCase().includes(coHostName.toLowerCase()) ||
             rawSpeaker.toLowerCase().includes('co') ||
             rawSpeaker.toLowerCase().includes('alex')
              ? coHostName
              : hostName)
          : (idx % 2 === 0 ? hostName : coHostName);
        return { speaker: normalizedSpeaker, text: rawText.slice(0, 800) };
      })
      .filter((x): x is PodcastLine => x !== null)
      .slice(0, 20);

    if (lines.length < 2) return null;
    return { title, hostName, coHostName, lines };
  } catch {
    return null;
  }
}

export function podcastScriptToMarkdown(script: PodcastScript): string {
  const body = script.lines
    .map((line) => `**${line.speaker}:** ${line.text}`)
    .join('\n\n');
  return `# ${script.title}\n\n${body}`;
}

const PODCAST_STORAGE_PREFIX = 'unipedia-sheet-podcast-v1:';

export function saveSheetPodcast(sheetId: string, script: PodcastScript): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${PODCAST_STORAGE_PREFIX}${sheetId}`, JSON.stringify(script));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadSheetPodcast(sheetId: string): PodcastScript | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PODCAST_STORAGE_PREFIX}${sheetId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PodcastScript>;
    if (
      typeof parsed.title === 'string' &&
      typeof parsed.hostName === 'string' &&
      typeof parsed.coHostName === 'string' &&
      Array.isArray(parsed.lines) &&
      parsed.lines.length > 0
    ) {
      return {
        title: parsed.title,
        hostName: parsed.hostName,
        coHostName: parsed.coHostName,
        lines: parsed.lines.filter(
          (l): l is PodcastLine =>
            Boolean(l && typeof l.speaker === 'string' && typeof l.text === 'string' && l.text.trim()),
        ),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function deleteSheetPodcast(sheetId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(`${PODCAST_STORAGE_PREFIX}${sheetId}`);
  } catch {
    // ignore
  }
}
