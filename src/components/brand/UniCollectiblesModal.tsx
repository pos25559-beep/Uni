import { Check, Lock, Sparkles } from 'lucide-react';
import { readCollectibleTelemetry, getUniCollectibleStates } from '../../lib/uniCollectibles';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import { Badge, Button, Modal, cx } from '../ui';
import { UniBuddy } from './UnipediaMarks';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UniCollectiblesModal({ open, onClose }: Props) {
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const academicProfile = useStore((s) => s.academicProfile);
  const activeSkin = useStore((s) => s.settings.uniSkin ?? 'classic');
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const liveCompanions = useStore((s) => s.settings.uniLiveCompanions ?? 'all');
  const updateSettings = useStore((s) => s.updateSettings);

  const accessory = resolveUniAccessory(
    uniPreference,
    academicProfile.degreeName,
    courses[0]?.name,
  );

  const telemetry = readCollectibleTelemetry(sessions, courses, weeklyCheckIns);
  const items = getUniCollectibleStates(telemetry);
  const unlockedCount = items.filter((i) => i.unlocked).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vitrina do Uni · Colecionáveis de Estudo"
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted">
          <span>
            {unlockedCount}/{items.length} estilos desbloqueados
          </span>
          <Button variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2 px-3.5 py-3 text-xs">
          <Sparkles size={16} className="shrink-0 text-accent" />
          <p className="text-muted">
            Cada sessão concluída com recall ativo e cada dia seguido desbloqueia novos visuais do Uni para o teu caderno.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-fg">Unis discretos nos cantos</p>
            <p className="text-[11px] text-muted">
              Espreitam em silêncio e escondem-se quando escreves.
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
                    'min-h-[32px] rounded-full px-2.5 text-[11px] font-semibold transition',
                    modeActive ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ skin, unlocked, progressCurrent, progressTarget, progressLabel }) => {
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
                      size={54}
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
                    <p className="text-[11px] leading-relaxed text-muted">{skin.tagline}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{unlocked ? progressLabel : skin.unlockHint}</span>
                    {!unlocked && <span className="font-mono text-[10px] text-muted">{pct}%</span>}
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
                      'Equipar este Uni'
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
    </Modal>
  );
}
