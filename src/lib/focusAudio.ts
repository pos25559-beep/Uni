import type { FocusSoundPreset } from './focusShield';

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

/**
 * Sintetizador ambiente 100% offline via Web Audio API (chuva suave ou ruído branco filtrado).
 * Evita dependências/ficheiros externos e garante libertação limpa ao pausar ou sair.
 */
export class FocusAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private lfoNode: OscillatorNode | null = null;
  private currentPreset: FocusSoundPreset = 'none';

  start(preset: FocusSoundPreset, volume = 0.35): boolean {
    if (preset === 'none') {
      this.stop();
      return false;
    }

    if (this.currentPreset === preset && this.ctx && this.masterGain) {
      this.setVolume(volume);
      return true;
    }

    this.stopImmediate();

    const Ctor = getAudioContextCtor();
    if (!Ctor) return false;

    try {
      const ctx = new Ctor();
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const seconds = 3;
      const sampleRate = ctx.sampleRate || 44100;
      const length = seconds * sampleRate;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      if (preset === 'rain') {
        // Ruído castanho/rosa suavizado para lembrar chuva contínua sem frequências agudas.
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.03 * white) / 1.03;
          data[i] = lastOut * 3.1;
        }
      } else {
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.45;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = preset === 'rain' ? 760 : 1400;
      filter.Q.value = 0.5;

      const masterGain = ctx.createGain();
      const targetGain = Math.min(0.65, Math.max(0.02, volume));
      masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.4);

      if (preset === 'rain') {
        const modGain = ctx.createGain();
        modGain.gain.value = 0.88;
        const lfo = ctx.createOscillator();
        const lfoDepth = ctx.createGain();
        lfo.frequency.value = 0.16;
        lfoDepth.gain.value = 0.12;
        lfo.connect(lfoDepth);
        lfoDepth.connect(modGain.gain);
        lfo.start();
        this.lfoNode = lfo;

        source.connect(filter);
        filter.connect(modGain);
        modGain.connect(masterGain);
      } else {
        source.connect(filter);
        filter.connect(masterGain);
      }

      masterGain.connect(ctx.destination);
      source.start();

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.sourceNode = source;
      this.currentPreset = preset;
      return true;
    } catch {
      this.stopImmediate();
      return false;
    }
  }

  setVolume(volume: number) {
    if (!this.ctx || !this.masterGain) return;
    const clamped = Math.min(0.65, Math.max(0.02, volume));
    try {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.08);
    } catch {
      // noop
    }
  }

  stop() {
    if (!this.ctx) {
      this.currentPreset = 'none';
      return;
    }
    const ctx = this.ctx;
    const gain = this.masterGain;
    const source = this.sourceNode;
    const lfo = this.lfoNode;

    this.ctx = null;
    this.masterGain = null;
    this.sourceNode = null;
    this.lfoNode = null;
    this.currentPreset = 'none';

    try {
      if (gain) {
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      }
      window.setTimeout(() => {
        try { source?.stop(); } catch { /* noop */ }
        try { lfo?.stop(); } catch { /* noop */ }
        void ctx.close().catch(() => {});
      }, 180);
    } catch {
      try { source?.stop(); } catch { /* noop */ }
      try { lfo?.stop(); } catch { /* noop */ }
      void ctx.close().catch(() => {});
    }
  }

  private stopImmediate() {
    try { this.sourceNode?.stop(); } catch { /* noop */ }
    try { this.lfoNode?.stop(); } catch { /* noop */ }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.masterGain = null;
    this.sourceNode = null;
    this.lfoNode = null;
    this.currentPreset = 'none';
  }
}
