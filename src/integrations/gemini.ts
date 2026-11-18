// Barrel público do cliente Gemini — preserva todas as assinaturas existentes enquanto divide a lógica por domínio.

export { CustomKeyError, friendlyCustomKeyError } from '../lib/geminiErrors';
export {
  parseHistoryJsonText,
  parseScheduleJsonText,
  type ExtractedHistoryItem,
  type ExtractedScheduleAssessment,
  type ExtractedSchedulePayload,
  type ExtractedScheduleSlot,
} from '../lib/visionParsers';

export { AiConsentRequiredError } from './gemini/models';
export { getCustomGeminiKey, type ChatAttachment } from './gemini/core';
export {
  extractScheduleFromText,
  parseAcademicHistoryFromScreenshot,
  parseTimetableFromScreenshot,
  type KnownCourseHint,
} from './gemini/vision';

export {
  askGemini,
  fileToChatAttachment,
  hasCustomGeminiKey,
  streamGeminiChat,
  type ChatMessage,
} from './gemini/chat';

export {
  buildDocumentContext,
  buildStudyContext,
  getActiveAppLanguage,
  outputLanguageInstruction,
  SYSTEM_PROMPT,
  type DocumentContextOptions,
} from './gemini/promptContext';

export {
  assertNotebookInputs,
  extractTopicSheetFromSources,
  generateNotebookBrief,
  generateStudyGuide,
  getStudyGuideLabels,
  refineStudyGuideTopic,
  runNotebookText,
  type ExtractedTopicSheetResult,
  type NotebookAssessmentContext,
  type NotebookBriefArgs,
  type NotebookSourceInput,
  type StudyGuideProgress,
  type StudyGuideResult,
} from './gemini/notebook';

export {
  converseCheckInWithGemini,
  evaluateUniRecall,
  generateMaterialPracticeSet,
  generateRecallChallenge,
  generateUniExpeditionQuestions,
  generateUniRecallQuestion,
  summarizeNotebookMemoryDelta,
  type GeneratedPracticeCardDraft,
  type RecallChallenge,
  type UniRecallEvaluationResult,
  type UniRecallPromptResult,
} from './gemini/practice';

export {
  generateWeeklyPlanFromBriefing,
  refinePlanBriefingWithAi,
} from './gemini/plannerAi';