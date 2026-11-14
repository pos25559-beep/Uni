import type { CompletedCourseRecord, Course, CourseColor, Topic } from '../types';

export interface CurriculumCourseTemplate {
  code: string;
  name: string;
  shortName: string;
  year: 1 | 2 | 3 | 4 | 5;
  semester: 1 | 2;
  ects: number;
  topics: string[];
  color?: CourseColor;
  optional?: boolean;
}

export function formatAcademicYearLabel(year: number, isSecondarySchool = false): string {
  if (isSecondarySchool) {
    return year === 1 ? '10.º Ano' : year === 2 ? '11.º Ano' : '12.º Ano';
  }
  if (year === 4) return '4.º Ano · 1.º Mestrado';
  if (year === 5) return '5.º Ano · 2.º Mestrado';
  return `${year}.º Ano`;
}

export function formatAcademicYearShort(year: number, isSecondarySchool = false): string {
  if (isSecondarySchool) {
    return year === 1 ? '10.º' : year === 2 ? '11.º' : '12.º';
  }
  if (year === 4) return '1.º Mest.';
  if (year === 5) return '2.º Mest.';
  return `${year}.º Ano`;
}

export interface DegreeCurriculum {
  id: string;
  name: string;
  shortName: string;
  cycle?: 'licenciatura' | 'mestrado' | 'misto';
  courses: CurriculumCourseTemplate[];
}

export interface UniversityCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  degrees: DegreeCurriculum[];
}

const COURSE_PALETTE: CourseColor[] = [
  'lime',
  'amber',
  'emerald',
  'sky',
  'orange',
  'rose',
  'cyan',
];

