// Contrato de dados partilhado por toda a app. NÃO alterar sem coordenar.

export type ID = string;

/** De onde veio o registo — permite re-sincronizar uma fonte sem tocar nas outras. */
export type Source = 'local' | 'clip' | 'google' | 'outlook';

export type CourseColor =
  | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'lime';

export type TopicStatus = 'todo' | 'learning' | 'review' | 'done';

export interface PracticeCard {
  id: ID;
  prompt: string;
  answer: string;
  /** Nome do material ou slide que fundamentou o cartão (opcional). */
  sourceTitle?: string;
  /** yyyy-MM-dd */
  createdAt: string;
  lastScore?: 1 | 2 | 3;
}

export interface TopicRecallSample {
  /** yyyy-MM-dd */
  date: string;
  score: 1 | 2 | 3;
  hits?: number;
  total?: number;
}

export interface Topic {
  id: ID;
  title: string;
  status: TopicStatus;
  /** Confiança do aluno na matéria, 1 (fraca) a 5 (dominada). */
  confidence: 1 | 2 | 3 | 4 | 5;
  /** yyyy-MM-dd */
  lastStudied?: string;
  /** Intervalo atual de repetição espaçada (1, 3, 7 ou 21 dias). */
  srsIntervalDays?: number;
  /** Próxima data recomendada de revisão espaçada (yyyy-MM-dd). */
  nextReviewDate?: string;
  /** Último resultado de recall ativo pós-sessão: 1 = rever já, 2 = com esforço, 3 = dominei. */
  lastRecallScore?: 1 | 2 | 3;
  /** Total de verificações de recall ativo concluídas neste tópico. */
  recallCount?: number;
  /** Número de recalls bem-sucedidos (com esforço ou dominei). */
  recallSuccessCount?: number;
  /** Sequência atual de recalls sem precisar de «Rever já». */
  recallStreak?: number;
  /** Últimas 10 tentativas de prática/recall ativo neste tópico. */
  recallHistory?: TopicRecallSample[];
  /** Cartões de prática rápida guardados para o tópico (reutilizáveis offline, máx. 8). */
  practiceCards?: PracticeCard[];
}

export interface CourseProfessor {
  name: string;
  role: 'Regente' | 'Teórica' | 'Prática' | 'Laboratório';
  email?: string;
  office?: string;
  officeHours?: string;
}

export interface CourseRules {
  evaluationFormula: string;
  minimumGradeRule: string;
  examRule: string;
  attendanceRule: string;
  officeHours?: string;
  professors?: CourseProfessor[];
  syllabusSummary?: string[];
  clipFichaUrl?: string;
}

export interface Course {
  id: ID;
  code: string;
  name: string;
  shortName: string;
  ects: number;
  color: CourseColor;
  teacher?: string;
  /** Nota final desejada (0–20). */
  targetGrade: number;
  topics: Topic[];
  clipUrl?: string;
  notebookUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  oneDriveFolderUrl?: string;
  sharedDriveUrl?: string;
  sharedOneDriveUrl?: string;
  rules?: CourseRules;
}

export type AssessmentKind = 'exame' | 'teste' | 'trabalho' | 'projeto' | 'quiz';

export interface Assessment {
  id: ID;
  courseId: ID;
  kind: AssessmentKind;
  title: string;
  /** ISO datetime (ex.: 2026-12-03T14:00:00). */
  date: string;
  /** Peso na nota final, em % (0–100). */
  weight: number;
  /** Nota obtida, 0–20. undefined = ainda não avaliado. */
  grade?: number;
  topicIds: ID[];
  location?: string;
  notes?: string;
  source: Source;
}

export type ClassType = 'T' | 'TP' | 'P' | 'OT';

export interface ClassSlot {
  id: ID;
  courseId: ID;
  type: ClassType;
  /** 0 = domingo … 6 = sábado (igual a Date.getDay()). */
  weekday: number;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  room?: string;
  source: Source;
}

export interface StudySessionReason {
  code:
    | 'exam_prep'
    | 'exam_marathon'
    | 'exam_eve'
    | 'srs_due'
    | 'weak_topic'
    | 'coverage'
    | 'starter'
    | 'briefing'
    | 'overdue';
  examDays?: number;
  weight?: number;
  label?: string;
}

