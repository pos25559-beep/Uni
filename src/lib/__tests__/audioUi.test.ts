import { describe, expect, it } from 'vitest';
import {
  appendTranscript,
  formatElapsed,
  studyGuideSpeechMarkdown,
  studyGuideTopicSpeechMarkdown,
} from '../../components/audio/speechText';
import type { StudyGuide, StudyGuideTopic } from '../studyGuide';
import { markdownLatexToSpeechText } from '../uniVoice';

const labels = { keyIdeas: 'Ideias-chave', formulas: 'Fórmulas', workedExample: 'Exemplo resolvido', pitfalls: 'Armadilhas' };

const topic: StudyGuideTopic = {
  title: 'Energia cinética',
  summary: 'A energia do movimento.',
  keyIdeas: ['Depende da massa', 'Depende da velocidade'],
  formulas: [],
  formulaDetails: [{ latex: 'E_c = \\frac{1}{2} m v^2', meaning: 'Energia cinética' }],
  workedExample: { statement: 'Um carro de 1000 kg a 20 m/s.', steps: ['Substituir valores'], result: '200 kJ' },
  pitfalls: ['Esquecer o quadrado'],
  practice: [{ question: 'Pergunta de treino?', answer: 'Resposta' }],
  sources: [{ title: 'Fonte X', page: '3' }],
};

describe('formatElapsed', () => {
  it('formata minutos e segundos', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7.9)).toBe('0:07');
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(-3)).toBe('0:00');
    expect(formatElapsed(Number.NaN)).toBe('0:00');
  });
});

describe('appendTranscript', () => {
  it('não apaga o que já estava escrito', () => {
    expect(appendTranscript('Olá  ', ' o que é entropia? ')).toBe('Olá o que é entropia?');
  });
  it('usa só a transcrição quando o campo está vazio', () => {
    expect(appendTranscript('', 'texto')).toBe('texto');
  });
  it('ignora transcrições vazias', () => {
    expect(appendTranscript('abc', '   ')).toBe('abc');
  });
});

describe('texto falado dos guias', () => {
  it('um tópico inclui o essencial e deixa fontes e treino de fora', () => {
    const md = studyGuideTopicSpeechMarkdown(topic, labels);
    expect(md).toContain('## Energia cinética');
    expect(md).toContain('- Depende da massa');
    expect(md).toContain('Exemplo resolvido');
    expect(md).toContain('200 kJ');
    expect(md).toContain('Esquecer o quadrado');
    expect(md).not.toContain('Fonte X');
    expect(md).not.toContain('Pergunta de treino');
  });

  it('fórmulas antigas sem cifrão ganham delimitadores para serem lidas como matemática', () => {
    const md = studyGuideTopicSpeechMarkdown({ ...topic, formulaDetails: undefined, formulas: ['F = m a'] }, labels);
    expect(md).toContain('$F = m a$');
  });

  it('o guia inteiro começa pelo título e objetivo e passa pelo conversor de fala sem sintaxe Markdown', () => {
    const guide: StudyGuide = { title: 'Guia de Física', goal: 'Preparar o teste', topics: [topic], examTraps: [], revisionPlan: [], selfCheck: [] };
    const md = studyGuideSpeechMarkdown(guide, labels);
    expect(md.startsWith('# Guia de Física')).toBe(true);
    const spoken = markdownLatexToSpeechText(md, 'pt-PT');
    expect(spoken).not.toMatch(/[#*$\\]/);
    expect(spoken).toContain('Preparar o teste');
  });
});
