import { addDays, format, subDays } from 'date-fns';
import { normalizeAppLanguage } from './grading';
import { useStore } from '../store/useStore';
import type {
  AcademicProfile,
  AppLanguage,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  StudySession,
  Task,
} from '../types';

const isoDate = (offsetDays: number) => format(addDays(new Date(), offsetDays), 'yyyy-MM-dd');
const isoDateTime = (offsetDays: number, hhmm: string) => `${isoDate(offsetDays)}T${hhmm}:00`;

interface DemoLocaleCopy {
  c1: { name: string; shortName: string; t1: string; t2: string; t3: string; t4: string };
  c2: { name: string; shortName: string; t5: string; t6: string; t7: string };
  c3: { name: string; shortName: string; t8: string; t9: string; t10: string };
  a1Title: string;
  a1Loc: string;
  a2Title: string;
  a3Title: string;
  rooms: [string, string, string, string];
  sessions: [string, string, string, string];
  tasks: [string, string, string];
  eventTitle: string;
  eventLoc: string;
  universityName: string;
  degreeName: string;
  userName: string;
  semesterName: string;
}

const DEMO_COPY: Record<AppLanguage, DemoLocaleCopy> = {
  'pt-PT': {
    c1: {
      name: 'Cálculo I',
      shortName: 'Cálculo I',
      t1: 'Limites e Continuidade',
      t2: 'Derivadas e Regras de Derivação',
      t3: 'Otimização e Teorema de Lagrange',
      t4: 'Primitivas e Cálculo Integral',
    },
    c2: {
      name: 'Física Geral',
      shortName: 'Física',
      t5: 'Cinemática da Partícula',
      t6: 'Leis de Newton e Atrito',
      t7: 'Trabalho, Energia e Conservação',
    },
    c3: {
      name: 'Programação',
      shortName: 'Prog',
      t8: 'Tipos, Funções e Recursividade',
      t9: 'Estruturas de Dados Lineares',
      t10: 'Complexidade e Ordenação',
    },
    a1Title: '1.º Teste de Cálculo I',
    a1Loc: 'Anfiteatro 2',
    a2Title: 'Entrega Prática · Estruturas Lineares',
    a3Title: 'Mini-teste de Mecânica',
    rooms: ['Sala A1', 'Lab F2', 'Lab Inf 3', 'Sala B4'],
    sessions: [
      'Revisão ativa de derivadas implícitas.',
      'Resolver 4 exercícios de otimização.',
      'Revisão SRS · Leis de Newton.',
      'Implementar fila circular e testes.',
    ],
    tasks: [
      'Resolver folha de exercícios 3 (extremos)',
      'Organizar relatório de laboratório de atrito',
      'Fazer commit inicial do repositório do projeto',
    ],
    eventTitle: 'Sessão de dúvidas de Cálculo I',
    eventLoc: 'Gabinete 2.14',
    universityName: 'Universidade Exemplo',
    degreeName: 'Engenharia e Ciências (Exemplo)',
    userName: 'Visitante',
    semesterName: 'Semestre de Exemplo',
  },
  'pt-BR': {
    c1: {
      name: 'Cálculo I',
      shortName: 'Cálculo I',
      t1: 'Limites e Continuidade',
      t2: 'Derivadas e Regras de Derivação',
      t3: 'Otimização e Multiplicadores de Lagrange',
      t4: 'Integrais e Técnicas de Primitivação',
    },
    c2: {
      name: 'Física Geral',
      shortName: 'Física',
      t5: 'Cinemática da Partícula',
      t6: 'Leis de Newton e Atrito',
      t7: 'Trabalho, Energia e Conservação',
    },
    c3: {
      name: 'Programação',
      shortName: 'Prog',
      t8: 'Tipos, Funções e Recursividade',
      t9: 'Estruturas de Dados Lineares',
      t10: 'Complexidade e Ordenação',
    },
    a1Title: '1ª Prova de Cálculo I',
    a1Loc: 'Auditório 2',
    a2Title: 'Entrega Prática · Estruturas Lineares',
    a3Title: 'Quiz de Mecânica',
    rooms: ['Sala A1', 'Lab F2', 'Lab Comp 3', 'Sala B4'],
    sessions: [
      'Revisão ativa de derivadas implícitas.',
      'Resolver 4 exercícios de otimização.',
      'Revisão SRS · Leis de Newton.',
      'Implementar fila circular e testes unitários.',
    ],
    tasks: [
      'Resolver lista de exercícios 3 (máximos e mínimos)',
      'Organizar relatório do laboratório de atrito',
      'Fazer commit inicial do repositório do projeto',
    ],
    eventTitle: 'Plantão de dúvidas de Cálculo I',
    eventLoc: 'Sala 2.14',
    universityName: 'Universidade Exemplo',
    degreeName: 'Engenharia e Ciências (Exemplo)',
    userName: 'Visitante',
    semesterName: 'Semestre de Exemplo',
  },
  es: {
    c1: {
      name: 'Cálculo I',
      shortName: 'Cálculo I',
      t1: 'Límites y Continuidad',
      t2: 'Derivadas y Reglas de Derivación',
      t3: 'Optimización y Teorema de Lagrange',
      t4: 'Primitivas y Cálculo Integral',
    },
    c2: {
      name: 'Física General',
      shortName: 'Física',
      t5: 'Cinemática de la Partícula',
      t6: 'Leyes de Newton y Rozamiento',
      t7: 'Trabajo, Energía y Conservación',
    },
    c3: {
      name: 'Programación',
      shortName: 'Prog',
      t8: 'Tipos, Funciones y Recursividad',
      t9: 'Estructuras de Datos Lineales',
      t10: 'Complejidad y Ordenación',
    },
    a1Title: '1.er Parcial de Cálculo I',
    a1Loc: 'Aula Magna 2',
    a2Title: 'Entrega Práctica · Estructuras Lineales',
    a3Title: 'Control de Mecánica',
    rooms: ['Aula A1', 'Lab F2', 'Lab Inf 3', 'Aula B4'],
    sessions: [
      'Repaso activo de derivadas implícitas.',
      'Resolver 4 problemas de optimización.',
      'Repaso SRS · Leyes de Newton.',
      'Implementar cola circular y pruebas.',
    ],
    tasks: [
      'Resolver hoja de ejercicios 3 (extremos)',
      'Preparar informe de laboratorio de rozamiento',
      'Hacer commit inicial del repositorio del proyecto',
    ],
    eventTitle: 'Tutoría de dudas de Cálculo I',
    eventLoc: 'Despacho 2.14',
    universityName: 'Universidad de Ejemplo',
    degreeName: 'Ingeniería y Ciencias (Ejemplo)',
    userName: 'Invitado',
    semesterName: 'Cuatrimestre de Ejemplo',
  },
  en: {
    c1: {
      name: 'Calculus I',
      shortName: 'Calc I',
      t1: 'Limits & Continuity',
      t2: 'Derivatives & Chain Rule',
      t3: 'Optimization & Lagrange Multipliers',
      t4: 'Antiderivatives & Integration',
    },
    c2: {
      name: 'General Physics',
      shortName: 'Physics',
      t5: 'Particle Kinematics',
      t6: "Newton's Laws & Friction",
      t7: 'Work, Energy & Conservation',
    },
    c3: {
      name: 'Programming',
      shortName: 'CS103',
      t8: 'Types, Functions & Recursion',
      t9: 'Linear Data Structures',
      t10: 'Complexity & Sorting',
    },
    a1Title: 'Calculus I Midterm 1',
    a1Loc: 'Lecture Hall 2',
    a2Title: 'Lab Submission · Linear Structures',
    a3Title: 'Mechanics Quiz',
    rooms: ['Room A1', 'Physics Lab F2', 'CS Lab 3', 'Room B4'],
    sessions: [
      'Active recall on implicit differentiation.',
      'Solve 4 optimization practice problems.',
      "SRS review · Newton's Laws.",
      'Implement circular queue and unit tests.',
    ],
    tasks: [
      'Complete problem set 3 (extrema)',
      'Organise friction lab report',
      'Push initial project repository commit',
    ],
    eventTitle: 'Calculus I office hours',
    eventLoc: 'Office 2.14',
    universityName: 'Sample University',
    degreeName: 'Engineering & Sciences (Sample)',
    userName: 'Guest',
    semesterName: 'Sample Semester',
  },
};

