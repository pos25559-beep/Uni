import type { CompletedCourseRecord, Course, CourseColor, Topic } from '../types';

export interface CurriculumCourseTemplate {
  code: string;
  name: string;
  shortName: string;
  year: 1 | 2 | 3;
  semester: 1 | 2;
  ects: number;
  topics: string[];
  color?: CourseColor;
}

export interface DegreeCurriculum {
  id: string;
  name: string;
  shortName: string;
  courses: CurriculumCourseTemplate[];
}

export interface UniversityCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  degrees: DegreeCurriculum[];
}

const COURSE_PALETTE: CourseColor[] = [
  'violet',
  'sky',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
  'lime',
];

export const PORTUGAL_CURRICULA: UniversityCatalogEntry[] = [
  {
    id: 'nova-fct',
    name: 'NOVA FCT — Faculdade de Ciências e Tecnologia',
    shortName: 'NOVA FCT',
    degrees: [
      {
        id: 'lemc',
        name: 'Licenciatura em Engenharia Mecânica (LEMc)',
        shortName: 'LEMc',
        courses: [
          // 1.º Ano
          { code: 'AM1', name: 'Análise Matemática I', shortName: 'AM1', year: 1, semester: 1, ects: 6, topics: ['Limites e continuidade', 'Derivadas', 'Primitivas e integrais', 'Séries numéricas'] },
          { code: 'ALGA', name: 'Álgebra Linear e Geometria Analítica', shortName: 'ALGA', year: 1, semester: 1, ects: 6, topics: ['Matrizes e determinantes', 'Espaços vetoriais', 'Aplicações lineares', 'Valores próprios'] },
          { code: 'F1', name: 'Física I', shortName: 'Física I', year: 1, semester: 1, ects: 6, topics: ['Cinemática', 'Leis de Newton', 'Trabalho e energia', 'Corpo rígido'] },
          { code: 'DM', name: 'Desenho de Engenharia Mecânica', shortName: 'DEM', year: 1, semester: 1, ects: 6, topics: ['Projeções ortogonais', 'Cortes e secções', 'Cotagem e tolerâncias', 'CAD 3D'] },
          { code: 'QG', name: 'Química Geral', shortName: 'Química', year: 1, semester: 1, ects: 6, topics: ['Estrutura atómica', 'Ligação química', 'Equilíbrio químico', 'Eletroquímica'] },
          { code: 'AM2', name: 'Análise Matemática II', shortName: 'AM2', year: 1, semester: 2, ects: 6, topics: ['Cálculo diferencial em R^n', 'Extremos condicionados', 'Integrais múltiplos', 'Curvas e superfícies'] },
          { code: 'F2', name: 'Física II', shortName: 'Física II', year: 1, semester: 2, ects: 6, topics: ['Eletrostática', 'Corrente contínua', 'Magnetostática', 'Indução eletromagnética'] },
          { code: 'CM1', name: 'Ciência dos Materiais', shortName: 'Materiais', year: 1, semester: 2, ects: 6, topics: ['Estrutura cristalina', 'Diagramas de fase', 'Tratamentos térmicos', 'Propriedades mecânicas'] },
          { code: 'PROG', name: 'Programação', shortName: 'Programação', year: 1, semester: 2, ects: 6, topics: ['Algoritmia', 'Ciclos e funções', 'Estruturas de dados', 'Cálculo numérico básico'] },
          // 2.º Ano
          { code: 'AM3', name: 'Cálculo III D / Análise Matemática III', shortName: 'Cálculo III D', year: 2, semester: 1, ects: 6, topics: ['Campos vetoriais', 'Integrais de linha e superfície', 'Teorema de Stokes e Gauss', 'EDO e Laplace'] },
          { code: 'ME', name: 'Mecânica Aplicada', shortName: 'Mecânica', year: 2, semester: 1, ects: 6, topics: ['Estática', 'Equilíbrio de estruturas', 'Dinâmica da partícula', 'Dinâmica do corpo rígido'] },
          { code: 'MS1', name: 'Mecânica dos Sólidos I', shortName: 'MS1', year: 2, semester: 1, ects: 6, topics: ['Tensão e deformação', 'Tração e compressão', 'Torção', 'Flexão simples'] },
          { code: 'TD1', name: 'Termodinâmica', shortName: 'Termodinâmica', year: 2, semester: 1, ects: 6, topics: ['1.ª Lei da Termodinâmica', 'Substâncias puras', '2.ª Lei e entropia', 'Ciclos motores'] },
          { code: 'MN', name: 'Métodos Numéricos', shortName: 'Métodos Num.', year: 2, semester: 2, ects: 6, topics: ['Erros numéricos', 'Sistemas lineares', 'Interpolação', 'Integração e EDOs'] },
          { code: 'MS2', name: 'Mecânica dos Sólidos II', shortName: 'MS2', year: 2, semester: 2, ects: 6, topics: ['Estado plano de tensões', 'Critérios de cedência', 'Flexão desviada', 'Encurvadura de colunas'] },
          { code: 'MDF', name: 'Mecânica dos Fluidos', shortName: 'MdF', year: 2, semester: 2, ects: 6, topics: ['Estática dos fluidos', 'Equação de Bernoulli', 'Escoamento viscoso em condutas', 'Análise dimensional'] },
          { code: 'TM', name: 'Tecnologia Mecânica', shortName: 'Tec. Mec.', year: 2, semester: 2, ects: 6, topics: ['Fundição e deformação plástica', 'Maquinagem', 'Soldadura', 'Metrologia'] },
          // 3.º Ano
          { code: 'TC', name: 'Transferência de Calor', shortName: 'Transf. Calor', year: 3, semester: 1, ects: 6, topics: ['Condução estacionária e transiente', 'Convecção forçada e natural', 'Permutadores de calor', 'Radiação térmica'] },
          { code: 'OM1', name: 'Órgãos de Máquinas I', shortName: 'Órgãos I', year: 3, semester: 1, ects: 6, topics: ['Fadiga de materiais', 'Veios e eixos', 'Rolamentos', 'Ligações aparafusadas e soldadas'] },
          { code: 'AC', name: 'Automação e Controlo', shortName: 'Controlo', year: 3, semester: 1, ects: 6, topics: ['Sistemas lineares', 'Resposta temporal e frequencial', 'Estabilidade', 'Controladores PID'] },
          { code: 'EF', name: 'Elementos Finitos', shortName: 'Elem. Finitos', year: 3, semester: 2, ects: 6, topics: ['Formulação variacional', 'Elementos 1D e 2D', 'Análise estrutural', 'Convergência de malha'] },
          { code: 'OM2', name: 'Órgãos de Máquinas II', shortName: 'Órgãos II', year: 3, semester: 2, ects: 6, topics: ['Engrenagens cilíndricas', 'Correias e correntes', 'Embraiagens e travões', 'Lubrificação'] },
          { code: 'PROJL', name: 'Projeto de Engenharia Mecânica', shortName: 'Projeto LEMc', year: 3, semester: 2, ects: 12, topics: ['Especificação e conceito', 'Dimensionamento estrutural', 'Seleção de materiais', 'Prototipagem'] },
        ],
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

/** Constrói registos iniciais de histórico para todas as cadeiras do plano curricular selecionado. */
export function buildInitialCompletedRecords(
  universityId: string,
  degreeId: string,
  currentYear: 1 | 2 | 3,
  currentSemester: 1 | 2,
  catalog: UniversityCatalogEntry[] = PORTUGAL_CURRICULA,
): CompletedCourseRecord[] {
  const degree = getDegreeCurriculum(universityId, degreeId, catalog);
  if (!degree) return [];

  return degree.courses.map((c) => {
    const isPastYear = c.year < currentYear;
    const isCurrentSlot = c.year === currentYear && c.semester === currentSemester;
    const isPastSameYear = c.year === currentYear && c.semester < currentSemester;

    return {
      id: `hist-${universityId}-${degreeId}-${c.code.toLowerCase()}`,
      code: c.code,
      name: c.name,
      year: c.year,
      semester: c.semester,
      ects: c.ects,
      status: isPastYear || isPastSameYear ? 'aprovada' : isCurrentSlot ? 'a_fazer' : 'por_fazer',
    };
  });
}

/** Converte as cadeiras em curso (`a_fazer`) do currículo num array `Course[]` compatível com a Unipedia. */
export function buildActiveCoursesFromCurriculum(
  universityId: string,
  degreeId: string,
  records: CompletedCourseRecord[],
  existingCourses: Course[] = [],
): Course[] {
  const degree = getDegreeCurriculum(universityId, degreeId);
  const templates = degree?.courses ?? [];
  const activeRecords = records.filter((r) => r.status === 'a_fazer');

  return activeRecords.map((rec, idx) => {
    const existing = existingCourses.find(
      (ec) =>
        ec.code.toLowerCase() === rec.code.toLowerCase() ||
        ec.name.toLowerCase() === rec.name.toLowerCase(),
    );
    const tpl = templates.find((t) => t.code.toLowerCase() === rec.code.toLowerCase());

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