const NOVA_FCT_LEMC_COURSES: CurriculumCourseTemplate[] = [
  // 1.º Ano · Plano oficial 2026/27 NOVA FCT LEMc (guia.unl.pt/pt/2026/fct/program/1273)
  { code: 'ALGA', name: 'Álgebra Linear e Geometria Analítica', shortName: 'ALGA', year: 1, semester: 1, ects: 6, topics: ['Matrizes e determinantes', 'Espaços vetoriais', 'Aplicações lineares', 'Valores e vetores próprios'] },
  { code: 'C1D', name: 'Cálculo I D', shortName: 'Cálculo I D', year: 1, semester: 1, ects: 6, topics: ['Funções e limites', 'Cálculo diferencial', 'Primitivas e integrais', 'Séries numéricas'] },
  { code: 'DCM', name: 'Desenho de Construção Mecânica', shortName: 'DCM', year: 1, semester: 1, ects: 6, topics: ['Projeções ortogonais', 'Cortes e secções', 'Cotagem e tolerâncias', 'Normalização técnica'] },
  { code: 'FEXP', name: 'Física Experimental', shortName: 'Fís. Exp.', year: 1, semester: 1, ects: 6, topics: ['Incertezas e medição', 'Mecânica experimental', 'Oscilações e termometria', 'Análise gráfica de dados'] },
  { code: 'QD', name: 'Química D', shortName: 'Química D', year: 1, semester: 1, ects: 3, topics: ['Estrutura atómica e ligação', 'Termoquímica', 'Equilíbrio químico', 'Corrosão e eletroquímica'] },
  { code: 'C2D', name: 'Cálculo II D', shortName: 'Cálculo II D', year: 1, semester: 2, ects: 6, topics: ['Cálculo diferencial em R^n', 'Extremos condicionados', 'Integrais múltiplos', 'Curvas e superfícies'] },
  { code: 'CTCT', name: 'Competências Transversais para Ciências e Tecnologia', shortName: 'CTCT', year: 1, semester: 2, ects: 3, topics: ['Comunicação científica', 'Trabalho em equipa', 'Gestão do tempo', 'Ética em engenharia'] },
  { code: 'ICED', name: 'Informática para Ciências e Engenharias D', shortName: 'Informática D', year: 1, semester: 2, ects: 6, topics: ['Algoritmia em Python', 'Controlo de fluxo e funções', 'Estruturas de dados', 'Cálculo científico'] },
  { code: 'ITM', name: 'Introdução à Tecnologia Mecânica', shortName: 'Tec. Mecânica', year: 1, semester: 2, ects: 6, topics: ['Metrologia dimensional', 'Processos de fabrico', 'Máquinas-ferramenta', 'Ligação de materiais'] },
  { code: 'ITA', name: 'Introdução à Termodinâmica Aplicada', shortName: 'Intro. Termo', year: 1, semester: 2, ects: 6, topics: ['1.ª Lei da Termodinâmica', 'Substâncias puras', '2.ª Lei e entropia', 'Rendimento e ciclos básicos'] },
  { code: 'RMQ', name: 'Relatividade e Mecânica Quântica', shortName: 'Relat. Quântica', year: 1, semester: 2, ects: 6, topics: ['Relatividade restrita', 'Radiação e efeito fotoelétrico', 'Equação de Schrödinger', 'Estrutura atómica e bandas'] },

  // 2.º Ano · Plano oficial 2026/27 NOVA FCT LEMc
  { code: 'C3D', name: 'Cálculo III D', shortName: 'Cálculo III D', year: 2, semester: 1, ects: 6, topics: ['Campos vetoriais', 'Integrais de linha e superfície', 'Stokes e Gauss', 'EDOs e Transformada de Laplace'] },
  { code: 'CMAT', name: 'Ciência dos Materiais', shortName: 'Materiais', year: 2, semester: 1, ects: 6, topics: ['Estrutura cristalina e defeitos', 'Difusão e diagramas de fase', 'Tratamentos térmicos', 'Propriedades mecânicas'] },
  { code: 'ECON', name: 'Economia', shortName: 'Economia', year: 2, semester: 1, ects: 3, topics: ['Microeconomia', 'Mercados e procura', 'Macroeconomia', 'Indicadores económicos'] },
  { code: 'EMAGD', name: 'Eletromagnetismo D', shortName: 'Eletromag. D', year: 2, semester: 1, ects: 6, topics: ['Eletrostática', 'Magnetostática', 'Indução de Faraday', 'Equações de Maxwell'] },
  { code: 'MA1', name: 'Mecânica Aplicada I', shortName: 'Mec. Apl. I', year: 2, semester: 1, ects: 6, topics: ['Estática de corpos rígidos', 'Treliças e pórticos', 'Esforços internos e momentos', 'Atrito e centro de massa'] },
  { code: 'DAC', name: 'Desenho Assistido por Computador', shortName: 'DAC / CAD', year: 2, semester: 2, ects: 6, topics: ['Modelação paramétrica 3D', 'Montagens e restrições', 'Desenhos técnicos e toleranciamento', 'Superfícies'] },
  { code: 'IPEIO', name: 'Introdução às Probabilidades Estatística e Investigação Operacional', shortName: 'IPEIO', year: 2, semester: 2, ects: 6, topics: ['Variáveis aleatórias e distribuições', 'Testes de hipóteses e regressão', 'Programação linear e Simplex', 'Otimização em redes'] },
  { code: 'MA2', name: 'Mecânica Aplicada II', shortName: 'Mec. Apl. II', year: 2, semester: 2, ects: 6, topics: ['Cinemática do corpo rígido', 'Dinâmica plana de mecanismos', 'Impulso e quantidade de movimento', 'Trabalho virtual'] },
  { code: 'MDF', name: 'Mecânica dos Fluidos', shortName: 'MdF', year: 2, semester: 2, ects: 6, topics: ['Estática dos fluidos', 'Equações de conservação', 'Escoamento em condutas', 'Análise dimensional e camada limite'] },
  { code: 'MS1', name: 'Mecânica dos Sólidos I', shortName: 'MS1', year: 2, semester: 2, ects: 6, topics: ['Tensão e deformação', 'Tração e compressão', 'Torção', 'Flexão simples e deflexão'] },
  { code: 'SSTD', name: 'Sociedade, Sustentabilidade e Transformação Digital', shortName: 'SSTD', year: 2, semester: 2, ects: 3, topics: ['Transição energética', 'Economia circular', 'Indústria 4.0', 'Impacto social da tecnologia'] },

  // 3.º Ano · Plano oficial 2026/27 NOVA FCT LEMc
  { code: 'EG', name: 'Eletrónica Geral', shortName: 'Eletrónica', year: 3, semester: 1, ects: 3, topics: ['Díodos e transístores', 'Amplificadores operacionais', 'Sistemas digitais', 'Instrumentação e sensores'] },
  { code: 'MS2', name: 'Mecânica dos Sólidos II', shortName: 'MS2', year: 3, semester: 1, ects: 6, topics: ['Estado plano de tensões', 'Critérios de cedência', 'Flexão desviada e composta', 'Encurvadura e métodos energéticos'] },
  { code: 'TFS', name: 'Tecnologias de Fundição e Soldadura', shortName: 'Fund. Sold.', year: 3, semester: 1, ects: 6, topics: ['Processos de fundição', 'Solidificação e defeitos', 'Soldadura por arco e laser', 'Metalurgia da soldadura'] },
  { code: 'TATC', name: 'Termodinâmica Aplicada e Transmissão de Calor', shortName: 'TATC', year: 3, semester: 1, ects: 6, topics: ['Ciclos de potência e refrigeração', 'Condução estacionária e transiente', 'Convecção natural e forçada', 'Permutadores de calor e radiação'] },
  { code: 'PIIC', name: 'Programa de Introdução à Investigação Científica em Engenharia Mecânica', shortName: 'PIIC', year: 3, semester: 1, ects: 3, optional: true, topics: ['Iniciação à investigação', 'Estado da arte', 'Relatório científico'] },
  { code: 'PIPP', name: 'Programa de Introdução à Prática Profissional em Engenharia Mecânica', shortName: 'PIPP', year: 3, semester: 1, ects: 3, optional: true, topics: ['Prática profissional em empresa', 'Relatório de atividade', 'Comunicação técnica'] },
  { code: 'AR', name: 'Automação e Robótica', shortName: 'Automação', year: 3, semester: 2, ects: 6, topics: ['Autómatos programáveis (PLC)', 'Pneumática e eletropneumática', 'Cinemática de manipuladores', 'Células robotizadas'] },
  { code: 'CMM', name: 'Comportamento Mecânico dos Materiais', shortName: 'Comp. Mec.', year: 3, semester: 2, ects: 6, topics: ['Elasticidade e plasticidade', 'Mecânica da fratura', 'Fadiga de materiais', 'Fluência'] },
  { code: 'GP', name: 'Gestão da Produção', shortName: 'Gestão Prod.', year: 3, semester: 2, ects: 3, topics: ['Planeamento de produção', 'Lean Manufacturing', 'Controlo de stocks', 'Qualidade industrial'] },
  { code: 'OM', name: 'Órgãos de Máquinas', shortName: 'Órgãos Máq.', year: 3, semester: 2, ects: 6, topics: ['Dimensionamento à fadiga', 'Veios, eixos e rolamentos', 'Engrenagens e transmissões', 'Ligações aparafusadas'] },
  { code: 'PDP', name: 'Projeto de Desenvolvimento de Produto', shortName: 'Proj. Produto', year: 3, semester: 2, ects: 3, topics: ['Especificação e conceito', 'DFM e DFA', 'Prototipagem rápida', 'Validação de produto'] },
  { code: 'IMCT', name: 'Introdução aos Métodos Computacionais em Termofluidos', shortName: 'Mét. Comp. Termo', year: 3, semester: 2, ects: 6, optional: true, topics: ['Discretização e volumes finitos', 'Condução e convecção numérica', 'Escoamentos em CFD'] },
  { code: 'MC', name: 'Mecânica Computacional', shortName: 'Mec. Comp.', year: 3, semester: 2, ects: 6, optional: true, topics: ['Método dos elementos finitos', 'Análise estrutural 2D/3D', 'Convergência de malha'] },
];

