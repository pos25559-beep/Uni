import { tr } from '../i18n/tr';
import type {
  AcademicProfile,
  Assessment,
  ClassSlot,
  Course,
  HubFlowId,
  Material,
  Settings,
  StudySession,
} from '../types';

export type HubStepKey = 'schedule' | 'assessments' | 'drive_hd' | 'notebook';

export interface HubFlowMeta {
  id: HubFlowId;
  title: string;
  shortLabel: string;
  badge: string;
  description: string;
  uniMessage: string;
  stepOrder: HubStepKey[];
  requiredKeys: HubStepKey[];
}

const hubFlow = (
  id: HubFlowId,
  stepOrder: HubStepKey[],
  requiredKeys: HubStepKey[],
): HubFlowMeta => ({
  id,
  get title() {
    return tr(`onboarding:hub.flow.${id}.title`);
  },
  get shortLabel() {
    return tr(`onboarding:hub.flow.${id}.short`);
  },
  get badge() {
    return tr(`onboarding:hub.flow.${id}.badge`);
  },
  get description() {
    return tr(`onboarding:hub.flow.${id}.description`);
  },
  get uniMessage() {
    return tr(`onboarding:hub.flow.${id}.message`);
  },
  stepOrder,
  requiredKeys,
});

export const HUB_FLOWS: Record<HubFlowId, HubFlowMeta> = {
  caloiro_inicio: hubFlow('caloiro_inicio', ['schedule', 'assessments', 'drive_hd', 'notebook'], []),
  caloiro_meio: hubFlow('caloiro_meio', ['schedule', 'assessments', 'drive_hd', 'notebook'], ['schedule', 'assessments']),
  veterano_inicio: hubFlow('veterano_inicio', ['drive_hd', 'notebook', 'schedule', 'assessments'], ['drive_hd', 'notebook']),
  veterano_meio: hubFlow('veterano_meio', ['schedule', 'assessments', 'drive_hd', 'notebook'], ['schedule', 'assessments', 'drive_hd']),
};

export interface HubInferenceInput {
  academicProfile: AcademicProfile;
  courses: Course[];
  classes: ClassSlot[];
  assessments: Assessment[];
  materials: Material[];
  sessions: StudySession[];
  settings: Settings;
}

export interface InferredHubResult {
  recommendedFlow: HubFlowId;
  isFreshman: boolean;
  hasMidSemesterSignals: boolean;
}

/**
 * Sugere automaticamente um dos 4 fluxos pós-onboarding a partir dos dados já recolhidos.
 */
export function inferHubProfile(input: HubInferenceInput): InferredHubResult {
  const { academicProfile, classes, assessments, materials, sessions, courses, settings } = input;
  const activeYears = academicProfile.activeYears ?? [academicProfile.currentAcademicYear || 1];
  const isFreshman =
    academicProfile.currentAcademicYear <= 1 &&
    (academicProfile.completedEcts ?? 0) <= 0 &&
    activeYears.every((y) => y <= 1);

  const hasPendingAssessments = assessments.some((a) => a.grade === undefined);
  const hasStudyHistory = sessions.some((s) => s.done);
  const hasDocs =
    materials.length > 0 ||
    courses.some((c) => Boolean(c.sharedDriveUrl || c.driveFolderUrl || c.notebookUrl)) ||
    (settings.sharedHubDriveUrls?.length ?? 0) > 0;

  const hasMidSemesterSignals =
    classes.length > 0 || hasPendingAssessments || hasStudyHistory;

  let recommendedFlow: HubFlowId;
  if (isFreshman) {
    recommendedFlow = hasMidSemesterSignals ? 'caloiro_meio' : 'caloiro_inicio';
  } else if (hasMidSemesterSignals) {
    recommendedFlow = 'veterano_meio';
  } else if (hasDocs) {
    recommendedFlow = 'veterano_inicio';
  } else {
    recommendedFlow = 'veterano_inicio';
  }

  return {
    recommendedFlow,
    isFreshman,
    hasMidSemesterSignals,
  };
}

export interface HubStepStatus {
  key: HubStepKey;
  title: string;
  hint: string;
  ready: boolean;
  requiredForFlow: boolean;
  countLabel?: string;
}

export interface HubProgressSnapshot {
  flow: HubFlowMeta;
  steps: HubStepStatus[];
  readyCount: number;
  totalCount: number;
  missingRequired: HubStepStatus[];
  missingAny: HubStepStatus[];
  isCompleteForFlow: boolean;
  allReady: boolean;
  hasCourses: boolean;
}

