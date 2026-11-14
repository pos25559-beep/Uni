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

export const HUB_FLOWS: Record<HubFlowId, HubFlowMeta> = {
  caloiro_inicio: {
    id: 'caloiro_inicio',
    title: 'Caloiro · Início de semestre',
    shortLabel: 'Caloiro (Início)',
    badge: 'Modo Arranque',
    description: 'Ainda sem horários, datas de provas ou Drives partilhados.',
    uniMessage:
      'Bem-vindo ao teu 1.º semestre! Mesmo que ainda não tenhas horários nem datas de testes ou apontamentos, crio já um Plano Arranque leve para as tuas cadeiras — e deixo este Hub pronto para ligares tudo assim que sair.',
    stepOrder: ['schedule', 'assessments', 'drive_hd', 'notebook'],
    requiredKeys: [],
  },
  caloiro_meio: {
    id: 'caloiro_meio',
    title: 'Caloiro · Semestre a decorrer',
    shortLabel: 'Caloiro (Em curso)',
    badge: 'Foco Prazos',
    description: 'Já tens aulas e datas de provas, mas poucos documentos ou Drives.',
    uniMessage:
      'Como o semestre já arrancou, o mais importante é confirmar os teus horários e datas dos próximos testes para o plano priorizar o que vence primeiro. Depois juntamos os PDFs dos professores e Drives.',
    stepOrder: ['schedule', 'assessments', 'drive_hd', 'notebook'],
    requiredKeys: ['schedule', 'assessments'],
  },
  veterano_inicio: {
    id: 'veterano_inicio',
    title: 'Veterano · Início de semestre',
    shortLabel: 'Veterano (Início)',
    badge: 'Drives & Base',
    description: 'Já tens pastas, Drives ou Gemini Notebooks; faltam horários e testes.',
    uniMessage:
      'Boa! Enquanto não saem os horários e o calendário oficial de avaliações, liga já os teus Drives partilhados, PDFs do HD e Gemini Notebooks para concentrar tudo no mesmo Hub e gerar um plano contínuo.',
    stepOrder: ['drive_hd', 'notebook', 'schedule', 'assessments'],
    requiredKeys: ['drive_hd', 'notebook'],
  },
  veterano_meio: {
    id: 'veterano_meio',
    title: 'Veterano · Semestre a decorrer',
    shortLabel: 'Veterano (Completo)',
    badge: 'Hub Total',
    description: 'Juntar horários, testes, Drives partilhados, HD e Gemini Notebook.',
    uniMessage:
      'Vamos reunir o teu semestre inteiro num só lugar: horários da faculdade, datas de avaliações, Drives partilhados de colegas, PDFs oficiais do disco e o teu Gemini Notebook.',
    stepOrder: ['schedule', 'assessments', 'drive_hd', 'notebook'],
    requiredKeys: ['schedule', 'assessments', 'drive_hd'],
  },
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
      title: 'Horários & Aulas',
      hint: scheduleReady
        ? `${input.classes.length} bloco(s) de aula sincronizado(s)`
        : 'Importa por foto do horário, Google Agenda ou ficheiro do portal.',
      ready: scheduleReady,
      countLabel: scheduleReady ? `${input.classes.length} aulas` : undefined,
    },
    assessments: {
      key: 'assessments',
      title: 'Datas de Provas & Entregas',
      hint: assessmentsReady
        ? `${input.assessments.filter((a) => a.grade === undefined).length} avaliação(ões) agendada(s)`
        : flow.id.endsWith('_inicio')
          ? 'Quando saírem as datas, adiciona aqui ou envia um print ao Uni.'
          : 'Envia um print dos testes ao Uni, adiciona à mão ou liga à Google Agenda.',
      ready: assessmentsReady,
      countLabel: assessmentsReady
        ? `${input.assessments.filter((a) => a.grade === undefined).length} datas`
        : undefined,
    },
    drive_hd: {
      key: 'drive_hd',
      title: 'Drives Partilhados, PDFs & HD',
      hint: driveReady
        ? `${driveCount} fonte(s) de materiais e pastas ligada(s)`
        : 'Liga o Google Drive, cola o link do Drive partilhado do curso ou importa PDFs do teu HD.',
      ready: driveReady,
      countLabel: driveReady ? `${driveCount} ligado(s)` : undefined,
    },
    notebook: {
      key: 'notebook',
      title: 'Gemini Notebook & Portais Académicos',
      hint: notebookReady
        ? `${notebookCount} caderno(s) ou portal ligado(s)`
        : 'Guarda o link do teu Gemini Notebook ou portal da cadeira para abrir com 1 clique.',
      ready: notebookReady,
      countLabel: notebookReady ? `${notebookCount} ligado(s)` : undefined,
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
 * Valida um URL HTTP(S) seguro para links de Drive partilhado, Gemini Notebook ou portais académicos.
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