export interface StudySession {
  id: ID;
  courseId: ID;
  topicId?: ID;
  assessmentId?: ID;
  /** Material sugerido ou associado a este bloco de estudo (opcional). */
  materialId?: ID;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm (opcional) */
  start?: string;
  /** Minutos planeados. */
  minutes: number;
  done: boolean;
  /** Minutos realmente estudados (preenchido ao concluir / pelo temporizador). */
  actualMinutes?: number;
  notes?: string;
  /** Explicação estruturada do motivo pelo qual este bloco foi agendado. */
  reason?: StudySessionReason;
  /** true = criada pelo gerador de plano (pode ser substituída ao regenerar, salvo se locked). */
  generated: boolean;
  /** true = bloco fixado manualmente pelo aluno (preservado ao recalcular o plano). */
  locked?: boolean;
  /** N.º de saídas do ecrã/separador durante o Modo Foco (opcional). */
  focusDistractions?: number;
  /** Segundos acumulados fora do ecrã durante o Modo Foco (opcional). */
  focusAwaySeconds?: number;
  /** Indica se algum nível de Escudo Anti-distração esteve ativo na sessão. */
  focusShieldUsed?: boolean;
  /** Acertos (com esforço ou dominei) na micro-prática pós-foco. */
  practiceHits?: number;
  /** Total de cartões respondidos na micro-prática pós-foco. */
  practiceTotal?: number;
}

export interface Task {
  id: ID;
  courseId?: ID;
  title: string;
  /** yyyy-MM-dd */
  due?: string;
  done: boolean;
  priority: 1 | 2 | 3;
}

export type MaterialProvider = 'gdrive' | 'onedrive' | 'notebooklm' | 'clip' | 'link' | 'upload';

export type MaterialCategory =
  | 'teste_antigo'
  | 'exame_antigo'
  | 'ficha'
  | 'sebenta'
  | 'slide_oficial'
  | 'relatorio'
  | 'outro';

export interface Material {
  id: ID;
  courseId?: ID;
  title: string;
  url: string;
  provider: MaterialProvider;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  /** ISO datetime */
  modifiedAt?: string;
  pinned?: boolean;
  category?: MaterialCategory;
  year?: string;
  epoch?: string;
  hasSolution?: boolean;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  /** ISO datetime */
  start: string;
  /** ISO datetime */
  end: string;
  allDay?: boolean;
  source: Source;
  location?: string;
  courseId?: ID;
}

export type IntegrationKey = 'google' | 'gemini' | 'clip';

export interface IntegrationStatus {
  connected: boolean;
  account?: string;
  /** ISO datetime */
  lastSync?: string;
  error?: string;
}

export type ThemePalette = 'caderno' | 'botanico' | 'ardosia' | 'terracota' | 'oceano' | 'cafe' | 'menta';
export type AppTone = 'vibrante' | 'serio';
export type UniLiveCompanionsMode = 'all' | 'solo' | 'off';
export type HubFlowId = 'caloiro_inicio' | 'caloiro_meio' | 'veterano_inicio' | 'veterano_meio';

export type UniSkinId =
  | 'classic'
  | 'sky'
  | 'peach'
  | 'blush'
  | 'mint'
  | 'cream'
  | 'crimson'
  | 'butter'
  | 'sage'
  | 'terracotta'
  | 'espresso'
  | 'ink';

export type UniPetId = 'none' | 'cat' | 'owl' | 'fox' | 'turtle' | 'rabbit';
export type UniVoiceName = 'Aoede' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface UniVoiceConfig {
  voiceName: UniVoiceName;
  stylePrompt?: string;
  coHostVoiceName?: UniVoiceName;
}

export type AppLanguage = 'pt-PT' | 'pt-BR' | 'es' | 'en';
export type GradingScale = 'pt20' | 'scale10' | 'pct100';

export type PlannerStrategy = 'balanced' | 'exams_first' | 'srs_focus' | 'catch_up';
export type PlannerDayPeriod = 'auto' | 'morning' | 'afternoon' | 'evening';
export type PlannerWindowMode = PlannerDayPeriod | 'all_day';
export type PlannerContentMix = 'balanced' | 'theory_first' | 'practice_first';

export interface WeekdayAvailability {
  enabled: boolean;
  minutes: number;
  window: PlannerWindowMode;
  blockedPeriods?: Array<'morning' | 'afternoon' | 'evening'>;
}

