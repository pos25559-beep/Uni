import { describe, expect, it } from 'vitest';
import { normalizeLatexFormula, normalizePlainMathText } from '../plainMath';

describe('matemática em texto simples', () => {
  it('converte símbolos gregos e raízes no texto corrido', () => {
    expect(normalizePlainMathText('tau = sigma_y / sqrt(3)')).toBe('$\\tau$ = $\\sigma_{y}$ / $\\sqrt{3}$');
    expect(normalizePlainMathText('Se sigma1 = 300 MPa')).toBe('Se $\\sigma_{1}$ = 300 MPa');
    expect(normalizePlainMathText('onde σ_x é a tensão normal')).toBe('onde $\\sigma_{x}$ é a tensão normal');
  });

  it('não mexe no que já está em LaTeX nem em palavras normais', () => {
    expect(normalizePlainMathText('já $\\sigma_y$ certo')).toBe('já $\\sigma_y$ certo');
    expect(normalizePlainMathText('A tensão de cedência é 250 MPa.')).toBe('A tensão de cedência é 250 MPa.');
    expect(normalizePlainMathText('mutação e etapa')).toBe('mutação e etapa');
  });

  it('repara fórmulas escritas em texto', () => {
    const f = normalizeLatexFormula('W_ext = W_int = integral(sigma_y * d_epsilon_p) dV');
    expect(f).toContain('\\int(');
    expect(f).toContain('\\sigma_{y}');
    expect(f).toContain('d\\varepsilon_{p}');
    expect(f).toContain('W_{\\text{ext}}');
    expect(f).not.toContain('integral');
  });

  it('deixa LaTeX correto como está', () => {
    const ok = '\\tau_{max} = \\frac{\\sigma_1 - \\sigma_3}{2}';
    expect(normalizeLatexFormula(ok)).toBe(ok);
    expect(normalizeLatexFormula('$$x^2$$')).toBe('x^2');
  });
});
