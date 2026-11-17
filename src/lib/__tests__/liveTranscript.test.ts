import { describe, expect, it } from 'vitest';
import { extractUniToolsFromText } from '../uniTools';
import { joinTranscriptFragment, visibleLiveText } from '../liveTranscript';

describe('transcrição da Voz Live', () => {
  it('junta os bocados de uma fala numa só frase', () => {
    let t = '';
    for (const f of ['Olha,', ' diz-me', 'qual tópico', ' queres rever', '?']) t = joinTranscriptFragment(t, f);
    expect(t).toBe('Olha, diz-me qual tópico queres rever?');
  });

  it('esconde a etiqueta de ferramenta e mantém o resto', () => {
    const raw =
      'Combinado, deixei a proposta no ecrã. <uni-tool>{"name":"focar_plano","args":{"courseId":"TEP","exclusive":true,"reason":"Foco total até ao teste"}}</uni-tool>';
    expect(visibleLiveText(raw)).toBe('Combinado, deixei a proposta no ecrã.');
    expect(visibleLiveText('Vou preparar <uni-tool>{"name":"foc')).toBe('Vou preparar');
    const { calls } = extractUniToolsFromText(raw);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('focar_plano');
  });
});
