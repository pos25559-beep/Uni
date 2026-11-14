import { useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  Compass,
  ExternalLink,
  FolderGit2,
  FolderPlus,
  HardDrive,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useGoogleAccounts } from '../../hooks/useGoogleData';
import { todayStr } from '../../lib/selectors';
import { kindLabel } from '../../lib/colors';
import { hapticSuccess, hapticTap } from '../../lib/nativeBridge';
import { generatePlan } from '../../lib/planner';
import {
  HUB_FLOWS,
  getHubProgress,
  inferHubProfile,
  normalizeSafeHubUrl,
  normalizeSharedDriveUrl,
  type HubStepKey,
  type HubStepStatus,
} from '../../lib/studyHub';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { AssessmentKind, HubFlowId } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { celebrateStationery } from '../motion/Primitives';
import SmartScheduleImportModal from '../courses/SmartScheduleImportModal';
import CloudPicker, { DRIVE_SOURCE } from '../materials/CloudPicker';
import DeviceImportModal from '../materials/DeviceImportModal';
import ClipImportModal from '../settings/ClipImportModal';
import { Badge, Button, Field, Input, Modal, Select, cx, showToast } from '../ui';

interface Props {
  open: boolean;
  initialFocusStep?: HubStepKey | null;
  onClose: () => void;
  onPlanGenerated?: (sessionsCount: number, starterOnly: boolean) => void;
}

type ActiveSubModal = 'smart_photo' | 'clip' | 'gdrive' | 'device' | null;

const ASSESSMENT_KINDS: AssessmentKind[] = ['teste', 'exame', 'trabalho', 'projeto', 'quiz'];

