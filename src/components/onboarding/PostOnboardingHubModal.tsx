import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookMarked,
  CalendarClock,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
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
import { DRIVE_SOURCE } from '../../lib/cloudSources';
import { celebrateStationery } from '../../lib/motionTokens';
import SmartScheduleImportModal from '../courses/SmartScheduleImportModal';
import CloudPicker from '../materials/CloudPicker';
import DeviceImportModal from '../materials/DeviceImportModal';
import ClipImportModal from '../settings/ClipImportModal';
import { Button, DateTimeField, Field, Input, Modal, Select } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';

interface Props {
  open: boolean;
  initialFocusStep?: HubStepKey | null;
  onClose: () => void;
  onPlanGenerated?: (sessionsCount: number, starterOnly: boolean) => void;
}

type ActiveSubModal = 'smart_photo' | 'test_photo' | 'test_gcal' | 'clip' | 'gdrive' | 'device' | null;

const ASSESSMENT_KINDS: AssessmentKind[] = ['teste', 'exame', 'trabalho', 'projeto', 'quiz'];

export default function PostOnboardingHubModal({
  open,
  initialFocusStep = null,
  onClose,
  onPlanGenerated,
}: Props) {
  const { t } = useTranslation('onboarding');
  const courses = useStore((s) => s.courses);
  const classes = useStore((s) => s.classes);
  const assessments = useStore((s) => s.assessments);
  const materials = useStore((s) => s.materials);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const upsert = useStore((s) => s.upsert);
  const patch = useStore((s) => s.patch);
  const updateSettings = useStore((s) => s.updateSettings);
  const replan = useStore((s) => s.replan);

  const { scanDrive, scanningDrive, isPersonalConnected } = useGoogleAccounts();

  const hubInput = useMemo(
    () => ({ academicProfile, courses, classes, assessments, materials, sessions, settings }),
    [academicProfile, courses, classes, assessments, materials, sessions, settings],
  );

  const inference = useMemo(() => inferHubProfile(hubInput), [hubInput]);

  const [selectedFlow, setSelectedFlow] = useState<HubFlowId>(
    () => settings.hubSetupFlow ?? inference.recommendedFlow,
  );
  const progress = useMemo(() => getHubProgress(hubInput, selectedFlow), [hubInput, selectedFlow]);

  const [expandedStep, setExpandedStep] = useState<HubStepKey | null>(
    () => initialFocusStep ?? HUB_FLOWS[settings.hubSetupFlow ?? inference.recommendedFlow].stepOrder[0],
  );
  const [subModal, setSubModal] = useState<ActiveSubModal>(null);

  // Avaliação rápida inline
  const [examCourseId, setExamCourseId] = useState(courses[0]?.id ?? '');
  const [examTitle, setExamTitle] = useState('1.º Teste');
  const [examKind, setExamKind] = useState<AssessmentKind>('teste');
  const [examDate, setExamDate] = useState(() => `${todayStr()}T10:00`);
  const [examWeight, setExamWeight] = useState(30);

  // Drives partilhados inline
  const [sharedDriveInput, setSharedDriveInput] = useState('');

  // Caderno externo & Portal inline
  const [personalNotebookInput, setPersonalNotebookInput] = useState(
    settings.personalNotebookUrl ?? '',
  );
  const [notebookCourseId, setNotebookCourseId] = useState(courses[0]?.id ?? '');
  const [courseNotebookInput, setCourseNotebookInput] = useState(
    () => courses[0]?.notebookUrl ?? '',
  );
  const [coursePortalInput, setCoursePortalInput] = useState(
    () => courses[0]?.clipUrl ?? '',
  );

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
      showToast(t('hub.ui.needCourse'));
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
    showToast(t('hub.ui.savedFor', { title: cleanTitle }));
    setExamTitle('');
  };

  const handleAddSharedDriveUrl = () => {
    const normalized = normalizeSharedDriveUrl(sharedDriveInput);
    if (!normalized) {
      showToast(t('hub.ui.badDrive'));
      return;
    }
    if (sharedUrls.includes(normalized)) {
      showToast(t('hub.ui.dupDrive'));
      setSharedDriveInput('');
      return;
    }
    const nextUrls = [...sharedUrls, normalized];
    updateSettings({ sharedHubDriveUrls: nextUrls });
    setSharedDriveInput('');
    void hapticSuccess();
    showToast(t('hub.ui.driveAdded'));
  };

  const handleRemoveSharedDriveUrl = (urlToRemove: string) => {
    updateSettings({
      sharedHubDriveUrls: sharedUrls.filter((u) => u !== urlToRemove),
    });
  };

  const handleSaveNotebooks = () => {
    const personalClean = normalizeSafeHubUrl(personalNotebookInput);
    if (personalNotebookInput.trim() && !personalClean) {
      showToast(t('hub.ui.badPersonalNb'));
      return;
    }

    const courseNbClean = normalizeSafeHubUrl(courseNotebookInput);
    if (courseNotebookInput.trim() && !courseNbClean) {
      showToast(t('hub.ui.badCourseNb'));
      return;
    }

    const coursePortalClean = normalizeSafeHubUrl(coursePortalInput);
    if (coursePortalInput.trim() && !coursePortalClean) {
      showToast(t('hub.ui.badPortal'));
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
            title: t('hub.ui.nbTitle', { course: targetCourse.shortName }),
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
    showToast(t('hub.ui.linksSaved'));
  };

  const handleGeneratePlanNow = () => {
    const today = todayStr();
    const pendingAssessmentsCount = assessments.filter((a) => a.grade === undefined).length;
    const starterOnly = pendingAssessmentsCount === 0 && courses.length > 0;
    replan('onboarding', { force: true });
    const nextSessions = useStore
      .getState()
      .sessions.filter((x) => x.generated && !x.done && x.date >= today);
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
          ? t('hub.ui.kickoff', { n: nextSessions.length })
          : t('hub.ui.planCreated', { n: nextSessions.length })
        : t('hub.ui.hubSaved'),
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

  const renderStepRow = (step: HubStepStatus, orderIdx: number) => {
    const isExpanded = expandedStep === step.key;
    const statusText = step.ready
      ? step.countLabel ?? t('hub.ui.connected')
      : step.requiredForFlow
        ? t('hub.ui.recommended')
        : t('hub.ui.notConnected');

    return (
      <div
        key={step.key}
        className={cx(
          'transition-colors',
          isExpanded && 'bg-surface/65 dark:bg-surface/55',
        )}
      >
        <button
          type="button"
          onClick={() => setExpandedStep(isExpanded ? null : step.key)}
          className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cx(
                'grid size-9 shrink-0 place-items-center rounded-xl transition-colors',
                step.ready ? 'bg-ok/15 text-ok' : 'bg-surface text-accent shadow-xs',
              )}
            >
              {step.ready ? <CheckCircle2 size={17} /> : stepIcon(step.key)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                {orderIdx + 1}. {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{step.hint}</p>
            </div>
          </div>
          <span
            className={cx(
              'shrink-0 text-xs font-semibold tabular-nums',
              step.ready ? 'text-ok' : 'text-muted',
            )}
          >
            {statusText}
          </span>
        </button>

        {isExpanded && (
          <div className="space-y-3.5 px-4 pt-1 pb-4">
            {step.key === 'schedule' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setSubModal('smart_photo')}
                >
                  <Camera size={14} /> {t('hub.ui.photoGcal')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSubModal('clip')}
                >
                  <Link2 size={14} /> {t('hub.ui.pasteIcs')}
                </Button>
              </div>
            )}

            {step.key === 'assessments' && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setSubModal('test_photo')}
                  >
                    <Camera size={14} /> {t('hub.ui.readTests')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSubModal('test_gcal')}
                  >
                    <CalendarDays size={14} /> {t('hub.ui.fromGcal')}
                  </Button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label={t('hub.ui.course')}>
                    <Select
                      value={examCourseId}
                      onChange={(e) => setExamCourseId(e.target.value)}
                    >
                      {courses.length === 0 ? (
                        <option value="">{t('hub.ui.noActive')}</option>
                      ) : (
                        courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.shortName} · {c.name}
                          </option>
                        ))
                      )}
                    </Select>
                  </Field>
                  <Field label={t('hub.ui.assessName')}>
                    <Input
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder={t('hub.ui.assessPh')}
                    />
                  </Field>
                  <Field label={t('hub.ui.type')}>
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
                  <Field label={t('hub.ui.dateTime')}>
                    <DateTimeField
                      aria-label={t('hub.ui.dateTimeAria')}
                      value={examDate}
                      onChange={setExamDate}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div className="w-28">
                    <Field label={t('hub.ui.weight')}>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={examWeight}
                        onChange={(e) => setExamWeight(Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleAddQuickAssessment}>
                    <Plus size={14} /> {t('hub.ui.saveManual')}
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
                    <FolderGit2 size={14} /> {t('hub.ui.exploreDrive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSubModal('device')}
                  >
                    <HardDrive size={14} /> {t('hub.ui.localFiles')}
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
                    {isPersonalConnected ? t('hub.ui.scanNow') : t('hub.ui.connectScan')}
                  </Button>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label={t('hub.ui.sharedLink')}>
                        <Input
                          value={sharedDriveInput}
                          onChange={(e) => setSharedDriveInput(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                        />
                      </Field>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleAddSharedDriveUrl}>
                      <FolderPlus size={14} /> {t('hub.ui.joinFolder')}
                    </Button>
                  </div>
                  {sharedUrls.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {sharedUrls.map((url) => (
                        <li
                          key={url}
                          className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 pl-3 pr-1 py-0.5 text-xs"
                        >
                          <span className="truncate text-muted">{url}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSharedDriveUrl(url)}
                            aria-label={t('hub.ui.removeShared')}
                            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 size={14} />
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {t('hub.ui.portalsIntro')}
                  </span>
                </div>

                <Field label={t('hub.ui.generalNb')}>
                  <Input
                    value={personalNotebookInput}
                    onChange={(e) => setPersonalNotebookInput(e.target.value)}
                    placeholder="https://..."
                  />
                </Field>

                {courses.length > 0 && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Field label={t('hub.ui.courseToLink')}>
                      <Select
                        value={notebookCourseId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setNotebookCourseId(nextId);
                          const selectedCourse = courses.find((c) => c.id === nextId);
                          setCourseNotebookInput(selectedCourse?.notebookUrl ?? '');
                          setCoursePortalInput(selectedCourse?.clipUrl ?? '');
                        }}
                      >
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.shortName} · {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('hub.ui.courseNb')}>
                      <Input
                        value={courseNotebookInput}
                        onChange={(e) => setCourseNotebookInput(e.target.value)}
                        placeholder="https://..."
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={t('hub.ui.portal')}>
                        <Input
                          value={coursePortalInput}
                          onChange={(e) => setCoursePortalInput(e.target.value)}
                          placeholder={t('hub.ui.portalPh')}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button size="sm" variant="primary" onClick={handleSaveNotebooks}>
                    <BookMarked size={14} /> {t('hub.ui.saveLinks')}
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
        title={t('hub.ui.title')}
        maxWidthClass="sm:max-w-2xl"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={handleContinueLater}>
              {t('hub.ui.later')}
            </Button>
            <Button variant="primary" onClick={handleGeneratePlanNow}>
              <Sparkles size={15} />
              {assessmentsReady ? t('hub.ui.generate') : t('hub.ui.kickoffBtn')}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Uni conversa inicial sem caixas encadeadas */}
          <div className="flex items-start gap-3.5 rounded-[22px] bg-pastel-sage/60 p-4 text-[#141312] dark:bg-surface-2 dark:text-fg">
            <div className="shrink-0">
              <UniBuddy mood="happy" accessory={uniAccessory} size={52} interactive={false} />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-base font-bold leading-snug">
                  {flowMeta.title}
                </p>
                <span className="text-xs font-semibold tabular-nums text-accent">
                  {t('hub.ui.linkedN', { a: progress.readyCount, b: progress.totalCount })}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-85">
                {flowMeta.uniMessage}
              </p>
            </div>
          </div>

          {/* Seleção limpa dos 4 momentos */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-fg">
              {t('hub.ui.moment')}
            </p>
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
                        ? 'border-accent bg-pastel-butter/70 text-[#141312] dark:bg-accent/15 dark:text-fg'
                        : 'border-line bg-surface hover:border-accent/45',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-xs font-bold">{flow.shortLabel}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                        {suggested && <span>Sugerido</span>}
                        {active && <Check size={14} />}
                      </span>
                    </div>
                    <span className="mt-1 text-xs text-muted">{flow.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista unificada de fontes (estilo papelaria sem caixas aninhadas) */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-fg">
              {t('hub.ui.onlyWhatYouHave')}
            </p>
            <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface-2/40 dark:bg-surface-2/35">
              {progress.steps.map((step, idx) => renderStepRow(step, idx))}
            </div>
          </div>

          {!assessmentsReady && (
            <p className="rounded-2xl bg-pastel-sky/40 px-4 py-3 text-xs leading-relaxed text-[#141312] dark:bg-surface-2 dark:text-fg">
              {t('hub.ui.noTests')}
            </p>
          )}
        </div>
      </Modal>

      {subModal === 'smart_photo' && (
        <SmartScheduleImportModal
          initialMode="photo"
          focus="schedule"
          onClose={() => setSubModal(null)}
          onOpenClipModal={() => setSubModal('clip')}
        />
      )}
      {subModal === 'test_photo' && (
        <SmartScheduleImportModal
          initialMode="photo"
          focus="assessments"
          onClose={() => setSubModal(null)}
          onOpenClipModal={() => setSubModal('clip')}
        />
      )}
      {subModal === 'test_gcal' && (
        <SmartScheduleImportModal
          initialMode="gcal"
          focus="assessments"
          onClose={() => setSubModal(null)}
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
