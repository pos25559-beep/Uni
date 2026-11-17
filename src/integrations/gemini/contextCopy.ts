// Textos do contexto de estudo enviados ao modelo, por língua (movido de gemini.ts).
import type { AppLanguage } from '../../types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface ContextCopy {
  todayDate: string;
  todayPattern: string;
  semesterLabel: string;
  profileHeader: string;
  schoolLabel: string;
  activeYearsLabel: string;
  currentYearLabel: string;
  mastersLabel: (n: number) => string;
  yearLabel: (n: number) => string;
  entryLabel: string;
  semesterOrdinal: (n: number) => string;
  ectsLabel: (done: number, total: number, pct: number) => string;
  challengesLabel: string;
  extraLabel: (desc: string) => string;
  extraPerWeek: string;
  hardCoursesLabel: string;
  studentDifficultiesLabel: string;
  completedHistoryLabel: (count: number) => string;
  coursesHeader: string;
  noCourses: string;
  impossibleGoal: string;
  neededGoal: (grade: string) => string;
  noGradesYet: string;
  currentAvg: (grade: string, pct: number) => string;
  priorityTag: string;
  targetGrade: (ects: number, current: string, target: string, needed: string) => string;
  topicsLabel: string;
  confidenceLabel: string;
  upcomingHeader: string;
  examModeSingle: (label: string, title: string) => string;
  examModeMulti: (count: number, names: string) => string;
  noUpcoming: string;
  dateTimePattern: string;
  dateOnlyPattern: string;
  shortDatePattern: string;
  todayWhen: (stamp: string) => string;
  tomorrowWhen: (stamp: string) => string;
  inDaysWhen: (days: number, stamp: string) => string;
  topicScopePrefix: string;
  generalCourse: string;
  assessmentLine: (
    courseLabel: string,
    title: string,
    kind: string,
    when: string,
    weight: number,
    ready: number,
    scope: string,
  ) => string;
  checkInHeader: (weekOf: string) => string;
  moodLabel: string;
  consolidatedLabel: string;
  missedInClassLabel: string;
  pendingNextWeekLabel: string;
  studentNotesLabel: string;
  logsHeader: string;
  logKinds: Record<'class' | 'day' | 'week' | 'exam_prep', string>;
  logState: string;
  logTopicGiven: string;
  logMarkedTopics: string;
  logStudied: string;
  logDifficulties: string;
  logNote: string;
  todayPlanHeader: string;
  noTodaySessions: string;
  sessionDone: (dur: string) => string;
  sessionTodo: (dur: string) => string;
  studyHeader: string;
  weeklySummary: (done: string, goal: string) => string;
  streakLine: (days: number) => string;
  tasksHeader: string;
  noTasks: string;
  duePrefix: string;
  overdueSuffix: string;
  truncatedTag: string;
}

