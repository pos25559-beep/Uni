import { afterEach, describe, expect, it } from 'vitest';
import {
  clearLocalDb,
  deleteTopicSheet,
  deleteUniAgent,
  deleteUniMemory,
  getTopicSheet,
  getUniAgent,
  getUniMemory,
  listTopicSheetsByCourse,
  listUniAgents,
  putTopicSheet,
  putUniAgent,
  putUniMemory,
} from '../localDb';

afterEach(async () => {
  await clearLocalDb();
});

describe('localDb', () => {
  it('saves, lists newest-first, fetches, and deletes topicSheets', async () => {
    await putTopicSheet({
      id: 'sheet-older',
      courseId: 'course-tep',
      title: 'Resumo antigo',
      mode: 'summary',
      summary: 'Conteúdo inicial',
      keyConcepts: ['Conceito A'],
      updatedAt: '2026-11-14T10:00:00.000Z',
    });
    await putTopicSheet({
      id: 'sheet-newer',
      courseId: 'course-tep',
      title: 'Guia para o teste',
      mode: 'guide',
      summary: '# Guia TEP\n\nPontos críticos...',
      keyConcepts: ['Conceito B', 'Conceito C'],
      materialIds: ['mat-1'],
      updatedAt: '2026-11-15T18:30:00.000Z',
    });
    await putTopicSheet({
      id: 'sheet-other-course',
      courseId: 'course-fab',
      title: 'Quiz Fab',
      mode: 'quiz',
      summary: 'Pergunta 1...',
      keyConcepts: [],
      updatedAt: '2026-11-15T20:00:00.000Z',
    });

    const tepSheets = await listTopicSheetsByCourse('course-tep');
    expect(tepSheets.map((s) => s.id)).toEqual(['sheet-newer', 'sheet-older']);

    const fetched = await getTopicSheet('sheet-newer');
    expect(fetched?.title).toBe('Guia para o teste');
    expect(fetched?.materialIds).toEqual(['mat-1']);

    await deleteTopicSheet('sheet-older');
    const afterDelete = await listTopicSheetsByCourse('course-tep');
    expect(afterDelete.map((s) => s.id)).toEqual(['sheet-newer']);
    expect(await getTopicSheet('sheet-older')).toBeNull();
  });

  it('persists and clears course uniMemories records', async () => {
    await putUniMemory({
      id: 'course-tep',
      courseId: 'course-tep',
      facts: [
        {
          id: 'fact-1',
          text: 'Prefere exercícios numéricos antes da teoria.',
          updatedAt: '2026-11-15T12:00:00.000Z',
          source: 'chat',
        },
      ],
      updatedAt: '2026-11-15T12:00:00.000Z',
    });

    const memory = await getUniMemory('course-tep');
    expect(memory?.facts).toHaveLength(1);
    expect(memory?.facts[0]?.text).toContain('exercícios numéricos');

    await deleteUniMemory('course-tep');
    expect(await getUniMemory('course-tep')).toBeNull();
  });

  it('saves, lists, retrieves, and deletes course uniAgents records', async () => {
    await putUniAgent({
      courseId: 'course-tep',
      name: 'Ada',
      formId: 'nuvem',
      personaId: 'exigente',
      language: 'pt-PT',
      memoryEnabled: false,
      stage: 1,
      mastery: 18,
      milestones: [],
      items: [],
      notebook: {
        goals: ['Dominar problemas de energia'],
        weakSpots: [],
        strengths: [],
        updatedAt: '2026-11-16T00:00:00.000Z',
      },
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    });
    await putUniAgent({
      courseId: 'course-fab',
      name: 'GotaFab',
      formId: 'gota',
      personaId: 'calmo',
      language: 'pt-PT',
      memoryEnabled: true,
      stage: 0,
      mastery: 4,
      milestones: [],
      items: [],
      notebook: {
        goals: ['Rever processos SLA/SLS'],
        weakSpots: [],
        strengths: [],
        updatedAt: '2026-11-16T00:00:00.000Z',
      },
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    });

    const fetched = await getUniAgent('course-tep');
    expect(fetched?.name).toBe('Ada');
    expect(fetched?.memoryEnabled).toBe(false);

    await putUniAgent({
      ...fetched!,
      stage: 4,
      expedition: {
        preparedAt: '2026-11-16T01:00:00.000Z',
        forDate: '2026-11-17',
        questions: [
          {
            id: 'q-1',
            topicTitle: 'Entropia',
            q: 'Define variação de entropia num ciclo reversível.',
            hint: 'Ciclo fechado de Carnot.',
            sourceRef: 'Sebenta Cap 4',
          },
        ],
      },
      diploma: {
        issuedAt: '2026-11-16T01:05:00.000Z',
        finalGrade: 17.5,
        masteredTopicCount: 6,
        totalTopicCount: 6,
        stageAtGraduation: 4,
      },
    });
    const withPhase2 = await getUniAgent('course-tep');
    expect(withPhase2?.expedition?.questions).toHaveLength(1);
    expect(withPhase2?.diploma?.finalGrade).toBe(17.5);

    const listed = await listUniAgents();
    expect(listed.map((a) => a.courseId)).toEqual(['course-tep', 'course-fab']);

    await deleteUniAgent('course-tep');
    expect(await getUniAgent('course-tep')).toBeNull();
    expect((await listUniAgents()).map((a) => a.courseId)).toEqual(['course-fab']);

    await clearLocalDb();
    expect(await listUniAgents()).toEqual([]);
  });
});
