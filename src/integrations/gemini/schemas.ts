// Schemas JSON estritos (Structured Outputs) compatíveis com Firebase AI Logic e REST API v1beta.
import { SchemaType, type SchemaRequest } from 'firebase/ai';

export const ACADEMIC_HISTORY_SCHEMA: SchemaRequest = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      code: { type: SchemaType.STRING, nullable: true },
      name: { type: SchemaType.STRING },
      grade: { type: SchemaType.NUMBER, nullable: true },
      ects: { type: SchemaType.NUMBER, nullable: true },
      semester: { type: SchemaType.INTEGER, nullable: true },
      status: {
        type: SchemaType.STRING,
        format: 'enum',
        enum: ['aprovada', 'a_fazer', 'por_fazer'],
      },
    },
    required: ['name', 'status'],
  },
};

export const TIMETABLE_EXTRACTION_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    hasSaturdayColumn: { type: SchemaType.BOOLEAN },
    slots: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          courseName: { type: SchemaType.STRING },
          courseCode: { type: SchemaType.STRING, nullable: true },
          dayHeader: { type: SchemaType.STRING, nullable: true },
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['T', 'TP', 'P', 'OT'],
          },
          weekday: { type: SchemaType.INTEGER },
          start: { type: SchemaType.STRING },
          end: { type: SchemaType.STRING },
          room: { type: SchemaType.STRING, nullable: true },
        },
        required: ['courseName', 'type', 'weekday', 'start', 'end'],
      },
    },
    assessments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          courseName: { type: SchemaType.STRING },
          courseCode: { type: SchemaType.STRING, nullable: true },
          title: { type: SchemaType.STRING },
          date: { type: SchemaType.STRING },
          kind: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['teste', 'exame', 'trabalho', 'projeto', 'quiz'],
          },
          location: { type: SchemaType.STRING, nullable: true },
        },
        required: ['courseName', 'title', 'date', 'kind'],
      },
    },
  },
  required: ['hasSaturdayColumn', 'slots', 'assessments'],
};

export const PRACTICE_SET_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          prompt: { type: SchemaType.STRING },
          answer: { type: SchemaType.STRING },
          sourceTitle: { type: SchemaType.STRING, nullable: true },
        },
        required: ['prompt', 'answer'],
      },
    },
  },
  required: ['cards'],
};

export const RECALL_CHALLENGE_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    question: { type: SchemaType.STRING },
    hint: { type: SchemaType.STRING },
  },
  required: ['question', 'hint'],
};

export const TOPIC_SHEET_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    keyConcepts: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['title', 'summary', 'keyConcepts'],
};

export const UNI_RECALL_PROMPT_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    question: { type: SchemaType.STRING },
    hint: { type: SchemaType.STRING },
  },
  required: ['question', 'hint'],
};

export const UNI_RECALL_EVAL_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER },
    feedback: { type: SchemaType.STRING },
    weakNote: { type: SchemaType.STRING },
    strengthNote: { type: SchemaType.STRING },
  },
  required: ['score', 'feedback', 'weakNote', 'strengthNote'],
};

export const UNI_EXPEDITION_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          topicTitle: { type: SchemaType.STRING },
          q: { type: SchemaType.STRING },
          hint: { type: SchemaType.STRING },
          sourceRef: { type: SchemaType.STRING },
        },
        required: ['topicTitle', 'q', 'hint', 'sourceRef'],
      },
    },
  },
  required: ['questions'],
};

export const NOTEBOOK_MEMORY_DELTA_SCHEMA: SchemaRequest = {
  type: SchemaType.OBJECT,
  properties: {
    weakSpot: {
      type: SchemaType.OBJECT,
      nullable: true,
      properties: {
        topic: { type: SchemaType.STRING },
        note: { type: SchemaType.STRING },
      },
      required: ['topic', 'note'],
    },
    strength: { type: SchemaType.STRING, nullable: true },
  },
};
