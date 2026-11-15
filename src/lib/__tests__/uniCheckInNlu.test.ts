import { describe, expect, it } from 'vitest';
import type { Course, Material } from '../../types';
import {
  detectUpToBoundary,
  extractUniCheckInSyncBlock,
  mergeParsedUnderstandingWithAi,
  parseConversationalCheckIn,
} from '../uniCheckInNlu';

const sampleCourse: Course = {
  id: 'tep',
  code: 'TEP',
  name: 'Tecnologia de Processos',
  shortName: 'TEP',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [
    { id: 't1', title: 'Aula T01 Introdução', status: 'done', confidence: 4 },
    { id: 't2', title: 'Aula T02 Elasticidade', status: 'review', confidence: 3 },
    { id: 't3', title: 'Aula T03 Plasticidade', status: 'todo', confidence: 2 },
    { id: 't4', title: 'Aula T09 Simulação', status: 'todo', confidence: 2 },
  ],
};

const sampleMaterials: Material[] = [
  {
    id: 'm1',
    courseId: 'tep',
    title: 'Aula T05 Aspetos Fenomenológicos.pdf',
    url: 'https://example.com/t05',
    provider: 'upload',
  },
];

describe('uniCheckInNlu.detectUpToBoundary', () => {
  it('deteta limites até slide ou aula N', () => {
    expect(detectUpToBoundary('a matéria cai até ao slide 8')).toEqual({
      maxNumber: 8,
      unitLabel: 'slide',
    });
    expect(detectUpToBoundary('sai até T03 no teste')).toEqual({
      maxNumber: 3,
      unitLabel: 'Aula T',
    });
    expect(detectUpToBoundary('slides 1 a 5')).toEqual({
      maxNumber: 5,
      unitLabel: 'slide',
    });
  });
});

describe('uniCheckInNlu.parseConversationalCheckIn', () => {
  it('extrai sentimento ansioso, tópicos até ao limite e novo tópico de material em exam_prep', () => {
    const parsed = parseConversationalCheckIn({
      kind: 'exam_prep',
      userText: 'A matéria cai até ao slide 5, já revi parte e estou um pouco ansioso com Plasticidade',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: sampleMaterials,
    });

    expect(parsed.feeling).toBe('ansioso');
    expect(parsed.prepProgress).toBe('parcial');
    expect(parsed.matchedTopicIds).toEqual(expect.arrayContaining(['t1', 't2', 't3']));
    expect(parsed.matchedTopicIds).not.toContain('t4');
    expect(parsed.newTopicsToAdd.some((t) => t.includes('Aula T05'))).toBe(true);
  });

  it('remove bloco oculto <uni-checkin-sync> da resposta visível e mescla tópicos válidos', () => {
    const raw =
      'Boa! Já registei até à T03.\n<uni-checkin-sync>{"feeling":"confiante","matchedTopicIds":["t3","inexistente"],"rating":4}</uni-checkin-sync>';
    const { visibleReply, sync } = extractUniCheckInSyncBlock(raw);
    expect(visibleReply).toBe('Boa! Já registei até à T03.');
    expect(sync?.feeling).toBe('confiante');

    const base = parseConversationalCheckIn({
      kind: 'class',
      userText: 'Entendi a Aula T02 Elasticidade',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: [],
    });
    const merged = mergeParsedUnderstandingWithAi(base, sync, sampleCourse);
    expect(merged.feeling).toBe('confiante');
    expect(merged.matchedTopicIds).toEqual(expect.arrayContaining(['t2', 't3']));
    expect(merged.matchedTopicIds).not.toContain('inexistente');
    expect(merged.rating).toBe(4);
  });

  it('deteta foco e método de estudo personalizado no alinhamento', () => {
    const pastTests = parseConversationalCheckIn({
      kind: 'exam_prep',
      userText: 'Quero focar em refazer os testes antigos e cai até ao slide 8',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: sampleMaterials,
    });
    expect(pastTests.studyFocus).toBe('Refazer testes antigos');

    const customFocus = parseConversationalCheckIn({
      kind: 'exam_prep',
      userText: 'Quero focar em derivadas parciais aplicadas, estou ansioso',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: [],
    });
    expect(customFocus.studyFocus).toBe('Derivadas parciais aplicadas');

    const focusNoEm = parseConversationalCheckIn({
      kind: 'exam_prep',
      userText: 'Vou focar nos testes antigos',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: [],
    });
    expect(focusNoEm.studyFocus).toBe('Refazer testes antigos');

    const exams = parseConversationalCheckIn({
      kind: 'exam_prep',
      userText: 'Prefiro resolver exames e provas anteriores',
      course: sampleCourse,
      courses: [sampleCourse],
      materials: [],
    });
    expect(exams.studyFocus).toBe('Refazer testes antigos');
  });
});
