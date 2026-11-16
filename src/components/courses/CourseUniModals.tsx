import {
  Award,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import {
  extractTopicSheetFromSources,
  hasCustomGeminiKey,
  type NotebookSourceInput,
} from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import { normalizeAppLanguage } from '../../lib/grading';
import type {
  TopicSheetRecord,
  UniAgentRecord,
  UniFormId,
} from '../../lib/localDb';
import { deleteTopicSheet, getUniAgent, putTopicSheet } from '../../lib/localDb';
import { getAiMaterialLimit, resolveMaterialsForAI } from '../../lib/materialContent';
import { openInAppBrowser } from '../../lib/nativeBridge';
import {
  buildStudyGuideExport,
  parseAndImportQuizResult,
  transferMasteryToNextCourse,
} from '../../lib/studyBridge';
import { saveUniAgent } from '../../lib/uniAgents';
import {
  getLocalizedPersonas,
  suggestFormForCourse,
  type UniAccessoryId,
  type UniPersonaMode,
} from '../../lib/uniAccessories';
import { cx, showToast } from '../../lib/uiHelpers';
import { newId, useStore } from '../../store/useStore';
import type { AppLanguage, Course, Material } from '../../types';
import { Markdown } from '../assistant/Markdown';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Field, Input, Modal, SegmentedControl, Select, Switch, Textarea } from '../ui';

const FORM_IDS: UniFormId[] = ['nuvem', 'gota', 'estrela', 'cristal', 'folha'];

const LEARNING_STYLES: Array<{ id: 'exemplos' | 'teoria' | 'exercicios'; label: string }> = [
  { id: 'exemplos', label: 'Exemplos primeiro' },
  { id: 'teoria', label: 'Teoria e intuição' },
  { id: 'exercicios', label: 'Exercícios práticos' },
];