export const CONTEXT_COPY: Record<AppLanguage, ContextCopy> = {
  'pt-PT': {
    todayDate: 'Data de hoje',
    todayPattern: "EEEE, d 'de' MMMM 'de' yyyy",
    semesterLabel: 'Semestre',
    profileHeader: 'PERFIL ACADÉMICO DO ESTUDANTE (UNIPEDIA):',
    schoolLabel: 'Faculdade/Curso',
    activeYearsLabel: 'Anos ativos',
    currentYearLabel: 'Ano atual',
    mastersLabel: (n) => `${n}.º Mestrado`,
    yearLabel: (n) => `${n}.º ano`,
    entryLabel: 'Ingresso',
    semesterOrdinal: (n) => `${n}.º semestre`,
    ectsLabel: (done, total, pct) => `- Créditos ECTS: ${done}/${total} ECTS (${pct}% concluído)`,
    challengesLabel: '- Dificuldades declaradas de ritmo/estudo:',
    extraLabel: (desc) => `- Atividades extra-curriculares: ${desc}`,
    extraPerWeek: 'h/sem',
    hardCoursesLabel: '- Cadeiras onde tem mais dificuldade:',
    studentDifficultiesLabel: '- Dificuldades declaradas pelo aluno:',
    completedHistoryLabel: (count) => `- Histórico de cadeiras já concluídas (${count}):`,
    coursesHeader: 'CADEIRAS:',
    noCourses: '- Sem cadeiras registadas.',
    impossibleGoal: '; objetivo inatingível nas restantes avaliações',
    neededGoal: (grade) => `; precisa de ${grade} nas restantes`,
    noGradesYet: 'sem notas ainda',
    currentAvg: (grade, pct) => `média atual ${grade} (${pct}% avaliado)`,
    priorityTag: ' [PRIORIDADE/DIFICULDADE]',
    targetGrade: (ects, current, target, needed) => `(${ects} ECTS): ${current}; objetivo ${target}${needed}.`,
    topicsLabel: 'Matéria',
    confidenceLabel: 'confiança',
    upcomingHeader: 'PRÓXIMAS AVALIAÇÕES:',
    examModeSingle: (label, title) => `- MODO TESTE ATIVO (<10 dias): Foco intensivo em ${label} (${title}).`,
    examModeMulti: (count, names) => `- MODO TESTE MÚLTIPLO ATIVO (<10 dias): Equilibrar ${count} avaliações urgentes (${names}).`,
    noUpcoming: '- Nenhuma avaliação futura registada.',
    dateTimePattern: "EEEE, d 'de' MMM 'às' HH:mm",
    dateOnlyPattern: "EEEE, d 'de' MMM",
    shortDatePattern: 'd MMM',
    todayWhen: (stamp) => `hoje (${stamp})`,
    tomorrowWhen: (stamp) => `amanhã (${stamp})`,
    inDaysWhen: (days, stamp) => `em ${days} dias (${stamp})`,
    topicScopePrefix: 'matéria que sai',
    generalCourse: 'Geral',
    assessmentLine: (c, title, kind, when, weight, ready, scope) =>
      `- ${c} – ${title} (${kind}) ${when}; peso ${weight}%; preparação ${ready}%${scope}.`,
    checkInHeader: (w) => `ÚLTIMO CHECK-IN SEMANAL (${w}):`,
    moodLabel: '- Estado do aluno:',
    consolidatedLabel: '- O que já consolidou:',
    missedInClassLabel: '- O que não entendeu na aula:',
    pendingNextWeekLabel: '- Ficou para a próxima semana:',
    studentNotesLabel: '- Notas do aluno:',
    logsHeader: 'DIÁRIO RECENTE (AULAS, ESTUDO DIÁRIO & MODO TESTE):',
    logKinds: { class: 'Pós-aula', day: 'Fim do dia', week: 'Domingo', exam_prep: 'Modo Teste' },
    logState: 'estado',
    logTopicGiven: 'matéria dada',
    logMarkedTopics: 'tópicos marcados',
    logStudied: 'já estudou',
    logDifficulties: 'dificuldades',
    logNote: 'nota',
    todayPlanHeader: 'PLANO DE HOJE:',
    noTodaySessions: '- Sem sessões planeadas hoje.',
    sessionDone: (dur) => `feita (${dur})`,
    sessionTodo: (dur) => `por fazer (${dur})`,
    studyHeader: 'ESTUDO:',
    weeklySummary: (done, goal) => `- Esta semana: ${done} de ${goal} planeados por semana.`,
    streakLine: (days) => `- Sequência atual: ${plural(days, 'dia seguido', 'dias seguidos')}.`,
    tasksHeader: 'TAREFAS PENDENTES:',
    noTasks: '- Nenhuma tarefa pendente.',
    duePrefix: 'prazo',
    overdueSuffix: ' (atrasada)',
    truncatedTag: '[…resumo truncado]',
  },
  'pt-BR': {
    todayDate: 'Data de hoje',
    todayPattern: "EEEE, d 'de' MMMM 'de' yyyy",
    semesterLabel: 'Semestre',
    profileHeader: 'PERFIL ACADÊMICO DO ESTUDANTE (UNIPEDIA):',
    schoolLabel: 'Faculdade/Curso',
    activeYearsLabel: 'Anos ativos',
    currentYearLabel: 'Ano atual',
    mastersLabel: (n) => `${n}º ano Mestrado`,
    yearLabel: (n) => `${n}º ano`,
    entryLabel: 'Ingresso',
    semesterOrdinal: (n) => `${n}º semestre`,
    ectsLabel: (done, total, pct) => `- Créditos: ${done}/${total} (${pct}% concluído)`,
    challengesLabel: '- Dificuldades declaradas de ritmo/estudo:',
    extraLabel: (desc) => `- Atividades extracurriculares: ${desc}`,
    extraPerWeek: 'h/sem',
    hardCoursesLabel: '- Disciplinas em que tem mais dificuldade:',
    studentDifficultiesLabel: '- Dificuldades relatadas pelo aluno:',
    completedHistoryLabel: (count) => `- Histórico de disciplinas concluídas (${count}):`,
    coursesHeader: 'DISCIPLINAS:',
    noCourses: '- Nenhuma disciplina cadastrada.',
    impossibleGoal: '; meta inatingível nas avaliações restantes',
    neededGoal: (grade) => `; precisa de ${grade} nas restantes`,
    noGradesYet: 'sem notas ainda',
    currentAvg: (grade, pct) => `média atual ${grade} (${pct}% avaliado)`,
    priorityTag: ' [PRIORIDADE/DIFICULDADE]',
    targetGrade: (ects, current, target, needed) => `(${ects} créditos): ${current}; meta ${target}${needed}.`,
    topicsLabel: 'Conteúdo',
    confidenceLabel: 'confiança',
    upcomingHeader: 'PRÓXIMAS PROVAS E ENTREGAS:',
    examModeSingle: (label, title) => `- MODO PROVA ATIVO (<10 dias): Foco intensivo em ${label} (${title}).`,
    examModeMulti: (count, names) => `- MODO PROVA MÚLTIPLO ATIVO (<10 dias): Equilibrar ${count} avaliações urgentes (${names}).`,
    noUpcoming: '- Nenhuma avaliação futura cadastrada.',
    dateTimePattern: "EEEE, d 'de' MMM 'às' HH:mm",
    dateOnlyPattern: "EEEE, d 'de' MMM",
    shortDatePattern: 'd MMM',
    todayWhen: (stamp) => `hoje (${stamp})`,
    tomorrowWhen: (stamp) => `amanhã (${stamp})`,
    inDaysWhen: (days, stamp) => `em ${days} dias (${stamp})`,
    topicScopePrefix: 'conteúdo da prova',
    generalCourse: 'Geral',
    assessmentLine: (c, title, kind, when, weight, ready, scope) =>
      `- ${c} – ${title} (${kind}) ${when}; peso ${weight}%; preparo ${ready}%${scope}.`,
    checkInHeader: (w) => `ÚLTIMO CHECK-IN SEMANAL (${w}):`,
    moodLabel: '- Estado do aluno:',
    consolidatedLabel: '- O que já consolidou:',
    missedInClassLabel: '- O que não entendeu na aula:',
    pendingNextWeekLabel: '- Ficou para a próxima semana:',
    studentNotesLabel: '- Anotações do aluno:',
    logsHeader: 'DIÁRIO RECENTE (AULAS, ESTUDO DIÁRIO & MODO PROVA):',
    logKinds: { class: 'Pós-aula', day: 'Fim do dia', week: 'Domingo', exam_prep: 'Modo Prova' },
    logState: 'estado',
    logTopicGiven: 'conteúdo dado',
    logMarkedTopics: 'tópicos marcados',
    logStudied: 'já estudou',
    logDifficulties: 'dificuldades',
    logNote: 'nota',
    todayPlanHeader: 'PLANO DE HOJE:',
    noTodaySessions: '- Nenhuma sessão planejada hoje.',
    sessionDone: (dur) => `feita (${dur})`,
    sessionTodo: (dur) => `pendente (${dur})`,
    studyHeader: 'ESTUDO:',
    weeklySummary: (done, goal) => `- Esta semana: ${done} de ${goal} planejados por semana.`,
    streakLine: (days) => `- Sequência atual: ${plural(days, 'dia seguido', 'dias seguidos')}.`,
    tasksHeader: 'TAREFAS PENDENTES:',
    noTasks: '- Nenhuma tarefa pendente.',
    duePrefix: 'prazo',
    overdueSuffix: ' (atrasada)',
    truncatedTag: '[…resumo truncado]',
  },
  es: {
    todayDate: 'Fecha de hoy',
    todayPattern: "EEEE, d 'de' MMMM 'de' yyyy",
    semesterLabel: 'Cuatrimestre',
    profileHeader: 'PERFIL ACADÉMICO DEL ESTUDIANTE (UNIPEDIA):',
    schoolLabel: 'Universidad/Carrera',
    activeYearsLabel: 'Cursos activos',
    currentYearLabel: 'Curso actual',
    mastersLabel: (n) => `${n}.º Máster`,
    yearLabel: (n) => `${n}.º curso`,
    entryLabel: 'Ingreso',
    semesterOrdinal: (n) => `${n}.º cuatrimestre`,
    ectsLabel: (done, total, pct) => `- Créditos ECTS: ${done}/${total} ECTS (${pct}% completado)`,
    challengesLabel: '- Dificultades declaradas de ritmo/estudio:',
    extraLabel: (desc) => `- Actividades extracurriculares: ${desc}`,
    extraPerWeek: 'h/sem',
    hardCoursesLabel: '- Asignaturas con mayor dificultad:',
    studentDifficultiesLabel: '- Dificultades indicadas por el estudiante:',
    completedHistoryLabel: (count) => `- Historial de asignaturas aprobadas (${count}):`,
    coursesHeader: 'ASIGNATURAS:',
    noCourses: '- Sin asignaturas registradas.',
    impossibleGoal: '; objetivo inalcanzable en las evaluaciones restantes',
    neededGoal: (grade) => `; necesita ${grade} en las restantes`,
    noGradesYet: 'sin notas aún',
    currentAvg: (grade, pct) => `media actual ${grade} (${pct}% evaluado)`,
    priorityTag: ' [PRIORIDAD/DIFICULTAD]',
    targetGrade: (ects, current, target, needed) => `(${ects} ECTS): ${current}; objetivo ${target}${needed}.`,
    topicsLabel: 'Temario',
    confidenceLabel: 'confianza',
    upcomingHeader: 'PRÓXIMOS EXÁMENES Y ENTREGAS:',
    examModeSingle: (label, title) => `- MODO EXAMEN ACTIVO (<10 días): Enfoque intensivo en ${label} (${title}).`,
    examModeMulti: (count, names) => `- MODO EXAMEN MÚLTIPLE ACTIVO (<10 días): Equilibrar ${count} evaluaciones urgentes (${names}).`,
    noUpcoming: '- Ninguna evaluación futura registrada.',
    dateTimePattern: "EEEE, d 'de' MMM 'a las' HH:mm",
    dateOnlyPattern: "EEEE, d 'de' MMM",
    shortDatePattern: 'd MMM',
    todayWhen: (stamp) => `hoy (${stamp})`,
    tomorrowWhen: (stamp) => `mañana (${stamp})`,
    inDaysWhen: (days, stamp) => `en ${days} días (${stamp})`,
    topicScopePrefix: 'temario incluido',
    generalCourse: 'General',
    assessmentLine: (c, title, kind, when, weight, ready, scope) =>
      `- ${c} – ${title} (${kind}) ${when}; peso ${weight}%; preparación ${ready}%${scope}.`,
    checkInHeader: (w) => `ÚLTIMO CHECK-IN SEMANAL (${w}):`,
    moodLabel: '- Estado del estudiante:',
    consolidatedLabel: '- Lo que ya consolidó:',
    missedInClassLabel: '- Lo que no entendió en clase:',
    pendingNextWeekLabel: '- Pendiente para la próxima semana:',
    studentNotesLabel: '- Notas del estudiante:',
    logsHeader: 'DIARIO RECIENTE (CLASES, ESTUDIO DIARIO & MODO EXAMEN):',
    logKinds: { class: 'Post-clase', day: 'Fin del día', week: 'Domingo', exam_prep: 'Modo Examen' },
    logState: 'estado',
    logTopicGiven: 'tema dado',
    logMarkedTopics: 'temas marcados',
    logStudied: 'ya estudió',
    logDifficulties: 'dificultades',
    logNote: 'nota',
    todayPlanHeader: 'PLAN DE HOY:',
    noTodaySessions: '- Sin sesiones planificadas hoy.',
    sessionDone: (dur) => `hecha (${dur})`,
    sessionTodo: (dur) => `pendiente (${dur})`,
    studyHeader: 'ESTUDIO:',
    weeklySummary: (done, goal) => `- Esta semana: ${done} de ${goal} planificados por semana.`,
    streakLine: (days) => `- Racha actual: ${plural(days, 'día seguido', 'días seguidos')}.`,
    tasksHeader: 'TAREAS PENDIENTES:',
    noTasks: '- Ninguna tarea pendiente.',
    duePrefix: 'fecha límite',
    overdueSuffix: ' (atrasada)',
    truncatedTag: '[…resumen truncado]',
  },
  en: {
    todayDate: "Today's date",
    todayPattern: 'EEEE, d MMMM yyyy',
    semesterLabel: 'Semester',
    profileHeader: 'STUDENT ACADEMIC PROFILE (UNIPEDIA):',
    schoolLabel: 'School/Degree',
    activeYearsLabel: 'Active years',
    currentYearLabel: 'Current year',
    mastersLabel: (n) => `Year ${n} Master's`,
    yearLabel: (n) => `Year ${n}`,
    entryLabel: 'Entry year',
    semesterOrdinal: (n) => `Semester ${n}`,
    ectsLabel: (done, total, pct) => `- Credits: ${done}/${total} ECTS (${pct}% completed)`,
    challengesLabel: '- Declared study pace/learning challenges:',
    extraLabel: (desc) => `- Extracurricular activities: ${desc}`,
    extraPerWeek: 'h/wk',
    hardCoursesLabel: '- Courses flagged as hardest:',
    studentDifficultiesLabel: '- Student-reported difficulties:',
    completedHistoryLabel: (count) => `- Completed courses (${count}):`,
    coursesHeader: 'COURSES:',
    noCourses: '- No courses registered.',
    impossibleGoal: '; target unreachable on remaining assessments',
    neededGoal: (grade) => `; needs ${grade} on remaining assessments`,
    noGradesYet: 'no grades yet',
    currentAvg: (grade, pct) => `current average ${grade} (${pct}% graded)`,
    priorityTag: ' [PRIORITY/DIFFICULT]',
    targetGrade: (ects, current, target, needed) => `(${ects} ECTS): ${current}; target ${target}${needed}.`,
    topicsLabel: 'Topics',
    confidenceLabel: 'confidence',
    upcomingHeader: 'UPCOMING ASSESSMENTS:',
    examModeSingle: (label, title) => `- EXAM MODE ACTIVE (<10 days): Intensive focus on ${label} (${title}).`,
    examModeMulti: (count, names) => `- MULTI-EXAM MODE ACTIVE (<10 days): Balance ${count} urgent assessments (${names}).`,
    noUpcoming: '- No upcoming assessments registered.',
    dateTimePattern: 'EEEE, MMM d, HH:mm',
    dateOnlyPattern: 'EEEE, MMM d',
    shortDatePattern: 'MMM d',
    todayWhen: (stamp) => `today (${stamp})`,
    tomorrowWhen: (stamp) => `tomorrow (${stamp})`,
    inDaysWhen: (days, stamp) => `in ${days} days (${stamp})`,
    topicScopePrefix: 'topics covered',
    generalCourse: 'General',
    assessmentLine: (c, title, kind, when, weight, ready, scope) =>
      `- ${c} – ${title} (${kind}) ${when}; weight ${weight}%; readiness ${ready}%${scope}.`,
    checkInHeader: (w) => `LATEST WEEKLY CHECK-IN (${w}):`,
    moodLabel: '- Student mood:',
    consolidatedLabel: '- Already consolidated:',
    missedInClassLabel: '- Unclear from class:',
    pendingNextWeekLabel: '- Carried over to next week:',
    studentNotesLabel: '- Student notes:',
    logsHeader: 'RECENT STUDY LOGS (CLASSES, DAILY STUDY & EXAM MODE):',
    logKinds: { class: 'After-class', day: 'End of day', week: 'Sunday', exam_prep: 'Exam Mode' },
    logState: 'mood',
    logTopicGiven: 'covered topic',
    logMarkedTopics: 'tagged topics',
    logStudied: 'studied',
    logDifficulties: 'difficulties',
    logNote: 'note',
    todayPlanHeader: "TODAY'S PLAN:",
    noTodaySessions: '- No sessions planned today.',
    sessionDone: (dur) => `done (${dur})`,
    sessionTodo: (dur) => `planned (${dur})`,
    studyHeader: 'STUDY:',
    weeklySummary: (done, goal) => `- This week: ${done} of ${goal} weekly goal.`,
    streakLine: (days) => `- Current streak: ${plural(days, 'day in a row', 'days in a row')}.`,
    tasksHeader: 'PENDING TASKS:',
    noTasks: '- No pending tasks.',
    duePrefix: 'due',
    overdueSuffix: ' (overdue)',
    truncatedTag: '[…summary truncated]',
  },
};
