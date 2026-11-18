import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  PlannerContentMix,
  PlannerDayPeriod,
  PlannerStrategy,
  PlannerWindowMode,
  PreExamMarathonConfig,
  Settings,
  StudyLogEntry,
  StudySession,
  StudySessionReason,
  Topic,
  WeekdayAvailability,
  WeeklyCheckIn,
} from '../../types';

export interface PlanInput {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  settings: Settings;
  /** Materiais da cadeira para associar sugestões reais aos blocos gerados. */
  materials?: Material[];
  /** yyyy-MM-dd */
  from: string;
  /** Minutos atuais desde a meia-noite no dia `from` (opcional; evita agendar no passado). */
  nowMinutes?: number;
  /** Número de dias a planear (por omissão 14). */
  days?: number;
  /**
   * Sessões que se mantêm ao regenerar (concluídas, fixadas e manuais). Ocupam tempo do dia
   * e o tempo já estudado diminui o esforço que falta em cada tópico.
   */
  existing?: StudySession[];
  /** Cadeiras declaradas pelo estudante como mais difíceis (recebem prioridade adicional). */
  difficultCourseIds?: ID[];
  /** Check-ins semanais do tutor para reforçar tópicos difíceis recentes. */
  weeklyCheckIns?: WeeklyCheckIn[];
  /** Registos recentes do Diário do Uni (pós-aula, fim do dia, domingo, Modo Teste). */
  studyLogs?: StudyLogEntry[];
  /** Atividades extracurriculares que reduzem a margem disponível em dias específicos. */
  extraActivities?: ExtraActivity[];
  /** Período preferido do dia para encaixar blocos livres. */
  preferredPeriod?: PlannerDayPeriod;
  /** Duração padrão desejada para cada bloco de estudo (em minutos). */
  blockMinutes?: 25 | 35 | 50 | 75;
  /** Estratégia principal do criador de planos. */
  strategy?: PlannerStrategy;
  /** Cadeiras selecionadas para reforço extra nesta geração. */
  boostCourseIds?: ID[];
  /** Cadeiras pausadas/excluídas temporariamente nesta geração. */
  pausedCourseIds?: ID[];
  /** Em Modo Teste único (> 2 dias), se verdadeiro concentra 100% na prova sem reservar bloco para outras cadeiras. */
  exclusiveTestFocus?: boolean;
  /** Disponibilidade individual por dia da semana ("0" = dom … "6" = sáb). */
  weekdaySchedule?: Record<string, WeekdayAvailability>;
  /** Aproveitar intervalos livres >= 35m entre aulas. */
  fillClassGaps?: boolean;
  /** Reta final: desbloqueia maratona de dia inteiro N dias antes de avaliações. */
  preExamMarathon?: PreExamMarathonConfig;
  /** Equilíbrio entre matéria nova e prática/testes antigos. */
  contentMix?: PlannerContentMix;
  /** Foco personalizado por cadeira definido no briefing ao Uni. */
  briefingCourseFocus?: Record<string, string>;
}

export interface CourseMinutes {
  courseId: ID;
  /** Minutos planeados (todas as sessões). */
  planned: number;
  /** Minutos realmente estudados (sessões concluídas). */
  done: number;
}

export interface DayPlanProfile {
  enabled: boolean;
  baseBudget: number;
  windowMode: PlannerWindowMode;
  blockedPeriods: Array<'morning' | 'afternoon' | 'evening'>;
  isMarathonDay: boolean;
  marathonDaysLeft?: number;
}

export interface Block {
  courseId: ID;
  topicId?: ID;
  assessmentId?: ID;
  materialId?: ID;
  minutes: number;
  notes?: string;
  reason?: StudySessionReason;
}

export interface WorkItem {
  assessment: Assessment;
  due: Date;
  dueMinutes?: number;
  courseId: ID;
  topics: Topic[];
}

export interface BusyInterval {
  start: number;
  end: number;
}

export const BLOCK = 50;
export const ADAPTIVE_LOW_CONFIDENCE_BLOCK = 35;
export const MIN_BLOCK = 25;
export const BREAK = 10;
export const MAX_BLOCKS_PER_DAY = 4;
export const MAX_BLOCKS_PER_COURSE = 2;
export const HORIZON_DAYS = 45;
export const TEST_MODE_DAYS = 10;
export const SPACED_MINUTES = 25;
export const LIGHT_CLASS_LOAD_MIN = 240;
export const EVENT_THRESHOLD_MIN = 120;
export const MIN_DAY_BUDGET = 30;

export const effortBase: Record<Topic['status'], number> = {
  todo: 150,
  learning: 100,
  review: 50,
  done: 25,
};

export const needBase: Record<Topic['status'], number> = {
  todo: 1,
  learning: 0.8,
  review: 0.5,
  done: 0.25,
};

export const PERIOD_BUSY_RANGES: Record<'morning' | 'afternoon' | 'evening', BusyInterval> = {
  morning: { start: 6 * 60, end: 12 * 60 + 30 },
  afternoon: { start: 12 * 60 + 30, end: 18 * 60 },
  evening: { start: 18 * 60, end: 23 * 60 + 59 },
};