export interface PreExamMarathonConfig {
  enabled: boolean;
  daysBefore: 1 | 2 | 3;
  dailyMinutes: 360 | 480 | 600;
}

export interface PlannerPreferences {
  horizonDays: 7 | 14 | 21;
  preferredPeriod: PlannerDayPeriod;
  blockMinutes: 25 | 35 | 50 | 75;
  strategy: PlannerStrategy;
  boostCourseIds?: ID[];
  pausedCourseIds?: ID[];
  includeOverdue?: boolean;
  /** Em Modo Teste único, se verdadeiro dedica 100% do tempo só à prova urgente. */
  exclusiveTestFocus?: boolean;
  /** Disponibilidade individual por dia da semana ("0" = dom … "6" = sáb). */
  weekdaySchedule?: Record<string, WeekdayAvailability>;
  /** Aproveitar janelas livres >= 35m entre aulas durante o dia. */
  fillClassGaps?: boolean;
  /** Modo Maratona Pré-Teste: liberta carga de dia inteiro nos N dias antes de testes/exames. */
  preExamMarathon?: PreExamMarathonConfig;
  /** Preferência de equilíbrio entre teoria base e prática/testes antigos. */
  contentMix?: PlannerContentMix;
  /** Último briefing em linguagem natural explicado ao Uni no construtor. */
  briefingNote?: string;
  /** @deprecated Substituído por `courseNotes` (com validade). Lido só para migrar. */
  briefingCourseFocus?: Record<string, string>;
  /** Nota de foco por cadeira com validade (do briefing ou do Uni). Expiradas são limpas no replan. */
  courseNotes?: Record<ID, PlannerCourseNote>;
  /** Exceções pontuais por data («esta sexta não posso»), por cima do horário semanal. */
  dateOverrides?: Record<string, PlannerDateOverride>;
  /** Até quando vale o reforço/pausa de cada cadeira (sem entrada = sem fim). */
  courseModeUntil?: Record<ID, string>;
  /** Modo de operação do Planeador: 'auto' recalcula; 'manual' preserva o controlo do aluno. */
  plannerMode?: 'auto' | 'manual';
  /** Quando o último briefing foi aplicado (ISO). */
  briefingAppliedAt?: string;
}

export interface PlannerCourseNote {
  text: string;
  /** Primeiro dia (yyyy-MM-dd) em que a nota vale; omisso = já. */
  from?: string;
  /** Último dia (yyyy-MM-dd) em que a nota vale. */
  until: string;
  source: 'briefing' | 'tool';
}

export interface PlannerDateOverride {
  enabled?: boolean;
  minutes?: number;
  window?: PlannerWindowMode;
}

export interface ExtraActivity {
  id: ID;
  label: string;
  kind: 'trabalho' | 'desporto' | 'nucleo' | 'musica' | 'outro';
  hoursPerWeek: number;
  /** 0 = domingo … 6 = sábado */
  weekdays: number[];
}

