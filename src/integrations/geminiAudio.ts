// Serviços de áudio e voz da Unipedia: TTS neural (3.8-tts), transcrição (3.5 / nativo curto)
// e podcast a 2 vozes — desenhado para custo $0 agora e costura limpa para Play Store Pro.

import { GoogleGenAI } from '@google/genai';
import { tr } from '../i18n/tr';
import { hasAiAccess } from '../lib/aiAccess';
import { pcmBase64ToWavBase64 } from '../lib/audioPlayer';
import { chunkPodcastLines, lineStartsInChunk, pcmDurationSeconds } from '../lib/podcastAudio';
import { MAX_CUSTOM_AUDIO_BYTES, MAX_NATIVE_AUDIO_BYTES } from '../lib/audioRecorder';
import { friendlyCustomKeyError } from '../lib/geminiErrors';
import { normalizeAppLanguage } from '../lib/grading';
import {
  markdownLatexToSpeechText,
  parsePodcastScript,
  resolveAiExecutionTier,
  resolveUniVoiceConfig,
  type PodcastScript,
} from '../lib/uniVoice';
import type { UniPersonaMode } from '../lib/uniAccessories';
import { useStore } from '../store/useStore';
import type { AppLanguage, UniVoiceConfig, UniVoiceName } from '../types';
import {
  assertNotebookInputs,
  runNotebookText,
  type NotebookAssessmentContext,
  type NotebookSourceInput,
} from './gemini';
import {
  getCustomGeminiKey,
  resolveGeminiConfig,
  runNativeGenerate,
  withQuotaAndFallback,
  type ChatAttachment,
} from './gemini/core';
import { AiConsentRequiredError, DEFAULT_MODEL, PRIMARY_TIMEOUT_MS } from './gemini/models';
import { PODCAST_SCRIPT_SCHEMA } from './gemini/schemas';

export const TTS_STANDARD_MODEL = 'gemini-3.8-flash-lite-tts';
export const TTS_DESIGN_MODEL = 'gemini-3.8-flash-tts';
export const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

export class MissingCustomKeyForNeuralAudioError extends Error {
  constructor() {
    super(tr('common:errors.audioNeuralKeyRequired'));
    this.name = 'MissingCustomKeyForNeuralAudioError';
  }
}

export function getAudioExecutionTier() {
  return resolveAiExecutionTier(getCustomGeminiKey());
}

function defaultStyleByLang(lang: AppLanguage): string {
  switch (lang) {
    case 'en':
      return 'Warm, clear university tutor speaking naturally';
    case 'es':
      return 'Tutor universitario cercano, claro y natural';
    case 'pt-BR':
      return 'Tutor universitário próximo, claro e natural';
    default:
      return 'Tutor universitário próximo, claro e natural';
  }
}

function buildGenAiClient(apiKey: string): GoogleGenAI {
  // A configuração de voz (speechConfig) só existe na API v1beta; a biblioteca usa v1 por omissão.
  return new GoogleGenAI({ apiKey: apiKey.trim(), apiVersion: 'v1beta' });
}

/** Modelos de voz conhecidos, a tentar depois do preferido se este não existir na conta. */
const TTS_FALLBACK_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];

function isModelUnavailable(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('"code":404') ||
    lower.includes('not found') ||
    lower.includes('is not supported') ||
    lower.includes('not_found') ||
    lower.includes('does not support')
  );
}

/** Tenta cada modelo pela ordem; passa ao seguinte só quando o modelo não existe ou não suporta o pedido. */
async function generateWithModelFallback<T>(
  models: string[],
  run: (model: string) => Promise<T>,
): Promise<{ result: T; model: string }> {
  let lastError: unknown;
  for (const model of [...new Set(models)]) {
    try {
      return { result: await run(model), model };
    } catch (err) {
      lastError = err;
      if (!isModelUnavailable(err)) throw err;
    }
  }
  throw lastError;
}

