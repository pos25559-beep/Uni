// Serviços de áudio e voz da Unipedia: TTS neural (3.8-tts), transcrição (3.5 / nativo curto)
// e podcast a 2 vozes — desenhado para custo $0 agora e costura limpa para Play Store Pro.

import { GoogleGenAI } from '@google/genai';
import { tr } from '../i18n/tr';
import { hasAiAccess } from '../lib/aiAccess';
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
  return new GoogleGenAI({ apiKey: apiKey.trim() });
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
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: spokenText,
              speechMetadata: { style },
            },
          ],
        },
      ],
      config: {
        abortSignal: args.signal,
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: resolved.voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error(tr('common:errors.audioSynthesizeFail'));
    }
    return { wavBase64: base64Audio, model: targetModel };
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
}): Promise<PodcastScript> {
  const { customKey, model } = resolveGeminiConfig();
  const fullArgs = {
    mode: 'podcast' as const,
    sources: args.sources,
    attachments: args.attachments,
    courseName: args.courseName,
    persona: args.persona,
    assessment: args.assessment,
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
}): Promise<{ wavBase64: string }> {
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

  const parts = args.script.lines.map((line, idx) => {
    const isHost = line.speaker.toLowerCase() === args.script.hostName.toLowerCase();
    const cleaned = markdownLatexToSpeechText(line.text, lang);
    const enriched =
      idx === 0
        ? `<breath> ${cleaned}`
        : !isHost && idx % 4 === 1
          ? `|mhm| ${cleaned}`
          : cleaned;
    return {
      text: `${line.speaker}: ${enriched}`,
      speechMetadata: {
        speaker: isHost ? args.script.hostName : args.script.coHostName,
        style: isHost ? hostStyle : coHostStyle,
      },
    };
  });

  try {
    const ai = buildGenAiClient(customKey);
    const response = await ai.models.generateContent({
      model: TTS_DESIGN_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        abortSignal: args.signal,
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            // Estritamente 2 locutores conforme especificação do Gemini 3.8 TTS
            speakerVoiceConfigs: [
              {
                speaker: args.script.hostName,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: safeHostVoice },
                },
              },
              {
                speaker: args.script.coHostName,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: safeCoHostVoice },
                },
              },
            ],
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error(tr('common:errors.audioSynthesizeFail'));
    }
    return { wavBase64: base64Audio };
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyCustomKeyError(err);
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
      const response = await ai.models.generateContent({
        model: TRANSCRIBE_MODEL,
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
      });
      const transcript = (response.text ?? '').trim();
      if (!transcript) {
        throw new Error(tr('common:errors.audioTranscribeFail'));
      }
      return { transcript, usedModel: TRANSCRIBE_MODEL };
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
