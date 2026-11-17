import { describe, expect, it } from 'vitest';
import {
  deleteSheetPodcast,
  loadSheetPodcast,
  markdownLatexToSpeechText,
  parsePodcastScript,
  pickCoHostVoice,
  podcastScriptToMarkdown,
  resolveAiExecutionTier,
  resolveUniVoiceConfig,
  saveSheetPodcast,
} from '../uniVoice';

describe('uniVoice helpers', () => {
  it('resolves execution tier cleanly for free native, custom AI Studio key, and future Play Store pro', () => {
    expect(resolveAiExecutionTier('')).toBe('free-native');
    expect(resolveAiExecutionTier('   ')).toBe('free-native');
    expect(resolveAiExecutionTier('AIza-test-key')).toBe('ai-studio-key');
    expect(resolveAiExecutionTier('', 'pro-session-token')).toBe('pro-server-future');
    expect(resolveAiExecutionTier('AIza-test-key', 'pro-session-token')).toBe('pro-server-future');
  });

  it('picks a distinct co-host voice and honors agent override before global voice', () => {
    const resolved = resolveUniVoiceConfig(
      { personaId: 'exigente', voiceConfig: { voiceName: 'Fenrir', stylePrompt: '  firme  ' } },
      { voiceName: 'Kore', stylePrompt: 'calmo' },
      'amigo',
    );
    expect(resolved.voiceName).toBe('Fenrir');
    expect(resolved.stylePrompt).toBe('firme');
    expect(resolved.coHostVoiceName).not.toBe('Fenrir');
    expect(pickCoHostVoice('Aoede', 'Aoede')).not.toBe('Aoede');
  });

  it('falls back cleanly to global voice and then persona default', () => {
    const fromGlobal = resolveUniVoiceConfig(null, { voiceName: 'Zephyr' }, 'amigo');
    expect(fromGlobal.voiceName).toBe('Zephyr');

    const fromPersona = resolveUniVoiceConfig(null, undefined, 'calmo');
    expect(fromPersona.voiceName).toBe('Kore');
  });

  it('normalizes Markdown, citations, and engineering LaTeX formulas into natural speech', () => {
    const raw = `## Critério de von Mises [1]
A tensão equivalente é $$\\sigma_{eq} = \\sqrt{\\sigma_1^2 - \\sigma_1\\sigma_2 + \\sigma_2^2}$$ e deve satisfazer $\\frac{\\sigma_{eq}}{\\sigma_y} \\leq 1$.
- Atenção a \`sigma_y\` em [Fonte: Sebenta T03].`;

    const spoken = markdownLatexToSpeechText(raw, 'pt-PT');
    expect(spoken).not.toContain('$$');
    expect(spoken).not.toContain('\\frac');
    expect(spoken).not.toContain('[1]');
    expect(spoken).not.toContain('[Fonte:');
    expect(spoken).toContain('sigma');
    expect(spoken).toContain('raiz de');
    expect(spoken).toContain('sobre');
    expect(spoken).toContain('menor ou igual a');
  });

  it('parses podcast JSON, formats markdown, and gracefully handles missing localStorage', () => {
    const rawJson = JSON.stringify({
      title: 'Revisão de Extrusão',
      lines: [
        { speaker: 'Uni', text: 'Olá! Vamos rever o método da fatia elementar.' },
        { speaker: 'Alex', text: 'Boa! Porque é que assumimos deformação uniforme?' },
      ],
    });
    const script = parsePodcastScript(rawJson, 'Uni', 'Alex');
    expect(script).not.toBeNull();
    expect(script?.lines).toHaveLength(2);
    expect(script?.lines[0]?.speaker).toBe('Uni');
    expect(script?.lines[1]?.speaker).toBe('Alex');

    if (script) {
      const md = podcastScriptToMarkdown(script);
      expect(md).toContain('# Revisão de Extrusão');
      expect(md).toContain('**Uni:**');
      saveSheetPodcast('test-sheet', script);
      // In Node test environment without localStorage, load/delete must not throw
      expect(() => loadSheetPodcast('test-sheet')).not.toThrow();
      expect(() => deleteSheetPodcast('test-sheet')).not.toThrow();
    }
  });
});
