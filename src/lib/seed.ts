import { addDays, format, startOfDay } from 'date-fns';
import type { Collections, Course, Settings, Topic } from '../types';

const d = (offset: number) => format(addDays(startOfDay(new Date()), offset), 'yyyy-MM-dd');
const dt = (offset: number, time: string) => `${d(offset)}T${time}:00`;

const topics = (prefix: string, items: [string, Topic['status'], Topic['confidence']][]): Topic[] =>
  items.map(([title, status, confidence], i) => ({
    id: `${prefix}-t${i + 1}`,
    title,
    status,
    confidence,
    lastStudied: status === 'todo' ? undefined : d(-(i + 1) * 2),
  }));

export const defaultSettings: Settings = {
  userName: '',
  theme: 'light',
  semesterName: '1.º Semestre 2026/27',
  semesterStart: d(-60),
  semesterEnd: d(75),
  dailyStudyMinutes: 150,
  studyDays: [1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  googleClientId: '',
  msClientId: '',
};

const courses: Course[] = [
  {
    id: 'am2', code: 'AM2', name: 'Análise Matemática II', shortName: 'AM II', ects: 6, color: 'violet',
    teacher: 'Prof.ª Helena Duarte', targetGrade: 14,
    topics: topics('am2', [
      ['Séries numéricas', 'done', 4],
      ['Séries de potências', 'review', 3],
      ['Funções de várias variáveis', 'learning', 2],
      ['Derivadas parciais e gradiente', 'learning', 2],
      ['Integrais duplos', 'todo', 1],
      ['Integrais triplos', 'todo', 1],
    ]),
  },
  {
    id: 'aed', code: 'AED', name: 'Algoritmos e Estruturas de Dados', shortName: 'AED', ects: 6, color: 'sky',
    teacher: 'Prof. Rui Antunes', targetGrade: 16,
    topics: topics('aed', [
      ['Complexidade assintótica', 'done', 5],
      ['Listas, pilhas e filas', 'done', 4],
      ['Árvores binárias de pesquisa', 'review', 3],
      ['Tabelas de dispersão', 'learning', 3],
      ['Grafos: BFS e DFS', 'todo', 1],
      ['Caminhos mais curtos', 'todo', 1],
    ]),
  },
  {
    id: 'bd', code: 'BD', name: 'Bases de Dados', shortName: 'BD', ects: 6, color: 'emerald',
    teacher: 'Prof.ª Marta Leal', targetGrade: 15,
    topics: topics('bd', [
      ['Modelo entidade-relação', 'done', 4],
      ['Modelo relacional', 'done', 4],
      ['SQL: consultas', 'review', 4],
      ['Normalização', 'learning', 2],
      ['Transações e concorrência', 'todo', 1],
    ]),
  },
  {
    id: 'fis', code: 'FIS1', name: 'Física I', shortName: 'Física I', ects: 6, color: 'amber',
    teacher: 'Prof. Nuno Sarmento', targetGrade: 12,
    topics: topics('fis', [
      ['Cinemática', 'done', 3],
      ['Leis de Newton', 'review', 3],
      ['Trabalho e energia', 'learning', 2],
      ['Momento linear e colisões', 'todo', 1],
      ['Rotação de corpos rígidos', 'todo', 1],
    ]),
  },
  {
    id: 'so', code: 'SO', name: 'Sistemas Operativos', shortName: 'SO', ects: 6, color: 'rose',
    teacher: 'Prof. Paulo Vidal', targetGrade: 14,
    topics: topics('so', [
      ['Processos e threads', 'done', 4],
      ['Escalonamento', 'review', 3],
      ['Sincronização', 'learning', 2],
      ['Gestão de memória', 'todo', 1],
      ['Sistemas de ficheiros', 'todo', 1],
    ]),
  },
];

export const demoData = (): Collections => ({
  courses,
  assessments: [
    { id: 'a1', courseId: 'am2', kind: 'teste', title: '1.º Teste', date: dt(-21, '10:00'), weight: 40, grade: 12.5, topicIds: ['am2-t1', 'am2-t2'], source: 'local' },
    { id: 'a2', courseId: 'am2', kind: 'teste', title: '2.º Teste', date: dt(9, '10:00'), weight: 60, topicIds: ['am2-t3', 'am2-t4', 'am2-t5', 'am2-t6'], location: 'Ed. VII — 1A', source: 'local' },
    { id: 'a3', courseId: 'aed', kind: 'projeto', title: 'Projeto 1', date: dt(-14, '23:59'), weight: 20, grade: 17, topicIds: ['aed-t2'], source: 'local' },
    { id: 'a4', courseId: 'aed', kind: 'projeto', title: 'Projeto 2 — Grafos', date: dt(5, '23:59'), weight: 20, topicIds: ['aed-t5', 'aed-t6'], source: 'local' },
    { id: 'a5', courseId: 'aed', kind: 'exame', title: 'Exame', date: dt(34, '09:00'), weight: 60, topicIds: ['aed-t1', 'aed-t2', 'aed-t3', 'aed-t4', 'aed-t5', 'aed-t6'], source: 'local' },
    { id: 'a6', courseId: 'bd', kind: 'teste', title: 'Mini-teste SQL', date: dt(-7, '14:00'), weight: 15, grade: 15.2, topicIds: ['bd-t3'], source: 'local' },
    { id: 'a7', courseId: 'bd', kind: 'trabalho', title: 'Trabalho de normalização', date: dt(12, '23:59'), weight: 25, topicIds: ['bd-t4'], source: 'local' },
    { id: 'a8', courseId: 'bd', kind: 'exame', title: 'Exame', date: dt(40, '14:00'), weight: 60, topicIds: ['bd-t1', 'bd-t2', 'bd-t3', 'bd-t4', 'bd-t5'], source: 'local' },
    { id: 'a9', courseId: 'fis', kind: 'teste', title: '1.º Teste', date: dt(-10, '16:00'), weight: 50, grade: 9.8, topicIds: ['fis-t1', 'fis-t2'], source: 'local' },
    { id: 'a10', courseId: 'fis', kind: 'teste', title: '2.º Teste', date: dt(18, '16:00'), weight: 50, topicIds: ['fis-t3', 'fis-t4', 'fis-t5'], source: 'local' },
    { id: 'a11', courseId: 'so', kind: 'teste', title: 'Teste intermédio', date: dt(3, '11:00'), weight: 40, topicIds: ['so-t1', 'so-t2', 'so-t3'], location: 'Ed. II — 127', source: 'local' },
    { id: 'a12', courseId: 'so', kind: 'exame', title: 'Exame', date: dt(45, '09:00'), weight: 60, topicIds: ['so-t1', 'so-t2', 'so-t3', 'so-t4', 'so-t5'], source: 'local' },
  ],
  classes: [
    { id: 'c1', courseId: 'am2', type: 'T', weekday: 1, start: '09:00', end: '11:00', room: 'Ed. VII — 1A', source: 'local' },
    { id: 'c2', courseId: 'aed', type: 'T', weekday: 1, start: '14:00', end: '16:00', room: 'Ed. II — 127', source: 'local' },
    { id: 'c3', courseId: 'bd', type: 'T', weekday: 2, start: '10:00', end: '12:00', room: 'Ed. II — 128', source: 'local' },
    { id: 'c4', courseId: 'fis', type: 'TP', weekday: 2, start: '14:00', end: '16:00', room: 'Ed. I — 4.2', source: 'local' },
    { id: 'c5', courseId: 'so', type: 'T', weekday: 3, start: '09:00', end: '11:00', room: 'Ed. II — 127', source: 'local' },
    { id: 'c6', courseId: 'aed', type: 'P', weekday: 3, start: '11:00', end: '13:00', room: 'Lab 110', source: 'local' },
    { id: 'c7', courseId: 'am2', type: 'TP', weekday: 4, start: '11:00', end: '13:00', room: 'Ed. VII — 2B', source: 'local' },
    { id: 'c8', courseId: 'bd', type: 'P', weekday: 4, start: '15:00', end: '17:00', room: 'Lab 112', source: 'local' },
    { id: 'c9', courseId: 'fis', type: 'T', weekday: 5, start: '09:00', end: '11:00', room: 'Ed. I — Anf. A', source: 'local' },
    { id: 'c10', courseId: 'so', type: 'P', weekday: 5, start: '14:00', end: '16:00', room: 'Lab 115', source: 'local' },
  ],
  sessions: [
    { id: 's1', courseId: 'so', topicId: 'so-t3', assessmentId: 'a11', date: d(0), start: '17:00', minutes: 60, done: false, generated: true },
    { id: 's2', courseId: 'aed', topicId: 'aed-t5', assessmentId: 'a4', date: d(0), start: '18:15', minutes: 50, done: false, generated: true },
    { id: 's3', courseId: 'am2', topicId: 'am2-t3', assessmentId: 'a2', date: d(0), start: '21:00', minutes: 40, done: false, generated: true },
    { id: 's4', courseId: 'so', topicId: 'so-t2', date: d(-1), minutes: 60, done: true, actualMinutes: 65, generated: true },
    { id: 's5', courseId: 'bd', topicId: 'bd-t4', date: d(-1), minutes: 45, done: true, actualMinutes: 40, generated: true },
    { id: 's6', courseId: 'am2', topicId: 'am2-t2', date: d(-2), minutes: 90, done: true, actualMinutes: 90, generated: true },
    { id: 's7', courseId: 'aed', topicId: 'aed-t4', date: d(-3), minutes: 60, done: true, actualMinutes: 50, generated: true },
    { id: 's8', courseId: 'fis', topicId: 'fis-t3', date: d(-3), minutes: 45, done: true, actualMinutes: 45, generated: true },
    { id: 's9', courseId: 'fis', topicId: 'fis-t3', date: d(-5), minutes: 60, done: false, generated: true },
    { id: 's10', courseId: 'so', topicId: 'so-t1', date: d(1), start: '17:00', minutes: 75, done: false, generated: true },
    { id: 's11', courseId: 'aed', topicId: 'aed-t6', date: d(1), start: '18:30', minutes: 60, done: false, generated: true },
  ],
  tasks: [
    { id: 'k1', courseId: 'aed', title: 'Implementar Dijkstra para o Projeto 2', due: d(3), done: false, priority: 1 },
    { id: 'k2', courseId: 'so', title: 'Resolver ficha 4 (semáforos)', due: d(1), done: false, priority: 1 },
    { id: 'k3', courseId: 'bd', title: 'Rever slides de formas normais', due: d(4), done: false, priority: 2 },
    { id: 'k4', courseId: 'fis', title: 'Refazer exercícios do 1.º teste', due: d(6), done: false, priority: 2 },
    { id: 'k5', title: 'Inscrição nos exames de época normal', due: d(10), done: false, priority: 3 },
    { id: 'k6', courseId: 'am2', title: 'Ficha 6 — derivadas parciais', due: d(-1), done: true, priority: 2 },
  ],
  materials: [
    { id: 'm1', courseId: 'am2', title: 'Sebenta de AM II.pdf', url: 'https://drive.google.com', provider: 'gdrive', mimeType: 'application/pdf', modifiedAt: dt(-4, '18:20'), pinned: true },
    { id: 'm2', courseId: 'aed', title: 'Notebook: Grafos e caminhos', url: 'https://notebooklm.google.com', provider: 'notebooklm', modifiedAt: dt(-1, '22:10'), pinned: true },
    { id: 'm3', courseId: 'so', title: 'Slides — Sincronização.pptx', url: 'https://onedrive.live.com', provider: 'onedrive', mimeType: 'application/vnd.ms-powerpoint', modifiedAt: dt(-2, '09:45') },
    { id: 'm4', courseId: 'bd', title: 'Página da cadeira no CLIP', url: 'https://clip.fct.unl.pt', provider: 'clip' },
    { id: 'm5', courseId: 'fis', title: 'Resumos de Mecânica', url: 'https://docs.google.com', provider: 'gdrive', mimeType: 'application/vnd.google-apps.document', modifiedAt: dt(-6, '15:00') },
  ],
  events: [
    { id: 'e1', title: 'Reunião de grupo — Projeto AED', start: dt(1, '16:00'), end: dt(1, '17:00'), source: 'google', courseId: 'aed' },
    { id: 'e2', title: 'Ginásio', start: dt(0, '19:30'), end: dt(0, '20:30'), source: 'google' },
    { id: 'e3', title: 'Horário de dúvidas — SO', start: dt(2, '15:00'), end: dt(2, '16:00'), source: 'clip', courseId: 'so', location: 'Gab. 243' },
  ],
});
