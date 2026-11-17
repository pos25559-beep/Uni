import { describe, expect, it } from 'vitest';
import { citedSources, groupSources, matchesSourceQuery } from '../tutorSources';

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
