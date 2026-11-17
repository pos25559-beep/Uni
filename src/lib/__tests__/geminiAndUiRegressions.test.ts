import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../../components/assistant/Markdown';
import { formatAssessmentCalendarTitle } from '../../components/calendar/items';
import {
  CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS,
  CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS,
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  LEGACY_REMOVED_MODELS,
  THINKING_BALANCED,
  THINKING_DEEP,
  THINKING_FAST,
  resolveChatThinkingConfig,
  sanitizeGenerationConfigForModel,
} from '../../integrations/gemini/models';
import {
  ACADEMIC_HISTORY_SCHEMA,
  NOTEBOOK_MEMORY_DELTA_SCHEMA,
  PRACTICE_SET_SCHEMA,
  RECALL_CHALLENGE_SCHEMA,
  TIMETABLE_EXTRACTION_SCHEMA,
  TOPIC_SHEET_SCHEMA,
  UNI_EXPEDITION_SCHEMA,
  UNI_RECALL_EVAL_SCHEMA,
  UNI_RECALL_PROMPT_SCHEMA,
} from '../../integrations/gemini/schemas';
import { looksSyncableReply } from '../visionParsers';

describe('gemini.models e schemas estritos', () => {
  it('usa gemini-4-hydrogen por omissão, fallback 3.1-flash-lite e remove modelos obsoletos', () => {
    expect(DEFAULT_MODEL).toBe('gemini-4-hydrogen');
    expect(FALLBACK_MODELS).toContain('gemini-3.1-flash-lite');
    expect(LEGACY_REMOVED_MODELS.has('gemini-3.8-flash')).toBe(true);
    expect(LEGACY_REMOVED_MODELS.has('gemini-3.5-flash-lite')).toBe(true);
    expect(THINKING_FAST.thinkingLevel).toBe('LOW');
    expect(THINKING_BALANCED.thinkingLevel).toBe('MEDIUM');
    expect(THINKING_DEEP.thinkingLevel).toBe('HIGH');
    expect(resolveChatThinkingConfig('gemini-4-hydrogen')).toEqual(THINKING_BALANCED);
    expect(resolveChatThinkingConfig('gemini-4-argon')).toEqual(THINKING_DEEP);
  });

  it('sanitiza generationConfig por série do modelo (remove temperature em gemini-4 e thinkingConfig fora da série 4)', () => {
    const g4 = sanitizeGenerationConfigForModel('gemini-4-hydrogen', {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
      thinkingConfig: THINKING_BALANCED,
    });
    expect(g4?.temperature).toBeUndefined();
    expect(g4?.topP).toBeUndefined();
    expect(g4?.topK).toBeUndefined();
    expect(g4?.thinkingConfig).toEqual(THINKING_BALANCED);
    expect(g4?.maxOutputTokens).toBeGreaterThanOrEqual(32768);

    const g3 = sanitizeGenerationConfigForModel('gemini-3.1-flash-lite', {
      temperature: 0.2,
      thinkingConfig: THINKING_DEEP,
    });
    expect(g3?.thinkingConfig).toBeUndefined();
    expect(g3?.temperature).toBe(0.2);
  });

  it('expõe todos os responseSchema estritos esperados', () => {
    const schemas = [
      ACADEMIC_HISTORY_SCHEMA,
      TIMETABLE_EXTRACTION_SCHEMA,
      PRACTICE_SET_SCHEMA,
      RECALL_CHALLENGE_SCHEMA,
      TOPIC_SHEET_SCHEMA,
      UNI_RECALL_PROMPT_SCHEMA,
      UNI_RECALL_EVAL_SCHEMA,
      UNI_EXPEDITION_SCHEMA,
      NOTEBOOK_MEMORY_DELTA_SCHEMA,
    ];
    for (const schema of schemas) {
      expect(schema).toBeTruthy();
      expect(schema.type).toBeDefined();
    }
  });
});

