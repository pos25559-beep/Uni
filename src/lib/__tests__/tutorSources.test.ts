import { describe, expect, it } from 'vitest';
import {
  citedSources,
  findAssessmentCandidates,
  findTargetAssessmentDocument,
  focusMaterialsOnTarget,
  groupSources,
  matchesSourceQuery,
  prioritizeMaterialsForQuery,
} from '../tutorSources';

const TITLES = [
  'Aula T05 Aspetos Fenomenológicos de Plasticidade Pt+Ing',
  'Aula T03b Revisão Critérios de Plasticidade (Von Mises e Mohr) Pt+Ing',
  'Aula T08 Método do Limite Superior',
  '1º Teste TMIII 2009 2010 (1)',
  '2º Exame TMIII 2011 2012',
  'Exame Recurso 2019 20 Resolucao',
  'T1 2021 Resolucao',
  'Problemas Aulas Práticas PT',
  'IMG 2940',
];

describe('groupSources', () => {
  const m = (title: string, mimeType?: string) => ({ title, mimeType });
  it('agrupa por tipo e omite grupos vazios', () => {
    const groups = groupSources(TITLES.map((t) => m(t)));
    const by = Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.title)]));
    expect(by.lessons).toEqual([TITLES[0], TITLES[1], TITLES[2]]);
    expect(by.tests).toEqual([TITLES[3], TITLES[4], TITLES[5], TITLES[6]]);
    expect(by.problems).toEqual(['Problemas Aulas Práticas PT']);
    expect(by.images).toEqual(['IMG 2940']);
    expect(by.other).toBeUndefined();
  });
  it('usa o tipo MIME e ignora acentos', () => {
    expect(groupSources([m('Digitalização', 'image/jpeg')])[0].key).toBe('images');
    expect(groupSources([m('Frequência 2018')])[0].key).toBe('tests');
    expect(groupSources([m('Resumo geral')])[0].key).toBe('other');
  });
});

describe('citedSources', () => {
  it('reconhece [Fonte: título completo ou prefixo]', () => {
    const text = 'O método usa um limite superior [Fonte: Aula T08 Método do Limite Superior].';
    expect(citedSources(text, TITLES)).toEqual(['Aula T08 Método do Limite Superior']);
  });
  it('reconhece várias fontes separadas por vírgula e ignora acentos e maiúsculas', () => {
    const text = 'Ver [Fonte: exame recurso 2019 20 resolução, T1 2021 Resolucao] para o passo final.';
    expect(citedSources(text, TITLES)).toEqual(['Exame Recurso 2019 20 Resolucao', 'T1 2021 Resolucao']);
  });
  it('reconhece citações entre parênteses por prefixo distintivo', () => {
    const text = 'A superfície de cedência (Aula T05) segue Tresca. Antes (Aula T03b) vimos Von Mises.';
    expect(citedSources(text, TITLES)).toEqual([TITLES[0], TITLES[1]]);
  });
  it('mantém a ordem da primeira menção e não repete', () => {
    const text = '(T1 2021) e depois [Fonte: Aula T08] e outra vez (T1 2021).';
    expect(citedSources(text, TITLES)).toEqual(['T1 2021 Resolucao', 'Aula T08 Método do Limite Superior']);
  });
  it('não confunde T03 com T03b nem dá falsos positivos', () => {
    expect(citedSources('(Aula T03)', TITLES)).toEqual([]);
    expect(citedSources('Texto sem citações, fala de Aula T08.', TITLES)).toEqual([]);
    expect(citedSources('[Fonte: Aula T99]', TITLES)).toEqual([]);
  });
  it('lida com títulos repetidos e extensões', () => {
    expect(citedSources('[Fonte: IMG 2940]', ['IMG 2940.jpg', 'IMG 2940.jpg'])).toEqual(['IMG 2940.jpg']);
  });
});

describe('matchesSourceQuery', () => {
  it('ignora acentos', () => {
    expect(matchesSourceQuery('Aula T08 Método', 'metodo')).toBe(true);
    expect(matchesSourceQuery('Aula T08 Método', 'exame')).toBe(false);
    expect(matchesSourceQuery('Qualquer', '  ')).toBe(true);
  });
});

