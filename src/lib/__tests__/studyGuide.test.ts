import { describe, expect, it } from 'vitest';
import { STUDY_GUIDE_SCHEMA } from '../../integrations/gemini/schemas';
import {
  asDisplayMath,
  formatSourceChip,
  parseStudyGuide,
  studyGuideToMarkdown,
  type StudyGuideLabels,
} from '../studyGuide';

const labels: StudyGuideLabels = {
  goal: 'Objetivo',
  keyIdeas: 'Ideias-chave',
  formulas: 'Fórmulas',
  pitfalls: 'Armadilhas',
  sources: 'Fontes',
  examTraps: 'Armadilhas de teste',
  revisionPlan: 'Plano de revisão',
  selfCheck: 'Testa-te',
  answer: 'Resposta',
  minutes: (n) => `${n} min`,
  page: (p) => `p. ${p}`,
};

const sample = {
  title: 'Guia do 1.º Teste de TEP',
  goal: '1.º Teste, 25 nov, cobre os capítulos 1 a 3.',
  topics: [
    {
      title: 'Balanços de massa',
      keyIdeas: ['Entrada menos saída igual a acumulação.'],
      formulas: ['\\dot m_{in} - \\dot m_{out} = \\frac{dm}{dt}'],
      pitfalls: ['Esquecer as unidades.'],
      sources: [{ title: 'Aula T08', page: '12' }, { title: 'Folha 2' }],
    },
  ],
  examTraps: ['Ler mal o enunciado.'],
  revisionPlan: [{ day: '2026-11-20', task: 'Resolver exames anteriores', minutes: 45 }],
  selfCheck: [{ question: 'O que é regime estacionário?', answer: 'Sem acumulação.' }],
};

describe('studyGuide', () => {
  it('schema exige os campos principais', () => {
    expect(STUDY_GUIDE_SCHEMA.required).toEqual(
      expect.arrayContaining(['title', 'goal', 'topics', 'examTraps', 'revisionPlan', 'selfCheck']),
    );
  });

  it('converte para Markdown com tópicos, fontes com página e plano', () => {
    const guide = parseStudyGuide(JSON.stringify(sample));
    expect(guide).not.toBeNull();
    const md = studyGuideToMarkdown(guide!, labels);
    expect(md).toContain('# Guia do 1.º Teste de TEP');
    expect(md).toContain('## Balanços de massa');
    expect(md).toContain('Aula T08 · p. 12');
    expect(md).toContain('Folha 2');
    expect(md).toContain('$$\\dot m_{in}');
    expect(md).toContain('- [ ] 2026-11-20: Resolver exames anteriores (45 min)');
    expect(md).toContain('Resposta: Sem acumulação.');
  });

  it('ignora cercas de código e texto à volta do JSON', () => {
    const wrapped = '```json\n' + JSON.stringify(sample) + '\n```\n';
    expect(parseStudyGuide(wrapped)?.topics).toHaveLength(1);
    expect(parseStudyGuide('Aqui está: ' + JSON.stringify(sample))?.title).toBe(sample.title);
  });

  it('devolve null com JSON inválido, vazio ou sem tópicos', () => {
    expect(parseStudyGuide('isto não é json')).toBeNull();
    expect(parseStudyGuide('{"title":"x"')).toBeNull();
    expect(parseStudyGuide('')).toBeNull();
    expect(parseStudyGuide(null)).toBeNull();
    expect(parseStudyGuide('{"title":"x","topics":[]}')).toBeNull();
  });

  it('descarta entradas malformadas sem rebentar', () => {
    const guide = parseStudyGuide(
      JSON.stringify({ topics: [null, { title: '' }, { title: 'A', sources: [{ page: '3' }, 5] }], revisionPlan: [{ task: 'x', minutes: 'abc' }] }),
    );
    expect(guide?.topics).toHaveLength(1);
    expect(guide?.topics[0]?.sources).toEqual([]);
    expect(guide?.revisionPlan[0]?.minutes).toBe(0);
  });

  it('formata chips e fórmulas', () => {
    expect(formatSourceChip({ title: 'Aula T08', page: '12' }, labels.page)).toBe('Aula T08 · p. 12');
    expect(formatSourceChip({ title: 'Folha' }, labels.page)).toBe('Folha');
    expect(asDisplayMath('x^2')).toBe('$$x^2$$');
    expect(asDisplayMath('$x$')).toBe('$x$');
  });
});
