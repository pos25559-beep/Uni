import { describe, expect, it } from 'vitest';
import {
  citedSources,
  findAssessmentCandidates,
  findTargetAssessmentDocument,
  findTargetAssessmentDocuments,
  ordinalAssessmentKeys,
  academicYearTokens,
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

describe('normalização de ordinais, tipos e anos letivos', () => {
  it('reconhece ordinais em vários formatos e listas', () => {
    const keys = (t: string) => [...ordinalAssessmentKeys(t)].sort();
    expect(keys('2º teste')).toEqual(['2:teste']);
    expect(keys('2.ª frequência')).toEqual(['2:frequencia']);
    expect(keys('segunda frequência')).toEqual(['2:frequencia']);
    expect(keys('Teste 2 2011-2012')).toEqual(['2:teste']);
    expect(keys('compara o 1º e o 2º teste')).toEqual(['1:teste', '2:teste']);
    expect(keys('os 1.º, 2.º e 3.º testes')).toEqual(['1:teste', '2:teste', '3:teste']);
    expect(keys('testes 1 e 2 de 2009')).toEqual(['1:teste', '2:teste']);
    expect(keys('T1 2021 Resolucao')).toEqual(['1:teste']);
    expect(keys('Aula T1')).toEqual([]);
    expect(keys('grupo 1 do teste')).toEqual([]);
  });
  it('equivale 2019/20, 2019/2020, 2019-2020 e 2019 2020', () => {
    for (const t of ['2019/20', '2019/2020', '2019-2020', '2019 2020', '19/20']) {
      expect(academicYearTokens(t).sort()).toEqual(['2019', '2020']);
    }
  });
});

describe('documento-alvo com ficheiros de estilos variados', () => {
  const titles = [
    'Teste 1 2011-2012.pdf',
    'Teste 2 2011-2012.pdf',
    'Exame 2011-2012.pdf',
    '2.ª Frequência 2018 2019.pdf',
    '1ª Frequência 2018 2019.pdf',
    'Exame Recurso 2019 20 Resolucao.pdf',
    'Exame Normal 2019-2020.pdf',
    '1º Teste TMIII 2009 2010',
    '2º Teste TMIII 2009 2010',
    '3º Teste TMIII 2009 2010',
    'T1 2021 Resolucao',
    'Aula T08 Método do Limite Superior',
  ].map((title) => ({ title }));
  const one = (q: string) => findTargetAssessmentDocuments(titles, q).map((m) => m.title);

  it.each([
    ['alínea c do teste 2 de 2011-2012', ['Teste 2 2011-2012.pdf']],
    ['grupo 1 do 1.º teste de 2011/12', ['Teste 1 2011-2012.pdf']],
    ['2.ª frequência de 2018/19', ['2.ª Frequência 2018 2019.pdf']],
    ['segunda frequência 2018-2019', ['2.ª Frequência 2018 2019.pdf']],
    ['exame de recurso 2019/20', ['Exame Recurso 2019 20 Resolucao.pdf']],
    ['recurso 2019-2020', ['Exame Recurso 2019 20 Resolucao.pdf']],
    ['exame de época normal 2019 2020', ['Exame Normal 2019-2020.pdf']],
    ['exame de 2011/2012', ['Exame 2011-2012.pdf']],
    ['T1 de 2021', ['T1 2021 Resolucao']],
  ])('%s', (q, expected) => {
    expect(one(q)).toEqual(expected);
  });

  it('o exame nunca é escolhido por uma pergunta sobre teste, e vice-versa', () => {
    expect(one('teste 2 de 2011-2012')).not.toContain('Exame 2011-2012.pdf');
    expect(one('exame de 2011-2012')).not.toContain('Teste 2 2011-2012.pdf');
  });

  it('compara vários: devolve todos os pedidos', () => {
    expect(one('compara o 1º e o 2º teste de 2009/10')).toEqual(['1º Teste TMIII 2009 2010', '2º Teste TMIII 2009 2010']);
    expect(one('testes 1 e 2 de 2011-2012')).toEqual(['Teste 1 2011-2012.pdf', 'Teste 2 2011-2012.pdf']);
    expect(one('os 1.º, 2.º e 3.º testes de 2009-2010')).toHaveLength(3);
    const focused = focusMaterialsOnTarget(titles, findTargetAssessmentDocuments(titles, 'compara o 1º e o 2º teste de 2009/10')).map((m) => m.title);
    expect(focused.slice(0, 2)).toEqual(['1º Teste TMIII 2009 2010', '2º Teste TMIII 2009 2010']);
    expect(focused).toContain('Aula T08 Método do Limite Superior');
    expect(focused).not.toContain('3º Teste TMIII 2009 2010');
  });

  it('se um dos pedidos não existe, mantém os encontrados', () => {
    expect(one('compara o 2º e o 4º teste de 2009/10')).toEqual(['2º Teste TMIII 2009 2010']);
  });

  it('ambíguo ou ano inexistente: sem alvo único', () => {
    expect(one('explica o teste de 2009-2010')).toEqual([]);
    expect(one('resolve o grupo 2 do teste')).toEqual([]);
    expect(one('teste 2 de 2015-2016')).toEqual([]);
    expect(one('exame de 2005')).toEqual([]);
    expect(findTargetAssessmentDocument(titles, 'o teste de 2009-2010')).toBeNull();
    expect(findAssessmentCandidates(titles, 'o teste de 2009-2010')).toHaveLength(3);
  });
});
