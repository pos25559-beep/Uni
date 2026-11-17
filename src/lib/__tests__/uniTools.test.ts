import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../../store/useStore';
import type { Course } from '../../types';
import {
  buildUniToolProposal,
  commitUniToolProposal,
  executeReadOnlyOrRecallUniTool,
  extractUniToolsFromText,
  requiresStudentConfirmation,
  UNI_TOOL_DECLARATIONS,
} from '../uniTools';

const SAMPLE_COURSE: Course = {
  id: 'c-calc',
  code: 'C1D',
  name: 'Cálculo I D',
  shortName: 'Cálculo I',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [
    {
      id: 't-lim',
      title: 'Limites no infinito',
      status: 'learning',
      confidence: 3,
    },
  ],
};

beforeEach(() => {
  useStore.setState({
    courses: [SAMPLE_COURSE],
    sessions: [
      {
        id: 's-1',
        courseId: 'c-calc',
        topicId: 't-lim',
        date: '2026-11-18',
        minutes: 50,
        done: false,
        generated: true,
        notes: 'Limites no infinito',
      },
    ],
    assessments: [
      {
        id: 'a-1',
        courseId: 'c-calc',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-22T10:00:00',
        weight: 40,
        topicIds: ['t-lim'],
        source: 'local',
      },
    ],
    tasks: [],
  });
});

describe('uniTools', () => {
  it('declares all 7 closed-list Uni tools with explicit confirmation rules', () => {
    const names = UNI_TOOL_DECLARATIONS.map((d) => d.name);
    expect(names).toEqual([
      'ler_plano',
      'ler_ficha',
      'registar_recall',
      'criar_sessao',
      'criar_flashcards',
      'marcar_duvida',
      'focar_plano',
    ]);
    expect(requiresStudentConfirmation('ler_plano')).toBe(false);
    expect(requiresStudentConfirmation('ler_ficha')).toBe(false);
    expect(requiresStudentConfirmation('registar_recall')).toBe(false);
    expect(requiresStudentConfirmation('criar_sessao')).toBe(true);
    expect(requiresStudentConfirmation('criar_flashcards')).toBe(true);
    expect(requiresStudentConfirmation('marcar_duvida')).toBe(true);
    expect(requiresStudentConfirmation('focar_plano')).toBe(true);
  });

  it('executes ler_plano, ler_ficha, and registar_recall immediately without confirmation', async () => {
    const planRes = await executeReadOnlyOrRecallUniTool(
      { name: 'ler_plano', args: { courseId: 'c-calc' } },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );
    expect(planRes.ok).toBe(true);
    expect(planRes.requiresConfirmation).toBe(false);
    expect(Array.isArray(planRes.data?.sessions) ? planRes.data.sessions.length : 0).toBe(1);

    const sheetRes = await executeReadOnlyOrRecallUniTool(
      { name: 'ler_ficha', args: { courseId: 'c-calc', topicQuery: 'Limites' } },
      { activeCourse: SAMPLE_COURSE },
    );
    expect(sheetRes.ok).toBe(true);
    expect(sheetRes.requiresConfirmation).toBe(false);

    const recallRes = await executeReadOnlyOrRecallUniTool(
      { name: 'registar_recall', args: { topicTitle: 'Limites no infinito', score: 3 } },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );
    expect(recallRes.ok).toBe(true);
    const updatedTopic = useStore
      .getState()
      .courses[0]?.topics.find((t) => t.id === 't-lim');
    expect(updatedTopic?.lastRecallScore).toBe(3);
    expect(updatedTopic?.recallCount).toBe(1);
    expect(updatedTopic?.srsIntervalDays).toBe(3);
    expect(updatedTopic?.nextReviewDate).toBe('2026-11-19');
  });

  it('never writes criar_sessao, criar_flashcards, or marcar_duvida before explicit student confirmation', async () => {
    const sessionProp = buildUniToolProposal(
      {
        name: 'criar_sessao',
        args: { topicTitle: 'Limites no infinito', minutes: 45, date: '2026-11-19' },
      },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );
    const cardsProp = buildUniToolProposal(
      {
        name: 'criar_flashcards',
        args: {
          topicTitle: 'Limites no infinito',
          cards: [{ front: 'Lim (1 + 1/n)^n?', back: 'Número de Euler e' }],
        },
      },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );
    const doubtProp = buildUniToolProposal(
      {
        name: 'marcar_duvida',
        args: { topicTitle: 'Limites no infinito', note: 'Quando aplicar L’Hôpital em 0·∞?' },
      },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );

    expect(sessionProp?.status).toBe('pending');
    expect(cardsProp?.status).toBe('pending');
    expect(doubtProp?.status).toBe('pending');

    // Store permanece inalterado enquanto o estudante não confirmar
    expect(useStore.getState().sessions).toHaveLength(1);
    expect(useStore.getState().courses[0]?.topics[0]?.practiceCards ?? []).toHaveLength(0);
    expect(useStore.getState().tasks).toHaveLength(0);

    // Confirmação explícita escreve cada proposta
    await commitUniToolProposal(sessionProp!);
    expect(useStore.getState().sessions).toHaveLength(2);

    await commitUniToolProposal(cardsProp!);
    expect(useStore.getState().courses[0]?.topics[0]?.practiceCards).toHaveLength(1);

    await commitUniToolProposal(doubtProp!);
    expect(useStore.getState().tasks).toHaveLength(1);
    expect(useStore.getState().tasks[0]?.title).toContain('Limites no infinito');
  });

  it('extracts <uni-tool> blocks cleanly and strips them from visible markdown', () => {
    const raw = `Posso marcar uma revisão extra amanhã.\n<uni-tool>{"name":"criar_sessao","args":{"topicTitle":"Séries","minutes":50}}</uni-tool>`;
    const extracted = extractUniToolsFromText(raw);
    expect(extracted.displayText).toBe('Posso marcar uma revisão extra amanhã.');
    expect(extracted.calls).toHaveLength(1);
    expect(extracted.calls[0]?.name).toBe('criar_sessao');
  });

  it('builds and commits focar_plano proposal, updating plannerPrefs and regenerating future sessions', async () => {
    const prevSettings = useStore.getState().settings;
    useStore.setState({
      settings: {
        ...prevSettings,
        plannerPrefs: {
          horizonDays: 14,
          preferredPeriod: 'auto',
          blockMinutes: 50,
          strategy: 'balanced',
          boostCourseIds: [],
          pausedCourseIds: ['c-calc'],
          exclusiveTestFocus: false,
        },
      },
    });

    const proposal = buildUniToolProposal(
      {
        name: 'focar_plano',
        args: { courseId: 'C1D', exclusive: true, reason: 'Foco total até ao teste' },
      },
      { activeCourse: SAMPLE_COURSE, today: '2026-11-16' },
    );

    expect(proposal).not.toBeNull();
    expect(proposal?.toolName).toBe('focar_plano');
    expect(proposal?.courseId).toBe('c-calc');
    expect(proposal?.planFocus?.exclusive).toBe(true);

    // Não altera settings antes de confirmar
    expect(useStore.getState().settings.plannerPrefs?.exclusiveTestFocus).toBe(false);
    expect(useStore.getState().settings.plannerPrefs?.pausedCourseIds).toEqual(['c-calc']);

    await commitUniToolProposal(proposal!);

    const updatedPrefs = useStore.getState().settings.plannerPrefs;
    expect(updatedPrefs?.exclusiveTestFocus).toBe(true);
    expect(updatedPrefs?.boostCourseIds).toContain('c-calc');
    expect(updatedPrefs?.pausedCourseIds).not.toContain('c-calc');
  });
});