export function AdoptUniModal({
  open,
  onClose,
  course,
  accessory,
  initialAgent,
  onSave,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  accessory: UniAccessoryId;
  initialAgent?: UniAgentRecord | null;
  onSave: (payload: {
    name: string;
    formId: UniFormId;
    personaId: UniPersonaMode;
    language: AppLanguage;
    memoryEnabled: boolean;
    learningStyle?: 'exemplos' | 'teoria' | 'exercicios';
    goal?: string;
    firstDifficulty?: string;
  }) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation(['uni', 'common']);
  const appLang: AppLanguage = normalizeAppLanguage(i18n.language);
  const defaultName = (initialAgent?.name || course.shortName || course.code || 'Uni').slice(0, 30);
  const [name, setName] = useState(defaultName);
  const [formId, setFormId] = useState<UniFormId>(
    () => initialAgent?.formId ?? suggestFormForCourse(course),
  );
  const [personaId, setPersonaId] = useState<UniPersonaMode>(initialAgent?.personaId ?? 'amigo');
  const [agentLanguage, setAgentLanguage] = useState<AppLanguage>(() =>
    initialAgent?.language ? normalizeAppLanguage(initialAgent.language) : appLang,
  );
  const [memoryEnabled, setMemoryEnabled] = useState(initialAgent?.memoryEnabled ?? false);
  const [learningStyle, setLearningStyle] = useState<'exemplos' | 'teoria' | 'exercicios'>(
    initialAgent?.notebook.learningStyle ?? 'exemplos',
  );
  const [goal, setGoal] = useState(initialAgent?.notebook.goals[0] ?? '');
  const [firstDifficulty, setFirstDifficulty] = useState('');
  const [saving, setSaving] = useState(false);

  const personas = getLocalizedPersonas(appLang);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || defaultName,
        formId,
        personaId,
        language: agentLanguage,
        memoryEnabled,
        learningStyle,
        goal: goal.trim() || undefined,
        firstDifficulty: firstDifficulty.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        initialAgent
          ? t('uni:adoptModal.editTitle', { name: initialAgent.name, course: course.shortName })
          : t('uni:adoptModal.adoptTitle', { course: course.shortName })
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {initialAgent && onRemove ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                void onRemove().then(onClose);
              }}
            >
              <Trash2 size={14} /> {t('uni:adoptModal.remove')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              onClick={() => void handleSubmit()}
            >
              <Check size={14} />{' '}
              {initialAgent ? t('uni:adoptModal.saveChanges') : t('uni:adoptModal.adoptConfirm')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-[20px] border border-line bg-surface-2/60 p-3.5">
          <UniBuddy
            form={formId}
            stage={initialAgent ? initialAgent.stage : 1}
            accessory={accessory}
            mood={personaId === 'calmo' ? 'calm' : personaId === 'exigente' || personaId === 'curioso' ? 'curious' : 'happy'}
            size={60}
            interactive={false}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">{name.trim() || defaultName}</p>
            <p className="text-xs text-muted">
              {t('uni:adoptModal.summarySubtitle', { course: course.name })}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">{t('uni:adoptModal.stepForm')}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORM_IDS.map((fId) => {
              const selected = formId === fId;
              return (
                <button
                  key={fId}
                  type="button"
                  onClick={() => setFormId(fId)}
                  className={cx(
                    'flex min-h-11 items-center gap-2.5 rounded-2xl border p-2.5 text-left transition',
                    selected
                      ? 'border-accent bg-accent-soft/50 text-fg'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  <UniBuddy form={fId} stage={1} size={34} interactive={false} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-fg">{t(`uni:forms.${fId}.label`)}</p>
                    <p className="text-xs leading-snug text-muted">{t(`uni:forms.${fId}.hint`)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">{t('uni:adoptModal.stepPersona')}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {personas.map((p) => {
              const selected = personaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonaId(p.id)}
                  className={cx(
                    'min-h-11 rounded-2xl border px-3 py-2 text-left transition',
                    selected
                      ? 'border-accent bg-accent-soft/60 text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  <p className="text-xs font-semibold text-fg">{p.label}</p>
                  <p className="text-xs text-muted">{p.hint}</p>
                  <p className="mt-0.5 text-xs italic text-muted/90">&ldquo;{p.example}&rdquo;</p>
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t('uni:adoptModal.stepName')}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            placeholder={course.shortName || 'Calc'}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">{t('uni:adoptModal.stepLanguage')}</p>
          <p className="mb-2 text-xs text-muted">{t('uni:adoptModal.stepLanguageHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map((langOption) => (
              <button
                key={langOption}
                type="button"
                onClick={() => setAgentLanguage(langOption)}
                className={cx(
                  'min-h-11 rounded-2xl border px-3 text-xs font-semibold transition',
                  agentLanguage === langOption
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                )}
              >
                {t(`common:languages.${langOption}`)}
              </button>
            ))}
          </div>
        </div>

        {!initialAgent && (
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-3.5">
            <p className="text-xs font-semibold text-fg">{t('uni:adoptModal.firstChatTitle')}</p>
            <div>
              <p className="mb-1.5 text-xs text-muted">{t('uni:adoptModal.firstChatStyle')}</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'exemplos', label: t('uni:adoptModal.styleExamples') },
                    { id: 'teoria', label: t('uni:adoptModal.styleTheory') },
                    { id: 'exercicios', label: t('uni:adoptModal.styleExercises') },
                  ] as const
                ).map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setLearningStyle(style.id)}
                    className={cx(
                      'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                      learningStyle === style.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t('uni:adoptModal.goalLabel')}>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={120}
                placeholder={t('uni:adoptModal.goalPlaceholder')}
              />
            </Field>
            <Field label={t('uni:adoptModal.difficultyLabel')}>
              <Input
                value={firstDifficulty}
                onChange={(e) => setFirstDifficulty(e.target.value)}
                maxLength={160}
                placeholder={t('uni:adoptModal.difficultyPlaceholder')}
              />
            </Field>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fg">{t('uni:adoptModal.memoryTitle')}</p>
            <p className="text-xs text-muted">{t('uni:adoptModal.memoryHint')}</p>
          </div>
          <Switch
            checked={memoryEnabled}
            onCheckedChange={setMemoryEnabled}
            label={t('uni:adoptModal.memoryTitle')}
          />
        </div>
      </div>
    </Modal>
  );
}

export function UniNotebookMemoryModal({
  open,
  onClose,
  agent,
  courseName,
  onUpdateAgent,
}: {
  open: boolean;
  onClose: () => void;
  agent: UniAgentRecord;
  courseName: string;
  onUpdateAgent: (next: UniAgentRecord) => Promise<void>;
}) {
  const [newGoal, setNewGoal] = useState('');
  const [newWeakTopic, setNewWeakTopic] = useState('');
  const [newWeakNote, setNewWeakNote] = useState('');
  const [newStrength, setNewStrength] = useState('');

  const patchNotebook = async (patch: Partial<UniAgentRecord['notebook']>, topLevel?: Partial<UniAgentRecord>) => {
    const now = new Date().toISOString();
    await onUpdateAgent({
      ...agent,
      ...topLevel,
      notebook: {
        ...agent.notebook,
        ...patch,
        updatedAt: now,
      },
      updatedAt: now,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`O que ${agent.name} sabe · ${courseName}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              void patchNotebook({
                goals: [],
                weakSpots: [],
                strengths: [],
                customNotes: [],
                learningStyle: undefined,
              }).then(() => showToast('Memória deste Uni limpa com sucesso.'));
            }}
          >
            <Trash2 size={14} /> Apagar tudo
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fg">Memória automática após conversas e recall</p>
            <p className="text-xs text-muted">
              Podes pausar a aprendizagem automática a qualquer momento e editar manualmente abaixo.
            </p>
          </div>
          <Switch
            checked={agent.memoryEnabled}
            onCheckedChange={(checked) => {
              void onUpdateAgent({
                ...agent,
                memoryEnabled: checked,
                updatedAt: new Date().toISOString(),
              });
            }}
            label="Ativar ou pausar memória automática"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Preferência de explicação</p>
          <div className="flex flex-wrap gap-1.5">
            {LEARNING_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => void patchNotebook({ learningStyle: st.id })}
                className={cx(
                  'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                  agent.notebook.learningStyle === st.id
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Objetivos nesta cadeira</p>
          {agent.notebook.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.notebook.goals.map((g, idx) => (
                <span
                  key={`${g}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1.5 text-xs font-medium text-fg"
                >
                  <span>{g}</span>
                  <button
                    type="button"
                    aria-label={`Remover objetivo ${g}`}
                    onClick={() =>
                      void patchNotebook({
                        goals: agent.notebook.goals.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="Adicionar objetivo (ex: nota 15 no 2.º teste)"
              maxLength={120}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newGoal.trim()}
              onClick={() => {
                const next = newGoal.trim();
                if (!next) return;
                setNewGoal('');
                void patchNotebook({
                  goals: [...agent.notebook.goals, next].slice(0, 10),
                });
              }}
            >
              <Plus size={14} /> Juntar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Pontos fracos e erros recorrentes</p>
          {agent.notebook.weakSpots.length === 0 ? (
            <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted">
              Ainda não existem pontos fracos registados.
            </p>
          ) : (
            <div className="space-y-1.5">
              {agent.notebook.weakSpots.map((w, idx) => (
                <div
                  key={`${w.topic}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-fg">{w.topic}</p>
                    <p className="text-xs text-muted">{w.note}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remover ponto fraco ${w.topic}`}
                    onClick={() =>
                      void patchNotebook({
                        weakSpots: agent.notebook.weakSpots.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
            <Input
              value={newWeakTopic}
              onChange={(e) => setNewWeakTopic(e.target.value)}
              placeholder="Tópico"
              maxLength={60}
            />
            <Input
              value={newWeakNote}
              onChange={(e) => setNewWeakNote(e.target.value)}
              placeholder="Nota (ex: troca o sinal)"
              maxLength={140}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newWeakTopic.trim() || !newWeakNote.trim()}
              onClick={() => {
                const t = newWeakTopic.trim();
                const n = newWeakNote.trim();
                if (!t || !n) return;
                setNewWeakTopic('');
                setNewWeakNote('');
                void patchNotebook({
                  weakSpots: [{ topic: t, note: n, seen: 1 }, ...agent.notebook.weakSpots].slice(0, 6),
                });
              }}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Pontos fortes</p>
          {agent.notebook.strengths.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.notebook.strengths.map((st, idx) => (
                <span
                  key={`${st}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ok/30 bg-accent-soft/40 py-1 pl-3 pr-1.5 text-xs font-medium text-ok-ink"
                >
                  <span>{st}</span>
                  <button
                    type="button"
                    aria-label={`Remover ponto forte ${st}`}
                    onClick={() =>
                      void patchNotebook({
                        strengths: agent.notebook.strengths.filter((_, i) => i !== idx),
                      })
                    }
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-coral-soft hover:text-coral"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newStrength}
              onChange={(e) => setNewStrength(e.target.value)}
              placeholder="Adicionar ponto forte (ex: domina regra da cadeia)"
              maxLength={120}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!newStrength.trim()}
              onClick={() => {
                const s = newStrength.trim();
                if (!s) return;
                setNewStrength('');
                void patchNotebook({
                  strengths: [s, ...agent.notebook.strengths].slice(0, 6),
                });
              }}
            >
              <Plus size={14} /> Juntar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function CourseSheetsModal({
  open,
  onClose,
  course,
  materials,
  sheets,
  onRefreshSheets,
  onOpenInTutor,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  materials: Material[];
  sheets: TopicSheetRecord[];
  onRefreshSheets: () => Promise<void>;
  onOpenInTutor: () => void;
}) {
  const aiConsent = useStore((s) => s.settings.aiConsent);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(course.topics[0]?.id ?? '');
  const [selectedMatIds, setSelectedMatIds] = useState<string[]>(() =>
    materials.slice(0, 2).map((m) => m.id),
  );
  const [manualText, setManualText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSheet, setPreviewSheet] = useState<TopicSheetRecord | null>(sheets[0] ?? null);

  const customKey = hasCustomGeminiKey();
  const maxFiles = getAiMaterialLimit(customKey);
  const quota = getDailyQuotaSnapshot(customKey);

  const selectedTopic = course.topics.find((t) => t.id === selectedTopicId);

  const toggleMat = (matId: string) => {
    setSelectedMatIds((prev) =>
      prev.includes(matId)
        ? prev.filter((id) => id !== matId)
        : prev.length >= maxFiles
          ? prev
          : [...prev, matId],
    );
  };

  const handleGenerateSheet = async () => {
    setBusy(true);
    setError(null);
    try {
      const pickedMats = materials.filter((m) => selectedMatIds.includes(m.id));
      const resolved =
        pickedMats.length > 0
          ? await resolveMaterialsForAI(pickedMats, { maxFiles })
          : { attachments: [], textExcerpts: [], readTitles: [], skipped: [], needsDriveAuth: false, contextTokens: 0, contextTokenBudget: null };

      if (resolved.needsDriveAuth) {
        showToast('Autoriza o Google Drive no separador Materiais para ler PDFs da pasta.');
      }

      const sources: NotebookSourceInput[] = resolved.textExcerpts.map((e) => ({
        title: e.title,
        content: e.content,
      }));
      if (manualText.trim()) {
        sources.push({
          title: selectedTopic?.title ? `Notas · ${selectedTopic.title}` : `Apontamentos · ${course.shortName}`,
          content: manualText.trim(),
        });
      }

      const extracted = await extractTopicSheetFromSources({
        topicTitle: selectedTopic?.title || course.name,
        courseName: course.shortName || course.name,
        sources,
        attachments: resolved.attachments,
      });

      const saved = await putTopicSheet({
        id: newId(),
        courseId: course.id,
        topicId: selectedTopic?.id,
        title: extracted.title,
        mode: 'guide',
        summary: extracted.summary,
        keyConcepts: extracted.keyConcepts,
        materialIds: pickedMats.map((m) => m.id),
        updatedAt: new Date().toISOString(),
      });
      await onRefreshSheets();
      setPreviewSheet(saved);
      setManualText('');
      showToast('Ficha guardada em IndexedDB para o Tutor e Foco.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar a ficha agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Fichas permanentes · ${course.shortName}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenInTutor}>
            <Sparkles size={14} /> Abrir no Tutor
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5 text-xs text-muted">
          As fichas ficam guardadas localmente em texto permanente no teu dispositivo: o Uni usa-as como base nas perguntas e no Recall mesmo quando os anexos temporários expiram.
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-fg">Gerar nova ficha dos materiais</p>
            <span className="text-xs text-muted">
              {customKey ? 'Chave pessoal · ilimitado' : `${quota.notebookRemaining}/${quota.notebookLimit} hoje`}
            </span>
          </div>

          {course.topics.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted">Tópico associado</p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {course.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTopicId(t.id)}
                    className={cx(
                      'min-h-11 rounded-full border px-3 text-xs font-medium transition',
                      selectedTopicId === t.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {materials.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted">
                Materiais da cadeira ({selectedMatIds.length}/{maxFiles})
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {materials.map((m) => {
                  const active = selectedMatIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMat(m.id)}
                      className={cx(
                        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      <FileText size={12} />
                      <span className="max-w-[160px] truncate">{m.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label="Ou cola excerto / notas da aula (opcional)">
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Cola fórmulas, teoremas ou apontamentos para estruturar numa ficha citável..."
              className="min-h-20"
            />
          </Field>

          {!aiConsent && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              Ativa o Uni primeiro nas Definições ou no Tutor para gerar fichas com IA.
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-medium text-coral">{error}</p>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={busy || !aiConsent || (selectedMatIds.length === 0 && !manualText.trim())}
            onClick={() => void handleGenerateSheet()}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? 'A extrair conceitos e citações…' : 'Gerar ficha permanente'}
          </Button>
        </div>

        {sheets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Fichas guardadas ({sheets.length})</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {sheets.map((sheet) => {
                const active = previewSheet?.id === sheet.id;
                return (
                  <div
                    key={sheet.id}
                    className={cx(
                      'flex items-center gap-1.5 rounded-2xl border p-1.5 transition',
                      active ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface-2/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewSheet(sheet)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 text-left"
                    >
                      <BookOpen size={14} className="shrink-0 text-accent" />
                      <span className="min-w-0 truncate text-xs font-semibold text-fg">
                        {sheet.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Copiar ${sheet.title}`}
                      onClick={async () => {
                        await navigator.clipboard?.writeText(sheet.summary);
                        showToast('Ficha copiada!');
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-fg"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Apagar ficha ${sheet.title}`}
                      onClick={async () => {
                        await deleteTopicSheet(sheet.id);
                        await onRefreshSheets();
                        if (previewSheet?.id === sheet.id) setPreviewSheet(null);
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral-soft hover:text-coral"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {previewSheet && (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-3.5 text-sm">
                <p className="mb-2 text-xs font-semibold text-accent">{previewSheet.title}</p>
                <Markdown text={previewSheet.summary} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function StudyBridgeModal({
  open,
  onClose,
  course,
  agent,
  sheets,
  onAgentUpdated,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  agent: UniAgentRecord;
  sheets: TopicSheetRecord[];
  onAgentUpdated: (next: UniAgentRecord) => Promise<void>;
}) {
  const { t, i18n } = useTranslation(['uni', 'common']);
  const appLang = normalizeAppLanguage(i18n.language);
  const sessions = useStore((s) => s.sessions);
  const assessments = useStore((s) => s.assessments);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const upsert = useStore((s) => s.upsert);

  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(course.topics[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [rawQuizText, setRawQuizText] = useState('');
  const [importing, setImporting] = useState(false);

  const selectedTopic = course.topics.find((tp) => tp.id === selectedTopicId) ?? course.topics[0];
  const guideText = buildStudyGuideExport({
    course,
    topic: selectedTopic,
    sheets,
    agent,
    language: agent.language || appLang,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(guideText);
      setCopied(true);
      showToast(t('uni:bridge.copied'), 'ok');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Não foi possível copiar para a área de transferência.', 'danger');
    }
  };

  const handleImportQuiz = async () => {
    if (!rawQuizText.trim()) {
      showToast(t('uni:bridge.missingText'), 'neutral');
      return;
    }
    setImporting(true);
    try {
      const outcome = parseAndImportQuizResult({
        rawText: rawQuizText,
        course,
        topicId: selectedTopic?.id,
        agent,
        sessions,
        assessments,
        gradingScale,
      });
      upsert('courses', outcome.nextCourse);
      if (outcome.nextAgent) {
        await onAgentUpdated(outcome.nextAgent);
      }
      setRawQuizText('');
      showToast(t('uni:bridge.importedSuccess'), 'ok');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao importar quiz', 'danger');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('uni:bridge.title', { course: course.shortName })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {course.notebookUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openInAppBrowser(course.notebookUrl!)}
            >
              <ExternalLink size={14} /> {t('uni:bridge.openExternal')}
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" variant="primary" onClick={onClose}>
            {t('common:actions.done')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted">{t('uni:bridge.subtitle')}</p>

        <SegmentedControl
          layoutId="study-bridge-tabs"
          value={tab}
          onChange={(v) => setTab(v as 'export' | 'import')}
          items={[
            { id: 'export', label: t('uni:bridge.tabExport') },
            { id: 'import', label: t('uni:bridge.tabImport') },
          ]}
        />

        {course.topics.length > 0 && (
          <Field label={t('uni:bridge.topicLabel')}>
            <Select
              value={selectedTopic?.id ?? ''}
              onChange={(e) => setSelectedTopicId(e.target.value)}
            >
              {course.topics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {tab === 'export' ? (
          <div className="space-y-2.5">
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface-2/60 p-3 text-xs leading-relaxed text-fg">
              {guideText}
            </pre>
            <Button size="sm" variant="primary" className="w-full" onClick={() => void handleCopy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('uni:bridge.copied') : t('uni:bridge.copyGuide')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label={t('uni:bridge.importLabel')}>
              <Textarea
                value={rawQuizText}
                onChange={(e) => setRawQuizText(e.target.value)}
                placeholder={t('uni:bridge.importPlaceholder')}
                className="min-h-28"
              />
            </Field>
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              loading={importing}
              onClick={() => void handleImportQuiz()}
            >
              <Sparkles size={14} /> {t('uni:bridge.importBtn')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function MasterMentorshipModal({
  open,
  onClose,
  sourceCourse,
  sourceAgent,
}: {
  open: boolean;
  onClose: () => void;
  sourceCourse: Course;
  sourceAgent: UniAgentRecord;
}) {
  const { t } = useTranslation(['uni', 'common']);
  const courses = useStore((s) => s.courses);
  const candidates = courses.filter((c) => c.id !== sourceCourse.id);
  const [targetCourseId, setTargetCourseId] = useState<string>(candidates[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const handleTransfer = async () => {
    const targetCourse = candidates.find((c) => c.id === targetCourseId);
    if (!targetCourse) return;
    setSaving(true);
    try {
      const existingTargetAgent = await getUniAgent(targetCourse.id);
      const nextTargetAgent = transferMasteryToNextCourse({
        sourceCourse,
        sourceAgent,
        targetCourse,
        targetAgent: existingTargetAgent,
      });
      await saveUniAgent(nextTargetAgent);
      showToast(
        t('uni:shelf.inheritDone', {
          from: sourceAgent.name,
          to: targetCourse.shortName || targetCourse.name,
        }),
        'ok',
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao ensinar cadeira seguinte', 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('uni:shelf.inheritModalTitle', {
        name: sourceAgent.name,
        course: sourceCourse.shortName,
      })}
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          {candidates.length > 0 && (
            <Button size="sm" variant="primary" loading={saving} onClick={() => void handleTransfer()}>
              <Award size={14} /> {t('uni:shelf.inheritBtn')}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted">{t('uni:shelf.inheritModalHint')}</p>
        {candidates.length === 0 ? (
          <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-xs text-muted">
            {t('uni:shelf.inheritNoTarget')}
          </p>
        ) : (
          <Select value={targetCourseId} onChange={(e) => setTargetCourseId(e.target.value)}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName} · {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Modal>
  );
}