function styleInstruction(style: string, lang: AppLanguage): string {
  switch (lang) {
    case 'en':
      return `Read aloud in this style (${style}):`;
    case 'es':
      return `Lee en voz alta con este estilo (${style}):`;
    case 'pt-BR':
      return `Leia em voz alta com este estilo (${style}):`;
    default:
      return `Lê em voz alta com este estilo (${style}):`;
  }
}

export async function synthesizeUniSpeech(args: {
  text: string;
  voiceConfig?: UniVoiceConfig;
  persona?: UniPersonaMode;
  language?: string;
  preferDesign?: boolean;
  signal?: AbortSignal;
}): Promise<{ wavBase64: string; model: string }> {
  const settings = useStore.getState().settings;
  if (!hasAiAccess(settings)) {
    throw new AiConsentRequiredError();
  }
  const customKey = getCustomGeminiKey();
  if (!customKey) {
    throw new MissingCustomKeyForNeuralAudioError();
  }

  const lang = normalizeAppLanguage(args.language ?? settings.language);
  const resolved = resolveUniVoiceConfig(
    args.voiceConfig ? { voiceConfig: args.voiceConfig, personaId: args.persona } : null,
    settings.uniVoice,
    args.persona ?? settings.uniPersona ?? 'amigo',
  );
  const spokenText = markdownLatexToSpeechText(args.text, lang).slice(0, 3800);
  if (!spokenText) {
    throw new Error(tr('common:errors.audioEmptyText'));
  }

  const style = resolved.stylePrompt || defaultStyleByLang(lang);
  const useDesignModel = Boolean(args.preferDesign || resolved.stylePrompt);
  const targetModel = useDesignModel ? TTS_DESIGN_MODEL : TTS_STANDARD_MODEL;

  try {
    const ai = buildGenAiClient(customKey);
    const { result: response, model } = await generateWithModelFallback(
      [targetModel, ...TTS_FALLBACK_MODELS],
      (candidate) =>
        ai.models.generateContent({
          model: candidate,
          // O estilo vai no próprio texto: é assim que os modelos de voz do Gemini o recebem.
          contents: [{ role: 'user', parts: [{ text: `${styleInstruction(style, lang)}\n\n${spokenText}` }] }],
          config: {
            abortSignal: args.signal,
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: resolved.voiceName },
              },
            },
          },
        }),
    );

    const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audioPart?.data) {
      throw new Error(tr('common:errors.audioSynthesizeFail'));
    }
    return { wavBase64: pcmBase64ToWavBase64(audioPart.data, audioPart.mimeType), model };
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyCustomKeyError(err);
  }
}