export interface Settings {
  userName: string;
  theme: 'system' | 'dark' | 'light';
  /** Paleta de cores do caderno selecionada pelo estudante. */
  themePalette?: ThemePalette;
  /** Tom visual & textual da app: expressivo (padrão) ou sério/minimalista. */
  appTone?: AppTone;
  /** Presença tímida e autónoma dos Unis no ecrã em todas as abas. */
  uniLiveCompanions?: UniLiveCompanionsMode;
  semesterName: string;
  /** yyyy-MM-dd */
  semesterStart: string;
  /** yyyy-MM-dd */
  semesterEnd: string;
  /** Minutos de estudo disponíveis por dia. */
  dailyStudyMinutes: number;
  /** Dias da semana em que estuda (0 = domingo … 6 = sábado). */
  studyDays: number[];
  geminiApiKey: string;
  geminiModel: string;
  googleClientId: string;
  /** Email institucional para avisos dos docentes e Gmail académico. */
  academicEmail?: string;
  /** Email pessoal para o Gemini AI e sincronização cloud (@gmail.com). */
  personalEmail?: string;
  /** Link do espaço pessoal do NotebookLM. */
  personalNotebookUrl?: string;
  /** Data ISO de aceitação da Política de Privacidade / Termos (RGPD Art. 7). */
  gdprAcceptedAt?: string;
  /** Versão da política aceite. */
  gdprPolicyVersion?: string;
  /** Confirmação mínima de idade (>= 13 anos em Portugal, Lei n.º 58/2019). */
  ageConfirmed13Plus?: boolean;
  /** Confirmação explícita de >= 18 anos para uso da API Gemini (ADR-001). */
  aiAgeConfirmed18Plus?: boolean;
  /** Consentimento explícito para envio de contexto/prints à Google Gemini API. */
  aiConsent?: boolean;
  /** Preferência explícita por sincronização cloud (Firebase Firestore). */
  cloudSyncConsent?: boolean;
  /** Indica se o utilizador escolheu continuar offline sem criar conta no ecrã inicial. */
  guestMode?: boolean;
  /** Indica se o utilizador já viu o carrossel de pré-login (/bem-vindo). */
  hasSeenWelcome?: boolean;
  /** Visual/acessório escolhido para o mascote Uni ('auto' adapta-se ao curso/cadeira). */
  uniAccessory?: 'auto' | 'default' | 'math' | 'tech' | 'health' | 'arts' | 'science' | 'humanities';
  /** Edição/tema de cor do mascote Uni (cores iniciais e colecionáveis de estudo). */
  uniSkin?: UniSkinId;
  /** Varia automaticamente a cor entre desbloqueadas nos companheiros discretos / a cada dia. */
  uniSkinAutoRotate?: boolean;
  /** Micropet de papelaria que acompanha o Uni (estilo Finch). */
  uniPet?: UniPetId;
  /** Tema visual e língua da interface (pt-PT ou en). */
  language?: AppLanguage;
  /** Escala de notas da instituição (0–20 PT, 0–10 ES/BR, 0–100%). */
  gradingScale?: GradingScale;
  /** Preferências guardadas do Criador de Planos em /plano. */
  plannerPrefs?: PlannerPreferences;
  /** Personalidade do Uni nas respostas do Tutor. */
  uniPersona?: 'amigo' | 'exigente' | 'calmo' | 'curioso' | 'treinador';
  /** Voz configurada por omissão para o Uni geral (timbre e estilo vocal). */
  uniVoice?: UniVoiceConfig;
  /** Indica se o tour guiado pós-onboarding já foi concluído. */
  tourCompleted?: boolean;
  /** Perfil pós-onboarding escolhido pelo aluno no Hub do Uni. */
  hubSetupFlow?: HubFlowId;
  /** Indica se o estudante concluiu (ou guardou) o assistente pós-guia do Hub. */
  hubSetupCompleted?: boolean;
  /** Indica se o estudante dispensou o lembrete de Hub pendente no Hoje. */
  hubSetupDismissed?: boolean;
  /** URLs de pastas partilhadas do Google Drive associadas ao Hub (ex.: Drive do curso/núcleo). */
  sharedHubDriveUrls?: string[];
  /** Lista de rotas/abas onde o cartão-guia do Uni de 1.ª visita já foi visto. */
  seenTabGuides?: string[];
  /** Preferências do sistema de notificação inteligente do Uni (estilo Duolingo). */
  notifications?: NotificationPreferences;
}

export interface NotificationPreferences {
  /** Consentimento explícito do estudante para receber lembretes locais/push. */
  enabled: boolean;
  /** Proteção de sequência diária (cancela automaticamente se já estudou hoje). */
  streakSaver: boolean;
  /** Resumo de revisões espaçadas (SRS) em atraso ou para hoje. */
  srsDue: boolean;
  /** Contagem decrescente inteligente para testes e exames (72h, 24h, 2h). */
  assessments: boolean;
  /** Avisos antes das aulas com indicação de sala. */
  classReminders: boolean;
  /** Pergunta pós-aula do Uni (como foi a aula e que matéria deu). */
  postClassCheckIn?: boolean;
  /** Atraso em minutos após o fim da aula para perguntar como foi. */
  postClassDelayMinutes?: 5 | 10 | 15;
  /** Check-in do Uni no final do dia (como foi o dia e o estudo). */
  eveningCheckIn?: boolean;
  /** Hora (17–22) para o balanço de fim de dia. */
  eveningHour?: number;
  /** Balanço semanal do Uni ao domingo. */
  sundayReview?: boolean;
  /** Hora (15–21) para o balanço de domingo. */
  sundayHour?: number;
  /** Alinhamento Modo Teste (< 10 dias: até que matéria sai, o que já estudou, como se sente). */
  examPrepCheckIn?: boolean;
  /** Minutos de antecedência para avisos de aula. */
  classBeforeMinutes: 15 | 30;
  /** Hora preferida (0–23) para o empurrão diário de streak/SRS. */
  preferredHour: number;
  /** Início das horas de silêncio em "HH:MM" (ex.: "22:30"). */
  quietStart: string;
  /** Fim das horas de silêncio em "HH:MM" (ex.: "08:30"). */
  quietEnd: string;
  /** Limite máximo de notificações por dia para evitar fadiga. */
  maxDailyNudges: 1 | 2 | 3 | 4 | 6;
}

