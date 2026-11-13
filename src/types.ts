// Contrato de dados partilhado por toda a app. NÃO alterar sem coordenar.

export type ID = string;

/** De onde veio o registo — permite re-sincronizar uma fonte sem tocar nas outras. */
export type Source = 'local' | 'clip' | 'google' | 'outlook';

export type CourseColor =
  | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'lime';

export type TopicStatus = 'todo' | 'learning' | 'review' | 'done';

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

export interface StudySession {
  id: ID;
  courseId: ID;
  topicId?: ID;
  assessmentId?: ID;
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
  /** true = criada pelo gerador de plano (pode ser substituída ao regenerar). */
  generated: boolean;
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

export type IntegrationKey = 'google' | 'microsoft' | 'gemini' | 'clip';

export interface IntegrationStatus {
  connected: boolean;
  account?: string;
  /** ISO datetime */
  lastSync?: string;
  error?: string;
}

export interface Settings {
  userName: string;
  theme: 'system' | 'dark' | 'light';
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
  msClientId: string;
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
  /** Edição/tema de cor do mascote Uni desbloqueado por estudo. */
  uniSkin?: 'classic' | 'crimson' | 'butter' | 'sage' | 'ink';
  /** Personalidade do Uni nas respostas do Tutor. */
  uniPersona?: 'amigo' | 'exigente' | 'calmo';
  /** Indica se o tour guiado pós-onboarding já foi concluído. */
  tourCompleted?: boolean;
  /** Lista de rotas/abas onde o cartão-guia do Uni de 1.ª visita já foi visto. */
  seenTabGuides?: string[];
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
