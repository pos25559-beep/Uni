// Motor do plano de estudo (barrel público — implementação modular em src/lib/planner/*).

export type {
  CourseMinutes,
  DayBudgetReductionReason,
  DayBudgetResult,
  DayPlanProfile,
  PlanInput,
} from './planner/types';
export {
  computeDayBudget,
  findFirstFreeSlotOnDate,
  matchBestMaterialForTopic,
  resolveDayPlanProfile,
} from './planner/slots';
export { analyzeTestMode, planSummary } from './planner/testMode';
export { generatePlan } from './planner/engine';
export { rescheduleOverdueSessions } from './planner/reschedule';
