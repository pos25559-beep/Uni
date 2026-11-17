import { Copy, Headphones, Loader2, Pause, Play, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import { playPodcastSpeechLines, playWavBase64, stopUniAudio, useUniAudioPlayer } from '../../lib/audioPlayer';
import { pickCoHostVoice, resolveUniVoiceConfig, type PodcastScript } from '../../lib/uniVoice';
import type { UniPersonaMode } from '../../lib/uniAccessories';
import type { UniVoiceConfig } from '../../types';
import { cx, showToast } from '../../lib/uiHelpers';
import { requestAiConsent } from '../../store/useAiConsentStore';

/** Áudio neural já sintetizado nesta sessão (por ficha), para repetir sem nova chamada. */
const wavCache = new Map<string, string>();

/** Ritmo médio de fala (palavras por segundo) para estimar a duração do episódio. */
const WORDS_PER_SECOND = 2.5;

function estimatePodcastSeconds(script: PodcastScript): number {
  const words = script.lines.reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(10, Math.round(words / WORDS_PER_SECOND));
}

function formatPodcastClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PodcastPlayer({
  sheetId,
  script,
  language,
  persona,
  agent,
  globalVoice,
}: {
  sheetId: string;
  script: PodcastScript;
  language: string;
  persona: UniPersonaMode;
  agent?: { voiceConfig?: UniVoiceConfig; personaId?: UniPersonaMode } | null;
  globalVoice?: UniVoiceConfig;
}) {
  const { t } = useTranslation('assistant');
  const sourceId = `podcast:${sheetId}`;
  const player = useUniAudioPlayer(sourceId);
  const [preparing, setPreparing] = useState(false);
  const [fallbackNote, setFallbackNote] = useState(false);
  const turnRefs = useRef<Array<HTMLLIElement | null>>([]);
  const listRef = useRef<HTMLOListElement | null>(null);
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const neural = hasCustomGeminiKey();
  const estimate = useMemo(() => estimatePodcastSeconds(script), [script]);
  const active = player.isPlaying || player.isPaused;
  const busy = preparing || player.isLoading;

  // Ao sair do ecrã ou trocar de episódio, pára o que estiver a tocar e cancela a síntese.
  useEffect(() => {
    return () => {
      runRef.current += 1;
      abortRef.current?.abort();
      stopUniAudio();
    };
  }, [sheetId]);

  // Mantém a fala ativa visível dentro da lista (sem mexer na página inteira).
  useEffect(() => {
    if (!active || player.activeTurnIndex < 0) return;
    const el = turnRefs.current[player.activeTurnIndex];
    const list = listRef.current;
    if (!el || !list) return;
    const top = el.offsetTop - list.offsetTop;
    const target = top - (list.clientHeight - el.clientHeight) / 2;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' });
  }, [active, player.activeTurnIndex]);

  const playOnDevice = async (run: number) => {
    if (run !== runRef.current) return;
    try {
      await playPodcastSpeechLines(sourceId, script.lines, {
        lang: language,
        hostName: script.hostName,
      });
    } catch {
      showToast(t('notebook.podcast.deviceUnavailable'), 'danger');
    }
  };

  const start = async () => {
    const run = ++runRef.current;
    setFallbackNote(false);
    if (!neural) {
      await playOnDevice(run);
      return;
    }

    const cached = wavCache.get(sheetId);
    try {
      let wav = cached;
      if (!wav) {
        setPreparing(true);
        player.setLoading();
        const controller = new AbortController();
        abortRef.current = controller;
        const voice = resolveUniVoiceConfig(agent, globalVoice, persona);
        const { synthesizePodcastWav } = await import('../../integrations/geminiAudio');
        const result = await synthesizePodcastWav({
          script,
          hostVoice: voice.voiceName,
          coHostVoice: pickCoHostVoice(voice.voiceName, voice.coHostVoiceName),
          stylePrompt: voice.stylePrompt,
          language,
          signal: controller.signal,
        });
        wav = result.wavBase64;
        wavCache.set(sheetId, wav);
      }
      if (run !== runRef.current) return;
      setPreparing(false);
      await playWavBase64(sourceId, wav);
    } catch (err) {
      if (run !== runRef.current) return;
      setPreparing(false);
      stopUniAudio();
      if (err instanceof Error && err.name === 'AiConsentRequiredError') {
        requestAiConsent();
        return;
      }
      setFallbackNote(true);
      await playOnDevice(run);
    }
  };

  const handleMain = () => {
    if (busy) return;
    if (player.isPlaying) {
      player.pause();
    } else if (player.isPaused) {
      player.resume();
    } else {
      void start();
    }
  };

  const handleStop = () => {
    runRef.current += 1;
    abortRef.current?.abort();
    setPreparing(false);
    stopUniAudio();
  };

  const handleCopy = async () => {
    const text = script.lines.map((line) => `${line.speaker}: ${line.text}`).join('\n\n');
    try {
      await navigator.clipboard?.writeText(`${script.title}\n\n${text}`);
      showToast(t('notebook.podcast.copied'));
    } catch {
      showToast(t('notebook.copyFail'), 'danger');
    }
  };

  const mainLabel = busy
    ? t('notebook.podcast.preparing')
    : player.isPlaying
      ? t('notebook.podcast.pause')
      : t('notebook.podcast.play');

  const progress =
    player.mode === 'wav' && player.duration > 0
      ? Math.min(100, (player.currentTime / player.duration) * 100)
      : player.mode === 'speech' && player.duration > 0
        ? Math.min(100, ((player.activeTurnIndex + 1) / player.duration) * 100)
        : 0;

  return (
    <section
      aria-label={t('notebook.podcast.playerLabel')}
      className="space-y-3 rounded-[20px] border border-accent/30 bg-accent-soft/50 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent-ink">
          <Headphones size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">
            {t('notebook.podcast.episode')}
          </p>
          <p className="break-words text-sm font-bold text-fg">{script.title}</p>
          <p className="text-xs text-muted">
            {t('notebook.podcast.meta', {
              duration: formatPodcastClock(estimate),
              host: script.hostName,
              coHost: script.coHostName,
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleMain}
          aria-label={mainLabel}
          aria-busy={busy}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-ink-cta text-ink-cta-fg transition hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={24} className="animate-spin" aria-hidden />
          ) : player.isPlaying ? (
            <Pause size={24} aria-hidden />
          ) : (
            <Play size={24} className="translate-x-px" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={!active && !busy}
          aria-label={t('notebook.podcast.stop')}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-fg transition hover:bg-surface-2 disabled:opacity-45"
        >
          <Square size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={player.cycleRate}
          aria-label={t('notebook.podcast.speed', { rate: player.playbackRate })}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface px-3 text-xs font-bold tabular-nums text-fg transition hover:bg-surface-2"
        >
          {player.playbackRate}x
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
        >
          <Copy size={14} aria-hidden /> {t('notebook.podcast.copy')}
        </button>
      </div>

      <div
        role="progressbar"
        aria-label={t('notebook.podcast.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <p role="status" aria-live="polite" className="text-xs text-muted">
        {busy
          ? t('notebook.podcast.preparing')
          : fallbackNote
            ? t('notebook.podcast.fallback')
            : !neural
              ? t('notebook.podcast.deviceNote')
              : ''}
      </p>

      <ol
        ref={listRef}
        aria-label={t('notebook.podcast.transcript')}
        className="relative max-h-72 space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-2"
      >
        {script.lines.map((line, idx) => {
          const isHost = line.speaker.toLowerCase() === script.hostName.toLowerCase();
          const isActive = active && player.activeTurnIndex === idx;
          return (
            <li
              key={`${idx}-${line.speaker}`}
              ref={(el) => {
                turnRefs.current[idx] = el;
              }}
              aria-current={isActive ? 'true' : undefined}
              className={cx(
                'flex flex-col gap-0.5 rounded-2xl px-3 py-2 transition-colors',
                isHost ? 'mr-6' : 'ml-6',
                isActive
                  ? 'bg-accent-soft ring-1 ring-accent/60'
                  : isHost
                    ? 'bg-surface-2/70'
                    : 'bg-surface-2/40',
              )}
            >
              <span className={cx('text-xs font-bold', isHost ? 'text-accent-ink' : 'text-muted')}>{line.speaker}</span>
              <span className="break-words text-sm leading-relaxed text-fg">{line.text}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
