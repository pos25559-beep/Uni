import { describe, expect, it } from 'vitest';
import { pcmBase64ToWavBase64 } from '../audioPlayer';

describe('voz do Gemini em PCM', () => {
  it('junta o cabeçalho WAV com a taxa indicada no tipo', () => {
    const pcm = btoa(String.fromCharCode(1, 0, 2, 0, 3, 0, 4, 0));
    const wav = atob(pcmBase64ToWavBase64(pcm, 'audio/L16;codec=pcm;rate=24000'));
    expect(wav.slice(0, 4)).toBe('RIFF');
    expect(wav.slice(8, 12)).toBe('WAVE');
    expect(wav.length).toBe(44 + 8);
    const view = new DataView(Uint8Array.from(wav, (c) => c.charCodeAt(0)).buffer);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
  });

  it('não mexe num ficheiro que já é WAV', () => {
    const already = btoa('RIFF' + '\0'.repeat(40));
    expect(pcmBase64ToWavBase64(already, 'audio/wav')).toBe(already);
  });
});
