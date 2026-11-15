import {
  BellOff,
  ChevronDown,
  ChevronUp,
  Lock,
  Maximize2,
  Minimize2,
  Shield,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import type { FocusShieldDevicePrefs, FocusSoundPreset } from '../../lib/focusShield';
import type { NativeFocusShieldCapabilities } from '../../lib/nativeBridge';
import { cx } from '../../lib/uiHelpers';

interface FocusShieldPanelProps {
  prefs: FocusShieldDevicePrefs;
  running: boolean;
  nativeAndroid: boolean;
  nativeCaps: NativeFocusShieldCapabilities;
  webCaps: { fullscreenSupported: boolean; wakeLockSupported: boolean };
  onTogglePref: (key: 'fullscreen' | 'wakeLock' | 'androidDnd' | 'androidPinning') => void;
  onChangeSound: (preset: FocusSoundPreset) => void;
  onChangeVolume: (volume: number) => void;
  onOpenDndSettings: () => void;
}

const SOUND_OPTIONS: Array<{ id: FocusSoundPreset; label: string }> = [
  { id: 'none', label: 'Silêncio' },
  { id: 'rain', label: 'Chuva' },
  { id: 'white', label: 'Branco' },
];

export default function FocusShieldPanel({
  prefs,
  running,
  nativeAndroid,
  nativeCaps,
  webCaps,
  onTogglePref,
  onChangeSound,
  onChangeVolume,
  onOpenDndSettings,
}: FocusShieldPanelProps) {
  const [expandedWhileRunning, setExpandedWhileRunning] = useState(false);

  const activeCount =
    Number(prefs.fullscreen && webCaps.fullscreenSupported) +
    Number(prefs.wakeLock && webCaps.wakeLockSupported) +
    Number(prefs.androidDnd && nativeAndroid && nativeCaps.dndGranted) +
    Number(prefs.androidPinning && nativeAndroid) +
    Number(prefs.soundPreset !== 'none');

  const showControls = !running || expandedWhileRunning;

  return (
    <div className="mt-5 w-full rounded-2xl border border-line bg-surface/80 p-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-fg">
          {activeCount > 0 ? (
            <ShieldCheck size={15} className="shrink-0 text-ok" aria-hidden="true" />
          ) : (
            <Shield size={15} className="shrink-0 text-muted" aria-hidden="true" />
          )}
          <span>Escudo anti-distração</span>
          <span
            className={cx(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              activeCount > 0 ? 'bg-ok/12 text-ok' : 'bg-surface-2 text-muted',
            )}
          >
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}`
              : 'Opcional'}
          </span>
        </div>

        {running && (
          <button
            type="button"
            onClick={() => setExpandedWhileRunning((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {expandedWhileRunning ? 'Recolher' : 'Ajustar'}
            {expandedWhileRunning ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {showControls && (
        <div className="mt-2.5 space-y-2.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Opções do escudo anti-distração">
            {webCaps.fullscreenSupported && (
              <button
                type="button"
                aria-pressed={prefs.fullscreen}
                onClick={() => onTogglePref('fullscreen')}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition',
                  prefs.fullscreen
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {prefs.fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                Ecrã cheio
              </button>
            )}

            {webCaps.wakeLockSupported && (
              <button
                type="button"
                aria-pressed={prefs.wakeLock}
                onClick={() => onTogglePref('wakeLock')}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition',
                  prefs.wakeLock
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                <Smartphone size={14} />
                Ecrã ligado
              </button>
            )}

            {nativeAndroid && nativeCaps.dndSupported && (
              <button
                type="button"
                aria-pressed={prefs.androidDnd && nativeCaps.dndGranted}
                onClick={() => {
                  if (!nativeCaps.dndGranted) {
                    onOpenDndSettings();
                    return;
                  }
                  onTogglePref('androidDnd');
                }}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition',
                  prefs.androidDnd && nativeCaps.dndGranted
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                <BellOff size={14} />
                {nativeCaps.dndGranted ? 'Não incomodar' : 'Autorizar Não incomodar'}
              </button>
            )}

            {nativeAndroid && nativeCaps.screenPinningSupported && (
              <button
                type="button"
                aria-pressed={prefs.androidPinning}
                onClick={() => onTogglePref('androidPinning')}
                className={cx(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition',
                  prefs.androidPinning
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                <Lock size={14} />
                Afixar ecrã
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              {prefs.soundPreset === 'none' ? <VolumeX size={14} /> : <Volume2 size={14} className="text-accent-ink" />}
              Som ambiente
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Som ambiente">
              {SOUND_OPTIONS.map((opt) => {
                const active = prefs.soundPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeSound(opt.id)}
                    className={cx(
                      'min-h-11 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {prefs.soundPreset !== 'none' && (
            <div className="flex items-center gap-2 pt-0.5">
              <label htmlFor="focus-sound-volume" className="text-xs font-medium text-muted">
                Volume
              </label>
              <input
                id="focus-sound-volume"
                type="range"
                min={0.05}
                max={0.65}
                step={0.05}
                value={prefs.soundVolume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                className="h-2 flex-1 accent-[var(--accent)]"
              />
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            {nativeAndroid && prefs.androidPinning
              ? 'O Android pede confirmação para afixar o ecrã. Para sair mais cedo, mantém Voltar + Recentes.'
              : 'Silencia lembretes da app durante o bloco e regista saídas do ecrã sem penalizar o teu progresso.'}
          </p>
        </div>
      )}
    </div>
  );
}
