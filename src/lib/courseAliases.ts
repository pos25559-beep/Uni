// Dicionário de Sinónimos e Mapeamento Histórico de Cadeiras do LEMc (NOVA FCT)
// Permite que ficheiros em drives partilhados antigos e emails identifiquem corretamente a cadeira atual,
// como por exemplo "Análise Matemática 3" / "AM3" -> "Cálculo III D".

import type { Course, MaterialCategory, MaterialProvider } from '../types';

export function normalizeAliasText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[._\-/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sinónimos, siglas, termos e nomes antigos por cadeira */
export const COURSE_ALIASES_MAP: Record<string, string[]> = {
  c3d: [
    'calculo iii d',
    'calculo iii',
    'calculo 3 d',
    'calculo 3',
    'c3 d',
    'c3d',
    'analise matematica 3',
    'analise matematica iii',
    'analise 3',
    'analise iii',
    'am3',
    'am iii',
    'am 3',
    'cdi 3',
    'cdi iii',
    'cdi3',
    'calculo diferencial e integral 3',
    'series numericas',
    'series de potencias',
    'multiplicadores de lagrange',
    'integrais multiplos',
    'integrais duplos',
    'integrais triplos',
    'teorema de green',
    'teorema de stokes',
    'teorema de gauss',
  ],
  fabad: [
    'fabrico aditivo',
    'manufatura aditiva',
    'fabad',
    'fab ad',
    'fa',
    'impressao 3d',
    '3d printing',
    'additive manufacturing',
    'fdm',
    'slm',
    'sls',
    'sla',
    'dlp',
    'dfam',
    'leito de po',
    'fotopolimerizacao',
  ],
  mdf: [
    'mecanica dos fluidos',
    'mecanica de fluidos',
    'fluidos',
    'mdf',
    'mf',
    'navier stokes',
    'transporte de reynolds',
    'perdas de carga',
    'diagrama de moody',
    'camada limite',
    'arrasto e sustentacao',
  ],
  ms2: [
    'mecanica dos solidos ii',
    'mecanica dos solidos 2',
    'mecanica dos solidos',
    'solidos ii',
    'solidos 2',
    'solidos',
    'ms2',
    'ms ii',
    'ms 2',
    'resistencia dos materiais 2',
    'resistencia de materiais 2',
    'resistencia dos materiais ii',
    'resistencia dos materiais',
    'resistencia de materiais',
    'resmat 2',
    'resmat ii',
    'resmat',
    'rm2',
    'rm ii',
    'rm 2',
    'circulo de mohr',
    'von mises',
    'tresca',
    'castigliano',
    'encurvadura',
    'flexao desviada',
  ],
  snti: [
    'sociologia das novas tecnologias de informacao',
    'sociologia das novas tecnologias',
    'sociologia da sociedade de informacao',
    'sociologia',
    'snti',
    'sociedade da informacao',
    'castells',
    'shoshana zuboff',
    'era digital',
  ],
  tep: [
    'tecnologias de enformacao plastica',
    'tecnologia de enformacao plastica',
    'enformacao plastica',
    'conformacao plastica',
    'enformacao',
    'conformacao',
    'tep',
    'cep',
    'laminagem',
    'forjamento',
    'extrusao plastica',
    'estampagem',
  ],
};

/**
 * Recolhe todos os sinónimos e termos de pesquisa de uma cadeira,
 * independentemente de ter sido criada com ID 'mdf' ou um ID gerado (UUID).
 */
export function getAliasesForCourse(course: Course): string[] {
  const result = new Set<string>();
  const idKey = (course.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const codeKey = (course.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const shortKey = (course.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normName = normalizeAliasText(course.name || '');

  // 1. Procura direta pelas chaves no mapa
  for (const [key, aliases] of Object.entries(COURSE_ALIASES_MAP)) {
    if (key === idKey || key === codeKey || key === shortKey) {
      aliases.forEach((a) => result.add(a));
    }
  }

  // 2. Inferência por termos contidos no nome ou sigla
  if (normName.includes('fluido') || codeKey.includes('mdf') || shortKey.includes('mdf')) {
    COURSE_ALIASES_MAP.mdf?.forEach((a) => result.add(a));
  }
  if (normName.includes('solido') || normName.includes('resistencia') || codeKey.includes('ms2') || shortKey.includes('ms2')) {
    COURSE_ALIASES_MAP.ms2?.forEach((a) => result.add(a));
  }
  if (normName.includes('calculo') || normName.includes('analise') || codeKey.includes('c3d') || shortKey.includes('c3d')) {
    COURSE_ALIASES_MAP.c3d?.forEach((a) => result.add(a));
  }
  if (normName.includes('aditivo') || normName.includes('fabrico') || codeKey.includes('fabad') || shortKey.includes('fabad')) {
    COURSE_ALIASES_MAP.fabad?.forEach((a) => result.add(a));
  }
  if (normName.includes('enformacao') || normName.includes('plastica') || codeKey.includes('tep') || shortKey.includes('tep')) {
    COURSE_ALIASES_MAP.tep?.forEach((a) => result.add(a));
  }
  if (normName.includes('sociologia') || normName.includes('tecnologia') || codeKey.includes('snti') || shortKey.includes('snti')) {
    COURSE_ALIASES_MAP.snti?.forEach((a) => result.add(a));
  }

  return Array.from(result);
}

/**
 * Deteta se um ficheiro é um documento pessoal, financeiro ou irrelevante
 * (ex.: faturas, recibos, contratos, bilhetes, fotos, instaladores)
 * que NUNCA deve ser importado para o repositório académico.
 */
export function isNonAcademicDocument(
  filename: string,
  opts?: { allowImages?: boolean },
): boolean {
  if (!filename) return false;
  const baseName = filename.split('/').pop()?.trim() || filename.trim();
  const lower = baseName.toLowerCase();
  const norm = normalizeAliasText(baseName);

  // 1. Extensões que não são ficheiros de estudo
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const binaryMediaExts = [
    '.mp4', '.mov', '.avi', '.mkv', '.webm',
    '.mp3', '.wav', '.flac', '.m4a',
    '.dmg', '.exe', '.pkg', '.iso', '.msi', '.app',
  ];
  const blockedExts = opts?.allowImages ? binaryMediaExts : [...imageExts, ...binaryMediaExts];
  if (blockedExts.some((ext) => lower.endsWith(ext))) {
    return true;
  }

  // 2. Termos expressamente pessoais, fiscais, bancários ou de burocracia
  const personalKeywords = [
    'fatura',
    'fatura recibo',
    'recibo',
    'recibo verde',
    'irs',
    'financas',
    'autoridade tributaria',
    'banco',
    'bancario',
    'santander',
    'cgd',
    'millennium',
    'novobanco',
    'activobank',
    'revolut',
    'extrato',
    'comprovativo',
    'comprovativo de pagamento',
    'comprovativo transferencia',
    'declaracao',
    'declaracao de rendimentos',
    'contrato',
    'contrato trabalho',
    'arrendamento',
    'recibo de renda',
    'condominio',
    'seguro',
    'apolice',
    'curriculo',
    'curriculum',
    'salario',
    'vencimento',
    'ordenado',
    'recibo de vencimento',
    'multa',
    'coima',
    'passaporte',
    'cartao de cidadao',
    'cartao cidadao',
    'bilhete de identidade',
    'bilhete',
    'boarding pass',
    'cartao de embarque',
    'voo',
    'ryanair',
    'easyjet',
    'tap air',
    'hotel',
    'booking',
    'airbnb',
    'reserva',
    'consulta',
    'receita medica',
    'analises clinicas',
    'atestado',
    'certidao',
    'notario',
    'carta de conducao',
    'via verde',
    'edp',
    'endesa',
    'galp',
    'vodafone',
    'meo',
    'nos comunicacoes',
    'vinted',
    'olx',
    'amazon',
  ];

  for (const kw of personalKeywords) {
    const regex = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i');
    if (regex.test(norm)) return true;
  }

  return false;
}

/**
 * Verifica se um texto (nome de ficheiro, assunto de email, nome de pasta)
 * corresponde a uma cadeira específica ou a qualquer dos seus sinónimos.
 */
export function matchesCourse(text: string, course: Course): boolean {
  if (!text) return false;
  if (isNonAcademicDocument(text, { allowImages: true })) return false;

  const normalized = normalizeAliasText(text);

  // Se a cadeira for Cálculo III D (c3d), NÃO pode coincidir com cadeiras de outros anos (ex: AM1, AM2, CDI1, CDI2)
  const isC3D = course.id === 'c3d' || (course.code || '').toLowerCase().includes('c3') || (course.name || '').toLowerCase().includes('calculo iii');
  if (isC3D) {
    const otherMathRegex = /(^|[^a-z0-9])(am1|am 1|am2|am 2|am i|am ii|calculo 1|calculo 2|calculo i|calculo ii|c1d|c2d|cdi 1|cdi 2|cdi1|cdi2)([^a-z0-9]|$)/i;
    if (otherMathRegex.test(normalized)) {
      return false;
    }
  }

  // Verificação direta com dados da cadeira
  const codeNorm = normalizeAliasText(course.code);
  const shortNorm = normalizeAliasText(course.shortName);
  const nameNorm = normalizeAliasText(course.name);

  // Tokens exatos ou delimitados
  if (codeNorm) {
    const regexCode = new RegExp(`(^|[^a-z0-9])${codeNorm}([^a-z0-9]|$)`, 'i');
    if (regexCode.test(normalized)) return true;
  }
  if (shortNorm) {
    const regexShort = new RegExp(`(^|[^a-z0-9])${shortNorm}([^a-z0-9]|$)`, 'i');
    if (regexShort.test(normalized)) return true;
  }
  if (nameNorm.length > 3 && normalized.includes(nameNorm)) {
    return true;
  }

  // Verificação contra a lista de sinónimos conhecidos
  const aliases = getAliasesForCourse(course);
  for (const alias of aliases) {
    if (alias.length <= 4) {
      // Siglas curtas (ex.: 'am3', 'ms2', 'mdf', 'tep', 'c3d') devem coincidir por limites de palavra
      const regex = new RegExp(`(^|[^a-z0-9])${alias}([^a-z0-9]|$)`, 'i');
      if (regex.test(normalized)) return true;
    } else {
      if (normalized.includes(alias)) return true;
    }
  }

  return false;
}

/**
 * Encontra a melhor cadeira correspondente a um texto (nome de ficheiro, assunto de email, nome de pasta).
 */
export function matchCourseByText(text: string, courses: Course[]): Course | undefined {
  if (!text || !courses || courses.length === 0) return undefined;
  for (const course of courses) {
    if (matchesCourse(text, course)) {
      return course;
    }
  }
  return undefined;
}

/**
 * Encontra a melhor cadeira correspondente a um texto (nome de ficheiro, email, etc.)
 */
export interface ParsedFileItem {
  id: string;
  name: string;
  title: string;
  courseId?: string;
  category: MaterialCategory;
  epoch?: string;
  year?: string;
  hasSolution: boolean;
  provider: MaterialProvider;
  url: string;
  selected: boolean;
  file?: File;
  fileSize?: number;
}

/**
 * Analisa o nome de um ficheiro (do HD ou Google Drive) e extrai
 * metadados estruturados (cadeira, teste/exame, ano, época, se tem resolução).
 */
export function parseFilenameToParsedItem(
  filename: string,
  courses: Course[],
  defaultCourseId?: string,
  defaultProvider: MaterialProvider = 'upload',
  folderUrl?: string,
  directFileUrl?: string,
  options?: { allowImages?: boolean },
): ParsedFileItem {
  const clean = filename.trim();
  const segments = clean.split('/').map((s) => s.trim()).filter(Boolean);
  const baseName = segments.length > 0 ? segments[segments.length - 1] : clean;
  const parentHint = segments.length > 1 ? segments[segments.length - 2] : '';
  const lower = clean.toLowerCase();

  // Deteção inteligente da cadeira usando sinónimos históricos (ex.: AM3 -> Cálculo III D)
  // Se for documento pessoal ou financeiro (faturas, recibos, etc.), rejeita e não atribui cadeira
  const isJunk = isNonAcademicDocument(baseName, { allowImages: options?.allowImages });
  const matched = isJunk ? undefined : matchCourseByText(clean, courses);
  const courseId = isJunk ? undefined : (matched ? matched.id : defaultCourseId);

  // Deteção de categoria
  let category: MaterialCategory = 'outro';
  if (lower.includes('1t') || lower.includes('2t') || lower.includes('teste') || lower.includes('1teste') || lower.includes('2teste')) {
    category = 'teste_antigo';
  } else if (lower.includes('exame') || lower.includes('recurso') || lower.includes('especial')) {
    category = 'exame_antigo';
  } else if (lower.includes('ficha') || lower.includes('exercicio') || lower.includes('problema') || lower.includes('folha')) {
    category = 'ficha';
  } else if (lower.includes('slide') || lower.includes('aula') || lower.includes('teorica') || lower.includes('capitulo') || lower.includes('apresentacao')) {
    category = 'slide_oficial';
  } else if (lower.includes('relatorio') || lower.includes('ensaio') || lower.includes('trabalho') || lower.includes('projeto')) {
    category = 'relatorio';
  } else if (lower.includes('sebenta') || lower.includes('resumo') || lower.includes('apontamento') || lower.includes('formulario')) {
    category = 'sebenta';
  }

  // Deteção de Época
  let epoch: string | undefined;
  if (lower.includes('1t') || lower.includes('1teste') || lower.includes('1.º teste') || lower.includes('1º teste') || lower.includes('teste 1')) {
    epoch = '1T';
  } else if (lower.includes('2t') || lower.includes('2teste') || lower.includes('2.º teste') || lower.includes('2º teste') || lower.includes('teste 2')) {
    epoch = '2T';
  } else if (lower.includes('recurso')) {
    epoch = 'Recurso';
  } else if (lower.includes('especial')) {
    epoch = 'Especial';
  }

  // Deteção de Ano Letivo
  let year: string | undefined;
  const yearMatch = /(?:20)?(1[8-9]|2[0-9])[-_/](?:20)?(1[8-9]|2[0-9])/.exec(clean);
  if (yearMatch) {
    year = `20${yearMatch[1].slice(-2)}/${yearMatch[2].slice(-2)}`;
  } else if (lower.includes('2024') || lower.includes('24')) {
    year = '2024/25';
  } else if (lower.includes('2023') || lower.includes('23')) {
    year = '2023/24';
  } else if (lower.includes('2022') || lower.includes('22')) {
    year = '2022/23';
  }

  // Deteção de Resolução
  const hasSolution =
    lower.includes('resolv') ||
    lower.includes('soluc') ||
    lower.includes('criterio') ||
    lower.includes('resolucao') ||
    lower.includes('solucoes');

  const baseTitle = baseName
    .replace(/\.[^/.]+$/, '')
    .replace(/[._-]+/g, ' ')
    .trim();

  const normalizedBase = normalizeAliasText(baseTitle);
  const isGenericTitle =
    baseTitle.length <= 6 ||
    /^(1t|2t|t1|t2|teste ?\d*|exame ?\d*|recurso|especial|resolucao|resolvido|solucao|solucoes|ficha ?\d*)$/.test(normalizedBase);
  const title = isGenericTitle && parentHint && parentHint !== baseTitle
    ? `${parentHint.replace(/[._-]+/g, ' ').trim()} · ${baseTitle}`
    : baseTitle;

  const url = directFileUrl || folderUrl || '';

  return {
    id: `parsed-${Math.random().toString(36).slice(2, 9)}`,
    name: baseName || clean,
    title: title || baseName || clean,
    courseId,
    category,
    epoch,
    year,
    hasSolution,
    provider: defaultProvider,
    url,
    selected: true,
  };
}
