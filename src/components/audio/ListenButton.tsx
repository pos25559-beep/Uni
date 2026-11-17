import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getCustomGeminiKey } from '../../integrations/gemini/core';
import { hasAiAccess } from '../../lib/aiAccess';
import {
  isDeviceSpeechSupported,
  playDeviceSpeech,
  playWavBase64,
  stopUniAudio,
  useUniAudioPlayer,
} from '../../lib/audioPlayer';
import { cx, showToast } from '../../lib/uiHelpers';
import { markdownLatexToSpeechText, resolveAiExecutionTier } from '../../lib/uniVoice';
import { useStore } from '../../store/useStore';
import type { UniVoiceConfig } from '../../types';

interface Props {
  sourceId: string;
  /** Markdown (com LaTeX); é convertido para texto natural antes de falar. */
  text: string;
  language?: string;
  voiceConfig?: UniVoiceConfig;
  /** `md` mostra o texto «Ouvir»; `sm` só o ícone. */
  size?: 'sm' | 'md';
  /** Nome acessível do botão (por omissão «Ouvir esta resposta»). */
  label?: string;
  className?: string;
}

// Cada pedido novo (deste ou de outro botão) invalida os anteriores ainda a sintetizar.
let requestCounter = 0;

const btn =
  'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';

export function ListenButton({ sourceId, text, language, voiceConfig, size = 'md', label, className }: Props) {
  const { t } = useTranslation('common');
  const player = useUniAudioPlayer(sourceId);
  const settings = useStore((s) => s.settings);
  const lang = language ?? settings.language;
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  });

  // Se o botão desaparece (outra conversa, leitor fechado), o áudio dele acaba.
  useEffect(() => {
    return () => {
      const p = playerRef.current;
      if (p.isThisSource && p.status !== 'idle') {
        requestCounter += 1;
        stopUniAudio();
      }
    };
  }, []);

  const deviceOk = isDeviceSpeechSupported();
  const hasText = text.trim().length > 0;
  const neuralOk =
    resolveAiExecutionTier(getCustomGeminiKey()) === 'ai-studio-key' && hasAiAccess(settings);
  const unavailable = !deviceOk && !neuralOk;

  const speakOnDevice = (spoken: string) => {
    playDeviceSpeech(sourceId, spoken, { lang, voiceHint: voiceConfig?.voiceName }).catch(() => {
      stopUniAudio();
      showToast(t('audio.failed'), 'danger');
    });
  };

  const start = async () => {
    const spoken = markdownLatexToSpeechText(text, lang);
    if (!spoken) {
      showToast(t('audio.empty'), 'neutral');
      return;
    }
    requestCounter += 1;
    const mine = requestCounter;

    if (!neuralOk) {
      if (!deviceOk) {
        showToast(t('audio.unavailable'), 'neutral');
        return;
      }
      speakOnDevice(spoken);
      return;
    }

    player.setLoading();
    try {
      const { synthesizeUniSpeech } = await import('../../integrations/geminiAudio');
      const { wavBase64 } = await synthesizeUniSpeech({ text: spoken, voiceConfig, language: lang });
      if (requestCounter !== mine) return; // cancelado entretanto
      await playWavBase64(sourceId, wavBase64);
    } catch (err) {
      if (requestCounter !== mine) return;
      if (deviceOk) {
        showToast(t('audio.fallback'), 'neutral');
        speakOnDevice(spoken);
      } else {
        stopUniAudio();
        showToast(err instanceof Error && err.message ? err.message : t('audio.failed'), 'danger');
      }
    }
  };

  const stop = () => {
    requestCounter += 1;
    stopUniAudio();
  };

  if (player.isLoading) {
    return (
      <span className={cx('inline-flex items-center gap-1', className)}>
        <button
          type="button"
          onClick={stop}
          aria-label={t('audio.cancelLoading')}
          title={t('audio.cancelLoading')}
          className={cx(btn, 'px-2.5 text-muted hover:bg-surface-2 hover:text-fg')}
        >
          <Loader2 size={15} className="animate-spin" aria-hidden />
          {size === 'md' && <span>{t('audio.loading')}</span>}
        </button>
      </span>
    );
  }

  if (player.isPlaying || player.isPaused) {
    const paused = player.isPaused;
    const rate = `${player.playbackRate}x`;
    return (
      <span
        role="group"
        aria-label={t('audio.controls')}
        className={cx('inline-flex items-center gap-0.5 rounded-full bg-accent-soft pr-0.5 text-accent-ink', className)}
      >
        <button
          type="button"
          onClick={paused ? player.resume : player.pause}
          aria-label={paused ? t('audio.resume') : t('audio.pause')}
          title={paused ? t('audio.resume') : t('audio.pause')}
          className={cx(btn, 'hover:bg-accent/15')}
        >
          {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={player.cycleRate}
          aria-label={t('audio.speed', { rate })}
          title={t('audio.speed', { rate })}
          className={cx(btn, 'px-2 tabular-nums hover:bg-accent/15')}
        >
          {rate}
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label={t('audio.stop')}
          title={t('audio.stop')}
          className={cx(btn, 'hover:bg-accent/15')}
        >
          <Square size={13} className="fill-current" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={unavailable || !hasText}
      aria-label={label ?? t('audio.listen')}
      title={unavailable ? t('audio.unavailable') : (label ?? t('audio.listen'))}
      className={cx(btn, 'px-2.5 text-muted hover:bg-surface-2 hover:text-fg', className)}
    >
      <Volume2 size={15} aria-hidden />
      {size === 'md' && <span>{t('audio.listenShort')}</span>}
    </button>
  );
}

export default ListenButton;
