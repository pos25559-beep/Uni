import { addDays, format, subDays } from 'date-fns';
import { useStore } from '../store/useStore';
import type {
  AcademicProfile,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  StudySession,
  Task,
} from '../types';

const isoDate = (offsetDays: number) => format(addDays(new Date(), offsetDays), 'yyyy-MM-dd');
const isoDateTime = (offsetDays: number, hhmm: string) => `${isoDate(offsetDays)}T${hhmm}:00`;

export function buildDemoPayload() {
  const courses: Course[] = [
    {
      id: 'demo-c1',
      code: 'MAT101',
      name: 'Cálculo I',
      shortName: 'Cálculo I',
      ects: 6,
      color: 'sky',
      targetGrade: 15,
      topics: [
        { id: 'demo-t1', title: 'Limites e Continuidade', status: 'done', confidence: 5, lastStudied: isoDate(-4), srsIntervalDays: 7, nextReviewDate: isoDate(3), recallCount: 2, lastRecallScore: 3 },
        { id: 'demo-t2', title: 'Derivadas e Regras de Derivação', status: 'review', confidence: 3, lastStudied: isoDate(-2), srsIntervalDays: 3, nextReviewDate: isoDate(0), recallCount: 1, lastRecallScore: 2 },
        { id: 'demo-t3', title: 'Otimização e Teorema de Lagrange', status: 'learning', confidence: 2 },
        { id: 'demo-t4', title: 'Primitivas e Cálculo Integral', status: 'todo', confidence: 1 },
      ],
    },
    {
      id: 'demo-c2',
      code: 'FIS102',
      name: 'Física Geral',
      shortName: 'Física',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [
        { id: 'demo-t5', title: 'Cinemática da Partícula', status: 'done', confidence: 4, lastStudied: isoDate(-5) },
        { id: 'demo-t6', title: 'Leis de Newton e Atrito', status: 'review', confidence: 3, lastStudied: isoDate(-1), srsIntervalDays: 1, nextReviewDate: isoDate(0), recallCount: 1, lastRecallScore: 2 },
        { id: 'demo-t7', title: 'Trabalho, Energia e Conservação', status: 'todo', confidence: 2 },
      ],
    },
    {
      id: 'demo-c3',
      code: 'INF103',
      name: 'Programação',
      shortName: 'Prog',
      ects: 6,
      color: 'amber',
      targetGrade: 16,
      topics: [
        { id: 'demo-t8', title: 'Tipos, Funções e Recursividade', status: 'done', confidence: 5, lastStudied: isoDate(-3) },
        { id: 'demo-t9', title: 'Estruturas de Dados Lineares', status: 'learning', confidence: 3 },
        { id: 'demo-t10', title: 'Complexidade e Ordenação', status: 'todo', confidence: 2 },
      ],
    },
  ];

  const assessments: Assessment[] = [
    {
      id: 'demo-a1',
      courseId: 'demo-c1',
      kind: 'teste',
      title: '1.º Teste de Cálculo I',
      date: isoDateTime(4, '10:30'),
      weight: 40,
      topicIds: ['demo-t1', 'demo-t2', 'demo-t3'],
      location: 'Anfiteatro 2',
      source: 'local',
    },
    {
      id: 'demo-a2',
      courseId: 'demo-c3',
      kind: 'projeto',
      title: 'Entrega Prática · Estruturas Lineares',
      date: isoDateTime(9, '23:59'),
      weight: 30,
      topicIds: ['demo-t8', 'demo-t9'],
      source: 'local',
    },
    {
      id: 'demo-a3',
      courseId: 'demo-c2',
      kind: 'quiz',
      title: 'Mini-teste de Mecânica',
      date: format(subDays(new Date(), 6), 'yyyy-MM-dd') + 'T09:30:00',
      weight: 15,
      grade: 15.5,
      topicIds: ['demo-t5'],
      source: 'local',
    },
  ];

  const classes: ClassSlot[] = [
    { id: 'demo-cl1', courseId: 'demo-c1', type: 'T', weekday: 1, start: '09:00', end: '10:30', room: 'Sala A1', source: 'local' },
    { id: 'demo-cl2', courseId: 'demo-c2', type: 'TP', weekday: 2, start: '11:00', end: '12:30', room: 'Lab F2', source: 'local' },
    { id: 'demo-cl3', courseId: 'demo-c3', type: 'P', weekday: 3, start: '14:00', end: '16:00', room: 'Lab Inf 3', source: 'local' },
    { id: 'demo-cl4', courseId: 'demo-c1', type: 'TP', weekday: 4, start: '10:30', end: '12:00', room: 'Sala B4', source: 'local' },
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
      notes: 'Revisão ativa de derivadas implícitas.',
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
      notes: 'Resolver 4 exercícios de otimização.',
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
      notes: 'Revisão SRS · Leis de Newton.',
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
      notes: 'Implementar fila circular e testes.',
      generated: true,
    },
  ];

  const tasks: Task[] = [
    { id: 'demo-tk1', courseId: 'demo-c1', title: 'Resolver folha de exercícios 3 (extremos)', due: isoDate(2), done: false, priority: 1 },
    { id: 'demo-tk2', courseId: 'demo-c2', title: 'Organizar relatório de laboratório de atrito', due: isoDate(5), done: false, priority: 2 },
    { id: 'demo-tk3', courseId: 'demo-c3', title: 'Fazer commit inicial do repositório do projeto', due: isoDate(0), done: true, priority: 2 },
  ];

  const events: CalendarEvent[] = [
    {
      id: 'demo-ev1',
      title: 'Sessão de dúvidas de Cálculo I',
      start: isoDateTime(2, '12:30'),
      end: isoDateTime(2, '13:30'),
      source: 'local',
      location: 'Gabinete 2.14',
      courseId: 'demo-c1',
    },
  ];

  const academicProfile: Partial<AcademicProfile> = {
    universityId: 'outra',
    universityName: 'Universidade Exemplo',
    degreeId: 'demo',
    degreeName: 'Engenharia e Ciências (Exemplo)',
    currentAcademicYear: 1,
    currentSemester: 1,
    activeYears: [1],
    completedCourses: [],
    difficultCourseIds: ['demo-c1'],
    onboardingCompleted: true,
  };

  return { courses, assessments, classes, sessions, tasks, events, academicProfile };
}

/** Preenche o store local com um semestre de demonstração anónimo. */
export function loadDemoData() {
  const st = useStore.getState();
  const demo = buildDemoPayload();
  st.clearAll();
  st.upsertMany('courses', demo.courses);
  st.upsertMany('assessments', demo.assessments);
  st.upsertMany('classes', demo.classes);
  st.upsertMany('sessions', demo.sessions);
  st.upsertMany('tasks', demo.tasks);
  st.upsertMany('events', demo.events);
  st.saveAcademicProfile(demo.academicProfile);
  st.updateSettings({
    userName: 'Visitante',
    semesterName: 'Semestre de Exemplo',
    guestMode: true,
    hasSeenWelcome: true,
    tourCompleted: true,
    hubSetupCompleted: true,
    aiConsent: false,
  });
}