export async function generatePodcastScript(args: {
  sources: NotebookSourceInput[];
  attachments?: ChatAttachment[];
  courseName?: string;
  uniName?: string;
  persona?: UniPersonaMode;
  language?: string;
  assessment?: NotebookAssessmentContext | null;
  signal?: AbortSignal;
}): Promise<PodcastScript> {
  const { customKey, model } = resolveGeminiConfig();
  const fullArgs = {
    mode: 'podcast' as const,
    sources: args.sources,
    attachments: args.attachments,
    courseName: args.courseName,
    persona: args.persona,
    assessment: args.assessment,
    signal: args.signal,
  };
  assertNotebookInputs(fullArgs);

  const lang = normalizeAppLanguage(args.language ?? useStore.getState().settings.language);
  const hostName = (args.uniName || 'Uni').trim().slice(0, 30) || 'Uni';
  const coHostName = hostName.toLowerCase() === 'alex' ? 'Sofia' : 'Alex';

  const prompt =
    lang === 'en'
      ? `Create an engaging 2-speaker study podcast episode based ONLY on the notebook sources${args.courseName ? ` for "${args.courseName}"` : ''}.
Speakers:
- "${hostName}": specialist Uni tutor who explains concepts clearly, resolves traps, and uses intuitive examples.
- "${coHostName}": sharp, curious classmate who asks clarifying questions, summarizes aloud, and keeps the pace lively.
Rules:
- Write 10 to 14 natural conversational turns alternating between "${hostName}" and "${coHostName}".
- Ground every explanation strictly in the sources; mention concrete formulas or exam pitfalls naturally in spoken words (do NOT dump raw LaTeX syntax).
- Keep each turn concise (1 to 3 spoken sentences).
- Return ONLY valid JSON: {"title":"Episode title","lines":[{"speaker":"${hostName}","text":"..."},{"speaker":"${coHostName}","text":"..."}]}.`
      : lang === 'es'
        ? `Crea un episodio breve y natural de pódcast de estudio entre 2 voces basado SOLO en las fuentes del cuaderno${args.courseName ? ` de «${args.courseName}»` : ''}.
Voces:
- "${hostName}": Uni especialista que explica los conceptos con claridad, destapa trampas de examen y da ejemplos cotidianos.
- "${coHostName}": compañero curioso que hace preguntas clave y resume en voz alta.
Reglas:
- Escribe entre 10 y 14 intervenciones naturales alternando "${hostName}" y "${coHostName}".
- Explica las fórmulas de forma hablada y natural (sin código LaTeX crudo).
- Cada turno debe tener 1 a 3 frases cortas para escuchar bien.
- Devuelve SOLO JSON válido: {"title":"Título del episodio","lines":[{"speaker":"${hostName}","text":"..."},{"speaker":"${coHostName}","text":"..."}]}.`
        : `Cria um episódio curto e envolvente de podcast de estudo a 2 vozes baseado APENAS nas fontes do caderno${args.courseName ? ` de «${args.courseName}»` : ''}.
Participantes:
- "${hostName}": Uni especialista que explica os conceitos com clareza, destaca armadilhas típicas de teste e dá exemplos intuitivos.
- "${coHostName}": colega curioso que faz boas perguntas, pede exemplos e ajuda a fixar as ideias-chave.
Regras:
- Escreve entre 10 e 14 falas naturais alternando entre "${hostName}" e "${coHostName}".
- Expressa fórmulas e grandezas em linguagem falada natural (nunca leias código LaTeX nem parênteses retos [Fonte 1]).
- Mantém cada fala curta (1 a 3 frases fáceis de ouvir).
- Devolve APENAS JSON válido: {"title":"Título do episódio","lines":[{"speaker":"${hostName}","text":"..."},{"speaker":"${coHostName}","text":"..."}]}.`;

  const rawText = await withQuotaAndFallback('notebook', customKey, () =>
    runNotebookText(fullArgs, customKey, model, prompt, true, { schema: PODCAST_SCRIPT_SCHEMA }),
  );

  const script = parsePodcastScript(rawText, hostName, coHostName);
  if (!script) {
    throw new Error(tr('common:errors.podcastScriptFail'));
  }
  return script;
}

