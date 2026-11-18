import { describe, expect, it } from 'vitest';
import { classifyOverdue } from '../planner/overdue';
import { rescheduleOverdueSessions } from '../planner/reschedule';
import type { Assessment, Settings, StudySession } from '../../types';

const settings: Settings = {
  userName: 'Teste',
  theme: 'light',
  semesterName: '2026/27 · 1.º Semestre',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-30',
  dailyStudyMinutes: 120,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  googleClientId: '',
};

const TODAY = '2026-11-16';

const sess = (p: Partial<StudySession> & { id: string }): StudySession => ({
  courseId: 'c1',
  date: '2026-11-12',
  minutes: 50,
  done: false,
  generated: true,
  ...p,
});

const exam = (p: Partial<Assessment> & { id: string }): Assessment => ({
  courseId: 'c1',
  kind: 'teste',
  title: 'Teste',
  date: '2026-11-20T10:00:00',
  weight: 50,
  topicIds: [],
  source: 'local',
  ...p,
});

describe('classifyOverdue', () => {
  it('separa geradas, manuais e caducadas', () => {
    const assessments = [
      exam({ id: 'a-past', date: '2026-11-14T10:00:00' }),
      exam({ id: 'a-next', date: '2026-11-25T10:00:00' }),
      exam({ id: 'a-c2', courseId: 'c2', date: '2026-11-10T10:00:00', grade: 15 }),
    ];
    const sessions = [
      sess({ id: 'gen' }),
      sess({ id: 'manual', generated: false }),
      sess({ id: 'locked', locked: true }),
      sess({ id: 'linkedPast', assessmentId: 'a-past' }),
      sess({ id: 'noExamLeft', courseId: 'c2', reason: { code: 'exam_prep' } }),
      sess({ id: 'c2-coverage', courseId: 'c2', reason: { code: 'coverage' } }),
      sess({ id: 'done', done: true }),
      sess({ id: 'future', date: TODAY }),
    ];
    const r = classifyOverdue({ sessions, today: TODAY, assessments });
    expect(r.missedGenerated.map((s) => s.id).sort()).toEqual(['c2-coverage', 'gen']);
    expect(r.manual.map((s) => s.id).sort()).toEqual(['locked', 'manual']);
    expect(r.expired.map((s) => s.id).sort()).toEqual(['linkedPast', 'noExamLeft']);
  });

  it('deixa de fora as cadeiras pausadas', () => {
    const sessions = [
      sess({ id: 'g', courseId: 'p' }),
      sess({ id: 'm', courseId: 'p', generated: false }),
      sess({ id: 'ok', courseId: 'c1', generated: false }),
    ];
    const r = classifyOverdue({
      sessions,
      today: TODAY,
      assessments: [],
      pausedCourseIds: ['p'],
    });
    expect(r.missedGenerated).toHaveLength(0);
    expect(r.manual.map((s) => s.id)).toEqual(['ok']);
  });
});

describe('rescheduleOverdueSessions (atrasadas)', () => {
  const base = { existing: [], classes: [], events: [], settings, from: TODAY, days: 10 };

  it('nunca coloca no dia da avaliação ligada nem depois', () => {
    const assessments = [exam({ id: 'a1', date: '2026-11-18T10:00:00' })];
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1', assessmentId: 'a1' })],
      assessments,
    });
    expect(res.updated).toHaveLength(1);
    expect(res.updated[0]!.date < '2026-11-18').toBe(true);
  });

  it('fica por agendar se já não há dia antes da avaliação', () => {
    const assessments = [exam({ id: 'a1', date: '2026-11-16T10:00:00' })];
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1', assessmentId: 'a1' })],
      assessments,
    });
    expect(res.updated).toHaveLength(0);
    expect(res.unscheduledCount).toBe(1);
  });

  it('motivo de exame respeita a próxima avaliação da cadeira', () => {
    const assessments = [exam({ id: 'a1', date: '2026-11-17T10:00:00' })];
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1', reason: { code: 'exam_prep' } })],
      assessments,
    });
    expect(res.updated[0]!.date).toBe('2026-11-16');
  });

  it('no dia da avaliação com hora termina pelo menos 30 min antes', () => {
    // Avaliação às 12:00 no próprio dia; só cabe antes das 11:30 (a janela começa às 08:30).
    const assessments = [exam({ id: 'a1', date: '2026-11-16T12:00:00' })];
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1', minutes: 50, reason: { code: 'coverage' } })],
      assessments,
      weekdaySchedule: undefined,
    });
    const s = res.updated[0]!;
    const [h, m] = s.start!.split(':').map(Number);
    if (s.date === '2026-11-16') {
      expect(h * 60 + m + s.minutes).toBeLessThanOrEqual(11 * 60 + 30);
    }
    // Com hora das 09:00 já não cabe nesse dia.
    const early = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's2', minutes: 50, reason: { code: 'coverage' } })],
      assessments: [exam({ id: 'a2', date: '2026-11-16T09:00:00' })],
    });
    expect(early.updated[0]!.date).not.toBe('2026-11-16');
  });

  it('ignora cadeiras pausadas', () => {
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1', courseId: 'p' }), sess({ id: 's2' })],
      assessments: [],
      pausedCourseIds: ['p'],
    });
    expect(res.updated.map((s) => s.id)).toEqual(['s2']);
    expect(res.unscheduledCount).toBe(1);
  });

  it('não trunca blocos: 90 min com 60 min de orçamento vão para outro dia', () => {
    const existing = [
      sess({ id: 'e1', date: TODAY, start: '09:00', minutes: 60, generated: true }),
    ];
    const res = rescheduleOverdueSessions({
      ...base,
      existing,
      overdue: [sess({ id: 's1', minutes: 90 })],
      assessments: [],
    });
    expect(res.updated).toHaveLength(1);
    expect(res.updated[0]!.minutes).toBe(90);
    expect(res.updated[0]!.date).not.toBe(TODAY);
  });

  it('devolve blocos fixados e com motivo "overdue" por omissão', () => {
    const res = rescheduleOverdueSessions({
      ...base,
      overdue: [sess({ id: 's1' }), sess({ id: 's2', reason: { code: 'coverage' } })],
      assessments: [],
    });
    expect(res.updated).toHaveLength(2);
    for (const s of res.updated) expect(s.locked).toBe(true);
    expect(res.updated[0]!.reason).toEqual({ code: 'overdue' });
    expect(res.updated[1]!.reason).toEqual({ code: 'coverage' });
    expect(res.updated.every((s) => s.minutes === 50)).toBe(true);
  });
});