const NOVA_FCT_MEMEC_COURSES: CurriculumCourseTemplate[] = [
  // 1.º Ano de Mestrado (4.º Ano Curricular — Plano oficial 2026/27 NOVA FCT MEMc · guia.unl.pt/pt/2026/fct/program/1299)
  { code: 'EME', name: 'Eletrotecnia e Máquinas Elétricas', shortName: 'Eletrotecnia', year: 4, semester: 1, ects: 6, topics: ['Circuitos AC monofásicos e trifásicos', 'Transformadores', 'Motores de indução', 'Acionamentos elétricos'] },
  { code: 'EMP', name: 'Empreendedorismo', shortName: 'Empreend.', year: 4, semester: 1, ects: 3, topics: ['Proposta de valor', 'Modelo de negócio', 'Propriedade intelectual', 'Plano financeiro'] },
  { code: 'TEP', name: 'Tecnologias de Enformação Plástica', shortName: 'TEP', year: 4, semester: 1, ects: 6, topics: ['Plasticidade aplicada', 'Laminagem e extrusão', 'Estampagem e quinagem', 'Forjamento e simulação'] },
  // Opção I A/B (6 ECTS, opcionais)
  { code: 'AERO', name: 'Aerodinâmica', shortName: 'Aerodinâmica', year: 4, semester: 1, ects: 6, optional: true, topics: ['Escoamento potencial e perfis alares', 'Camada limite compressível', 'Sustentação e resistência'] },
  { code: 'BIOMEC', name: 'Biomecânica Experimental e Computacional', shortName: 'Biomecânica', year: 4, semester: 1, ects: 6, optional: true, topics: ['Caracterização de tecidos', 'Análise de movimento', 'Modelação biomédica MEF'] },
  { code: 'CLIM', name: 'Climatização e Refrigeração', shortName: 'Climatização', year: 4, semester: 1, ects: 6, optional: true, topics: ['Psicrometria e cargas térmicas', 'Ciclos de refrigeração', 'Sistemas AVAC'] },
  { code: 'DSM', name: 'Dinâmica de Sistemas Mecânicos', shortName: 'Din. Sistemas', year: 4, semester: 1, ects: 6, optional: true, topics: ['Formulação Lagrangiana', 'Cinemática 3D', 'Dinâmica multicorpo'] },
  { code: 'ENAMB', name: 'Energia e Ambiente', shortName: 'Energia Amb.', year: 4, semester: 1, ects: 6, optional: true, topics: ['Fontes renováveis', 'Descarbonização industrial', 'Avaliação de impacto ambiental'] },
  { code: 'FABAD', name: 'Fabrico Aditivo', shortName: 'Fab. Aditivo', year: 4, semester: 1, ects: 6, optional: true, topics: ['Processos PBF, DED e FFF', 'Design for Additive (DfAM)', 'Topologia e qualificação'] },
  { code: 'FGM', name: 'Fiabilidade e Gestão da Manutenção', shortName: 'Fiab. Manut.', year: 4, semester: 1, ects: 6, optional: true, topics: ['Curvas de Weibull', 'Manutenção preditiva', 'RCM e gestão de ativos'] },
  { code: 'CFD', name: 'Mecânica dos Fluidos Computacional', shortName: 'CFD', year: 4, semester: 1, ects: 6, optional: true, topics: ['Navier-Stokes numérico', 'Modelos de turbulência', 'Malhas e convergência'] },
  { code: 'MEEM', name: 'Métodos Experimentais em Engenharia Mecânica', shortName: 'Mét. Exp.', year: 4, semester: 1, ects: 6, optional: true, topics: ['Extensometria e sensores', 'Aquisição de sinal', 'Planeamento de ensaios'] },
  { code: 'OSCM', name: 'Otimização de Sistemas e Componentes Mecânicos', shortName: 'Otimização', year: 4, semester: 1, ects: 6, optional: true, topics: ['Otimização topológica', 'Algoritmos evolutivos', 'Projeto ótimo estrutural'] },
  { code: 'PAFEND', name: 'Processos Avançados de Fabrico e Ensaios não Destrutivos', shortName: 'PAFEND', year: 4, semester: 1, ects: 6, optional: true, topics: ['Soldadura avançada e laser', 'Ultrassons e radiografia', 'Liquidos penetrantes e correntes induzidas'] },
  { code: 'CAM', name: 'Produção Assistida por Computador', shortName: 'CAM', year: 4, semester: 1, ects: 6, optional: true, topics: ['Estratégias CNC multi-eixo', 'Pós-processamento ISO', 'Simulação de trajetória'] },
  { code: 'CAD', name: 'Projeto Assistido por Computador', shortName: 'CAD Avançado', year: 4, semester: 1, ects: 6, optional: true, topics: ['Superfícies complexas', 'Modelação paramétrica avançada', 'Validação CAE'] },
  { code: 'PROP', name: 'Sistemas de Propulsão', shortName: 'Propulsão', year: 4, semester: 1, ects: 6, optional: true, topics: ['Turborreatores e turbofans', 'Propulsão elétrica e híbrida', 'Bocal e câmara de combustão'] },
  { code: 'TSM', name: 'Toleranciamento de Sistemas Mecânicos', shortName: 'Toleranciamento', year: 4, semester: 1, ects: 6, optional: true, topics: ['GD&T segundo ISO GPS', 'Cadeias de cotas 3D', 'Análise estatística de tolerâncias'] },
  // Opção II A (3 ECTS, opcionais)
  { code: 'ACSM', name: 'Análise de Condição de Sistemas Mecânicos', shortName: 'Anál. Condição', year: 4, semester: 1, ects: 3, optional: true, topics: ['Diagnóstico por vibrações', 'Termografia e óleos', 'Monitorização contínua'] },
  { code: 'IFAB', name: 'Instrumentação para o Fabrico', shortName: 'Instrum. Fabrico', year: 4, semester: 1, ects: 3, optional: true, topics: ['Sensores em máquina', 'Monitorização de processo', 'Aquisição de dados'] },
  { code: 'METF', name: 'Métodos Experimentais em Termofluidos', shortName: 'Exp. Termofluidos', year: 4, semester: 1, ects: 3, optional: true, topics: ['Anemometria e PIV', 'Caudalímetros e pressão', 'Termografia IR'] },
  { code: 'SPROD', name: 'Sistemas de Produção', shortName: 'Sist. Produção', year: 4, semester: 1, ects: 3, optional: true, topics: ['Layout e linhas flexíveis', 'Equilibragem e fluxo', 'Indústria 4.0'] },
  { code: 'SMT', name: 'Sistemas Mecânicos de Transmissão', shortName: 'Transmissões', year: 4, semester: 1, ects: 3, optional: true, topics: ['Engrenagens e caixas redutoras', 'Acoplamentos e veios', 'Lubrificação'] },

  // 1.º Ano de Mestrado · 2.º Semestre
  { code: 'TFI', name: 'Termofluidos Industrial', shortName: 'Termofluidos', year: 4, semester: 2, ects: 6, topics: ['Redes de tubagem e bombagem', 'Turbomáquinas', 'Vapor industrial e caldeiras', 'Eficiência energética'] },
  { code: 'TMP', name: 'Teoria e Metodologias de Projeto', shortName: 'TMP', year: 4, semester: 2, ects: 6, topics: ['Engenharia sistemática', 'Análise funcional e QFD', 'FMEA e robustez', 'Ciclo de vida'] },
  { code: 'VMR', name: 'Vibrações Mecânicas e Ruído', shortName: 'Vibrações', year: 4, semester: 2, ects: 6, topics: ['Vibrações livres e forçadas', 'Sistemas múltiplos GL e análise modal', 'Isolamento vibratório', 'Acústica industrial'] },
  // Opção III A/B (opcionais)
  { code: 'AEFI', name: 'Análise Económica e Financeira de Investimentos', shortName: 'Anál. Econ.', year: 4, semester: 2, ects: 3, optional: true, topics: ['VAL e TIR', 'Cash flows de projeto', 'Risco de investimento'] },
  { code: 'DGAS', name: 'Dinâmica de Gases', shortName: 'Din. Gases', year: 4, semester: 2, ects: 6, optional: true, topics: ['Escoamento compressível 1D', 'Ondas de choque normais e oblíquas', 'Bocais de Laval'] },
  { code: 'ESTEC', name: 'Energia na Sociedade Tecnológica', shortName: 'Energia Soc.', year: 4, semester: 2, ects: 6, optional: true, topics: ['Redes e armazenamento energético', 'Sistemas energéticos sustentáveis', 'Política energética'] },
  { code: 'MCE', name: 'Materiais Compósitos Estruturais', shortName: 'Compósitos', year: 4, semester: 2, ects: 6, optional: true, topics: ['Fibras e matrizes poliméricas', 'Teoria clássica dos laminados', 'Critérios de rotura e fabrico'] },
  { code: 'MBDEM', name: 'Métodos Baseados em Dados em Engenharia Mecânica', shortName: 'Dados Eng. Mec.', year: 4, semester: 2, ects: 6, optional: true, topics: ['Machine learning físico', 'Modelos reduzidos', 'Identificação de sistemas'] },
  { code: 'PFAD', name: 'Projeto de Fadiga de Ligações Mecânicas e Estruturas Aerospaciais', shortName: 'Proj. Fadiga', year: 4, semester: 2, ects: 6, optional: true, topics: ['Mecânica da fratura à fadiga', 'Ligações rebitadas e soldadas', 'Tolerância ao dano'] },
  { code: 'SNF', name: 'Simulação Numérica para o Fabrico', shortName: 'Sim. Fabrico', year: 4, semester: 2, ects: 3, optional: true, topics: ['MEF aplicado à conformação', 'Simulação de soldadura e corte', 'Previsão de tensões residuais'] },
  { code: 'TCOR', name: 'Tecnologias de Corte', shortName: 'Tec. Corte', year: 4, semester: 2, ects: 6, optional: true, topics: ['Mecânica do corte ortogonal', 'Ferramentas e desgaste', 'CNC e maquinação avançada'] },

  // 2.º Ano de Mestrado (5.º Ano Curricular — Plano oficial 2026/27 NOVA FCT MEMc)
  { code: 'AIRA', name: 'Automação Industrial e Robótica Avançada', shortName: 'Automação', year: 5, semester: 1, ects: 6, topics: ['PLCs e redes industriais', 'Cinemática e controlo de manipuladores', 'Visão e robótica colaborativa', 'Células flexíveis'] },
  { code: 'PM', name: 'Projeto Mecânico', shortName: 'Proj. Mec.', year: 5, semester: 1, ects: 6, topics: ['Análise estrutural avançada', 'Elementos finitos aplicados', 'Otimização estrutural', 'Caderno de encargos'] },
  { code: 'OPTL', name: 'Opção(ões) Livre(s) / Seminários MEMc', shortName: 'Opções Livres', year: 5, semester: 1, ects: 6, optional: true, topics: ['Especialização escolhida nas listas de Opção I/II/III', 'Seminários avançados'] },
  { code: 'DISS', name: 'Dissertação em Engenharia Mecânica', shortName: 'Dissertação', year: 5, semester: 2, ects: 30, topics: ['Investigação ou projeto industrial', 'Validação experimental ou numérica', 'Tese e defesa pública'] },
];

