import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSheetGuide,
  loadSheetGuide,
  parseStudyGuide,
  saveSheetGuide,
  splitCitations,
  topicCounts,
} from '../studyGuide';

const cites = (s: ReturnType<typeof splitCitations>) =>
  s.filter((x) => x.type === 'cite').map((x) => (x.type === 'cite' ? x.numbers : []));

describe('splitCitations', () => {
  it('separa texto e citações simples e múltiplas', () => {
    const seg = splitCitations('A tensão é máxima aqui [1]. Também ali [2, 3] e fim.', 3);
    expect(seg.map((s) => s.type)).toEqual(['text', 'cite', 'text', 'cite', 'text']);
    expect(cites(seg)).toEqual([[1], [2, 3]]);
    expect(seg.map((s) => (s.type === 'text' ? s.text : s.raw)).join('')).toBe(
      'A tensão é máxima aqui [1]. Também ali [2, 3] e fim.',
    );
  });

  it('ignora números fora de 1..n e deixa-os como texto', () => {
    const seg = splitCitations('Isto [4] e isto [0] e [1, 9].', 2);
    expect(cites(seg)).toEqual([[1]]);
    expect(seg[0]).toEqual({ type: 'text', text: 'Isto [4] e isto [0] e ' });
  });

  it('não toca em checkboxes, links nem LaTeX', () => {
    expect(splitCitations('- [ ] fazer', 3)).toEqual([{ type: 'text', text: '- [ ] fazer' }]);
    expect(splitCitations('ver [1](https://x.pt)', 3)).toHaveLength(1);
    expect(cites(splitCitations('$x_[1]$ e $$a_[2]$$ mas [3]', 3))).toEqual([[3]]);
    expect(cites(splitCitations('usa `v[1]` aqui', 3))).toEqual([]);
  });

  it('sem fontes não há citações', () => {
    expect(splitCitations('texto [1]', 0)).toEqual([{ type: 'text', text: 'texto [1]' }]);
    expect(splitCitations('', 2)).toEqual([]);
  });
});

describe('topicCounts', () => {
  it('conta fórmulas, exemplo e perguntas', () => {
    expect(
      topicCounts({
        title: 'T',
        keyIdeas: [],
        formulas: ['a', 'b'],
        pitfalls: [],
        sources: [],
        workedExample: { statement: 's', steps: ['1'], result: 'r' },
        practice: [{ question: 'q', answer: 'a' }],
      }),
    ).toEqual({ formulas: 2, example: 1, questions: 1 });
  });
});

describe('guia guardado ao lado da ficha', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  const guide = parseStudyGuide(
    JSON.stringify({
      title: 'Guia',
      goal: 'Teste 1',
      topics: [
        {
          title: 'Tresca',
          keyIdeas: ['sigma_y e tau_max [1]'],
          formulas: ['\\sigma_1-\\sigma_3 = \\sigma_y'],
          pitfalls: [],
          sources: [{ title: 'Aula T08', page: '12' }],
        },
      ],
    }),
  )!;

  it('guarda, lê e apaga', () => {
    saveSheetGuide('s1', guide);
    expect(loadSheetGuide('s1')).toEqual(guide);
    deleteSheetGuide('s1');
    expect(loadSheetGuide('s1')).toBeNull();
  });

  it('JSON estragado ou ausente dá null', () => {
    expect(loadSheetGuide('nada')).toBeNull();
    localStorage.setItem('unipedia.studyGuide.x', '{oops');
    expect(loadSheetGuide('x')).toBeNull();
  });
});
