import { useSyncExternalStore } from 'react';
import { normalizeAppLanguage } from './grading';
import type { UniVoiceName } from '../types';

export type AudioPlaybackRate = 1 | 1.25 | 1.5;

export interface UniAudioSnapshot {
  sourceId: string | null;
  mode: 'none' | 'wav' | 'speech';
  status: 'idle' | 'loading' | 'playing' | 'paused';
  currentTime: number;
  duration: number;
  playbackRate: AudioPlaybackRate;
  activeTurnIndex: number;
}

const DEFAULT_SNAPSHOT: UniAudioSnapshot = {
  sourceId: null,
  mode: 'none',
  status: 'idle',
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  activeTurnIndex: -1,
};

let snapshot: UniAudioSnapshot = { ...DEFAULT_SNAPSHOT };
const listeners = new Set<() => void>();
let activeAudioEl: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let speechCancelledToken = 0;

function emit() {
  listeners.forEach((l) => l());
}

function updateSnapshot(patch: Partial<UniAudioSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function wavBase64ToObjectUrl(wavBase64: string): string {
  const binary = atob(wavBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function revokeActiveUrl() {
  if (activeObjectUrl && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(activeObjectUrl);
    } catch {
      // ignore
    }
    activeObjectUrl = null;
  }
}

function clearAudioElement() {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.onended = null;
      activeAudioEl.ontimeupdate = null;
      activeAudioEl.onloadedmetadata = null;
      activeAudioEl.onerror = null;
      activeAudioEl.src = '';
    } catch {
      // ignore
    }
    activeAudioEl = null;
  }
  revokeActiveUrl();
}

function clearDeviceSpeech() {
  speechCancelledToken += 1;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function stopUniAudio(): void {
  clearAudioElement();
  clearDeviceSpeech();
  snapshot = { ...DEFAULT_SNAPSHOT, playbackRate: snapshot.playbackRate };
  emit();
}

export function setUniAudioLoading(sourceId: string): void {
  clearAudioElement();
  clearDeviceSpeech();
  updateSnapshot({
    sourceId,
    mode: 'none',
    status: 'loading',
    currentTime: 0,
    duration: 0,
    activeTurnIndex: -1,
  });
}

export function pauseUniAudio(): void {
  if (snapshot.mode === 'wav' && activeAudioEl && !activeAudioEl.paused) {
    activeAudioEl.pause();
    updateSnapshot({ status: 'paused' });
    return;
  }
  if (
    snapshot.mode === 'speech' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.pause();
      updateSnapshot({ status: 'paused' });
    } catch {
      stopUniAudio();
    }
  }
}

export function resumeUniAudio(): void {
  if (snapshot.mode === 'wav' && activeAudioEl && activeAudioEl.paused) {
    void activeAudioEl.play().then(() => {
      updateSnapshot({ status: 'playing' });
    }).catch(() => {
      stopUniAudio();
    });
    return;
  }
  if (
    snapshot.mode === 'speech' &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    try {
      window.speechSynthesis.resume();
      updateSnapshot({ status: 'playing' });
    } catch {
      stopUniAudio();
    }
  }
}

export function setUniAudioRate(rate: AudioPlaybackRate): void {
  updateSnapshot({ playbackRate: rate });
  if (activeAudioEl) {
    activeAudioEl.playbackRate = rate;
  }
}

export function nextPlaybackRate(current: AudioPlaybackRate): AudioPlaybackRate {
  if (current === 1) return 1.25;
  if (current === 1.25) return 1.5;
  return 1;
}

