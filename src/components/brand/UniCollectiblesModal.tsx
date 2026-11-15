import { Check, Heart, Lock, Shuffle, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hapticTap } from '../../lib/nativeBridge';
import { fmtMinutes, todayStr } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import {
  computeUniCompanionState,
  getUniCollectibleStates,
  getUniPetStates,
  readCollectibleTelemetry,
  readDailyPetCareCount,
  recordUniPetCare,
  type UniPetId,
} from '../../lib/uniCollectibles';
import { useStore } from '../../store/useStore';
import { Badge, Button, Modal, Progress, SegmentedControl } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { UniBuddy, UniPetBuddy } from './UnipediaMarks';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ModalTab = 'cores' | 'pets' | 'discreto';

export default function UniCollectiblesModal({ open, onClose }: Props) {
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const tasks = useStore((s) => s.tasks);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const studyLogs = useStore((s) => s.studyLogs);
  const academicProfile = useStore((s) => s.academicProfile);
  const activeSkin = useStore((s) => s.settings.uniSkin ?? 'classic');
  const activePet: UniPetId = useStore((s) => s.settings.uniPet ?? 'cat');
  const autoRotate = useStore((s) => s.settings.uniSkinAutoRotate ?? true);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const liveCompanions = useStore((s) => s.settings.uniLiveCompanions ?? 'all');
  const updateSettings = useStore((s) => s.updateSettings);

  const [tab, setTab] = useState<ModalTab>('cores');
  const today = todayStr();
  const [dailyHugs, setDailyHugs] = useState(() => readDailyPetCareCount(today));
  const [justPetted, setJustPetted] = useState(false);

  useEffect(() => {
    const sync = () => setDailyHugs(readDailyPetCareCount(today));
    window.addEventListener('uni-companion-care-updated', sync);
    return () => window.removeEventListener('uni-companion-care-updated', sync);
  }, [today]);

  const accessory = resolveUniAccessory(
    uniPreference,
    academicProfile.degreeName,
    courses[0]?.name,
  );

  const telemetry = readCollectibleTelemetry(sessions, courses, weeklyCheckIns);
  const skinItems = getUniCollectibleStates(telemetry);
  const petItems = getUniPetStates(telemetry);
  const unlockedSkinsCount = skinItems.filter((i) => i.unlocked).length;
  const unlockedPetsCount = petItems.filter((p) => p.unlocked).length;

  const companion = computeUniCompanionState({
    sessions,
    tasks,
    weeklyCheckIns,
    studyLogs,
    today,
    dailyHugs,
  });
  const energyPct = Math.min(1, companion.dailyEnergy / companion.dailyEnergyGoal);

  const handlePetHug = () => {
    void hapticTap();
    const next = recordUniPetCare(today);
    setDailyHugs(next);
    setJustPetted(true);
    window.setTimeout(() => setJustPetted(false), 1800);
    window.dispatchEvent(new CustomEvent('uni-companion-care-updated'));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ninho & Vitrina do Uni"
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted">
          <span>
            {unlockedSkinsCount}/{skinItems.length} cores · {unlockedPetsCount}/{petItems.length} pets
          </span>
          <Button variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Habitat / Cartão estilo Finch */}
        <section className="rounded-[22px] bg-pastel-butter/65 p-4 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1 rounded-2xl bg-white/75 px-3 py-2 shadow-sm dark:bg-black/25">
                <UniBuddy
                  skin={activeSkin}
                  accessory={accessory}
                  mood={justPetted || companion.adventureDone ? 'celebrate' : 'happy'}
                  size={60}
                  onClick={handlePetHug}
                  ariaLabel="Fazer carinho no Uni"
                />
                {activePet !== 'none' && (
                  <UniPetBuddy pet={activePet} size={34} className="mb-0.5" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="ok">{companion.stage.label}</Badge>
                  <span className="text-xs font-medium opacity-75 tabular">
                    {fmtMinutes(companion.totalStudyMinutes)} totais
                  </span>
                </div>
                <p className="text-xs font-semibold">
                  <Zap size={13} className="mr-1 inline text-coral" />
                  Energia hoje: <span className="font-mono tabular">{companion.dailyEnergy}/{companion.dailyEnergyGoal}</span>
                </p>
                {companion.stage.nextLabel && companion.stage.nextMinutesRequired && (
                  <p className="text-xs opacity-70">
                    Próximo nível ({companion.stage.nextLabel}): {fmtMinutes(companion.stage.nextMinutesRequired)}
                  </p>
                )}
              </div>
            </div>

            <Button size="sm" variant="secondary" onClick={handlePetHug}>
              <Heart size={14} className={justPetted ? 'fill-coral text-coral' : undefined} />
              {justPetted
                ? 'Adorou! +3 ⚡'
                : dailyHugs >= companion.maxDailyHugs
                  ? 'Carinho dado'
                  : `Fazer carinho (${dailyHugs}/${companion.maxDailyHugs})`}
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            <Progress value={energyPct} color="bg-[#157F58] dark:bg-accent" />
            <p className="text-xs opacity-80">
              {companion.adventureDone && companion.discoveryNote
                ? `Descoberta de hoje: ${companion.discoveryNote}`
                : 'Conclui sessões, tarefas ou faz carinho para encher a energia do dia.'}
            </p>
          </div>
        </section>

        <div className="flex justify-center">
          <SegmentedControl
            layoutId="uni-showcase-tabs"
            value={tab}
            onChange={(v) => setTab(v as ModalTab)}
            items={[
              { id: 'cores', label: `Cores (${skinItems.length})` },
              { id: 'pets', label: `Micropets (${petItems.length})` },
              { id: 'discreto', label: 'Discreto nos ecrãs' },
            ]}
          />
        </div>

        {tab === 'cores' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold text-fg">
                  <Shuffle size={13} className="text-accent" /> Cor surpresa nos ecrãs
                </p>
                <p className="text-xs text-muted">
                  Alterna a cor dos companheiros discretos entre as cores que já tens abertas.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoRotate}
                onClick={() => updateSettings({ uniSkinAutoRotate: !autoRotate })}
                className={cx(
                  'min-h-[40px] rounded-full px-3.5 text-xs font-semibold transition',
                  autoRotate
                    ? 'bg-ink-cta text-ink-cta-fg'
                    : 'border border-line bg-surface text-muted hover:text-fg',
                )}
              >
                {autoRotate ? 'Ativo' : 'Cor fixa'}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {skinItems.map(({ skin, unlocked, progressCurrent, progressTarget, progressLabel }) => {
                const equipped = activeSkin === skin.id;
                const pct = Math.min(100, Math.round((progressCurrent / Math.max(1, progressTarget)) * 100));
                return (
                  <div
                    key={skin.id}
                    className={cx(
                      'flex flex-col justify-between gap-3 rounded-2xl border p-3.5 transition',
                      equipped
                        ? 'border-accent bg-accent-soft/40'
                        : unlocked
                          ? 'border-line bg-surface hover:border-muted/60'
                          : 'border-dashed border-line bg-surface-2/60 opacity-85',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <UniBuddy
                          skin={skin.id}
                          accessory={accessory}
                          mood={unlocked ? 'celebrate' : 'shy'}
                          size={50}
                          interactive={false}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-sm font-bold text-fg">{skin.name}</span>
                          <Badge tone={equipped ? 'ok' : unlocked ? 'accent' : 'neutral'}>
                            {skin.badgeText}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-muted">{skin.tagline}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">{unlocked ? progressLabel : skin.unlockHint}</span>
                        {!unlocked && <span className="font-mono text-xs text-muted">{pct}%</span>}
                      </div>
                      {!unlocked && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant={equipped ? 'secondary' : unlocked ? 'primary' : 'ghost'}
                        disabled={!unlocked || equipped}
                        onClick={() => updateSettings({ uniSkin: skin.id })}
                        className="w-full"
                      >
                        {equipped ? (
                          <>
                            <Check size={14} /> Equipado
                          </>
                        ) : unlocked ? (
                          'Equipar esta cor'
                        ) : (
                          <>
                            <Lock size={13} /> {progressLabel}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'pets' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-2.5 text-xs">
              <span className="text-muted">
                Os Micropets caminham ao lado do teu Uni no Ninho e pelos cantos do ecrã.
              </span>
              {activePet !== 'none' && (
                <button
                  type="button"
                  onClick={() => updateSettings({ uniPet: 'none' })}
                  className="font-semibold text-muted underline hover:text-fg"
                >
                  Guardar pet
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {petItems.map(({ pet, unlocked, progressCurrent, progressTarget, progressLabel }) => {
                const equipped = activePet === pet.id;
                const pct = Math.min(100, Math.round((progressCurrent / Math.max(1, progressTarget)) * 100));
                return (
                  <div
                    key={pet.id}
                    className={cx(
                      'flex flex-col justify-between gap-3 rounded-2xl border p-3.5 transition',
                      equipped
                        ? 'border-accent bg-accent-soft/40'
                        : unlocked
                          ? 'border-line bg-surface hover:border-muted/60'
                          : 'border-dashed border-line bg-surface-2/60 opacity-85',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2">
                        <UniPetBuddy pet={pet.id} size={36} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display text-sm font-bold text-fg">{pet.name}</span>
                          <Badge tone={equipped ? 'ok' : unlocked ? 'accent' : 'neutral'}>
                            {pet.species}
                          </Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-muted">{pet.tagline}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">{unlocked ? progressLabel : pet.unlockHint}</span>
                        {!unlocked && <span className="font-mono text-xs text-muted">{pct}%</span>}
                      </div>
                      {!unlocked && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant={equipped ? 'secondary' : unlocked ? 'primary' : 'ghost'}
                        disabled={!unlocked || equipped}
                        onClick={() => updateSettings({ uniPet: pet.id })}
                        className="w-full"
                      >
                        {equipped ? (
                          <>
                            <Check size={14} /> A acompanhar-te
                          </>
                        ) : unlocked ? (
                          `Adotar ${pet.name}`
                        ) : (
                          <>
                            <Lock size={13} /> {progressLabel}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'discreto' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 py-3 text-xs">
              <Sparkles size={16} className="shrink-0 text-accent" />
              <p className="text-muted">
                Os Unis discretos agora passeiam por diferentes cantos e margens (esquerda, direita e bordas laterais) tanto no computador como no telemóvel, escondendo-se ao escrever ou fazer scroll.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-3 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-fg">Quantidade no ecrã</p>
                <p className="text-xs text-muted">
                  No modo «Até 2», um amigo de cor diferente vem espreitar contigo.
                </p>
              </div>
              <div className="inline-flex rounded-full bg-surface-2 p-1">
                {(
                  [
                    ['all', 'Até 2'],
                    ['solo', 'Só 1'],
                    ['off', 'Desligado'],
                  ] as const
                ).map(([modeId, label]) => {
                  const modeActive = liveCompanions === modeId;
                  return (
                    <button
                      key={modeId}
                      type="button"
                      onClick={() => updateSettings({ uniLiveCompanions: modeId })}
                      className={cx(
                        'min-h-[36px] rounded-full px-3 text-xs font-semibold transition',
                        modeActive ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