export function buildDemoPayload(lang?: AppLanguage | string) {
  const copy = DEMO_COPY[normalizeAppLanguage(lang)];

  const courses: Course[] = [
    {
      id: 'demo-c1',
      code: 'MAT101',
      name: copy.c1.name,
      shortName: copy.c1.shortName,
      ects: 6,
      color: 'sky',
      targetGrade: 15,
      topics: [
        { id: 'demo-t1', title: copy.c1.t1, status: 'done', confidence: 5, lastStudied: isoDate(-4), srsIntervalDays: 7, nextReviewDate: isoDate(3), recallCount: 2, lastRecallScore: 3 },
        { id: 'demo-t2', title: copy.c1.t2, status: 'review', confidence: 3, lastStudied: isoDate(-2), srsIntervalDays: 3, nextReviewDate: isoDate(0), recallCount: 1, lastRecallScore: 2 },
        { id: 'demo-t3', title: copy.c1.t3, status: 'learning', confidence: 2 },
        { id: 'demo-t4', title: copy.c1.t4, status: 'todo', confidence: 1 },
      ],
    },
    {
      id: 'demo-c2',
      code: 'FIS102',
      name: copy.c2.name,
      shortName: copy.c2.shortName,
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [
        { id: 'demo-t5', title: copy.c2.t5, status: 'done', confidence: 4, lastStudied: isoDate(-5) },
        { id: 'demo-t6', title: copy.c2.t6, status: 'review', confidence: 3, lastStudied: isoDate(-1), srsIntervalDays: 1, nextReviewDate: isoDate(0), recallCount: 1, lastRecallScore: 2 },
        { id: 'demo-t7', title: copy.c2.t7, status: 'todo', confidence: 2 },
      ],
    },
    {
      id: 'demo-c3',
      code: 'INF103',
      name: copy.c3.name,
      shortName: copy.c3.shortName,
      ects: 6,
      color: 'amber',
      targetGrade: 16,
      topics: [
        { id: 'demo-t8', title: copy.c3.t8, status: 'done', confidence: 5, lastStudied: isoDate(-3) },
        { id: 'demo-t9', title: copy.c3.t9, status: 'learning', confidence: 3 },
        { id: 'demo-t10', title: copy.c3.t10, status: 'todo', confidence: 2 },
      ],
    },
  ];

  const assessments: Assessment[] = [
    {
      id: 'demo-a1',
      courseId: 'demo-c1',
      kind: 'teste',
      title: copy.a1Title,
      date: isoDateTime(4, '10:30'),
      weight: 40,
      topicIds: ['demo-t1', 'demo-t2', 'demo-t3'],
      location: copy.a1Loc,
      source: 'local',
    },
    {
      id: 'demo-a2',
      courseId: 'demo-c3',
      kind: 'projeto',
      title: copy.a2Title,
      date: isoDateTime(9, '23:59'),
      weight: 30,
      topicIds: ['demo-t8', 'demo-t9'],
      source: 'local',
    },
    {
      id: 'demo-a3',
      courseId: 'demo-c2',
      kind: 'quiz',
      title: copy.a3Title,
      date: format(subDays(new Date(), 6), 'yyyy-MM-dd') + 'T09:30:00',
      weight: 15,
      grade: 15.5,
      topicIds: ['demo-t5'],
      source: 'local',
    },
  ];

  const classes: ClassSlot[] = [
    { id: 'demo-cl1', courseId: 'demo-c1', type: 'T', weekday: 1, start: '09:00', end: '10:30', room: copy.rooms[0], source: 'local' },
    { id: 'demo-cl2', courseId: 'demo-c2', type: 'TP', weekday: 2, start: '11:00', end: '12:30', room: copy.rooms[1], source: 'local' },
    { id: 'demo-cl3', courseId: 'demo-c3', type: 'P', weekday: 3, start: '14:00', end: '16:00', room: copy.rooms[2], source: 'local' },
    { id: 'demo-cl4', courseId: 'demo-c1', type: 'TP', weekday: 4, start: '10:30', end: '12:00', room: copy.rooms[3], source: 'local' },
  ];

  const sessions: StudySession[] = [
    {
      id: 'demo-s1',
      courseId: 'demo-c1',
      topicId: 'demo-t2',
      assessmentId: 'demo-a1',
      date: isoDate(0),
      start: '17:00',
      minutes: 45,
      done: true,
      actualMinutes: 45,
      notes: copy.sessions[0],
      generated: true,
    },
    {
      id: 'demo-s2',
      courseId: 'demo-c1',
      topicId: 'demo-t3',
      assessmentId: 'demo-a1',
      date: isoDate(0),
      start: '18:15',
      minutes: 45,
      done: false,
      notes: copy.sessions[1],
      generated: true,
    },
    {
      id: 'demo-s3',
      courseId: 'demo-c2',
      topicId: 'demo-t6',
      date: isoDate(1),
      start: '16:00',
      minutes: 40,
      done: false,
      notes: copy.sessions[2],
      generated: true,
    },
    {
      id: 'demo-s4',
      courseId: 'demo-c3',
      topicId: 'demo-t9',
      assessmentId: 'demo-a2',
      date: isoDate(2),
      start: '17:30',
      minutes: 50,
      done: false,
      notes: copy.sessions[3],
      generated: true,
    },
  ];

  const tasks: Task[] = [
    { id: 'demo-tk1', courseId: 'demo-c1', title: copy.tasks[0], due: isoDate(2), done: false, priority: 1 },
    { id: 'demo-tk2', courseId: 'demo-c2', title: copy.tasks[1], due: isoDate(5), done: false, priority: 2 },
    { id: 'demo-tk3', courseId: 'demo-c3', title: copy.tasks[2], due: isoDate(0), done: true, priority: 2 },
  ];

  const events: CalendarEvent[] = [
    {
      id: 'demo-ev1',
      title: copy.eventTitle,
      start: isoDateTime(2, '12:30'),
      end: isoDateTime(2, '13:30'),
      source: 'local',
      location: copy.eventLoc,
      courseId: 'demo-c1',
    },
  ];

  const academicProfile: Partial<AcademicProfile> = {
    universityId: 'outra',
    universityName: copy.universityName,
    degreeId: 'demo',
    degreeName: copy.degreeName,
    currentAcademicYear: 1,
    currentSemester: 1,
    activeYears: [1],
    completedCourses: [],
    difficultCourseIds: ['demo-c1'],
    onboardingCompleted: true,
  };

  return {
    courses,
    assessments,
    classes,
    sessions,
    tasks,
    events,
    academicProfile,
    userName: copy.userName,
    semesterName: copy.semesterName,
  };
}

/** Preenche o store local com um semestre de demonstração anónimo. */
export function loadDemoData() {
  const st = useStore.getState();
  const demo = buildDemoPayload(st.settings.language);
  st.clearAll();
  st.upsertMany('courses', demo.courses);
  st.upsertMany('assessments', demo.assessments);
  st.upsertMany('classes', demo.classes);
  st.upsertMany('sessions', demo.sessions);
  st.upsertMany('tasks', demo.tasks);
  st.upsertMany('events', demo.events);
  st.saveAcademicProfile(demo.academicProfile);
  st.updateSettings({
    userName: demo.userName,
    semesterName: demo.semesterName,
    guestMode: true,
    hasSeenWelcome: true,
    tourCompleted: true,
    hubSetupCompleted: true,
    aiConsent: false,
  });
}
