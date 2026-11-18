import { Check, Play, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import { isDeviceSpeechSupported, playDeviceSpeech, playWavBase64 } from '../../lib/audioPlayer';
import { normalizeAppLanguage } from '../../lib/grading';
import { cx, showToast } from '../../lib/uiHelpers';
import {
  DEFAULT_VOICE_BY_PERSONA,
  UNI_VOICES,
  VOICE_STYLE_PRESETS,
  isValidUniVoiceName,
} from '../../lib/uniVoice';
import { useStore } from '../../store/useStore';
import type { UniVoiceConfig, UniVoiceName } from '../../types';
import { Button, Field, Input } from '../ui';

const STYLE_MAX = 120;

export default function UniVoiceCard() {
  const { t, i18n } = useTranslation(['settings', 'uni']);
  const appLang = normalizeAppLanguage(i18n.language);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const persisted = settings.uniVoice;
  const fallbackVoice = DEFAULT_VOICE_BY_PERSONA[settings.uniPersona ?? 'amigo'] ?? 'Aoede';
  const savedVoice: UniVoiceName = isValidUniVoiceName(persisted?.voiceName)
    ? persisted.voiceName
    : fallbackVoice;
  const savedStyle = (persisted?.stylePrompt ?? '').trim();

  const [voiceDraft, setVoiceDraft] = useState<{ base: UniVoiceName; value: UniVoiceName }>({
    base: savedVoice,
    value: savedVoice,
  });
  const [styleDraft, setStyleDraft] = useState<{ base: string; value: string }>({
    base: savedStyle,
    value: savedStyle,
  });
  const voice = voiceDraft.base === savedVoice ? voiceDraft.value : savedVoice;
  const style = styleDraft.base === savedStyle ? styleDraft.value : savedStyle;
  const setVoice = (value: UniVoiceName) => setVoiceDraft({ base: savedVoice, value });
  const setStyle = (value: string) => setStyleDraft({ base: savedStyle, value });
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const neural = hasCustomGeminiKey();
  const dirty = voice !== savedVoice || style.trim() !== savedStyle;
  const count = style.trim().length;

  const save = () => {
    const trimmed = style.trim().slice(0, STYLE_MAX);
    updateSettings({
      uniVoice: { ...persisted, voiceName: voice, stylePrompt: trimmed || undefined },
    });
    setStyle(trimmed);
    setError(null);
    showToast(t('settings:uniVoice.saved'));
  };

  const listen = async () => {
    if (previewing) return;
    setPreviewing(true);
    setError(null);
    const sample = t('settings:uniVoice.sample');
    const voiceConfig: UniVoiceConfig = { voiceName: voice, stylePrompt: style.trim() || undefined };
    try {
      // Carregado só ao ouvir: o módulo de áudio traz o SDK da Gemini e fica fora do chunk de Definições.
      const audio = await import('../../integrations/geminiAudio');
      if (audio.getAudioExecutionTier() === 'ai-studio-key') {
        try {
          const { wavBase64 } = await audio.synthesizeUniSpeech({
            text: sample,
            voiceConfig,
            language: appLang,
          });
          await playWavBase64('uni-voice-preview', wavBase64);
        } catch (neuralErr) {
          // A voz neural falhou (modelo indisponível, quota, rede): toca com a voz do dispositivo
          // e explica em linguagem simples, sem mostrar o erro técnico da Google.
          if (import.meta.env.DEV) console.warn('[Uni voz]', neuralErr);
          if (!isDeviceSpeechSupported()) throw neuralErr;
          await playDeviceSpeech('uni-voice-preview', sample, { lang: appLang, voiceHint: voice });
          setError(t('settings:uniVoice.neuralFallback'));
        }
      } else if (isDeviceSpeechSupported()) {
        await playDeviceSpeech('uni-voice-preview', sample, { lang: appLang, voiceHint: voice });
      } else {
        setError(t('settings:uniVoice.previewError'));
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Uni voz]', e);
      setError(t('settings:uniVoice.previewError'));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <section
      aria-labelledby="uni-voice-title"
      className="min-w-0 space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <header className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
          <Volume2 size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 id="uni-voice-title" className="font-display text-base font-bold text-fg">
            {t('settings:uniVoice.title')}
          </h3>
          <p className="text-xs text-muted">{t('settings:uniVoice.desc')}</p>
        </div>
      </header>

      <div role="radiogroup" aria-label={t('settings:uniVoice.voiceGroup')} className="grid gap-2 sm:grid-cols-2">
        {UNI_VOICES.map((entry) => {
          const active = voice === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setVoice(entry.id)}
              className={cx(
                'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                active
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface-2/60 text-fg hover:border-muted/50',
              )}
            >
              <span
                aria-hidden
                className={cx(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  active ? 'border-accent' : 'border-muted/60',
                )}
              >
                {active && <span className="size-2.5 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t(entry.labelKey)}</span>
                <span className="block text-xs text-muted">{t(entry.descKey)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Field label={t('settings:uniVoice.styleLabel')}>
          <Input
            value={style}
            maxLength={STYLE_MAX}
            placeholder={t('settings:uniVoice.stylePlaceholder')}
            onChange={(e) => setStyle(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{t('settings:uniVoice.styleCount', { count })}</p>
          {style.trim() && (
            <Button size="sm" variant="ghost" onClick={() => setStyle('')}>
              {t('settings:uniVoice.clearStyle')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('settings:uniVoice.presetsLabel')}>
          {VOICE_STYLE_PRESETS.map((preset) => {
            const prompt = preset.promptByLang[appLang];
            const active = style.trim() === prompt;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStyle(prompt.slice(0, STYLE_MAX))}
                className={cx(
                  'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {t(preset.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {!neural && (
        <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted">
          {t('settings:uniVoice.deviceNote')}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" loading={previewing} onClick={() => void listen()}>
          <Play size={14} /> {previewing ? t('settings:uniVoice.listening') : t('settings:uniVoice.listen')}
        </Button>
        <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>
          <Check size={14} /> {t('settings:uniVoice.save')}
        </Button>
      </div>
    </section>
  );
}
