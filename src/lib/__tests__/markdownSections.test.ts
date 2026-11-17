import { describe, expect, it } from 'vitest';
import {
  isAnswersHeading,
  markdownHeadings,
  markdownTitle,
  splitAnswerItems,
  splitMarkdownSections,
} from '../markdownSections';

const MD = [
  '# Quiz de Física',
  '',
  'Intro com texto.',
  '',
  '## Perguntas',
  '1. O que é a **inércia**?',
  '2. Define $F = ma$.',
  '',
  '```python',
  '## isto não é título',
  '```',
  '',
  '### Nota **extra**',
  'Texto.',
  '',
  '## Respostas',
  '1. Resistência à mudança [Fonte 1].',
  '2. A força resultante é a massa vezes a aceleração.',
].join('\n');

describe('markdownHeadings', () => {
  it('devolve ## e ### fora de código, com ids únicos', () => {
    const h = markdownHeadings(MD);
    expect(h.map((x) => [x.level, x.text])).toEqual([
      [2, 'Perguntas'],
      [3, 'Nota extra'],
      [2, 'Respostas'],
    ]);
    expect(new Set(h.map((x) => x.id)).size).toBe(3);
    expect(h[0].id).toBe('mr-0-perguntas');
  });
  it('lida com vazio e sem títulos', () => {
    expect(markdownHeadings('')).toEqual([]);
    expect(markdownHeadings('só texto')).toEqual([]);
  });
  it('títulos repetidos têm ids diferentes', () => {
    const h = markdownHeadings('## A\n## A');
    expect(h[0].id).not.toBe(h[1].id);
  });
});

describe('splitMarkdownSections', () => {
  it('separa preâmbulo e secções e ignora o título de nível 1', () => {
    const s = splitMarkdownSections(MD);
    expect(markdownTitle(MD)).toBe('Quiz de Física');
    expect(s[0].heading).toBeNull();
    expect(s[0].body).toBe('Intro com texto.');
    expect(s.map((x) => x.heading?.text)).toEqual([undefined, 'Perguntas', 'Nota extra', 'Respostas']);
    expect(s[1].body).toContain('## isto não é título');
    expect(s[3].heading?.id).toBe(markdownHeadings(MD)[2].id);
  });
});

describe('respostas do quiz', () => {
  it('reconhece o título da secção', () => {
    expect(isAnswersHeading('Respostas')).toBe(true);
    expect(isAnswersHeading('Answers and explanations')).toBe(true);
    expect(isAnswersHeading('Perguntas')).toBe(false);
  });
  it('divide itens numerados e junta linhas de continuação', () => {
    const items = splitAnswerItems('1. Primeira\n   continua\n\n2. **Segunda**\n3) Terceira');
    expect(items?.map((i) => i.n)).toEqual([1, 2, 3]);
    expect(items?.[0].text).toBe('Primeira\n   continua');
  });
  it('aceita **1.** em negrito', () => {
    expect(splitAnswerItems('**1.** a\n**2.** b')?.length).toBe(2);
  });
  it('devolve null quando a estrutura é incerta', () => {
    expect(splitAnswerItems('Só um parágrafo')).toBeNull();
    expect(splitAnswerItems('1. só um')).toBeNull();
    expect(splitAnswerItems('Texto solto\n1. a\n2. b')).toBeNull();
    expect(splitAnswerItems('1. a\n3. b')).toBeNull();
  });
});