/**
 * Calcula em tempo real o estado das 4 fontes do Hub segundo o fluxo ativo.
 */
export function getHubProgress(
  input: HubInferenceInput,
  flowId?: HubFlowId,
): HubProgressSnapshot {
  const resolvedFlowId =
    flowId ?? input.settings.hubSetupFlow ?? inferHubProfile(input).recommendedFlow;
  const flow = HUB_FLOWS[resolvedFlowId];

  const scheduleReady = input.classes.length > 0;
  const assessmentsReady = input.assessments.some((a) => a.grade === undefined);
  const driveCount =
    input.materials.length +
    input.courses.filter((c) => Boolean(c.sharedDriveUrl || c.driveFolderUrl)).length +
    (input.settings.sharedHubDriveUrls?.length ?? 0);
  const driveReady = driveCount > 0;

  const notebookCount =
    input.materials.filter((m) => m.provider === 'notebooklm' || m.provider === 'clip').length +
    input.courses.filter((c) => Boolean(c.notebookUrl || c.clipUrl)).length +
    (input.settings.personalNotebookUrl ? 1 : 0);
  const notebookReady = notebookCount > 0;

  const rawByKey: Record<HubStepKey, Omit<HubStepStatus, 'requiredForFlow'>> = {
    schedule: {
      key: 'schedule',
      title: tr('onboarding:hub.step.schedule'),
      hint: scheduleReady
        ? tr('onboarding:hub.step.scheduleReady', { n: input.classes.length })
        : tr('onboarding:hub.step.scheduleHint'),
      ready: scheduleReady,
      countLabel: scheduleReady ? tr('onboarding:hub.step.scheduleCount', { n: input.classes.length }) : undefined,
    },
    assessments: {
      key: 'assessments',
      title: tr('onboarding:hub.step.assessments'),
      hint: assessmentsReady
        ? tr('onboarding:hub.step.assessmentsReady', { n: input.assessments.filter((a) => a.grade === undefined).length })
        : flow.id.endsWith('_inicio')
          ? tr('onboarding:hub.step.assessmentsHintStart')
          : tr('onboarding:hub.step.assessmentsHint'),
      ready: assessmentsReady,
      countLabel: assessmentsReady
        ? tr('onboarding:hub.step.assessmentsCount', { n: input.assessments.filter((a) => a.grade === undefined).length })
        : undefined,
    },
    drive_hd: {
      key: 'drive_hd',
      title: tr('onboarding:hub.step.drive'),
      hint: driveReady
        ? tr('onboarding:hub.step.driveReady', { n: driveCount })
        : tr('onboarding:hub.step.driveHint'),
      ready: driveReady,
      countLabel: driveReady ? tr('onboarding:hub.step.connectedN', { n: driveCount }) : undefined,
    },
    notebook: {
      key: 'notebook',
      title: tr('onboarding:hub.step.notebook'),
      hint: notebookReady
        ? tr('onboarding:hub.step.notebookReady', { n: notebookCount })
        : tr('onboarding:hub.step.notebookHint'),
      ready: notebookReady,
      countLabel: notebookReady ? tr('onboarding:hub.step.connectedN', { n: notebookCount }) : undefined,
    },
  };

  const steps: HubStepStatus[] = flow.stepOrder.map((key) => ({
    ...rawByKey[key],
    requiredForFlow: flow.requiredKeys.includes(key),
  }));

  const readyCount = steps.filter((s) => s.ready).length;
  const missingAny = steps.filter((s) => !s.ready);
  const missingRequired = steps.filter((s) => s.requiredForFlow && !s.ready);

  return {
    flow,
    steps,
    readyCount,
    totalCount: steps.length,
    missingRequired,
    missingAny,
    isCompleteForFlow: missingRequired.length === 0,
    allReady: missingAny.length === 0,
    hasCourses: input.courses.length > 0,
  };
}

/**
 * Valida um URL HTTP(S) seguro para links de Drive partilhado, Caderno externo ou portais académicos.
 */
export function normalizeSafeHubUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Verifica se um URL pertence ao Google Drive e devolve o URL normalizado caso seja válido.
 */
export function normalizeSharedDriveUrl(raw: string): string | null {
  const safe = normalizeSafeHubUrl(raw);
  if (!safe) return null;
  try {
    const host = new URL(safe).hostname.toLowerCase();
    if (!host.endsWith('drive.google.com') && !host.endsWith('docs.google.com')) {
      return null;
    }
    return safe;
  } catch {
    return null;
  }
}