describe('Markdown LaTeX e proteção de preços', () => {
  it('renderiza equações numéricas inline via KaTeX e mantém preços em texto simples', () => {
    const mathHtml = renderToStaticMarkup(createElement(Markdown, { text: '- $14400 + 4800 = 19200$' }));
    expect(mathHtml).toContain('class="katex"');

    const unitMathHtml = renderToStaticMarkup(createElement(Markdown, { text: 'Valor: $5 \\text{ MPa}$' }));
    expect(unitMathHtml).toContain('class="katex"');

    const priceHtml = renderToStaticMarkup(createElement(Markdown, { text: 'Custa $20 no total. Entre $20 e $30.' }));
    expect(priceHtml).not.toContain('class="katex"');
    expect(priceHtml).toContain('$20');
  });

  it('não deixa cifrões ($$ ou $) visíveis em blocos após texto, decimais com vírgula ou negrito', () => {
    const tightBlock = renderToStaticMarkup(
      createElement(Markdown, {
        text: [
          'Fazendo a multiplicação em cruz:',
          '$$\\frac{0,2623}{2\\sigma_x - \\sigma_y} = \\frac{0,0953}{2\\sigma_y - \\sigma_x}$$',
          '$$0,2623 \\cdot (2\\sigma_y - \\sigma_x) = 0,0953 \\cdot (2\\sigma_x - \\sigma_y)$$',
        ].join('\n'),
      }),
    );
    expect(tightBlock).toContain('class="katex"');
    expect(tightBlock).not.toContain('$');

    const boldMath = renderToStaticMarkup(
      createElement(Markdown, { text: '1. **Resolve para a relação entre $\\sigma_x$ e $\\sigma_y$:**' }),
    );
    expect(boldMath).toContain('<strong');
    expect(boldMath).toContain('class="katex"');
    expect(boldMath).not.toContain('$');

    const listBlockMath = renderToStaticMarkup(
      createElement(Markdown, { text: '- Fórmula principal: $$\\sigma_x \\approx 1,3688 \\cdot \\sigma_y$$' }),
    );
    expect(listBlockMath).toContain('class="katex"');
    expect(listBlockMath).not.toContain('$');

    const trailingPunctBlock = renderToStaticMarkup(
      createElement(Markdown, {
        text: ['$$\\sigma_x = 1,3688 \\cdot \\sigma_y$$.', 'Alínea b) seguinte.'].join('\n'),
      }),
    );
    expect(trailingPunctBlock).toContain('class="katex"');
    expect(trailingPunctBlock).toContain('Alínea b) seguinte.');
    expect(trailingPunctBlock).not.toContain('$');
  });

  it('mantém janelas de timeout alargadas para chats com anexos', () => {
    expect(CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS).toBeGreaterThanOrEqual(45_000);
    expect(CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });
});

describe('visionParsers.looksSyncableReply', () => {
  it('não dispara falso positivo em resoluções de exercícios que só mencionam dia da semana', () => {
    expect(
      looksSyncableReply('Como σ_v = 153.3 MPa, queres treinar Tresca para o teste de quinta?'),
    ).toBe(false);
    expect(looksSyncableReply('O teu 1.º teste de TEP é em 20/11 às 09:00 na sala 1.2.')).toBe(true);
    expect(looksSyncableReply('Aula TP de TEP às 14:30 às terças na sala A2.1')).toBe(true);
  });

  it('não oferece guardar datas por uma data citada num guia ou num quiz', () => {
    expect(
      looksSyncableReply(
        'Objetivo: este guia prepara-te para o teste de 20 de novembro de 2026 (30% da nota).\n1. O que é um campo cinematicamente admissível?',
      ),
    ).toBe(false);
    expect(
      looksSyncableReply('- [ ] 2026-11-18: revisão do teste de 2010 (150 min)\n- [ ] 2026-11-19: exame de 2011 (180 min)'),
    ).toBe(false);
    expect(looksSyncableReply('1.º Teste de TEP: 20/11\n2.º Teste de TEP: 18/12')).toBe(true);
  });
});

describe('calendar.formatAssessmentCalendarTitle', () => {
  it('evita títulos duplicados como Teste — Teste', () => {
    expect(formatAssessmentCalendarTitle('teste', 'Teste')).toBe('Teste');
    expect(formatAssessmentCalendarTitle('teste', 'teste')).toBe('teste');
    expect(formatAssessmentCalendarTitle('teste', '1.º Teste')).toBe('Teste — 1.º Teste');
  });
});
