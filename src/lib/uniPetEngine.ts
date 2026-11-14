import type { AppTone, UniLiveCompanionsMode } from '../types';
import { getUniCollectibleStates, type CollectibleTelemetry, type UniSkinId } from './uniCollectibles';

export type PetBehavior = 'idle_peek' | 'edge_walk' | 'shy_hide' | 'quiet_meetup' | 'tiny_slip';

export interface ActiveUniActor {
  skin: UniSkinId;
  isPrimary: boolean;
  /** Posição horizontal percentual segura ao longo da margem inferior (6..92). */
  xPct: number;
  facing: 1 | -1;
  behavior: PetBehavior;
}

/**
 * Resolve até 2 Unis desbloqueados para aparecerem de forma discreta nas bordas.
 * Em modo sério ou desligado devolve lista vazia para garantir foco total.
 */
export function resolveVisibleUniPeers(args: {
  activeSkin: UniSkinId;
  telemetry: CollectibleTelemetry;
  mode?: UniLiveCompanionsMode;
  appTone?: AppTone;
  tickSeed?: number;
}): UniSkinId[] {
  if (args.appTone === 'serio' || args.mode === 'off') return [];
  if (args.mode === 'solo') return [args.activeSkin];

  const unlocked = getUniCollectibleStates(args.telemetry)
    .filter((item) => item.unlocked)
    .map((item) => item.skin.id);

  const peers = unlocked.filter((id) => id !== args.activeSkin);
  if (peers.length === 0) return [args.activeSkin];

  const chosenVisitor = peers[Math.abs(args.tickSeed ?? 0) % peers.length]!;
  return [args.activeSkin, chosenVisitor];
}

/**
 * Escolhe o próximo comportamento tímido e singelo do companheiro:
 * alterna sobretudo entre espreitar à borda, caminhar devagar no canto, esconder-se brevemente
 * e encontros silenciosos entre dois Unis desbloqueados.
 */
export function pickNextShyBehavior(args: {
  hasPeer: boolean;
  stepCount: number;
  isFocusActive?: boolean;
}): PetBehavior {
  if (args.isFocusActive) return 'shy_hide';
  const mod = args.stepCount % 7;
  if (args.hasPeer && mod === 3) return 'quiet_meetup';
  if (mod === 5) return 'tiny_slip';
  if (mod === 2 || mod === 6) return 'shy_hide';
  if (mod === 1 || mod === 4) return 'edge_walk';
  return 'idle_peek';
}

/**
 * Devolve micro-frases curtas e discretas para a folhinha dobrada (estilo singelo, sem urgência agressiva).
 */
export function pickQuietRouteNote(args: {
  pathname: string;
  pendingTodayCount: number;
  streakDays: number;
}): string {
  const path = args.pathname || '/';
  if (path === '/' || path === '') {
    if (args.pendingTodayCount > 0) {
      return args.pendingTodayCount === 1
        ? '1 bloco leve hoje já chega.'
        : `${args.pendingTodayCount} blocos à tua espera, sem pressa.`;
    }
    return args.streakDays >= 2 ? `${args.streakDays} dias seguidos… bom ritmo.` : 'Caderno em dia.';
  }
  if (path.startsWith('/cadeiras')) return 'Tira print ou cola o plano se faltar algo.';
  if (path.startsWith('/plano')) return 'Blocos ajustam-se ao teu ritmo.';
  if (path.startsWith('/progresso')) return 'Cada recall acorda um Uni novo.';
  if (path.startsWith('/assistente')) return 'Podes anexar a sebenta por cadeira.';
  if (path.startsWith('/materiais')) return 'Liga Drive ou OneDrive nas cadeiras.';
  return 'Aqui ao canto caso precises.';
}