export const PORTUGAL_CURRICULA: UniversityCatalogEntry[] = [
  {
    id: 'nova-fct',
    name: 'NOVA FCT — Faculdade de Ciências e Tecnologia',
    shortName: 'NOVA FCT',
    degrees: [
      {
        id: 'lemc',
        name: 'Licenciatura em Engenharia Mecânica (LEMc · Plano 2026/27)',
        shortName: 'LEMc',
        cycle: 'licenciatura',
        courses: NOVA_FCT_LEMC_COURSES,
      },
      {
        id: 'memec',
        name: 'Mestrado em Engenharia Mecânica (MEMc / MEMec · Plano 2026/27)',
        shortName: 'MEMc',
        cycle: 'mestrado',
        courses: NOVA_FCT_MEMEC_COURSES,
      },
      {
        id: 'lemc-memec',
        name: 'Percurso Combinado LEMc + MEMc (Plano 2026/27 · 1.º–5.º Ano)',
        shortName: 'LEMc + MEMc',
        cycle: 'misto',
        courses: [...NOVA_FCT_LEMC_COURSES, ...NOVA_FCT_MEMEC_COURSES],
      },
      {
        id: 'lei',
        name: 'Licenciatura em Engenharia Informática (LEI)',
        shortName: 'LEI',
        courses: [
          { code: 'IP', name: 'Introdução à Programação', shortName: 'IP', year: 1, semester: 1, ects: 6, topics: ['Fundamentos em Java/Python', 'Controlo de fluxo', 'Vetores e matrizes', 'Ficheiros'] },
          { code: 'MD', name: 'Matemática Discreta', shortName: 'Mat. Discreta', year: 1, semester: 1, ects: 6, topics: ['Lógica proposicional', 'Conjuntos e relações', 'Indução', 'Teoria dos grafos'] },
          { code: 'AC1', name: 'Arquitetura de Computadores', shortName: 'Arq. Comp.', year: 1, semester: 1, ects: 6, topics: ['Sistemas numéricos', 'Circuitos combinatórios', 'Assembly', 'Hierarquia de memória'] },
          { code: 'POO', name: 'Programação Orientada por Objetos', shortName: 'POO', year: 1, semester: 2, ects: 6, topics: ['Classes e objetos', 'Herança e polimorfismo', 'Coleções', 'Exceções'] },
          { code: 'AED', name: 'Algoritmos e Estruturas de Dados', shortName: 'AED', year: 2, semester: 1, ects: 6, topics: ['Complexidade assintótica', 'Árvores binárias e AVL', 'Tabelas de dispersão', 'Algoritmos em grafos'] },
          { code: 'BD', name: 'Bases de Dados', shortName: 'Bases Dados', year: 2, semester: 1, ects: 6, topics: ['Modelo E-R', 'Álgebra relacional', 'SQL avançado', 'Normalização e transações'] },
          { code: 'FSO', name: 'Fundamentos de Sistemas Operativos', shortName: 'Sistemas Op.', year: 2, semester: 2, ects: 6, topics: ['Processos e threads', 'Sincronização', 'Gestão de memória', 'Sistemas de ficheiros'] },
          { code: 'RC', name: 'Redes de Computadores', shortName: 'Redes', year: 2, semester: 2, ects: 6, topics: ['Camada física e ligação', 'TCP/UDP e IP', 'Encaminhamento', 'Protocolos aplicacionais'] },
          { code: 'ES', name: 'Engenharia de Software', shortName: 'Eng. Software', year: 3, semester: 1, ects: 6, topics: ['Requisitos', 'Arquitetura e padrões', 'Testes automatizados', 'Agile e CI/CD'] },
          { code: 'IA', name: 'Inteligência Artificial', shortName: 'IA', year: 3, semester: 1, ects: 6, topics: ['Procura heurística', 'Satisfação de restrições', 'Lógica e planeamento', 'Aprendizagem automática'] },
          { code: 'SD', name: 'Sistemas Distribuídos', shortName: 'Sist. Dist.', year: 3, semester: 2, ects: 6, topics: ['RPC e REST', 'Consenso e replicação', 'Tolerância a falhas', 'Segurança distribuída'] },
        ],
      },
      {
        id: 'leec',
        name: 'Licenciatura em Engenharia Eletrotécnica e de Computadores (LEEC)',
        shortName: 'LEEC',
        courses: [
          { code: 'AM1', name: 'Análise Matemática I', shortName: 'AM1', year: 1, semester: 1, ects: 6, topics: ['Limites', 'Derivadas', 'Integrais', 'Séries'] },
          { code: 'SDIG', name: 'Sistemas Digitais', shortName: 'Sist. Digitais', year: 1, semester: 1, ects: 6, topics: ['Álgebra booleana', 'Circuitos sequenciais', 'Máquinas de estado', 'VHDL'] },
          { code: 'ACE', name: 'Análise de Circuitos Elétricos', shortName: 'Circuitos', year: 1, semester: 2, ects: 6, topics: ['Leis de Kirchhoff', 'Teorema de Thévenin', 'Regime sinusoidal', 'Resposta em frequência'] },
          { code: 'EL1', name: 'Eletrónica I', shortName: 'Eletrónica I', year: 2, semester: 1, ects: 6, topics: ['Díodos', 'Transístores BJT e MOSFET', 'Amplificadores', 'AmpOps'] },
          { code: 'SS', name: 'Sinais e Sistemas', shortName: 'Sinais e Sist.', year: 2, semester: 2, ects: 6, topics: ['Convolução', 'Série e Transformada de Fourier', 'Laplace', 'Amostragem'] },
          { code: 'CTRL', name: 'Sistemas de Controlo', shortName: 'Controlo', year: 3, semester: 1, ects: 6, topics: ['Função de transferência', 'Lugar das raízes', 'Bode e Nyquist', 'Controladores PID'] },
        ],
      },
    ],
  },
  {
    id: 'ist',
    name: 'IST — Instituto Superior Técnico (ULisboa)',
    shortName: 'IST',
    degrees: [
      {
        id: 'memec',
        name: 'Licenciatura em Engenharia Mecânica (LEMec / MEMec)',
        shortName: 'LEMec',
        courses: [
          { code: 'CDI1', name: 'Cálculo Diferencial e Integral I', shortName: 'CDI-I', year: 1, semester: 1, ects: 6, topics: ['Sucessões', 'Cálculo diferencial', 'Primitivação', 'Séries'] },
          { code: 'AL', name: 'Álgebra Linear', shortName: 'AL', year: 1, semester: 1, ects: 6, topics: ['Sistemas lineares', 'Determinantes', 'Diagonalização', 'Formas quadráticas'] },
          { code: 'CDI2', name: 'Cálculo Diferencial e Integral II', shortName: 'CDI-II', year: 1, semester: 2, ects: 6, topics: ['Cálculo em R^n', 'Integrais múltiplos', 'Campos vetoriais', 'Teoremas integrais'] },
          { code: 'MO', name: 'Mecânica e Ondas', shortName: 'MO', year: 1, semester: 2, ects: 6, topics: ['Dinâmica de sistemas', 'Oscilações harmónicas', 'Ondas mecânicas', 'Corpo rígido'] },
          { code: 'MM1', name: 'Mecânica de Materiais I', shortName: 'MM-I', year: 2, semester: 1, ects: 6, topics: ['Esforços internos', 'Tração e torção', 'Flexão', 'Energia de deformação'] },
          { code: 'TERMO', name: 'Termodinâmica I', shortName: 'Termo I', year: 2, semester: 1, ects: 6, topics: ['1.º e 2.º Princípios', 'Exergia', 'Ciclos de potência', 'Refrigeração'] },
          { code: 'MF', name: 'Mecânica de Fluidos I', shortName: 'MF-I', year: 2, semester: 2, ects: 6, topics: ['Hidrostática', 'Volume de controlo', 'Navier-Stokes', 'Camada limite'] },
          { code: 'TCAL', name: 'Transferência de Calor', shortName: 'TCal', year: 3, semester: 1, ects: 6, topics: ['Condução', 'Convecção', 'Radiação', 'Permutadores'] },
        ],
      },
      {
        id: 'leic',
        name: 'Licenciatura em Engenharia Informática e de Computadores (LEIC)',
        shortName: 'LEIC',
        courses: [
          { code: 'FP', name: 'Fundamentos da Programação', shortName: 'FP', year: 1, semester: 1, ects: 6, topics: ['Python', 'Recursão', 'Tipos abstratos', 'Complexidade'] },
          { code: 'IAC', name: 'Introdução à Arquitetura de Computadores', shortName: 'IAC', year: 1, semester: 1, ects: 6, topics: ['Lógica digital', 'RISC-V / Assembly', 'Processador', 'Memória cache'] },
          { code: 'IAED', name: 'Introdução aos Algoritmos e Estruturas de Dados', shortName: 'IAED', year: 1, semester: 2, ects: 6, topics: ['Ponteiros em C', 'Ordenação', 'Listas e árvores', 'Hashing'] },
          { code: 'ASA', name: 'Análise e Síntese de Algoritmos', shortName: 'ASA', year: 2, semester: 2, ects: 6, topics: ['Grafos avançados', 'Programação dinâmica', 'Fluxo máximo', 'NP-Completude'] },
          { code: 'SO', name: 'Sistemas Operativos', shortName: 'SO', year: 2, semester: 1, ects: 6, topics: ['Chamadas ao sistema', 'Threads e mutexes', 'Escalonamento', 'Memória virtual'] },
          { code: 'COMP', name: 'Compiladores', shortName: 'Compiladores', year: 3, semester: 1, ects: 6, topics: ['Análise léxica', 'Parsing LR', 'Análise semântica', 'Geração de código'] },
        ],
      },
    ],
  },
  {
    id: 'feup',
    name: 'FEUP — Faculdade de Engenharia da Universidade do Porto',
    shortName: 'FEUP',
    degrees: [
      {
        id: 'lem',
        name: 'Licenciatura em Engenharia Mecânica (L.EM)',
        shortName: 'L.EM',
        courses: [
          { code: 'AMAT1', name: 'Análise Matemática 1', shortName: 'AM1', year: 1, semester: 1, ects: 6, topics: ['Funções reais', 'Derivação', 'Integração', 'EDOs lineares'] },
          { code: 'ALGA', name: 'Álgebra Linear e Geometria Analítica', shortName: 'ALGA', year: 1, semester: 1, ects: 6, topics: ['Espaços vetoriais', 'Valores próprios', 'Produto interno'] },
          { code: 'RM1', name: 'Resistência de Materiais 1', shortName: 'RM1', year: 2, semester: 1, ects: 6, topics: ['Tensões e deformações', 'Flexão', 'Torção', 'Critérios de cedência'] },
          { code: 'FLUID', name: 'Mecânica de Fluidos', shortName: 'MFluids', year: 2, semester: 2, ects: 6, topics: ['Estática', 'Análise integral', 'Condutas', 'Turbulência'] },
          { code: 'TERMO', name: 'Termodinâmica Aplicada', shortName: 'Termo', year: 2, semester: 2, ects: 6, topics: ['Entropia', 'Ciclos Rankine/Brayton', 'Ar húmido'] },
          { code: 'PMAC', name: 'Projeto de Máquinas', shortName: 'Proj. Máq.', year: 3, semester: 1, ects: 6, topics: ['Fadiga', 'Veios', 'Engrenagens', 'Rolamentos'] },
        ],
      },
      {
        id: 'leic-feup',
        name: 'Licenciatura em Engenharia Informática e Computação (L.EIC)',
        shortName: 'L.EIC',
        courses: [
          { code: 'FP', name: 'Fundamentos da Programação', shortName: 'FP', year: 1, semester: 1, ects: 6, topics: ['Python', 'Recursão', 'Coleções'] },
          { code: 'AED', name: 'Algoritmos e Estruturas de Dados', shortName: 'AED', year: 2, semester: 1, ects: 6, topics: ['Complexidade', 'Árvores', 'Grafos'] },
          { code: 'BD', name: 'Bases de Dados', shortName: 'BD', year: 2, semester: 1, ects: 6, topics: ['UML/Relacional', 'SQL', 'Índices'] },
          { code: 'SO', name: 'Sistemas Operativos', shortName: 'SO', year: 2, semester: 2, ects: 6, topics: ['Processos', 'Concorrência', 'Memória'] },
          { code: 'ES', name: 'Engenharia de Software', shortName: 'ES', year: 2, semester: 2, ects: 6, topics: ['Scrum', 'Design patterns', 'Testes'] },
        ],
      },
    ],
  },
  {
    id: 'ua',
    name: 'UA — Universidade de Aveiro',
    shortName: 'UA',
    degrees: [
      {
        id: 'em-ua',
        name: 'Licenciatura em Engenharia Mecânica (LEM)',
        shortName: 'LEM',
        courses: [
          { code: 'C1', name: 'Cálculo I', shortName: 'Cálculo I', year: 1, semester: 1, ects: 6, topics: ['Limites', 'Derivadas', 'Integrais'] },
          { code: 'C2', name: 'Cálculo II', shortName: 'Cálculo II', year: 1, semester: 2, ects: 6, topics: ['Séries', 'Cálculo multivariável', 'Integrais duplos/triplos'] },
          { code: 'RM', name: 'Resistência de Materiais', shortName: 'RM', year: 2, semester: 1, ects: 6, topics: ['Tração', 'Torção', 'Flexão'] },
          { code: 'MF', name: 'Mecânica dos Fluidos', shortName: 'MF', year: 2, semester: 2, ects: 6, topics: ['Estática', 'Dinâmica', 'Condutas'] },
        ],
      },
    ],
  },
  {
    id: 'uc',
    name: 'UC — Universidade de Coimbra (FCTUC)',
    shortName: 'FCTUC',
    degrees: [
      {
        id: 'lei-uc',
        name: 'Licenciatura em Engenharia Informática',
        shortName: 'LEI',
        courses: [
          { code: 'PPP', name: 'Princípios de Programação Procedimental', shortName: 'PPP', year: 1, semester: 2, ects: 6, topics: ['Linguagem C', 'Ponteiros', 'Ficheiros'] },
          { code: 'AED', name: 'Algoritmos e Estruturas de Dados', shortName: 'AED', year: 2, semester: 1, ects: 6, topics: ['Árvores', 'Grafos', 'Ordenação'] },
          { code: 'SO', name: 'Sistemas Operativos', shortName: 'SO', year: 2, semester: 1, ects: 6, topics: ['Threads', 'IPC', 'Gestão de memória'] },
          { code: 'COMP', name: 'Compiladores', shortName: 'Compiladores', year: 3, semester: 1, ects: 6, topics: ['Lex', 'Yacc', 'AST e geração de código'] },
        ],
      },
    ],
  },
  {
    id: 'uminho',
    name: 'UMinho — Universidade do Minho',
    shortName: 'UMinho',
    degrees: [
      {
        id: 'lei-um',
        name: 'Licenciatura em Engenharia Informática',
        shortName: 'LEI',
        courses: [
          { code: 'PF', name: 'Programação Funcional', shortName: 'PF', year: 1, semester: 1, ects: 6, topics: ['Haskell', 'Recursão', 'Tipos algébricos'] },
          { code: 'PI', name: 'Programação Imperativa', shortName: 'PI', year: 1, semester: 2, ects: 6, topics: ['C', 'Apontadores', 'Estruturas dinâmicas'] },
          { code: 'ALG', name: 'Algoritmos e Complexidade', shortName: 'AlgC', year: 2, semester: 1, ects: 6, topics: ['Tabelas de hash', 'Grafos', 'Heaps'] },
          { code: 'SO', name: 'Sistemas Operativos', shortName: 'SO', year: 2, semester: 2, ects: 6, topics: ['Processos', 'Pipes', 'Sinais'] },
        ],
      },
    ],
  },
  {
    id: 'escola-secundario',
    name: 'Ensino Secundário / Escola (Portugal)',
    shortName: 'Secundário',
    degrees: [
      {
        id: 'sec-ct',
        name: 'Ciências e Tecnologias (10.º–12.º)',
        shortName: 'Ciências',
        courses: [
          { code: 'MAT-A', name: 'Matemática A', shortName: 'Mat. A', year: 1, semester: 1, ects: 6, topics: ['Geometria e vetores', 'Funções e derivadas', 'Probabilidades e combinatória', 'Complexos'] },
          { code: 'FQA', name: 'Física e Química A', shortName: 'FQ A', year: 1, semester: 1, ects: 6, topics: ['Mecânica e energia', 'Ondas e eletromagnetismo', 'Ligação e reações químicas', 'Equilíbrio químico'] },
          { code: 'BGEO', name: 'Biologia e Geologia', shortName: 'Bio/Geo', year: 1, semester: 2, ects: 6, topics: ['Biomoléculas e célula', 'Fotossíntese e respiração', 'Tectónica e rochas', 'Evolução'] },
          { code: 'PT', name: 'Português', shortName: 'Português', year: 2, semester: 1, ects: 6, topics: ['Poesia trovadoresca e Camões', 'Fernando Pessoa', 'Memorial do Convento', 'Gramática e texto argumentativo'] },
          { code: 'ING', name: 'Inglês', shortName: 'Inglês', year: 2, semester: 2, ects: 4, topics: ['Reading comprehension', 'Essay & writing', 'Grammar B2/C1'] },
        ],
      },
      {
        id: 'sec-se',
        name: 'Ciências Socioeconómicas (10.º–12.º)',
        shortName: 'Economia',
        courses: [
          { code: 'MAT-A', name: 'Matemática A', shortName: 'Mat. A', year: 1, semester: 1, ects: 6, topics: ['Funções', 'Probabilidades', 'Combinatória', 'Derivadas'] },
          { code: 'ECON-A', name: 'Economia A', shortName: 'Economia', year: 1, semester: 1, ects: 6, topics: ['Consumo e poupança', 'Produção e mercados', 'Inflação e PIB', 'Política económica'] },
          { code: 'GEOG-A', name: 'Geografia A', shortName: 'Geografia', year: 1, semester: 2, ects: 6, topics: ['População e povoamento', 'Recursos hídricos e climáticos', 'Desenvolvimento e UE'] },
          { code: 'PT', name: 'Português', shortName: 'Português', year: 2, semester: 1, ects: 6, topics: ['Obras literárias', 'Análise crítica', 'Gramática'] },
        ],
      },
    ],
  },
];

