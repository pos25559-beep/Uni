import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { canStartLiveVoiceSession, recordVoiceSessionUsage } from '../lib/aiQuota';
import type { UniAgentRecord } from '../lib/localDb';
import type { UniAccessoryId, UniPersonaMode } from '../lib/uniAccessories';
import {
  buildUniToolProposal,
  executeReadOnlyOrRecallUniTool,
  extractUniToolsFromText,
  isUniToolName,
  requiresStudentConfirmation,
  UNI_TOOL_DECLARATIONS,
  type UniToolExecutionContext,
  type UniToolProposal,
} from '../lib/uniTools';
import { useStore } from '../store/useStore';
import type { AppLanguage, Course } from '../types';
import { buildStudyContext, SYSTEM_PROMPT } from './gemini';
import { normalizeAppLanguage } from '../lib/grading';
import { resolveUniVoiceConfig } from '../lib/uniVoice';
import { joinTranscriptFragment, visibleLiveText } from '../lib/liveTranscript';
import { tr } from '../i18n/tr';
import { hasAiAccess } from '../lib/aiAccess';
import { AiConsentRequiredError } from './gemini/models';

export const LIVE_VOICE_MODEL = 'gemini-3.8-live';
const LIVE_VOICE_CANDIDATE_MODELS = [LIVE_VOICE_MODEL] as const;
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SILENCE_TIMEOUT_MS = 60_000;

export type LiveVoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'sleeping'
  | 'ended'
  | 'error';

/** Motivo (seguro para mostrar) pelo qual a Google fechou a sessão. */
export type LiveCloseKind = 'quota' | 'key' | 'generic';

/**
 * Classifica o evento de fecho da ligação em tempo real num motivo amigável.
 * Nunca devolve o texto bruto do servidor (pode conter detalhes internos).
 */
export function classifyLiveClose(event: { code?: number; reason?: string } | null | undefined): LiveCloseKind {
  const reason = (event?.reason ?? '').toLowerCase();
  if (/quota|resource_exhausted|rate.?limit|exhausted|\b429\b/.test(reason)) return 'quota';
  if (/api key|api_key|permission|unauthenticated|unauthorized|forbidden|invalid.*key|\b40[13]\b/.test(reason)) {
    return 'key';
  }
  return 'generic';
}

const LIVE_CLOSE_MESSAGE_KEY: Record<LiveCloseKind, string> = {
  quota: 'assistant:liveVoice.sessionEndedQuota',
  key: 'assistant:liveVoice.sessionEndedKey',
  generic: 'assistant:liveVoice.sessionEnded',
};

export function liveCloseMessageKey(kind: LiveCloseKind): string {
  return LIVE_CLOSE_MESSAGE_KEY[kind];
}

export interface LiveTranscriptEntry {
  id: string;
  role: 'user' | 'model';
  text: string;
}

/**
 * Reduz a taxa de amostragem para 16 kHz com média por janela (filtro passa-baixo simples),
 * em vez de saltar amostras — evita o som metálico (aliasing) da versão anterior.
 */
export function downsampleToPcm16(floatData: Float32Array, sourceRate: number): Int16Array {
  const ratio = Math.max(1, sourceRate / INPUT_SAMPLE_RATE);
  const outLength = Math.max(1, Math.floor(floatData.length / ratio));
  const pcm16 = new Int16Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(floatData.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += floatData[j] ?? 0;
    const avg = sum / (end - start);
    const clamped = Math.max(-1, Math.min(1, avg));
    pcm16[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }
  return pcm16;
}

function floatToInt16Base64(floatData: Float32Array, sourceRate: number): string {
  const pcm16 = downsampleToPcm16(floatData, sourceRate);
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = (int16[i] ?? 0) / 32768;
  }
  return float32;
}

export interface StartLiveVoiceSessionArgs {
  apiKey: string;
  activeCourse?: Course;
  uniAgent?: UniAgentRecord | null;
  persona: UniPersonaMode;
  accessory: UniAccessoryId;
  studentName: string;
  language: AppLanguage | string;
  onStatusChange: (status: LiveVoiceStatus) => void;
  onTranscript: (entry: LiveTranscriptEntry) => void;
  onToolProposal: (proposal: UniToolProposal) => void;
  onSilenceTimeout?: () => void;
  /** Permite cancelar a ligação (ex.: o modal fechou) enquanto ainda está a abrir. */
  signal?: AbortSignal;
  onError: (message: string) => void;
}

