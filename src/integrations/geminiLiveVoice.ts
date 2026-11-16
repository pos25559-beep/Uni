import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { canStartLiveVoiceSession, recordVoiceSessionUsage } from '../lib/aiQuota';
import type { UniAgentRecord } from '../lib/localDb';
import type { UniAccessoryId, UniPersonaMode } from '../lib/uniAccessories';
import {
  buildUniToolProposal,
  executeReadOnlyOrRecallUniTool,
  isUniToolName,
  requiresStudentConfirmation,
  UNI_TOOL_DECLARATIONS,
  type UniToolExecutionContext,
  type UniToolProposal,
} from '../lib/uniTools';
import { useStore } from '../store/useStore';
import type { AppLanguage, Course } from '../types';
import { buildStudyContext, SYSTEM_PROMPT } from './gemini';

export const LIVE_VOICE_MODEL = 'gemini-3.8-live';
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
  | 'error';

export interface LiveTranscriptEntry {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const PERSONA_PREBUILT_VOICES: Record<UniPersonaMode, string> = {
  amigo: 'Aoede',
  exigente: 'Fenrir',
  calmo: 'Kore',
  curioso: 'Puck',
  treinador: 'Charon',
};

function floatToInt16Base64(floatData: Float32Array, sourceRate: number): string {
  const ratio = sourceRate / INPUT_SAMPLE_RATE;
  const outLength = Math.max(1, Math.floor(floatData.length / ratio));
  const pcm16 = new Int16Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcIdx = Math.min(floatData.length - 1, Math.floor(i * ratio));
    const clamped = Math.max(-1, Math.min(1, floatData[srcIdx] ?? 0));
    pcm16[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
  }

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
  onError: (message: string) => void;
}

export interface LiveVoiceController {
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

/**
 * Abre sessão bidirecional em tempo real (`gemini-3.8-live`) exclusivamente com a chave Gemini própria.
 */
export async function startUniLiveVoiceSession(
  args: StartLiveVoiceSessionArgs,
): Promise<LiveVoiceController> {
  const trimmedKey = args.apiKey.trim();
  const guard = canStartLiveVoiceSession(Boolean(trimmedKey));
  if (!guard.allowed) {
    throw new Error(guard.reason ?? 'Chave Gemini própria necessária.');
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('O microfone não está disponível neste dispositivo/browser.');
  }

  args.onStatusChange('connecting');

  let closed = false;
  let muted = false;
  let session: Session | null = null;
  let stream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
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

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (silenceTimer !== null) {
      window.clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    stopQueuedOutputAudio();
    try {
      processor?.disconnect();
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
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => {});
    }
    try {
      session?.close();
    } catch {
      // ignore
    }
    const elapsedSec = (Date.now() - startedAtMs) / 1000;
    if (elapsedSec >= 2) {
      recordVoiceSessionUsage(elapsedSec);
    }
  };

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

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const ai = new GoogleGenAI({ apiKey: trimmedKey });
    const studyContext = buildStudyContext(useStore.getState());
    const systemText = `${SYSTEM_PROMPT(studyContext, undefined, {
      persona: args.persona,
      accessory: args.accessory,
      studentName: args.studentName,
      appTone: useStore.getState().settings.appTone,
      language: args.language,
      uniAgent: args.uniAgent,
      courseName: args.activeCourse?.shortName || args.activeCourse?.name,
    })}\n\nMODO VOZ EM TEMPO REAL: responde de forma natural, calorosa, objetiva e breve (2 a 4 frases por turno) para facilitar a audição.`;

    session = await ai.live.connect({
      model: LIVE_VOICE_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: PERSONA_PREBUILT_VOICES[args.persona] ?? 'Aoede',
            },
          },
        },
        systemInstruction: systemText,
        tools: [{ functionDeclarations: UNI_TOOL_DECLARATIONS }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          if (closed) return;
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

          const inText = message.serverContent?.inputTranscription?.text?.trim();
          if (inText) {
            args.onTranscript({
              id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: 'user',
              text: inText,
            });
          }

          const outText = message.serverContent?.outputTranscription?.text?.trim();
          if (outText) {
            args.onTranscript({
              id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: 'model',
              text: outText,
            });
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
          if (closed) return;
          args.onStatusChange('error');
          args.onError(err?.message || 'Erro na ligação de voz em tempo real.');
          cleanup();
        },
        onclose: () => {
          if (!closed) {
            cleanup();
          }
        },
      },
    });

    sourceNode = audioCtx.createMediaStreamSource(stream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);
    const actualSampleRate = audioCtx.sampleRate;

    processor.onaudioprocess = (ev) => {
      if (closed || muted || !session) return;
      const input = ev.inputBuffer.getChannelData(0);
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

    sourceNode.connect(processor);
    processor.connect(audioCtx.destination);

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
    args.onStatusChange('error');
    const message = err instanceof Error ? err.message : 'Não foi possível iniciar o modo Voz Live.';
    args.onError(message);
    throw err;
  }
}