export async function synthesizePodcastWav(args: {
  script: PodcastScript;
  hostVoice: UniVoiceName;
  coHostVoice: UniVoiceName;
  stylePrompt?: string;
  language?: string;
  signal?: AbortSignal;
  /** Progresso da síntese por partes (feitas / total). */
  onProgress?: (done: number, total: number) => void;
}): Promise<{ wavBase64: string; lineStartSeconds: number[] }> {
  const settings = useStore.getState().settings;
  if (!hasAiAccess(settings)) {
    throw new AiConsentRequiredError();
  }
  const customKey = getCustomGeminiKey();
  if (!customKey) {
    throw new MissingCustomKeyForNeuralAudioError();
  }

  const lang = normalizeAppLanguage(args.language ?? settings.language);
  const safeHostVoice = args.hostVoice;
  const safeCoHostVoice =
    args.coHostVoice !== safeHostVoice
      ? args.coHostVoice
      : safeHostVoice === 'Puck'
        ? 'Aoede'
        : 'Puck';

  const hostStyle = args.stylePrompt?.trim() || defaultStyleByLang(lang);
  const coHostStyle =
    lang === 'en'
      ? 'Curious, attentive university student asking natural questions'
      : lang === 'es'
        ? 'Estudiante universitario curioso y atento que dialoga con naturalidad'
        : 'Estudante universitário curioso, expressivo e atento num diálogo natural';

  const direction =
    lang === 'en'
      ? `Read this study conversation aloud. ${args.script.hostName} speaks in this style: ${hostStyle}. ${args.script.coHostName} speaks in this style: ${coHostStyle}.`
      : lang === 'es'
        ? `Lee en voz alta esta conversación de estudio. ${args.script.hostName} habla con este estilo: ${hostStyle}. ${args.script.coHostName} habla con este estilo: ${coHostStyle}.`
        : `Lê em voz alta esta conversa de estudo. ${args.script.hostName} fala com este estilo: ${hostStyle}. ${args.script.coHostName} fala com este estilo: ${coHostStyle}.`;

  const speakerOf = (speaker: string) =>
    speaker.toLowerCase() === args.script.hostName.toLowerCase() ? args.script.hostName : args.script.coHostName;
  const spoken = args.script.lines.map((line) => markdownLatexToSpeechText(line.text, lang));
  // Um pedido com o episódio inteiro passa do que o modelo de voz devolve de uma vez:
  // sintetiza por partes pequenas e junta o áudio.
  const chunks = chunkPodcastLines(spoken.map((text) => ({ text })));
  const ai = buildGenAiClient(customKey);
  const speechConfig = {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: args.script.hostName, voiceConfig: { prebuiltVoiceConfig: { voiceName: safeHostVoice } } },
        { speaker: args.script.coHostName, voiceConfig: { prebuiltVoiceConfig: { voiceName: safeCoHostVoice } } },
      ],
    },
  };
  let workingModels = [TTS_DESIGN_MODEL, ...TTS_FALLBACK_MODELS];

  const synthChunk = async (lineIndexes: number[]) => {
    const conversation = lineIndexes
      .map((i) => `${speakerOf(args.script.lines[i].speaker)}: ${spoken[i]}`)
      .join('\n');
    const { result: response, model } = await generateWithModelFallback(workingModels, (candidate) =>
      ai.models.generateContent({
        model: candidate,
        contents: [{ role: 'user', parts: [{ text: `${direction}\n\n${conversation}` }] }],
        config: { abortSignal: args.signal, responseModalities: ['AUDIO'], speechConfig },
      }),
    );
    // As partes seguintes vão logo ao modelo que respondeu.
    workingModels = [model, ...workingModels.filter((m) => m !== model)];
    const audioPart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!audioPart?.data) throw new Error(tr('common:errors.audioSynthesizeFail'));
    const rate = Number(/rate=(\d+)/i.exec(audioPart.mimeType ?? '')?.[1] ?? 24_000);
    let pcm = atob(audioPart.data);
    if (pcm.startsWith('RIFF')) pcm = pcm.slice(44);
    return { pcm, rate };
  };

  try {
    const results: Array<{ pcm: string; rate: number }> = new Array(chunks.length);
    let done = 0;
    args.onProgress?.(0, chunks.length);
    // A primeira parte sozinha (descobre o modelo que responde); depois 2 de cada vez.
    let next = 0;
    const worker = async () => {
      while (next < chunks.length) {
        const i = next++;
        results[i] = await synthChunk(chunks[i].lineIndexes);
        done += 1;
        args.onProgress?.(done, chunks.length);
      }
    };
    if (chunks.length > 0) {
      next = 1;
      results[0] = await synthChunk(chunks[0].lineIndexes);
      done = 1;
      args.onProgress?.(done, chunks.length);
    }
    await Promise.all([worker(), worker()]);

    const rate = results[0]?.rate ?? 24_000;
    const lineStartSeconds: number[] = new Array(args.script.lines.length).fill(0);
    let offset = 0;
    chunks.forEach((chunk, ci) => {
      const duration = pcmDurationSeconds(results[ci].pcm.length, rate);
      const starts = lineStartsInChunk(chunk.lineIndexes.map((i) => spoken[i].length), offset, duration);
      chunk.lineIndexes.forEach((lineIdx, k) => {
        lineStartSeconds[lineIdx] = starts[k];
      });
      offset += duration;
    });
    const joined = btoa(results.map((r) => r.pcm).join(''));
    return { wavBase64: pcmBase64ToWavBase64(joined, `audio/L16;rate=${rate}`), lineStartSeconds };
  } catch (err) {
    if (args.signal?.aborted) throw err;
    // Erro original: o leitor explica o motivo (quota, modelo, rede) e cai para a voz do dispositivo.
    throw err;
  }
}

