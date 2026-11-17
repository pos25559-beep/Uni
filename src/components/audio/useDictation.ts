import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCustomGeminiKey } from '../../integrations/gemini/core';
import { hasAiAccess } from '../../lib/aiAccess';
import {
  isAudioRecordingSupported,
  MAX_CUSTOM_AUDIO_BYTES,
  MAX_NATIVE_AUDIO_BYTES,
  startAudioRecording,
  type ActiveAudioRecorder,
} from '../../lib/audioRecorder';
import { showToast } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { requestAiConsent } from '../../store/useAiConsentStore';
import { MAX_DICTATION_SECONDS } from './speechText';

export type DictationStatus = 'idle' | 'recording' | 'transcribing';

/**
 * Ditado por voz: grava, transcreve com a IA e devolve o texto por `onTranscript`
 * (nunca envia nada sozinho). Pede o consentimento de IA antes de gravar.
 */
export function useDictation(onTranscript: (text: string) => void) {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<ActiveAudioRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  const statusRef = useRef<DictationStatus>('idle');
  const stopRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    statusRef.current = status;
  });

  const supported = isAudioRecordingSupported();

  const reset = useCallback(() => {
    recorderRef.current = null;
    abortRef.current = null;
    setStatus('idle');
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (status !== 'recording') return;
    const id = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(sec);
      // Limite de duração: pára sozinho e transcreve o que já gravou.
      if (sec >= MAX_DICTATION_SECONDS) {
        showToast(t('audio.dictation.limitReached'), 'neutral');
        void stopRef.current();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [status, t]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || statusRef.current !== 'recording') return;
    statusRef.current = 'transcribing';
    setStatus('transcribing');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const clip = await recorder.stop();
      const limit = getCustomGeminiKey() ? MAX_CUSTOM_AUDIO_BYTES : MAX_NATIVE_AUDIO_BYTES;
      if (clip.sizeBytes > limit) {
        showToast(t('audio.dictation.tooLong'), 'danger');
        return;
      }
      if (clip.sizeBytes < 800) {
        showToast(t('audio.dictation.empty'), 'neutral');
        return;
      }
      const { transcribeAudioNotes } = await import('../../integrations/geminiAudio');
      const { transcript } = await transcribeAudioNotes({
        base64Data: clip.base64,
        mimeType: clip.mimeType,
        sizeBytes: clip.sizeBytes,
        language: useStore.getState().settings.language,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!transcript.trim()) {
        showToast(t('audio.dictation.empty'), 'neutral');
        return;
      }
      onTranscriptRef.current(transcript);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.message === 'AUDIO_RECORD_CANCELLED') return;
      showToast(err instanceof Error && err.message ? err.message : t('audio.dictation.failed'), 'danger');
    } finally {
      if (!controller.signal.aborted) reset();
    }
  }, [reset, t]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    recorderRef.current?.cancel();
    reset();
  }, [reset]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const begin = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    try {
      const recorder = await startAudioRecording();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      statusRef.current = 'recording';
      setStatus('recording');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      showToast(denied ? t('audio.dictation.denied') : t('audio.dictation.micError'), 'danger');
    }
  }, [t]);

  const start = useCallback(() => {
    if (statusRef.current !== 'idle') return;
    if (!hasAiAccess(useStore.getState().settings)) {
      requestAiConsent(() => void begin());
      return;
    }
    void begin();
  }, [begin]);

  // Sair do ecrã a meio liberta o microfone.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      recorderRef.current?.cancel();
    },
    [],
  );

  return { supported, status, elapsed, start, stop, cancel };
}
