import { describe, expect, it } from 'vitest';
import { STUDY_GUIDE_SCHEMA } from '../../integrations/gemini/schemas';
import {
  asDisplayMath,
  formatSourceChip,
  parseStudyGuide,
  parseStudyGuideTopic,
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

describe('secção aprofundada de um tópico', () => {
  const raw = JSON.stringify({
    title: 'Critérios de plasticidade',
    summary: 'Tresca e Von Mises dizem quando o material começa a ceder.',
    keyIdeas: ['Tresca usa a tensão de corte máxima.'],
    formulaDetails: [
      { latex: '\\sigma_{eq} = \\sqrt{\\sigma_x^2 - \\sigma_x\\sigma_y + \\sigma_y^2 + 3\\tau_{xy}^2}', meaning: 'Tensão equivalente de Von Mises em estado plano.', units: 'MPa', validity: 'Estado plano de tensão, material isotrópico.' },
      { latex: '', meaning: 'sem fórmula' },
    ],
    workedExample: {
      statement: '$\\sigma_x = 120$ MPa, $\\sigma_y = -40$ MPa, $\\tau_{xy} = 30$ MPa; cede?',
      steps: ['$\\sigma_{eq}^2 = 14400 + 4800 + 1600 + 2700 = 23500$', '$\\sigma_{eq} \\approx 153{,}3$ MPa'],
      result: 'Não cede: 153,3 MPa < 250 MPa.',
      source: { title: 'T1 2021 Resolução', page: '2' },
    },
    examPattern: 'Pergunta 1 dos testes: verificar cedência num ponto.',
    pitfalls: ['Esquecer o termo $3\\tau_{xy}^2$.'],
    practice: [{ question: 'E com $\\tau_{xy}=100$ MPa?', answer: '$\\approx 222$ MPa, não cede.' }],
    sources: [{ title: 'Aula T03b', page: '14' }],
  });

  it('lê fórmulas explicadas, exemplo resolvido e prática, e ignora fórmulas vazias', () => {
    const topic = parseStudyGuideTopic(raw);
    expect(topic?.formulaDetails).toHaveLength(1);
    expect(topic?.formulaDetails?.[0].units).toBe('MPa');
    expect(topic?.workedExample?.steps).toHaveLength(2);
    expect(topic?.workedExample?.source?.page).toBe('2');
    expect(topic?.practice).toHaveLength(1);
  });

  it('leva os campos novos para o Markdown com a página das fontes', () => {
    const topic = parseStudyGuideTopic(raw)!;
    const md = studyGuideToMarkdown(
      { title: 'TEP', goal: 'Teste a 20/11', topics: [topic], examTraps: [], revisionPlan: [], selfCheck: [] },
      {
        goal: 'Objetivo', keyIdeas: 'Ideias-chave', formulas: 'Fórmulas', pitfalls: 'Armadilhas', sources: 'Fontes',
        examTraps: 'Armadilhas de teste', revisionPlan: 'Plano', selfCheck: 'Testa-te', answer: 'Resposta',
        units: 'Unidades', validity: 'Quando se aplica', workedExample: 'Exemplo resolvido',
        examPattern: 'Como sai', practice: 'Treina', minutes: (n) => `${n} min`, page: (p) => `p. ${p}`,
      },
    );
    expect(md).toContain('$$\\sigma_{eq} = \\sqrt{');
    expect(md).toContain('Unidades: MPa');
    expect(md).toContain('1. $\\sigma_{eq}^2');
    expect(md).toContain('T1 2021 Resolução · p. 2');
    expect(md).toContain('Aula T03b · p. 14');
    expect(md).not.toContain('sem fórmula');
  });

  it('devolve null para uma secção inválida', () => {
    expect(parseStudyGuideTopic('não é json')).toBeNull();
    expect(parseStudyGuideTopic('{"summary":"sem título"}')).toBeNull();
  });
});
