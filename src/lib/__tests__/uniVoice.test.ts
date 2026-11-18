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

  describe('parsePodcastScript · atribuição de vozes', () => {
    const scriptWith = (speakers: string[]) =>
      JSON.stringify({
        title: 'Teste',
        lines: speakers.map((speaker, i) => ({ speaker, text: `Fala ${i + 1}` })),
      });

    it('anfitrião «Alex» e colega «Marco»: cada fala vai para a voz certa', () => {
      const script = parsePodcastScript(
        scriptWith(['Alex', 'Marco', ' alex ', 'MARCO']),
        'Alex',
        'Marco',
      );
      expect(script?.lines.map((l) => l.speaker)).toEqual(['Alex', 'Marco', 'Alex', 'Marco']);
    });

    it('anfitrião «Marco» e colega «Alex»: as duas vozes são usadas corretamente', () => {
      const script = parsePodcastScript(
        scriptWith(['Marco', 'Alex', 'Marco', 'Alex']),
        'Marco',
        'Alex',
      );
      expect(script?.lines.map((l) => l.speaker)).toEqual(['Marco', 'Alex', 'Marco', 'Alex']);
    });

    it('anfitrião «Coral» com colega «Alex»: nenhuma fala cai toda numa só voz', () => {
      const script = parsePodcastScript(
        scriptWith(['Coral', 'Alex', 'Coral', 'Alex']),
        'Coral',
        'Alex',
      );
      const speakers = script?.lines.map((l) => l.speaker) ?? [];
      expect(speakers).toEqual(['Coral', 'Alex', 'Coral', 'Alex']);
      expect(new Set(speakers).size).toBe(2);
    });

    it('nomes não reconhecidos alternam pela ordem da primeira aparição', () => {
      const script = parsePodcastScript(
        scriptWith(['Professora', 'Aluno', 'Professora', 'Outro', 'Aluno']),
        'Coral',
        'Alex',
      );
      expect(script?.lines.map((l) => l.speaker)).toEqual([
        'Coral',
        'Alex',
        'Coral',
        'Coral',
        'Alex',
      ]);
    });

    it('um nome que contém «co» ou «alex» não é confundido com o colega', () => {
      const script = parsePodcastScript(
        scriptWith(['Coral', 'Cosmo', 'Alexandre']),
        'Coral',
        'Alex',
      );
      // «Cosmo» e «Alexandre» são desconhecidos: primeira aparição → anfitrião, depois colega
      expect(script?.lines.map((l) => l.speaker)).toEqual(['Coral', 'Coral', 'Alex']);
    });
  });
});
