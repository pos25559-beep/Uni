import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePlan } from '../planner';
import { isWithinWindow, parseFocusWindow } from '../planner/focusWindow';
import { computeReplan, pruneExpiredPrefs, reuseStableIds, type ReplanState } from '../planner/replan';
import type { Assessment, Course, Settings, StudySession } from '../../types';

const TODAY = '2026-11-18'; // quarta

const settings: Settings = {
  userName: 'Teste',
  theme: 'light',
  semesterName: 'S1',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-31',
  dailyStudyMinutes: 150,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
  msClientId: '',
};

const course: Course = {
  id: 'c1',
  code: 'TEP',
  name: 'Tecnologia e Processos',
  shortName: 'TEP',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [
    { id: 't1', title: 'Método do limite superior', status: 'learning', confidence: 2 },
    { id: 't2', title: 'Extrusão', status: 'todo', confidence: 2 },
  ],
};

const exam: Assessment = {
  id: 'a1',
  courseId: 'c1',
  kind: 'teste',
  title: '1.º Teste',
  date: '2026-11-23T14:00:00',
  weight: 50,
  topicIds: ['t1', 't2'],
  source: 'local',
};

const baseState = (sessions: StudySession[] = [], over: Partial<Settings> = {}): ReplanState => ({
  courses: [course],
  assessments: [exam],
  classes: [],
  events: [],
  materials: [],
  settings: { ...settings, ...over },
  sessions,
  academicProfile: { difficultCourseIds: [], extraActivities: [] },
  weeklyCheckIns: [],
  studyLogs: [],
});

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

describe('replan: um só motor', () => {
  it('sem plano e sem force não cria plano a ninguém', () => {
    const r = computeReplan(baseState(), { today: TODAY, nowMinutes: 8 * 60 });
    expect(r.changed).toBe(false);
    expect(r.sessions).toHaveLength(0);
  });

  it('nunca marca por cima de uma sessão fixada', () => {
    const locked: StudySession = {
      id: 'lock-1',
      courseId: 'c1',
      date: '2026-11-19',
      start: '09:00',
      minutes: 150,
      done: false,
      generated: true,
      locked: true,
    };
    const r = computeReplan(baseState([locked]), { today: TODAY, nowMinutes: 8 * 60, force: true });
    expect(r.sessions.find((s) => s.id === 'lock-1')).toBe(locked);
    const sameDay = r.sessions.filter((s) => s.date === '2026-11-19' && s.id !== 'lock-1');
    for (const s of sameDay) {
      const start = toMin(s.start ?? '00:00');
      const overlaps = start < 9 * 60 + 150 && start + s.minutes > 9 * 60;
      expect(overlaps).toBe(false);
    }
  });

  it('recalcular sem mudanças mantém os mesmos ids e objetos (sem escritas na nuvem)', () => {
    const first = computeReplan(baseState(), { today: TODAY, nowMinutes: 8 * 60, force: true });
    expect(first.sessions.length).toBeGreaterThan(0);
    const second = computeReplan(baseState(first.sessions), { today: TODAY, nowMinutes: 8 * 60, force: true });
    expect(second.changed).toBe(false);
    expect(second.sessions.map((s) => s.id).sort()).toEqual(first.sessions.map((s) => s.id).sort());
  });

  it('reuseStableIds reaproveita ids por dia/hora/cadeira/tópico', () => {
    const old: StudySession = { id: 'old', courseId: 'c1', topicId: 't1', date: TODAY, start: '17:00', minutes: 50, done: false, generated: true };
    const fresh: StudySession = { ...old, id: 'new', minutes: 35 };
    const [out] = reuseStableIds([old], [fresh]);
    expect(out.id).toBe('old');
    expect(out.minutes).toBe(35);
  });

  it('o horizonte vem das preferências guardadas', () => {
    const r = computeReplan(
      baseState([], { plannerPrefs: { horizonDays: 7, preferredPeriod: 'auto', blockMinutes: 50, strategy: 'balanced' } }),
      { today: TODAY, nowMinutes: 8 * 60, force: true },
    );
    expect(r.sessions.every((s) => s.date <= '2026-11-24')).toBe(true);
  });

  it('limpa notas e reforços expirados', () => {
    const pruned = pruneExpiredPrefs(
      {
        horizonDays: 14,
        preferredPeriod: 'auto',
        blockMinutes: 50,
        strategy: 'balanced',
        boostCourseIds: ['c1'],
        courseModeUntil: { c1: '2026-11-10' },
        courseNotes: { c1: { text: 'x', until: '2026-11-17', source: 'briefing' } },
      },
      TODAY,
    );
    expect(pruned.courseNotes).toEqual({});
    expect(pruned.boostCourseIds).toEqual([]);
  });
});

describe('notas de foco com validade', () => {
  it('lê «de sexta a segunda», «até quarta», «fim de semana» e «amanhã»', () => {
    expect(parseFocusWindow('Sprint intensivo de sexta a segunda', TODAY)).toEqual({ from: '2026-11-20', until: '2026-11-23' });
    expect(parseFocusWindow('reforçar até quarta-feira', '2026-11-16')).toEqual({ from: '2026-11-16', until: '2026-11-18' });
    expect(parseFocusWindow('rever tudo no fim de semana', TODAY)).toEqual({ from: '2026-11-21', until: '2026-11-22' });
    expect(parseFocusWindow('amanhã só exercícios', TODAY)).toEqual({ from: '2026-11-19', until: '2026-11-19' });
    expect(parseFocusWindow('método do limite superior', TODAY)).toBeUndefined();
    expect(isWithinWindow('2026-11-21', { from: '2026-11-20', until: '2026-11-23' })).toBe(true);
  });

  it('uma nota com validade só aparece nos dias da janela', () => {
    const plan = generatePlan({
      courses: [course],
      assessments: [exam],
      classes: [],
      events: [],
      settings,
      from: TODAY,
      nowMinutes: 8 * 60,
      days: 7,
      courseNotes: { c1: { text: 'Sprint final', from: '2026-11-21', until: '2026-11-22', source: 'briefing' } },
    });
    const withNote = plan.filter((s) => (s.notes ?? '').includes('Sprint final'));
    expect(withNote.length).toBeGreaterThan(0);
    for (const s of withNote) expect(s.date >= '2026-11-21' && s.date <= '2026-11-22').toBe(true);
  });
});

describe('só o motor gera planos', () => {
  it('nenhum componente chama generatePlan( diretamente', () => {
    const root = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const allowed = ['lib/planner/', 'lib/planner.ts', '__tests__'];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) {
          const rel = full.slice(root.length + 1).replace(/\\/g, '/');
          if (allowed.some((a) => rel.includes(a))) continue;
          if (/\bgeneratePlan\(/.test(readFileSync(full, 'utf8'))) offenders.push(rel);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