describe('prioritizeMaterialsForQuery', () => {
  const mats = TITLES.map((title) => ({ title }));

  it('coloca o teste/ano mencionado na conversa no topo mesmo quando o pedido diz apenas "grupo 3 deste teste"', () => {
    const ranked = prioritizeMaterialsForQuery(
      mats,
      'vamos para o grupo 3 deste teste',
      'Estamos a resolver o 1º Teste TMIII 2009 2010',
    );
    expect(ranked[0]?.title).toBe('1º Teste TMIII 2009 2010 (1)');
    expect(ranked.slice(0, 4).every((m) => groupSources([m])[0].key === 'tests')).toBe(true);
  });

  it('prioriza aulas e apontamentos quando a pergunta pede matéria teórica', () => {
    const ranked = prioritizeMaterialsForQuery(mats, 'explica a aula T08 do limite superior');
    expect(ranked[0]?.title).toBe('Aula T08 Método do Limite Superior');
  });
});

describe('escolha das fontes para perguntas sobre testes antigos', () => {
  const titles = [
    'Aula T05   Aspetos Fenomenológicos de Plasticidade  Pt+Ing',
    '1º Teste TMIII 2009 2010 (1)',
    '1º Teste TMIII 2009 2010',
    '2º Exame TMIII 2009 2010',
    '1º Exame TMIII 2009 2010',
    'Problemas Aulas Práticas PT',
    '2º Exame TMIII 2011 2012',
    '1º Exame TMIII 2010',
    'IMG 2913',
    '2º Teste TMIII 2009 2010',
  ].map((title) => ({ title }));

  it('põe o 2.º teste de 2009-10 em primeiro quando o estudante diz «2 teste de 2009-10»', () => {
    const ranked = prioritizeMaterialsForQuery(titles, 'No 2 teste de 2009-10 a unica questão que cai é a c do grupo 1');
    expect(ranked[0].title).toBe('2º Teste TMIII 2009 2010');
    expect(ranked.slice(0, 3).map((m) => m.title)).not.toContain('Aula T05   Aspetos Fenomenológicos de Plasticidade  Pt+Ing');
  });

  it('reconhece «segundo teste», «2.º teste» e «teste 2»', () => {
    for (const q of ['segundo teste de 2009/2010', '2.º teste 09/10', 'o teste 2 de 2009']) {
      expect(prioritizeMaterialsForQuery(titles, q)[0].title).toBe('2º Teste TMIII 2009 2010');
    }
  });

  it('o nome exato do ficheiro ganha sempre', () => {
    expect(prioritizeMaterialsForQuery(titles, 'Mas tu tens sim, está no 2º Teste TMIII 2009 2010')[0].title).toBe(
      '2º Teste TMIII 2009 2010',
    );
  });
});

describe('documento-alvo de uma pergunta sobre um teste', () => {
  const titles = [
    'Aula T03a Revisão Critérios de Plasticidade (TRESCA) Pt+Ing',
    '1º Teste TMIII 2009 2010 (1)',
    '1º Teste TMIII 2009 2010',
    '2º Exame TMIII 2009 2010',
    '1º Exame TMIII 2009 2010',
    '2º Exame TMIII 2011 2012',
    'Problemas Aulas Práticas PT',
    '2º Teste TMIII 2009 2010',
  ].map((title) => ({ title }));

  it('encontra o teste pedido e tira os outros testes e exames', () => {
    const target = findTargetAssessmentDocument(titles, 'eu estava a me referir a c do grupo 1 do teste 2 de 2009-2010.');
    expect(target?.title).toBe('2º Teste TMIII 2009 2010');
    const focused = focusMaterialsOnTarget(titles, target!).map((m) => m.title);
    expect(focused[0]).toBe('2º Teste TMIII 2009 2010');
    expect(focused).not.toContain('2º Exame TMIII 2009 2010');
    expect(focused).toContain('Aula T03a Revisão Critérios de Plasticidade (TRESCA) Pt+Ing');
    expect(focused).toContain('Problemas Aulas Práticas PT');
  });

  it('não escolhe nada quando a pergunta é ambígua', () => {
    expect(findTargetAssessmentDocument(titles, 'explica o critério de Tresca')).toBeNull();
    expect(findTargetAssessmentDocument(titles, 'o teste de 2009-2010')).toBeNull();
    // Os dois ficheiros do 1.º teste são o mesmo documento duplicado.
    expect(findTargetAssessmentDocument(titles, '1.º teste de 2009/10')?.title).toBe('1º Teste TMIII 2009 2010 (1)');
  });

  it('lista os candidatos quando a pergunta é ambígua, para o Uni perguntar', () => {
    const c = findAssessmentCandidates(titles, 'resolve o grupo 2 do teste de 2009-2010').map((m) => m.title);
    expect(c).toEqual(['1º Teste TMIII 2009 2010 (1)', '2º Teste TMIII 2009 2010']);
    expect(findAssessmentCandidates(titles, 'explica Tresca')).toEqual([]);
  });
});