export function getUniversityById(
  universityId: string,
  catalog: UniversityCatalogEntry[] = PORTUGAL_CURRICULA,
): UniversityCatalogEntry | undefined {
  return catalog.find((u) => u.id === universityId);
}

export function getDegreeCurriculum(
  universityId: string,
  degreeId: string,
  catalog: UniversityCatalogEntry[] = PORTUGAL_CURRICULA,
): DegreeCurriculum | undefined {
  return getUniversityById(universityId, catalog)?.degrees.find((d) => d.id === degreeId);
}

/** Constrói registos iniciais de histórico para todas as cadeiras do plano curricular selecionado, suportando anos simultâneos (ex: Licenciatura + Mestrado). */
export function buildInitialCompletedRecords(
  universityId: string,
  degreeId: string,
  currentYear: 1 | 2 | 3 | 4 | 5,
  currentSemester: 1 | 2,
  catalog: UniversityCatalogEntry[] = PORTUGAL_CURRICULA,
  activeYears?: number[],
): CompletedCourseRecord[] {
  const degree = getDegreeCurriculum(universityId, degreeId, catalog);
  if (!degree) return [];

  const targetActiveYears =
    activeYears && activeYears.length > 0 ? activeYears : [currentYear];
  const minActiveYear = Math.min(...targetActiveYears);

  return degree.courses.map((c) => {
    const isSelectedYear = targetActiveYears.includes(c.year);
    const isCurrentSlot = isSelectedYear && c.semester === currentSemester;
    const isPastYear = c.year < minActiveYear;
    const isPastSameActiveYear = isSelectedYear && c.semester < currentSemester;

    return {
      id: `hist-${universityId}-${degreeId}-${c.code.toLowerCase()}`,
      code: c.code,
      name: c.name,
      year: c.year,
      semester: c.semester,
      ects: c.ects,
      ...(c.optional ? { isOptional: true } : {}),
      status: c.optional
        ? 'por_fazer'
        : isPastYear || isPastSameActiveYear
          ? 'aprovada'
          : isCurrentSlot
            ? 'a_fazer'
            : 'por_fazer',
    };
  });
}

