import { describe, expect, it } from 'vitest';
import { downsampleToPcm16 } from '../../integrations/geminiLiveVoice';

describe('downsampleToPcm16', () => {
  it('converte 48 kHz em 16 kHz com o número certo de amostras', () => {
    const out = downsampleToPcm16(new Float32Array(4800).fill(0.5), 48000);
    expect(out.length).toBe(1600);
    expect(out[0]).toBe(Math.round(0.5 * 32767));
  });

  it('atenua ruído acima de 8 kHz em vez de o dobrar (anti-aliasing)', () => {
    // Sinal a 16 kHz amostrado a 48 kHz: padrão [1, -0.5, -0.5] com média zero por janela.
    const input = new Float32Array(4800).map((_, i) => (i % 3 === 0 ? 1 : -0.5));
    const out = downsampleToPcm16(input, 48000);
    const maxAbs = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(maxAbs).toBeLessThan(50);
  });
});
