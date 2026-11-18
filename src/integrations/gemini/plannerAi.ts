import type { Content, GenerationConfig } from 'firebase/ai';
import { tr } from '../../i18n/tr';
import { normalizeAppLanguage } from '../../lib/grading';
import { parsePlannerBriefing, type ParsedPlannerBriefing } from '../../lib/plannerBriefing';
import type { LlmWeeklyBriefingOutput } from '../../lib/studyBriefingPlan';
import type { AppLanguage } from '../../types';
import {
  callDirectRest,
  resolveGeminiConfig,
  runNativeGenerate,
  withQuotaAndFallback,
} from './core';
import { THINKING_FAST } from './models';
import { getActiveAppLanguage, outputLanguageInstruction } from './promptContext';
import { WEEKLY_BRIEFING_PLAN_SCHEMA } from './schemas';

/**
 * Refinamento opcional com IA do briefing do construtor de planos.
 * Só corre quando o estudante clica explicitamente e tem IA consentida; caso contrário devolve a leitura determinística.
 */
export async function refinePlanBriefingWithAi(args: {
  text: string;
  courses: Array<{ id: string; code: string; shortName: string; name: string }>;
  lang?: AppLanguage | string;
}): Promise<ParsedPlannerBriefing> {
  const { customKey, model } = resolveGeminiConfig();
  const base = parsePlannerBriefing({
    text: args.text,
    courses: args.courses.map((c) => ({ ...c, ects: 6, color: 'emerald', targetGrade: 14, topics: [] })),
  });
  if (!args.text.trim()) return base;

  const targetLang = normalizeAppLanguage(args.lang ?? getActiveAppLanguage());
  const courseCatalog = args.courses
    .map((c) => `${c.id} | ${c.shortName} (${c.code}) | ${c.name}`)
    .join('\n');

  const prompt = `Extrai apenas ajustes estruturados deste pedido do estudante para o plano de estudo (${targetLang}).
Cadeiras:
${courseCatalog}

Pedido do estudante:
"${args.text.slice(0, 1200)}"

Devolve APENAS JSON válido:
{"midSemesterCatchUp":boolean,"marathon":{"enabled":boolean,"daysBefore":1|2|3,"dailyMinutes":360|480|600}|null,"boostCourseIds":[string],"pausedCourseIds":[string],"courseFocus":{"courseId":"foco curto ate 60 chars"}}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.15,
    maxOutputTokens: 320,
    responseMimeType: 'application/json',
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  try {
    const ai = JSON.parse(match ? match[0] : rawText || '{}') as {
      midSemesterCatchUp?: boolean;
      marathon?: { enabled?: boolean; daysBefore?: number; dailyMinutes?: number } | null;
      boostCourseIds?: string[];
      pausedCourseIds?: string[];
      courseFocus?: Record<string, string>;
    };
    const validIds = new Set(args.courses.map((c) => c.id));
    const mergedBoost = [...new Set([...base.boostCourseIds, ...(ai.boostCourseIds ?? []).filter((id) => validIds.has(id))])];
    const mergedPaused = [...new Set([...base.pausedCourseIds, ...(ai.pausedCourseIds ?? []).filter((id) => validIds.has(id) && !mergedBoost.includes(id))])];
    const mergedFocus = { ...base.briefingCourseFocus };
    if (ai.courseFocus && typeof ai.courseFocus === 'object') {
      for (const [cid, txt] of Object.entries(ai.courseFocus)) {
        if (validIds.has(cid) && typeof txt === 'string' && txt.trim()) {
          mergedFocus[cid] = txt.trim().slice(0, 80);
        }
      }
    }
    let suggestedMarathon = base.suggestedMarathon;
    if (!suggestedMarathon && ai.marathon?.enabled) {
      const daysBefore = ([1, 2, 3].includes(Number(ai.marathon.daysBefore)) ? Number(ai.marathon.daysBefore) : 2) as 1 | 2 | 3;
      const dailyMinutes = ([360, 480, 600].includes(Number(ai.marathon.dailyMinutes)) ? Number(ai.marathon.dailyMinutes) : 480) as 360 | 480 | 600;
      suggestedMarathon = { enabled: true, daysBefore, dailyMinutes };
    }
    return {
      ...base,
      midSemesterCatchUp: Boolean(base.midSemesterCatchUp || ai.midSemesterCatchUp),
      ...(suggestedMarathon ? { suggestedMarathon } : {}),
      boostCourseIds: mergedBoost,
      pausedCourseIds: mergedPaused,
      briefingCourseFocus: mergedFocus,
    };
  } catch {
    return base;
  }
}

/**
 * Gera um plano estruturado de 7 dias a partir do briefing conversacional do estudante.
 * Respeita consentimento/quota, cancelamento via AbortSignal e devolve erro real em caso de falha.
 */
export async function generateWeeklyPlanFromBriefing(args: {
  briefingText: string;
  plannerSnapshot: string;
  refinementHistory?: string[];
  currentPlanSummary?: string;
  lang?: AppLanguage | string;
  signal?: AbortSignal;
}): Promise<LlmWeeklyBriefingOutput> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang = normalizeAppLanguage(args.lang ?? getActiveAppLanguage());
  const refinementsBlock =
    args.refinementHistory && args.refinementHistory.length > 0
      ? `\nFOLLOW-UP REFINEMENTS REQUESTED BY STUDENT (apply cumulatively in order of priority):\n${args.refinementHistory.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';
  const currentSummaryBlock = args.currentPlanSummary
    ? `\nCURRENT DRAFT SUMMARY TO REFINE:\n${args.currentPlanSummary.slice(0, 1400)}`
    : '';

  const prompt = `You are Uni, an empathetic, practical academic study planner for university and high-school students.
${outputLanguageInstruction(targetLang)}

TASK:
Create a realistic, structured 7-day study plan (dayOffset 0..6 where 0 is today) tailored specifically to the student's briefing, upcoming exams, topic difficulties, and available windows.

STUDENT BRIEFING:
"${args.briefingText.trim().slice(0, 1400)}"${refinementsBlock}${currentSummaryBlock}

STUDENT ACADEMIC SNAPSHOT:
${args.plannerSnapshot}

RULES:
- Use exact \`courseId\` and \`topicId\` values from COURSES when a course/topic matches; never invent fake IDs.
- Prioritize urgent assessments (especially tests in 1-5 days) and topics marked low-confidence or explicitly mentioned as struggles.
- Keep daily study load sustainable (typically 1-4 blocks per day, 25-75 min each; allow more blocks only when an exam is imminent and availability allows).
- Pick \`window\` ('morning' | 'afternoon' | 'evening' | 'all_day' | 'auto') matching NEXT_7_DAYS_AVAILABILITY and the student's briefing.
- Choose \`focusKind\`: 'exam_prep' near exams, 'practice' for problem sets/calculus/drills, 'theory' for new/unfamiliar concepts, 'review' for spaced recall.
- Keep \`strategySummary\` concise (1-2 clear sentences in the student's language).
- Provide 3 short, actionable \`suggestedFollowUps\` (under 40 chars each, in the student's language) tailored to adjusting this specific week.
- Keep each block's \`reasonNote\` concrete and short (max 85 chars, in the student's language).`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.35,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: WEEKLY_BRIEFING_PLAN_SCHEMA,
    thinkingConfig: THINKING_FAST,
  };

  const rawText = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({
          key: customKey,
          model,
          contents,
          generationConfig,
          signal: args.signal,
        })
      : runNativeGenerate({
          model,
          contents,
          generationConfig,
          signal: args.signal,
        }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '');
  if (!match) {
    throw new Error(tr('common:errors.aiEmptyReply'));
  }

  let parsed: Partial<LlmWeeklyBriefingOutput>;
  try {
    parsed = JSON.parse(match[0]) as Partial<LlmWeeklyBriefingOutput>;
  } catch {
    throw new Error(tr('common:errors.aiEmptyReply'));
  }

  if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    throw new Error(tr('common:errors.aiEmptyReply'));
  }

  return {
    strategySummary: String(parsed.strategySummary || '').trim(),
    focusCourseIds: Array.isArray(parsed.focusCourseIds)
      ? parsed.focusCourseIds.map((id) => String(id))
      : [],
    suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
      ? parsed.suggestedFollowUps.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
      : [],
    blocks: parsed.blocks.map((b) => ({
      dayOffset: Number.isFinite(Number(b.dayOffset)) ? Number(b.dayOffset) : 0,
      courseId: String(b.courseId || ''),
      ...(b.courseShortName ? { courseShortName: String(b.courseShortName) } : {}),
      ...(b.topicId ? { topicId: String(b.topicId) } : {}),
      ...(b.topicTitle ? { topicTitle: String(b.topicTitle) } : {}),
      window: b.window ?? 'auto',
      minutes: Number.isFinite(Number(b.minutes)) ? Number(b.minutes) : 50,
      focusKind: b.focusKind ?? 'practice',
      reasonNote: String(b.reasonNote || '').trim(),
    })),
  };
}