/** Converte as cadeiras em curso (`a_fazer`) do currículo num array `Course[]` compatível com a Unipedia. */
function compactCurriculumKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizedWordTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Encontra o índice de uma cadeira no histórico do aluno usando sigla, shortName do catálogo,
 * iniciais do nome e correspondência normalizada sem acentos/espaços (ex: "C3 D" ↔ "C3D", "MdF" ↔ "MDF").
 */
export function findMatchingCourseRecordIndex(
  records: CompletedCourseRecord[],
  candidate: { code?: string; name: string },
  templates: CurriculumCourseTemplate[] = [],
): number {
  const codeKey = candidate.code ? compactCurriculumKey(candidate.code) : '';
  const nameKey = compactCurriculumKey(candidate.name);
  const nameTokens = normalizedWordTokens(candidate.name);

  if (!codeKey && !nameKey) return -1;

  const tplByCode = new Map<string, CurriculumCourseTemplate>();
  for (const t of templates) {
    tplByCode.set(compactCurriculumKey(t.code), t);
  }

  // 1. Correspondência exata por código, shortName ou nome normalizado
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    const rCode = compactCurriculumKey(r.code);
    const rName = compactCurriculumKey(r.name);
    const tpl = tplByCode.get(rCode);
    const rShort = tpl ? compactCurriculumKey(tpl.shortName) : '';

    if (
      (codeKey && (rCode === codeKey || rShort === codeKey || rName === codeKey)) ||
      (nameKey && (rName === nameKey || rCode === nameKey || (rShort && rShort === nameKey)))
    ) {
      return i;
    }
  }

  // 2. Correspondência parcial por inclusão de frase completa (>= 5 chars) sem confundir I/II/III
  const romanOrNum = new Set(['1', '2', '3', '4', '5', 'i', 'ii', 'iii', 'iv', 'v']);
  const candNumTokens = nameTokens.filter((t) => romanOrNum.has(t));

  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    const rName = compactCurriculumKey(r.name);
    const rTokens = normalizedWordTokens(r.name);
    const rNumTokens = rTokens.filter((t) => romanOrNum.has(t));

    if (
      candNumTokens.length > 0 &&
      rNumTokens.length > 0 &&
      candNumTokens.join(',') !== rNumTokens.join(',')
    ) {
      continue;
    }

    if (
      nameKey.length >= 5 &&
      rName.length >= 5 &&
      (rName.includes(nameKey) || nameKey.includes(rName))
    ) {
      return i;
    }
  }

  return -1;
}