export async function playWavBase64(
  sourceId: string,
  wavBase64: string,
  rate?: AudioPlaybackRate,
): Promise<void> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Audio playback unavailable');
  }
  clearAudioElement();
  clearDeviceSpeech();

  const effectiveRate = rate ?? snapshot.playbackRate;
  const url = wavBase64ToObjectUrl(wavBase64);
  activeObjectUrl = url;

  const audio = new Audio(url);
  audio.playbackRate = effectiveRate;
  activeAudioEl = audio;

  updateSnapshot({
    sourceId,
    mode: 'wav',
    status: 'playing',
    currentTime: 0,
    duration: 0,
    playbackRate: effectiveRate,
    activeTurnIndex: -1,
  });

  audio.onloadedmetadata = () => {
    if (activeAudioEl === audio) {
      updateSnapshot({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
    }
  };
  audio.ontimeupdate = () => {
    if (activeAudioEl === audio) {
      updateSnapshot({
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : snapshot.duration,
      });
    }
  };
  audio.onended = () => {
    if (activeAudioEl === audio) {
      stopUniAudio();
    }
  };
  audio.onerror = () => {
    if (activeAudioEl === audio) {
      stopUniAudio();
    }
  };

  await audio.play();
}

function splitSpeechChunks(text: string, maxLen = 230): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length <= maxLen) {
      buf = (buf + ' ' + s).trim();
    } else {
      if (buf) chunks.push(buf);
      if (s.length <= maxLen) {
        buf = s;
      } else {
        const words = s.split(/\s+/);
        let wordBuf = '';
        for (const w of words) {
          if ((wordBuf + ' ' + w).trim().length <= maxLen) {
            wordBuf = (wordBuf + ' ' + w).trim();
          } else {
            if (wordBuf) chunks.push(wordBuf);
            wordBuf = w;
          }
        }
        buf = wordBuf;
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

function pickSystemVoices(language?: string): { primary?: SpeechSynthesisVoice; secondary?: SpeechSynthesisVoice } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return {};
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return {};
  const norm = normalizeAppLanguage(language);
  const prefix = norm === 'en' ? 'en' : norm === 'es' ? 'es' : 'pt';
  const exactPool = voices.filter((v) => v.lang.toLowerCase() === norm.toLowerCase());
  const langPool = exactPool.length ? exactPool : voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const pool = langPool.length ? langPool : voices;
  const primary = pool[0];
  const secondary = pool.find((v) => v.voiceURI !== primary?.voiceURI) ?? primary;
  return { primary, secondary };
}

export function isDeviceSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export async function playDeviceSpeech(
  sourceId: string,
  text: string,
  options?: { lang?: string; voiceHint?: UniVoiceName; rate?: AudioPlaybackRate },
): Promise<void> {
  if (!isDeviceSpeechSupported()) {
    throw new Error('Speech synthesis unavailable');
  }
  const chunks = splitSpeechChunks(text);
  if (chunks.length === 0) return;

  clearAudioElement();
  clearDeviceSpeech();
  const token = speechCancelledToken;
  const effectiveRate = options?.rate ?? snapshot.playbackRate;
  const normLang = normalizeAppLanguage(options?.lang);
  const { primary } = pickSystemVoices(normLang);

  updateSnapshot({
    sourceId,
    mode: 'speech',
    status: 'playing',
    currentTime: 0,
    duration: chunks.length,
    playbackRate: effectiveRate,
    activeTurnIndex: -1,
  });

  for (let i = 0; i < chunks.length; i++) {
    if (token !== speechCancelledToken) return;
    await new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(chunks[i]);
      utter.lang = normLang;
      if (primary) utter.voice = primary;
      utter.rate = snapshot.playbackRate;
      if (options?.voiceHint === 'Charon' || options?.voiceHint === 'Fenrir') {
        utter.pitch = 0.92;
      } else if (options?.voiceHint === 'Puck' || options?.voiceHint === 'Zephyr') {
        utter.pitch = 1.06;
      }
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
    if (token === speechCancelledToken) {
      updateSnapshot({ currentTime: i + 1 });
    }
  }

  if (token === speechCancelledToken) {
    stopUniAudio();
  }
}

export async function playPodcastSpeechLines(
  sourceId: string,
  lines: Array<{ speaker: string; text: string }>,
  options: { lang?: string; hostName: string; rate?: AudioPlaybackRate },
): Promise<void> {
  if (!isDeviceSpeechSupported() || lines.length === 0) {
    throw new Error('Speech synthesis unavailable');
  }

  clearAudioElement();
  clearDeviceSpeech();
  const token = speechCancelledToken;
  const effectiveRate = options.rate ?? snapshot.playbackRate;
  const normLang = normalizeAppLanguage(options.lang);
  const { primary, secondary } = pickSystemVoices(normLang);

  updateSnapshot({
    sourceId,
    mode: 'speech',
    status: 'playing',
    currentTime: 0,
    duration: lines.length,
    playbackRate: effectiveRate,
    activeTurnIndex: 0,
  });

  for (let i = 0; i < lines.length; i++) {
    if (token !== speechCancelledToken) return;
    const line = lines[i];
    const isHost = line.speaker.toLowerCase() === options.hostName.toLowerCase();
    updateSnapshot({ activeTurnIndex: i, currentTime: i });

    await new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(line.text);
      utter.lang = normLang;
      if (isHost && primary) utter.voice = primary;
      if (!isHost && secondary) utter.voice = secondary;
      utter.rate = snapshot.playbackRate;
      utter.pitch = isHost ? 0.96 : 1.08;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }

  if (token === speechCancelledToken) {
    stopUniAudio();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): UniAudioSnapshot {
  return snapshot;
}

export function useUniAudioPlayer(sourceId: string) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isThisSource = state.sourceId === sourceId;
  return {
    isThisSource,
    status: isThisSource ? state.status : 'idle',
    isLoading: isThisSource && state.status === 'loading',
    isPlaying: isThisSource && state.status === 'playing',
    isPaused: isThisSource && state.status === 'paused',
    mode: isThisSource ? state.mode : 'none',
    currentTime: isThisSource ? state.currentTime : 0,
    duration: isThisSource ? state.duration : 0,
    activeTurnIndex: isThisSource ? state.activeTurnIndex : -1,
    playbackRate: state.playbackRate,
    pause: pauseUniAudio,
    resume: resumeUniAudio,
    stop: stopUniAudio,
    setRate: setUniAudioRate,
    cycleRate: () => setUniAudioRate(nextPlaybackRate(state.playbackRate)),
    setLoading: () => setUniAudioLoading(sourceId),
  };
}
