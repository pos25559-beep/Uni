import type { CurriculumCourseTemplate } from './portugalCurriculum';

function makeCourseCode(rawCode: string | undefined, name: string, idx: number): string {
  if (rawCode && /^[A-Z0-9-]{2,12}$/i.test(rawCode.trim())) {
    return rawCode.trim().toUpperCase();
  }
  const cleanWords = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^\d+$/.test(w));

  if (cleanWords.length >= 2) {
    return cleanWords
      .slice(0, 4)
      .map((w) => (/^\d+$/.test(w) ? w : w[0]))
      .join('')
      .toUpperCase()
      .slice(0, 8);
  }
  if (cleanWords.length === 1) {
    return cleanWords[0].slice(0, 6).toUpperCase();
  }
  return `UC${idx + 1}`;
}

/**
 * Analisa texto colado diretamente do Guia de Cursos (guia.unl.pt), CLIP ou pauta universitária
 * (ex: blocos "1.º Semestre", "3.º Semestre", linhas "13493\tCálculo I D\t6.0")
 * e devolve cadeiras estruturadas por ano curricular (1..5), semestre (1..2) e ECTS.
 */
export function parseCurriculumFromText(
  rawText: string,
  fallbackYear: 1 | 2 | 3 | 4 | 5 = 1,
  fallbackSemester: 1 | 2 = 1,
): CurriculumCourseTemplate[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let currentYear: 1 | 2 | 3 | 4 | 5 = fallbackYear;
  let currentSemester: 1 | 2 = fallbackSemester;
  let insideOptions = false;
  const results: CurriculumCourseTemplate[] = [];
  const seenNames = new Set<string>();

  for (const line of lines) {
    // Deteta cabeçalhos de Mestrado/Licenciatura explícitos
    if (/\b1\.º\s*ano\b/i.test(line)) currentYear = 1;
    else if (/\b2\.º\s*ano\b/i.test(line)) currentYear = 2;
    else if (/\b3\.º\s*ano\b/i.test(line)) currentYear = 3;
    else if (/\b4\.º\s*ano\b|\b1\.º\s*(ano\s*(de\s*)?)?mestrado\b/i.test(line)) currentYear = 4;
    else if (/\b5\.º\s*ano\b|\b2\.º\s*(ano\s*(de\s*)?)?mestrado\b/i.test(line)) currentYear = 5;

    // Deteta semestres absolutos 1..10 (estilo guia.unl.pt: "3.º Semestre" -> 2.º ano, 1.º sem)
    const semMatch = line.match(/^(\d{1,2})\s*[.º°]*\s*semestre\b(.*)$/i);
    if (semMatch) {
      const absSem = Number(semMatch[1]);
      const trailing = semMatch[2] ?? '';
      if (absSem >= 1 && absSem <= 10) {
        const computedYear = Math.min(5, Math.ceil(absSem / 2)) as 1 | 2 | 3 | 4 | 5;
        // Se for um mestrado (fallbackYear >= 4) e o site numerar 1..4 semestres, mapeia para anos 4..5
        currentYear =
          fallbackYear >= 4 && absSem <= 4
            ? ((3 + Math.ceil(absSem / 2)) as 1 | 2 | 3 | 4 | 5)
            : computedYear;
        currentSemester = absSem % 2 === 1 ? 1 : 2;
      }
      insideOptions = /opç|optativ|livre/i.test(trailing);
      continue;
    }

    if (/^opç(?:ão|ões)\b/i.test(line)) {
      insideOptions = true;
      continue;
    }

    if (/^(obrigatóri[ao]s?|tronco comum|plano de estudos)\b/i.test(line)) {
      insideOptions = false;
      continue;
    }

    // Ignora linhas informativas / cabeçalhos de tabela
    if (
      /^(código\s+nome|o aluno deverá|estrutura|objetivos|campus de|copyright)/i.test(line)
    ) {
      continue;
    }

    // Formato tabular guia.unl.pt / CLIP: "13493\tCálculo I D\t6.0" ou "13493  Cálculo I D  6"
    const tabMatch = line.match(
      /^(?:(\d{3,6}|[A-Z0-9-]{2,10})[\t\s]+)?(.+?)[\t\s]+(\d{1,2}(?:[.,]\d)?)\s*(?:ects|cr[eé]ditos)?$/i,
    );
    let rawCode: string | undefined;
    let name = '';
    let ects = 6;

    if (tabMatch) {
      rawCode = tabMatch[1];
      name = tabMatch[2].trim();
      ects = Math.max(1, Math.min(30, Math.round(Number(tabMatch[3].replace(',', '.')) || 6)));
    } else if (line.length >= 4 && line.length <= 120 && !/^https?:/i.test(line)) {
      // Linha simples com nome da cadeira
      name = line.replace(/^[-•*]\s*/, '').trim();
    }

    if (!name || name.length < 3 || /^(?:semestre|opç|ects|código|total\b)/i.test(name)) continue;

    const norm = name.toLowerCase();
    if (seenNames.has(norm)) continue;
    seenNames.add(norm);

    const isNumericPortalCode = Boolean(rawCode && /^\d{4,6}$/.test(rawCode));
    const code = makeCourseCode(isNumericPortalCode ? undefined : rawCode, name, results.length);

    results.push({
      code,
      name,
      shortName: name.length > 18 ? code : name,
      year: currentYear,
      semester: currentSemester,
      ects,
      topics: [name],
      ...(insideOptions ? { optional: true } : {}),
    });
  }

  return results;
}