export type StudyLogKind = 'class' | 'day' | 'week' | 'exam_prep';

export interface StudyLogMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export interface StudyLogEntry {
  id: ID;
  kind: StudyLogKind;
  /** yyyy-MM-dd */
  date: string;
  createdAt: string;
  courseId?: ID;
  classSlotId?: ID;
  assessmentId?: ID;
  /** Avaliação rápida: ex. 'clara' | 'mais_ou_menos' | 'dificil' | 'faltei' | 'produtivo' | 'cansado' | 'confiante' | 'ansioso'... */
  feeling: string;
  /** Energia ou confiança 1–5 declarada no momento */
  rating?: 1 | 2 | 3 | 4 | 5;
  /** Matéria dada na aula ou tópico principal */
  topicTitle?: string;
  /** IDs de tópicos alinhados (ex.: até que matéria sai no Modo Teste) */
  topicIds?: ID[];
  /** Resumo do que já estudou ou avançou */
  studiedSummary?: string;
  /** Dificuldades ou dúvidas declaradas */
  difficulties?: string;
  /** Foco ou método escolhido pelo aluno (ex.: "Refazer testes antigos", "Resolver exercícios") */
  studyFocus?: string;
  notes?: string;
  /** Histórico de mensagens da conversa no Diário do Uni */
  messages?: StudyLogMessage[];
}

export interface CompletedCourseRecord {
  id: ID;
  code: string;
  name: string;
  year: number;
  semester: 1 | 2;
  ects: number;
  grade?: number;
  status: 'aprovada' | 'a_fazer' | 'por_fazer';
  isOptional?: boolean;
  /** Anos curriculares em que uma opcional pode ser frequentada (ex: [4, 5] nos 2 anos de Mestrado). */
  eligibleYears?: number[];
}

export interface WeeklyCheckIn {
  id: ID;
  /** ISO date (yyyy-MM-dd) da semana do check-in */
  weekOf: string;
  createdAt: string;
  mood: 'confiante' | 'estavel' | 'pressionado' | 'atrasado';
  understoodTopics: string[];
  classDifficulties: string[];
  pendingNextWeek: string[];
  hardCourseIds: ID[];
  notes: string;
}

export interface AcademicProfile {
  onboardingCompleted: boolean;
  universityId: string;
  universityName: string;
  degreeId: string;
  degreeName: string;
  entryYear: number;
  currentAcademicYear: 1 | 2 | 3 | 4 | 5;
  academicCycle?: 'licenciatura' | 'mestrado' | 'misto';
  activeYears?: number[];
  currentSemester: 1 | 2;
  /** Meta total de ECTS do ciclo/percurso (ex.: 180 Licenciatura, 120 Mestrado, 300 Completo). */
  targetTotalEcts?: number;
  /** Créditos ECTS concluídos/aprovados até ao momento. */
  completedEcts?: number;
  /** Principais dificuldades declaradas na avaliação pessoal do onboarding. */
  learningChallenges?: string[];
  /** Atividades extracurriculares / trabalho com impacto na disponibilidade semanal. */
  extraActivities?: ExtraActivity[];
  difficultCourseIds: ID[];
  difficultTopicsNotes?: string;
  completedCourses: CompletedCourseRecord[];
}

export type TestModeKind = 'normal' | 'single_test' | 'multi_test';

export interface TestModeStatus {
  mode: TestModeKind;
  urgentAssessments: Array<{
    assessment: Assessment;
    course: Course;
    daysLeft: number;
  }>;
  urgentCourseIds: ID[];
}

export interface Collections {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  sessions: StudySession[];
  tasks: Task[];
  materials: Material[];
  events: CalendarEvent[];
}