export interface ImportedRecordCourseInput {
  code?: string;
  name: string;
  ects?: number;
  status: CompletedCourseRecord['status'];
  grade?: number;
}

/**
 * Aplica cadeiras vindas de horário/pauta partilhados ao histórico de onboarding.
 * Quando `replaceActiveScope` é true (ex: foto do horário ou Google Agenda), apenas as
 * cadeiras presentes no horário ficam «a_fazer»; sugestões anteriores não presentes passam para «por_fazer».
 */
export function applyImportedScheduleRecords(
  prevRecords: CompletedCourseRecord[],
  importedCourses: ImportedRecordCourseInput[],
  options: {
    primaryAcademicYear: number;
    currentSemester: 1 | 2;
    defaultEcts?: number;
    templates?: CurriculumCourseTemplate[];
    replaceActiveScope: boolean;
  },
): CompletedCourseRecord[] {
  const next = [...prevRecords];
  const matchedActiveIds = new Set<string>();
  const templates = options.templates ?? [];

  for (const item of importedCourses) {
    const idx = findMatchingCourseRecordIndex(next, { code: item.code, name: item.name }, templates);
    if (idx >= 0) {
      const current = next[idx]!;
      next[idx] = {
        ...current,
        status: item.status,
        grade: item.grade ?? current.grade,
      };
      if (item.status === 'a_fazer') {
        matchedActiveIds.add(current.id);
      }
    } else {
      const code = (item.code ?? item.name.slice(0, 6)).trim().toUpperCase();
      const newId = `hist-sched-${compactCurriculumKey(code || item.name) || Math.random().toString(36).slice(2, 8)}-${next.length}`;
      next.unshift({
        id: newId,
        code,
        name: item.name,
        year: options.primaryAcademicYear,
        semester: options.currentSemester,
        ects: item.ects ?? options.defaultEcts ?? 6,
        grade: item.grade,
        status: item.status,
      });
      if (item.status === 'a_fazer') {
        matchedActiveIds.add(newId);
      }
    }
  }

  if (!options.replaceActiveScope || matchedActiveIds.size === 0) {
    return next;
  }

  return next.map((r) => {
    if (r.status === 'a_fazer' && !matchedActiveIds.has(r.id)) {
      return { ...r, status: 'por_fazer' };
    }
    return r;
  });
}

