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

export type MaterialProvider = 'gdrive' | 'onedrive' | 'notebooklm' | 'clip' | 'link';

export interface Material {
  id: ID;
  courseId?: ID;
  title: string;
  url: string;
  provider: MaterialProvider;
  mimeType?: string;
  /** ISO datetime */
  modifiedAt?: string;
  pinned?: boolean;
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
  theme: 'dark' | 'light';
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