export async function transcribeAudioNotes(args: {
  base64Data: string;
  mimeType: string;
  sizeBytes: number;
  courseName?: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ transcript: string; usedModel: string }> {
  const settings = useStore.getState().settings;
  if (!hasAiAccess(settings)) {
    throw new AiConsentRequiredError();
  }
  const customKey = getCustomGeminiKey();
  const limit = customKey ? MAX_CUSTOM_AUDIO_BYTES : MAX_NATIVE_AUDIO_BYTES;
  if (args.sizeBytes > limit) {
    throw new Error(
      customKey
        ? tr('common:errors.audioTooLargeCustom')
        : tr('common:errors.audioTooLargeNative'),
    );
  }

  const lang = normalizeAppLanguage(args.language ?? settings.language);
  const prompt =
    lang === 'en'
      ? `Transcribe this lecture or study voice note verbatim and cleanly in clean paragraphs${args.courseName ? ` (academic context: ${args.courseName})` : ''}. Fix obvious technical term spelling if clear from context and omit filler noises. Return only the clean transcript text.`
      : lang === 'es'
        ? `Transcribe este audio de clase o nota de estudio de forma fiel y limpia en párrafos claros${args.courseName ? ` (asignatura: ${args.courseName})` : ''}. Corrige términos técnicos evidentes por el contexto y devuelve solo el texto transcrito.`
        : `Transcreve este áudio de aula ou nota de estudo de forma fiel e limpa em parágrafos organizados${args.courseName ? ` (cadeira: ${args.courseName})` : ''}. Respeita termos técnicos académicos, remove ruídos de hesitação e devolve apenas o texto da transcrição.`;

  if (customKey) {
    try {
      const ai = buildGenAiClient(customKey);
      const { result: response, model: usedModel } = await generateWithModelFallback(
        [TRANSCRIBE_MODEL, DEFAULT_MODEL, 'gemini-2.5-flash'],
        (candidate) => ai.models.generateContent({
        model: candidate,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: args.mimeType,
                data: args.base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          abortSignal: args.signal,
        },
      }),
      );
      const transcript = (response.text ?? '').trim();
      if (!transcript) {
        throw new Error(tr('common:errors.audioTranscribeFail'));
      }
      return { transcript, usedModel };
    } catch (err) {
      if (args.signal?.aborted) throw err;
      throw friendlyCustomKeyError(err);
    }
  }

  const transcript = await withQuotaAndFallback('notebook', '', () =>
    runNativeGenerate({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              type: 'inlineData',
              inlineData: {
                mimeType: args.mimeType,
                data: args.base64Data,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
      primaryTimeoutMs: Math.max(PRIMARY_TIMEOUT_MS, 45_000),
      signal: args.signal,
    }),
  );

  if (!transcript.trim()) {
    throw new Error(tr('common:errors.audioTranscribeFail'));
  }
  return { transcript: transcript.trim(), usedModel: DEFAULT_MODEL };
}