export function buildActiveCoursesFromCurriculum(
  universityId: string,
  degreeId: string,
  records: CompletedCourseRecord[],
  existingCourses: Course[] = [],
  catalog: UniversityCatalogEntry[] = PORTUGAL_CURRICULA,
): Course[] {
  const degree = getDegreeCurriculum(universityId, degreeId, catalog);
  const templates = degree?.courses ?? [];
  const activeRecords = records.filter((r) => r.status === 'a_fazer');

  return activeRecords.map((rec, idx) => {
    const recCodeKey = compactCurriculumKey(rec.code);
    const recNameKey = compactCurriculumKey(rec.name);
    const existing = existingCourses.find(
      (ec) =>
        compactCurriculumKey(ec.code) === recCodeKey ||
        compactCurriculumKey(ec.shortName) === recCodeKey ||
        compactCurriculumKey(ec.name) === recNameKey,
    );
    const tpl = templates.find((t) => compactCurriculumKey(t.code) === recCodeKey);

    if (existing) return existing;

    const topicTitles = tpl?.topics ?? [rec.name];
    const mappedTopics: Topic[] = topicTitles.map((title, tidx) => ({
      id: `top-${degreeId}-${rec.code.toLowerCase()}-${tidx + 1}`,
      title,
      status: 'todo',
      confidence: 3,
    }));

    return {
      id: `uc-${degreeId}-${rec.code.toLowerCase()}`,
      code: rec.code,
      name: rec.name,
      shortName: tpl?.shortName ?? rec.code,
      ects: rec.ects,
      color: tpl?.color ?? COURSE_PALETTE[idx % COURSE_PALETTE.length],
      targetGrade: 14,
      topics: mappedTopics,
    };
  });
}

/** Média ponderada por ECTS das cadeiras concluídas com nota atribuída. */
export function computeWeightedAverage(records: CompletedCourseRecord[]): number | null {
  const graded = records.filter((r) => r.status === 'aprovada' && typeof r.grade === 'number' && r.grade >= 10);
  if (graded.length === 0) return null;
  const totalEcts = graded.reduce((acc, r) => acc + (r.ects || 6), 0);
  if (totalEcts === 0) return null;
  const sum = graded.reduce((acc, r) => acc + (r.grade ?? 0) * (r.ects || 6), 0);
  return Math.round((sum / totalEcts) * 10) / 10;
}

export interface SharedCurriculumInput {
  universityId: string;
  universityName: string;
  universityShortName?: string;
  degreeId: string;
  degreeName: string;
  degreeShortName?: string;
  courses: CurriculumCourseTemplate[];
}

/** Junta planos curriculares locais aos planos partilhados pelos alunos no Firestore. */
export function mergeCurriculumCatalog(
  base: UniversityCatalogEntry[],
  shared: SharedCurriculumInput[],
): UniversityCatalogEntry[] {
  const map = new Map<string, UniversityCatalogEntry>(
    base.map((u) => [u.id, { ...u, degrees: [...u.degrees] }]),
  );

  for (const item of shared) {
    if (!item.universityId || !item.degreeId || !Array.isArray(item.courses)) continue;
    const existingUni = map.get(item.universityId) ?? {
      id: item.universityId,
      name: item.universityName,
      shortName: item.universityShortName || item.universityName.slice(0, 12),
      degrees: [],
    };
    const degreeExists = existingUni.degrees.some((d) => d.id === item.degreeId);
    if (!degreeExists) {
      existingUni.degrees = [
        ...existingUni.degrees,
        {
          id: item.degreeId,
          name: item.degreeName,
          shortName: item.degreeShortName || item.degreeName.slice(0, 12),
          courses: item.courses,
        },
      ];
    }
    map.set(item.universityId, existingUni);
  }

  return Array.from(map.values());
}
