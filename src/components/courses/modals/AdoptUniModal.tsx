import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../../i18n';
import { normalizeAppLanguage } from '../../../lib/grading';
import type { UniAgentRecord, UniFormId } from '../../../lib/localDb';
import { type UniAccessoryId, type UniPersonaMode, getLocalizedPersonas, suggestFormForCourse } from '../../../lib/uniAccessories';
import { getUniCollectibleStates, getUniPetStates, readCollectibleTelemetry } from '../../../lib/uniCollectibles';
import { cx } from '../../../lib/uiHelpers';
import { useStore } from '../../../store/useStore';
import type { AppLanguage, Course, UniPetId, UniSkinId } from '../../../types';
import { UniBuddy, UniPetBuddy } from '../../brand/UnipediaMarks';
import { Button, Field, Input, Modal, Switch } from '../../ui';

const FORM_IDS: UniFormId[] = ['nuvem', 'gota', 'estrela', 'cristal', 'folha'];

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
    skinId?: UniSkinId;
    petId?: UniPetId;
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
  const globalSkin = useStore((s) => s.settings.uniSkin ?? 'classic');
  const globalPet = useStore((s) => s.settings.uniPet ?? 'cat');
  const sessions = useStore((s) => s.sessions);
  const allCourses = useStore((s) => s.courses);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const telemetry = readCollectibleTelemetry(sessions, allCourses, weeklyCheckIns);
  const skinStates = getUniCollectibleStates(telemetry);
  const petStates = getUniPetStates(telemetry);

  const defaultName = (initialAgent?.name || course.shortName || course.code || 'Uni').slice(0, 30);
  const [name, setName] = useState(defaultName);
  const [formId, setFormId] = useState<UniFormId>(
    () => initialAgent?.formId ?? suggestFormForCourse(course),
  );
  const [skinId, setSkinId] = useState<UniSkinId>(
    () => initialAgent?.skinId ?? globalSkin,
  );
  const [petId, setPetId] = useState<UniPetId>(
    () => initialAgent?.petId ?? globalPet,
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
        skinId,
        petId,
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
          <div className="flex items-end gap-1.5">
            <UniBuddy
              form={formId}
              stage={initialAgent ? initialAgent.stage : 1}
              accessory={accessory}
              skin={skinId}
              mood={personaId === 'calmo' ? 'calm' : personaId === 'exigente' || personaId === 'curioso' ? 'curious' : 'happy'}
              size={60}
              interactive={false}
            />
            {petId !== 'none' && <UniPetBuddy pet={petId} size={34} />}
          </div>
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
                  <UniBuddy form={fId} stage={1} skin={skinId} size={34} interactive={false} />
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
          <p className="mb-2 text-xs font-semibold text-muted">
            {t('uni:shelf.skinsTitle', { defaultValue: 'Cor do Uni desta cadeira' })}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {skinStates.map((item) => {
              const selected = skinId === item.skin.id;
              return (
                <button
                  key={item.skin.id}
                  type="button"
                  disabled={!item.unlocked}
                  onClick={() => {
                    if (item.unlocked) setSkinId(item.skin.id);
                  }}
                  title={item.unlocked ? item.skin.name : item.skin.unlockHint}
                  className={cx(
                    'flex min-h-11 items-center gap-2 rounded-2xl border p-2 text-left transition',
                    selected
                      ? 'border-accent bg-accent-soft/60 text-fg'
                      : item.unlocked
                        ? 'border-line bg-surface-2/60 text-muted hover:text-fg'
                        : 'cursor-not-allowed border-line/50 bg-surface-2/30 opacity-55',
                  )}
                >
                  <UniBuddy form={formId} stage={1} skin={item.skin.id} size={28} interactive={false} />
                  <span className="truncate text-xs font-semibold text-fg">
                    {item.skin.name.replace(/^Uni\s+/i, '')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted">
            {t('uni:shelf.petsTitle', { defaultValue: 'Micropet companheiro' })}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {petStates.map((pState) => {
              const selected = petId === pState.pet.id;
              return (
                <button
                  key={pState.pet.id}
                  type="button"
                  disabled={!pState.unlocked}
                  onClick={() => {
                    if (pState.unlocked) setPetId(pState.pet.id);
                  }}
                  title={pState.unlocked ? pState.pet.tagline : pState.pet.unlockHint}
                  className={cx(
                    'flex min-h-11 items-center gap-2 rounded-2xl border p-2 text-left transition',
                    selected
                      ? 'border-accent bg-accent-soft/60 text-fg'
                      : pState.unlocked
                        ? 'border-line bg-surface-2/60 text-muted hover:text-fg'
                        : 'cursor-not-allowed border-line/50 bg-surface-2/30 opacity-55',
                  )}
                >
                  <UniPetBuddy pet={pState.pet.id} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-fg">{pState.pet.name}</p>
                    <p className="truncate text-xs text-muted">{pState.pet.species}</p>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPetId('none')}
              className={cx(
                'flex min-h-11 items-center justify-center rounded-2xl border p-2 text-xs font-semibold transition',
                petId === 'none'
                  ? 'border-accent bg-accent-soft/60 text-fg'
                  : 'border-line bg-surface-2/60 text-muted hover:text-fg',
              )}
            >
              {t('uni:shelf.noPetBtn', { defaultValue: 'Sem micropet' })}
            </button>
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
                    {t(`memory.style.${style.id}`)}
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