export default function PostOnboardingHubModal({
  open,
  initialFocusStep = null,
  onClose,
  onPlanGenerated,
}: Props) {
  const courses = useStore((s) => s.courses);
  const classes = useStore((s) => s.classes);
  const assessments = useStore((s) => s.assessments);
  const materials = useStore((s) => s.materials);
  const events = useStore((s) => s.events);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const upsert = useStore((s) => s.upsert);
  const patch = useStore((s) => s.patch);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceGeneratedSessions = useStore((s) => s.replaceGeneratedSessions);

  const { scanDrive, scanningDrive, isPersonalConnected } = useGoogleAccounts();

  const hubInput = useMemo(
    () => ({ academicProfile, courses, classes, assessments, materials, sessions, settings }),
    [academicProfile, courses, classes, assessments, materials, sessions, settings],
  );

  const inference = useMemo(() => inferHubProfile(hubInput), [hubInput]);

  const [selectedFlow, setSelectedFlow] = useState<HubFlowId>(
    settings.hubSetupFlow ?? inference.recommendedFlow,
  );
  const progress = useMemo(() => getHubProgress(hubInput, selectedFlow), [hubInput, selectedFlow]);

  const [expandedStep, setExpandedStep] = useState<HubStepKey | null>(initialFocusStep);
  const [subModal, setSubModal] = useState<ActiveSubModal>(null);

  // Quick Assessment inline state
  const [examCourseId, setExamCourseId] = useState(courses[0]?.id ?? '');
  const [examTitle, setExamTitle] = useState('1.º Teste');
  const [examKind, setExamKind] = useState<AssessmentKind>('teste');
  const [examDate, setExamDate] = useState(() => `${todayStr()}T10:00`);
  const [examWeight, setExamWeight] = useState(30);

  // Shared Drive URL inline state
  const [sharedDriveInput, setSharedDriveInput] = useState('');

  // Gemini Notebook & Course Portal inline state
  const [personalNotebookInput, setPersonalNotebookInput] = useState(
    settings.personalNotebookUrl ?? '',
  );
  const [notebookCourseId, setNotebookCourseId] = useState(courses[0]?.id ?? '');
  const [courseNotebookInput, setCourseNotebookInput] = useState('');
  const [coursePortalInput, setCoursePortalInput] = useState('');

  useEffect(() => {
    if (open) {
      const flowId = settings.hubSetupFlow ?? inference.recommendedFlow;
      setSelectedFlow(flowId);
      setExpandedStep(initialFocusStep ?? HUB_FLOWS[flowId].stepOrder[0]);
      setPersonalNotebookInput(settings.personalNotebookUrl ?? '');
      if (!examCourseId && courses[0]?.id) setExamCourseId(courses[0].id);
      if (!notebookCourseId && courses[0]?.id) setNotebookCourseId(courses[0].id);
    }
  }, [
    open,
    initialFocusStep,
    settings.hubSetupFlow,
    settings.personalNotebookUrl,
    inference.recommendedFlow,
    courses,
    examCourseId,
    notebookCourseId,
  ]);

  useEffect(() => {
    const selectedCourse = courses.find((c) => c.id === notebookCourseId);
    if (selectedCourse) {
      setCourseNotebookInput(selectedCourse.notebookUrl ?? '');
      setCoursePortalInput(selectedCourse.clipUrl ?? '');
    }
  }, [notebookCourseId, courses]);

  const uniAccessory = useMemo(
    () => resolveUniAccessory(settings.uniAccessory, academicProfile?.degreeName, courses[0]?.name),
    [settings.uniAccessory, academicProfile?.degreeName, courses],
  );

  const flowMeta = HUB_FLOWS[selectedFlow];
  const sharedUrls = settings.sharedHubDriveUrls ?? [];
  const assessmentsReady = progress.steps.find((s) => s.key === 'assessments')?.ready ?? false;

  const handleSelectFlow = (flowId: HubFlowId) => {
    void hapticTap();
    setSelectedFlow(flowId);
    setExpandedStep(HUB_FLOWS[flowId].stepOrder[0]);
    updateSettings({ hubSetupFlow: flowId });
  };

  const handleAddQuickAssessment = () => {
    const targetCourseId = examCourseId || courses[0]?.id;
    if (!targetCourseId) {
      showToast('Adiciona primeiro pelo menos uma cadeira ativa.');
      return;
    }
    const cleanTitle = examTitle.trim() || kindLabel[examKind];
    const isoDate = examDate.length === 16 ? `${examDate}:00` : examDate || `${todayStr()}T10:00:00`;
    upsert('assessments', {
      id: newId(),
      courseId: targetCourseId,
      title: cleanTitle,
      kind: examKind,
      date: isoDate,
      weight: Math.max(0, Math.min(100, Number(examWeight) || 0)),
      topicIds: [],
      notes: '',
      source: 'local',
    });
    void hapticSuccess();
    showToast(`${cleanTitle} guardado para a tua cadeira!`);
    setExamTitle('');
  };

  const handleAddSharedDriveUrl = () => {
    const normalized = normalizeSharedDriveUrl(sharedDriveInput);
    if (!normalized) {
      showToast('Cola um link válido do Google Drive (pasta ou disco partilhado).');
      return;
    }
    if (sharedUrls.includes(normalized)) {
      showToast('Esta pasta partilhada já está na tua lista.');
      setSharedDriveInput('');
      return;
    }
    const nextUrls = [...sharedUrls, normalized];
    updateSettings({ sharedHubDriveUrls: nextUrls });
    setSharedDriveInput('');
    void hapticSuccess();
    showToast('Pasta partilhada adicionada ao Hub!');
  };

  const handleRemoveSharedDriveUrl = (urlToRemove: string) => {
    updateSettings({
      sharedHubDriveUrls: sharedUrls.filter((u) => u !== urlToRemove),
    });
  };

  const handleSaveNotebooks = () => {
    const personalClean = normalizeSafeHubUrl(personalNotebookInput);
    if (personalNotebookInput.trim() && !personalClean) {
      showToast('Link inválido para o teu Gemini Notebook pessoal.');
      return;
    }

    const courseNbClean = normalizeSafeHubUrl(courseNotebookInput);
    if (courseNotebookInput.trim() && !courseNbClean) {
      showToast('Link inválido para o Gemini Notebook da cadeira.');
      return;
    }

    const coursePortalClean = normalizeSafeHubUrl(coursePortalInput);
    if (coursePortalInput.trim() && !coursePortalClean) {
      showToast('Link inválido para o portal da cadeira.');
      return;
    }

    if ((personalClean ?? '') !== (settings.personalNotebookUrl ?? '')) {
      updateSettings({ personalNotebookUrl: personalClean ?? '' });
    }

    const targetCourse = courses.find((c) => c.id === notebookCourseId);
    if (targetCourse && (courseNbClean || coursePortalClean)) {
      patch('courses', targetCourse.id, {
        ...(courseNbClean ? { notebookUrl: courseNbClean } : {}),
        ...(coursePortalClean ? { clipUrl: coursePortalClean } : {}),
      });
      if (courseNbClean) {
        const alreadyListed = materials.some(
          (m) => m.courseId === targetCourse.id && m.url === courseNbClean,
        );
        if (!alreadyListed) {
          upsert('materials', {
            id: newId(),
            courseId: targetCourse.id,
            title: `Gemini Notebook · ${targetCourse.shortName}`,
            category: 'sebenta',
            provider: 'notebooklm',
            url: courseNbClean,
            modifiedAt: new Date().toISOString(),
            pinned: true,
          });
        }
      }
    }

    void hapticSuccess();
    showToast('Ligações do Gemini Notebook e portal guardadas!');
  };

  const handleGeneratePlanNow = () => {
    const today = todayStr();
    const pendingAssessmentsCount = assessments.filter((a) => a.grade === undefined).length;
    const starterOnly = pendingAssessmentsCount === 0 && courses.length > 0;
    const nextSessions = generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings,
      from: today,
      days: 14,
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
      difficultCourseIds: academicProfile.difficultCourseIds,
      weeklyCheckIns,
      extraActivities: academicProfile.extraActivities,
    });
    replaceGeneratedSessions(today, nextSessions);
    updateSettings({
      hubSetupFlow: selectedFlow,
      hubSetupCompleted: true,
      hubSetupDismissed: false,
    });
    celebrateStationery();
    void hapticSuccess();
    showToast(
      nextSessions.length > 0
        ? starterOnly
          ? `Modo Arranque ativo: ${nextSessions.length} blocos ligeiros criados para os próximos 14 dias.`
          : `Plano criado com ${nextSessions.length} sessões prontas para arrancar!`
        : 'Hub guardado! Adiciona cadeiras ativas para gerar blocos de estudo.',
    );
    onPlanGenerated?.(nextSessions.length, starterOnly);
    onClose();
  };

  const handleContinueLater = () => {
    updateSettings({ hubSetupFlow: selectedFlow });
    onClose();
  };

  const stepIcon = (key: HubStepKey) => {
    if (key === 'schedule') return <CalendarClock size={16} />;
    if (key === 'assessments') return <ClipboardList size={16} />;
    if (key === 'drive_hd') return <HardDrive size={16} />;
    return <BookMarked size={16} />;
  };

  const renderStepCard = (step: HubStepStatus, orderIdx: number) => {
    const isExpanded = expandedStep === step.key;
    const isPriority = (step.requiredForFlow || orderIdx === 0) && !step.ready;

    return (
      <div
        key={step.key}
        className={cx(
          'rounded-2xl border transition',
          step.ready
            ? 'border-ok/35 bg-ok/5'
            : isPriority
              ? 'border-accent/45 bg-pastel-butter/35 dark:bg-surface-2'
              : 'border-line bg-surface',
        )}
      >
        <button
          type="button"
          onClick={() => setExpandedStep(isExpanded ? null : step.key)}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cx(
                'grid size-9 shrink-0 place-items-center rounded-xl',
                step.ready ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-accent',
              )}
            >
              {step.ready ? <CheckCircle2 size={17} /> : stepIcon(step.key)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-fg">
                  {orderIdx + 1}. {step.title}
                </span>
                {isPriority && <Badge tone="warn">Prioritário</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted">{step.hint}</p>
            </div>
          </div>
          <Badge tone={step.ready ? 'ok' : 'neutral'}>
            {step.countLabel ?? (step.requiredForFlow ? 'Por ligar' : 'Opcional')}
          </Badge>
        </button>

        {isExpanded && (
          <div className="space-y-3 border-t border-line/70 px-4 py-3.5">
            {step.key === 'schedule' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setSubModal('smart_photo')}
                >
                  <Camera size={14} /> Foto ou Google Agenda
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSubModal('clip')}
                >
                  <Link2 size={14} /> Colar CLIP / Ficheiro ICS
                </Button>
              </div>
            )}

            {step.key === 'assessments' && (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Cadeira">
                    <Select
                      value={examCourseId}
                      onChange={(e) => setExamCourseId(e.target.value)}
                    >
                      {courses.length === 0 ? (
                        <option value="">Sem cadeiras ativas</option>
                      ) : (
                        courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.shortName} · {c.name}
                          </option>
                        ))
                      )}
                    </Select>
                  </Field>
                  <Field label="Nome da avaliação">
                    <Input
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="Ex: 1.º Teste / Exame"
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select
                      value={examKind}
                      onChange={(e) => setExamKind(e.target.value as AssessmentKind)}
                    >
                      {ASSESSMENT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {kindLabel[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Data e hora">
                    <Input
                      type="datetime-local"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="w-28">
                    <Field label="Peso (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={examWeight}
                        onChange={(e) => setExamWeight(Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <Button size="sm" variant="primary" onClick={handleAddQuickAssessment}>
                    <Plus size={14} /> Adicionar avaliação
                  </Button>
                </div>
              </div>
            )}

            {step.key === 'drive_hd' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSubModal('gdrive')}
                  >
                    <FolderGit2 size={14} /> Explorar Google Drive
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSubModal('device')}
                  >
                    <HardDrive size={14} /> PDFs / Pastas do PC ou HD
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={scanningDrive}
                    onClick={() => void scanDrive()}
                  >
                    {scanningDrive ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {isPersonalConnected ? 'Varrer Drives agora' : 'Ligar Drive & Varrer'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl bg-surface-2/80 p-3">
                  <p className="text-xs font-semibold text-fg">
                    Drives partilhados da turma / núcleo
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label="Link da pasta no Google Drive">
                        <Input
                          value={sharedDriveInput}
                          onChange={(e) => setSharedDriveInput(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                        />
                      </Field>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleAddSharedDriveUrl}>
                      <FolderPlus size={14} /> Juntar pasta
                    </Button>
                  </div>
                  {sharedUrls.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {sharedUrls.map((url) => (
                        <li
                          key={url}
                          className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs"
                        >
                          <span className="truncate text-muted">{url}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSharedDriveUrl(url)}
                            aria-label="Remover pasta partilhada"
                            className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {step.key === 'notebook' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-pastel-lavender/45 px-3 py-2 text-xs dark:bg-surface-2">
                  <span className="font-medium text-fg">
                    Centraliza os teus cadernos no <strong>Gemini Notebook</strong> e links dos professores.
                  </span>
                  <a
                    href="https://notebooklm.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-semibold text-accent hover:underline"
                  >
                    Abrir Gemini Notebook <ExternalLink size={12} />
                  </a>
                </div>

                <Field label="Link geral do teu Gemini Notebook (opcional)">
                  <Input
                    value={personalNotebookInput}
                    onChange={(e) => setPersonalNotebookInput(e.target.value)}
                    placeholder="https://notebooklm.google.com/notebook/..."
                  />
                </Field>

                {courses.length > 0 && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Field label="Cadeira a ligar">
                      <Select
                        value={notebookCourseId}
                        onChange={(e) => setNotebookCourseId(e.target.value)}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.shortName} · {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Gemini Notebook da cadeira">
                      <Input
                        value={courseNotebookInput}
                        onChange={(e) => setCourseNotebookInput(e.target.value)}
                        placeholder="https://notebooklm.google.com/notebook/..."
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Portal / Página oficial da cadeira (CLIP/Moodle, opcional)">
                        <Input
                          value={coursePortalInput}
                          onChange={(e) => setCoursePortalInput(e.target.value)}
                          placeholder="https://moodle... ou página da UC"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button size="sm" variant="primary" onClick={handleSaveNotebooks}>
                    <BookMarked size={14} /> Guardar ligações
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleContinueLater}
        title="O teu Hub de Estudo com o Uni"
        maxWidthClass="sm:max-w-2xl"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={handleContinueLater}>
              Continuar depois no Hoje
            </Button>
            <Button variant="primary" onClick={handleGeneratePlanNow}>
              <Sparkles size={15} />
              {assessmentsReady ? 'Gerar o meu Plano agora' : 'Arrancar Plano de Semestre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Uni conversa inicial */}
          <div className="flex items-start gap-3.5 rounded-[22px] bg-pastel-sage/65 p-4 text-[#141312] dark:bg-surface-2 dark:text-fg">
            <div className="shrink-0">
              <UniBuddy mood="happy" accessory={uniAccessory} size={54} interactive={false} />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Hub Unipedia · {progress.readyCount}/{progress.totalCount} fontes ligadas
                </span>
                <Badge tone="accent">
                  <Compass size={11} /> {flowMeta.badge}
                </Badge>
              </div>
              <p className="font-display text-base font-bold leading-snug">
                {flowMeta.title}
              </p>
              <p className="text-xs leading-relaxed opacity-85">
                {flowMeta.uniMessage}
              </p>
            </div>
          </div>

          {/* Seleção dos 4 fluxos */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Em que momento estás agora?
              </p>
              <span className="text-xs text-muted">
                {inference.isFreshman ? 'Perfil 1.º ano detetado' : 'Perfil veterano detetado'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(HUB_FLOWS).map((flow) => {
                const active = selectedFlow === flow.id;
                const suggested = inference.recommendedFlow === flow.id;
                return (
                  <button
                    key={flow.id}
                    type="button"
                    onClick={() => handleSelectFlow(flow.id)}
                    className={cx(
                      'flex min-h-[56px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition',
                      active
                        ? 'border-accent bg-pastel-butter/75 text-[#141312] shadow-sm dark:bg-accent/15 dark:text-fg'
                        : 'border-line bg-surface hover:border-accent/50',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-bold">{flow.shortLabel}</span>
                      {suggested && (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                          Sugerido para ti
                        </span>
                      )}
                    </div>
                    <span className="mt-1 text-xs text-muted">{flow.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checklist dinâmica priorizada pelo fluxo */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Fontes do teu Hub (podes ligar já ou mais tarde)
            </p>
            <div className="space-y-2">
              {progress.steps.map((step, idx) => renderStepCard(step, idx))}
            </div>
          </div>

          {/* Nota de arranque quando não há provas */}
          {!assessmentsReady && (
            <div className="rounded-2xl border border-accent/25 bg-pastel-sky/45 px-4 py-3 text-xs text-[#141312] dark:bg-surface-2 dark:text-fg">
              <strong>Sem testes marcados ainda?</strong> Sem problema: ao clicar em{' '}
              <em>Arrancar Plano de Semestre</em>, o Uni cria blocos ligeiros de consolidação pelas tuas cadeiras ativas e atualiza-os assim que tiveres datas.
            </div>
          )}
        </div>
      </Modal>

      {subModal === 'smart_photo' && (
        <SmartScheduleImportModal
          initialMode="photo"
          onClose={() => setSubModal(null)}
          onOpenClipModal={() => setSubModal('clip')}
        />
      )}
      {subModal === 'clip' && (
        <ClipImportModal onClose={() => setSubModal(null)} />
      )}
      {subModal === 'gdrive' && (
        <CloudPicker source={DRIVE_SOURCE} onClose={() => setSubModal(null)} />
      )}
      {subModal === 'device' && (
        <DeviceImportModal onClose={() => setSubModal(null)} />
      )}
    </>
  );
}