export interface LiveVoiceController {
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

const CAPTURE_WORKLET_SOURCE = `
class UniCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.length = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.length++] = channel[i];
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer.slice(0));
          this.length = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('uni-capture', UniCaptureProcessor);
`;

/** Cria o nó de captura em AudioWorklet (thread de áudio); devolve null se não for suportado. */
async function createCaptureWorklet(ctx: AudioContext): Promise<AudioWorkletNode | null> {
  if (typeof AudioWorkletNode === 'undefined' || !ctx.audioWorklet) return null;
  const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET_SOURCE], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(url);
    return new AudioWorkletNode(ctx, 'uni-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Abre sessão bidirecional em tempo real (`gemini-3.8-live`) exclusivamente com a chave Gemini própria.
 */
export async function startUniLiveVoiceSession(
  args: StartLiveVoiceSessionArgs,
): Promise<LiveVoiceController> {
  // ADR-001: sem consentimento e 18+ não se abre o microfone nem se envia nada à Google.
  if (!hasAiAccess(useStore.getState().settings)) {
    throw new AiConsentRequiredError();
  }
  const trimmedKey = args.apiKey.trim();
  const guard = canStartLiveVoiceSession(Boolean(trimmedKey));
  if (!guard.allowed) {
    throw new Error(guard.reason ?? tr('common:errors.voiceNeedKey'));
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(tr('common:errors.voiceNoMic'));
  }

  args.onStatusChange('connecting');

  let closed = false;
  let everConnected = false;
  let muted = false;
  let session: Session | null = null;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let processor: AudioNode | null = null;
  let processorSink: GainNode | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let silenceTimer: number | null = null;
  let nextPlayTime = 0;
  const startedAtMs = Date.now();
  const activeSources = new Set<AudioBufferSourceNode>();

  const stopQueuedOutputAudio = () => {
    for (const src of activeSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSources.clear();
    if (audioCtx) {
      nextPlayTime = audioCtx.currentTime;
    }
  };

  const resetSilenceTimer = () => {
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
    }
    silenceTimer = window.setTimeout(() => {
      if (closed) return;
      args.onStatusChange('sleeping');
      args.onSilenceTimeout?.();
      cleanup();
    }, SILENCE_TIMEOUT_MS);
  };

  /** Liberta microfone, grafo de áudio e sessão; seguro de chamar várias vezes. */
  const releaseResources = () => {
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    stopQueuedOutputAudio();
    try {
      if (processor instanceof AudioWorkletNode) processor.port.onmessage = null;
      processor?.disconnect();
      processorSink?.disconnect();
    } catch {
      // ignore
    }
    try {
      sourceNode?.disconnect();
    } catch {
      // ignore
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      stream = null;
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    try {
      session?.close();
    } catch {
      // ignore
    }
    session = null;
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;
    releaseResources();
    // Só conta como uso de voz se a sessão chegou realmente a ligar.
    const elapsedSec = (Date.now() - startedAtMs) / 1000;
    if (everConnected && elapsedSec >= 2) {
      recordVoiceSessionUsage(elapsedSec);
    }
  };

  const abortError = () => new DOMException('Sessão de voz cancelada.', 'AbortError');
  /** Depois de cada await: se entretanto foi cancelada, liberta tudo o que acabou de ser aberto. */
  const throwIfClosed = () => {
    if (closed || args.signal?.aborted) {
      closed = true;
      releaseResources();
      throw abortError();
    }
  };
  args.signal?.addEventListener('abort', () => cleanup(), { once: true });

  const schedulePcmPlayback = (base64: string) => {
    if (!audioCtx || closed) return;
    const samples = base64Pcm16ToFloat32(base64);
    if (samples.length === 0) return;

    const buffer = audioCtx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now;
    src.start(nextPlayTime);
    nextPlayTime += buffer.duration;

    activeSources.add(src);
    args.onStatusChange('speaking');
    src.onended = () => {
      activeSources.delete(src);
      if (!closed && activeSources.size === 0) {
        args.onStatusChange(muted ? 'sleeping' : 'listening');
      }
    };
  };

  // Cada fala chega aos bocados: junta-os numa entrada por turno (mesmo id) e tira
  // etiquetas técnicas que o modelo diga por engano, transformando-as em propostas.
  let userTurn: { id: string; text: string } | null = null;
  let modelTurn: { id: string; text: string; handledTools: number } | null = null;
  const newTurnId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const joinFragment = joinTranscriptFragment;
  const visibleModelText = visibleLiveText;

  const buildToolContext = (): UniToolExecutionContext => {
    const state = useStore.getState();
    return {
      activeCourse: args.activeCourse,
      courses: state.courses,
      sessions: state.sessions,
      assessments: state.assessments,
      agent: args.uniAgent,
    };
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    throwIfClosed();

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      throwIfClosed();
    }

    const ai = new GoogleGenAI({
      apiKey: trimmedKey,
      apiVersion: 'v1beta',
      httpOptions: { apiVersion: 'v1beta' },
    });
    const studyContext = buildStudyContext(useStore.getState());
    const activeLang = normalizeAppLanguage(args.language);
    const resolvedVoice = resolveUniVoiceConfig(
      args.uniAgent,
      useStore.getState().settings.uniVoice,
      args.persona,
    );
    const baseVoiceSuffix =
      activeLang === 'en'
        ? 'REAL-TIME VOICE MODE: reply naturally, warmly, concisely, and briefly (2 to 4 sentences per turn) so it is easy to listen to.'
        : activeLang === 'es'
          ? 'MODO VOZ EN TIEMPO REAL: responde de forma natural, cercana, objetiva y breve (2 a 4 frases por turno) para facilitar la escucha.'
          : activeLang === 'pt-BR'
            ? 'MODO VOZ EM TEMPO REAL: responda de forma natural, acolhedora, objetiva e breve (2 a 4 frases por turno) para facilitar a audição.'
            : 'MODO VOZ EM TEMPO REAL: responde de forma natural, calorosa, objetiva e breve (2 a 4 frases por turno) para facilitar a audição. Fala português de Portugal: trata o estudante por «tu» (nunca «você») e usa vocabulário e pronúncia europeus.';
    const liveVoiceSuffix = resolvedVoice.stylePrompt
      ? `${baseVoiceSuffix}\nESTILO VOCAL PREFERIDO: ${resolvedVoice.stylePrompt}.`
      : baseVoiceSuffix;
    const systemText = `${SYSTEM_PROMPT(studyContext, undefined, {
      persona: args.persona,
      accessory: args.accessory,
      studentName: args.studentName,
      appTone: useStore.getState().settings.appTone,
      language: args.language,
      uniAgent: args.uniAgent,
      courseName: args.activeCourse?.shortName || args.activeCourse?.name,
      voiceMode: true,
    })}\n\n${liveVoiceSuffix}`;

    let connected = false;
    let lastConnectErr: unknown = null;

    for (const candidateModel of LIVE_VOICE_CANDIDATE_MODELS) {
      if (closed) break;
      const is38Model = candidateModel.startsWith('gemini-3.8');
      const toolsForModel = is38Model
        ? UNI_TOOL_DECLARATIONS
        : UNI_TOOL_DECLARATIONS.map((decl) => {
            const copy = { ...decl };
            delete copy.behavior;
            return copy;
          });

      try {
        session = await ai.live.connect({
          model: candidateModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: resolvedVoice.voiceName,
                },
              },
            },
            systemInstruction: systemText,
            tools: [{ functionDeclarations: toolsForModel }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (closed) return;
              everConnected = true;
              args.onStatusChange('listening');
              resetSilenceTimer();
            },
            onmessage: (message: LiveServerMessage) => {
              if (closed) return;
              resetSilenceTimer();

              if (message.serverContent?.interrupted) {
                stopQueuedOutputAudio();
                args.onStatusChange(muted ? 'sleeping' : 'listening');
              }

              const inText = message.serverContent?.inputTranscription?.text;
              if (inText && inText.trim()) {
                modelTurn = null;
                if (!userTurn) userTurn = { id: newTurnId('u'), text: '' };
                userTurn.text = joinFragment(userTurn.text, inText);
                args.onTranscript({ id: userTurn.id, role: 'user', text: userTurn.text.trim() });
              }

              const outText = message.serverContent?.outputTranscription?.text;
              if (outText && outText.trim()) {
                userTurn = null;
                if (!modelTurn) modelTurn = { id: newTurnId('m'), text: '', handledTools: 0 };
                modelTurn.text = joinFragment(modelTurn.text, outText);
                const shown = visibleModelText(modelTurn.text);
                if (shown) args.onTranscript({ id: modelTurn.id, role: 'model', text: shown });

                const { calls } = extractUniToolsFromText(modelTurn.text);
                const fresh = calls.slice(modelTurn.handledTools);
                modelTurn.handledTools = calls.length;
                if (fresh.length > 0) {
                  const ctx = buildToolContext();
                  for (const call of fresh) {
                    if (!requiresStudentConfirmation(call.name)) continue;
                    const proposal = buildUniToolProposal(call, ctx);
                    if (proposal) args.onToolProposal(proposal);
                  }
                }
              }

              if (message.serverContent?.turnComplete) {
                modelTurn = null;
              }

              const parts = message.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                const inline = part.inlineData;
                if (inline?.data && inline.mimeType?.startsWith('audio/pcm')) {
                  schedulePcmPlayback(inline.data);
                }
              }

              if (message.serverContent?.turnComplete && activeSources.size === 0) {
                args.onStatusChange(muted ? 'sleeping' : 'listening');
              }

              const fnCalls = message.toolCall?.functionCalls ?? [];
              if (fnCalls.length > 0 && session) {
                args.onStatusChange('thinking');
                void (async () => {
                  const responses = [];
                  const ctx = buildToolContext();
                  for (const fc of fnCalls) {
                    const rawName = fc.name ?? '';
                    if (!isUniToolName(rawName)) {
                      responses.push({
                        id: fc.id,
                        name: rawName,
                        response: { ok: false, error: 'Ferramenta desconhecida.' },
                      });
                      continue;
                    }
                    const callArgs = (fc.args ?? {}) as Record<string, unknown>;
                    if (requiresStudentConfirmation(rawName)) {
                      const proposal = buildUniToolProposal(
                        { id: fc.id, name: rawName, args: callArgs },
                        ctx,
                      );
                      if (proposal) {
                        args.onToolProposal(proposal);
                      }
                      responses.push({
                        id: fc.id,
                        name: rawName,
                        response: {
                          ok: true,
                          status: 'awaiting_student_confirmation',
                          message: 'Proposta apresentada no ecrã para confirmação explícita do estudante.',
                        },
                      });
                    } else {
                      const result = await executeReadOnlyOrRecallUniTool(
                        { id: fc.id, name: rawName, args: callArgs },
                        ctx,
                      );
                      responses.push({
                        id: fc.id,
                        name: rawName,
                        response: result,
                      });
                    }
                  }
                  if (!closed && session && responses.length > 0) {
                    session.sendToolResponse({ functionResponses: responses });
                  }
                })();
              }
            },
            onerror: (err: ErrorEvent) => {
              if (closed || !everConnected) return;
              cleanup();
              args.onStatusChange('error');
              args.onError(err?.message || tr('common:errors.voiceConnErr'));
            },
            onclose: (ev: CloseEvent) => {
              // Fecho inesperado (timeout do servidor, erro, quota): sem isto a UI ficava a «ouvir».
              if (closed || !everConnected) return;
              cleanup();
              args.onStatusChange('ended');
              args.onError(tr(liveCloseMessageKey(classifyLiveClose(ev))));
            },
          },
        });
        connected = true;
        everConnected = true;
        throwIfClosed();
        args.onStatusChange('listening');
        resetSilenceTimer();
        break;
      } catch (connectErr) {
        if (closed || args.signal?.aborted) throw connectErr;
        lastConnectErr = connectErr;
      }
    }

    if (!connected || !session) {
      throw lastConnectErr instanceof Error
        ? lastConnectErr
        : new Error(tr('common:errors.voiceSessionErr'));
    }

    sourceNode = audioCtx!.createMediaStreamSource(stream!);
    const actualSampleRate = audioCtx!.sampleRate;

    const handleChunk = (input: Float32Array) => {
      if (closed || muted || !session) return;
      let peak = 0;
      for (let i = 0; i < input.length; i += 8) {
        const v = Math.abs(input[i] ?? 0);
        if (v > peak) peak = v;
      }
      if (peak > 0.015) {
        resetSilenceTimer();
      }
      const b64 = floatToInt16Base64(input, actualSampleRate);
      try {
        session.sendRealtimeInput({
          audio: {
            data: b64,
            mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
          },
        });
      } catch {
        // Session may have just closed
      }
    };

    // Saída silenciosa: mantém o grafo de áudio ativo sem reproduzir o microfone.
    processorSink = audioCtx.createGain();
    processorSink.gain.value = 0;
    processorSink.connect(audioCtx.destination);

    const workletNode = await createCaptureWorklet(audioCtx);
    throwIfClosed();
    if (workletNode) {
      workletNode.port.onmessage = (ev: MessageEvent<Float32Array>) => handleChunk(ev.data);
      processor = workletNode;
    } else {
      // Fallback para browsers sem AudioWorklet (ScriptProcessorNode está obsoleto).
      const legacy = audioCtx.createScriptProcessor(4096, 1, 1);
      legacy.onaudioprocess = (ev) => handleChunk(ev.inputBuffer.getChannelData(0));
      processor = legacy;
    }

    sourceNode.connect(processor);
    processor.connect(processorSink);

    return {
      setMuted: (nextMuted: boolean) => {
        muted = nextMuted;
        if (!closed && activeSources.size === 0) {
          args.onStatusChange(nextMuted ? 'sleeping' : 'listening');
        }
      },
      stop: cleanup,
    };
  } catch (err) {
    cleanup();
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    args.onStatusChange('error');
    const message = err instanceof Error ? err.message : tr('common:errors.voiceStartErr');
    args.onError(message);
    throw err;
  }
}
