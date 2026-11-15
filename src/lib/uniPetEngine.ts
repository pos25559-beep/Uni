import type { AppTone, UniLiveCompanionsMode } from '../types';
import { getUniCollectibleStates, type CollectibleTelemetry, type UniSkinId } from './uniCollectibles';

export type PetBehavior = 'idle_peek' | 'edge_walk' | 'shy_hide' | 'quiet_meetup' | 'tiny_slip';

export type PetAnchorZone =
  | 'bottom_right'
  | 'bottom_left'
  | 'right_edge_peek'
  | 'left_edge_peek'
  | 'top_right_corner'
  | 'top_left_corner';

export interface NomadPlacement {
  zone: PetAnchorZone;
  tiltDeg: number;
  offsetPx: number;
}

const ANCHOR_ORDER: PetAnchorZone[] = [
  'bottom_right',
  'left_edge_peek',
  'bottom_left',
  'right_edge_peek',
  'top_right_corner',
  'top_left_corner',
];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Resolve até 2 Unis desbloqueados para aparecerem de forma discreta nas bordas.
 * Com `autoRotate` ativo, a cor principal varia suavemente entre as cores desbloqueadas;
 * o companheiro visitante escolhe sempre uma cor distinta da principal.
 */
export function resolveVisibleUniPeers(args: {
  activeSkin: UniSkinId;
  telemetry: CollectibleTelemetry;
  mode?: UniLiveCompanionsMode;
  appTone?: AppTone;
  tickSeed?: number;
  autoRotate?: boolean;
  pathname?: string;
}): UniSkinId[] {
  if (args.appTone === 'serio' || args.mode === 'off') return [];

  const unlocked = getUniCollectibleStates(args.telemetry)
    .filter((item) => item.unlocked)
    .map((item) => item.skin.id);

  const pool = unlocked.length > 0 ? unlocked : [args.activeSkin];
  const seed = Math.abs(args.tickSeed ?? 0) + (args.pathname ? hashString(args.pathname) : 0);
  const primarySkin =
    args.autoRotate && pool.length > 1
      ? pool[seed % pool.length]!
      : args.activeSkin;

  if (args.mode === 'solo') return [primarySkin];

  const peers = pool.filter((id) => id !== primarySkin);
  if (peers.length === 0) return [primarySkin];

  const chosenVisitor = peers[seed % peers.length]!;
  return [primarySkin, chosenVisitor];
}

const TUTOR_SAFE_ANCHORS: PetAnchorZone[] = ['right_edge_peek', 'left_edge_peek', 'top_right_corner'];
const MOBILE_SAFE_ANCHORS: PetAnchorZone[] = ['bottom_right'];

/**
 * Escolhe de forma determinística onde o Uni discreto aparece no ecrã
 * (alternando entre canto inferior direito/esquerdo, bordas laterais a espreitar e cantos superiores).
 * Em telemóveis (`mobile: true`), restringe exclusivamente aos cantos inferiores acima da dock
 * para nunca tapar cabeçalhos nem cartões.
 */
export function pickNextNomadPlacement(args: {
  pathname: string;
  stepCount: number;
  mobile?: boolean;
}): NomadPlacement {
  const path = args.pathname || '/';
  const pool = args.mobile
    ? MOBILE_SAFE_ANCHORS
    : path.startsWith('/assistente')
      ? TUTOR_SAFE_ANCHORS
      : ANCHOR_ORDER;
  const routeOffset = hashString(path);
  const index = (routeOffset + args.stepCount) % pool.length;
  const zone = pool[index]!;
  const stepParity = args.stepCount % 2 === 0 ? 1 : -1;

  if (args.mobile) {
    return {
      zone,
      tiltDeg: 0,
      offsetPx: stepParity * 4,
    };
  }

  if (zone === 'right_edge_peek') {
    return { zone, tiltDeg: -16, offsetPx: stepParity * 12 };
  }
  if (zone === 'left_edge_peek') {
    return { zone, tiltDeg: 16, offsetPx: stepParity * 12 };
  }
  return {
    zone,
    tiltDeg: 0,
    offsetPx: stepParity * 8,
  };
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
 * Devolve micro-frases curtas e discretas para a folhinha dobrada (estilo Finch / caderno gentil).
 */
export function pickQuietRouteNote(args: {
  pathname: string;
  pendingTodayCount: number;
  streakDays: number;
  adventureDone?: boolean;
}): string {
  if (args.adventureDone) return 'Energia do dia cheia — ótimo ritmo!';
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
  if (path.startsWith('/progresso')) return 'Cada recall acorda um Uni ou pet novo.';
  if (path.startsWith('/assistente')) return 'Podes anexar a sebenta por cadeira.';
  if (path.startsWith('/materiais')) return 'Organiza por pastas nas cadeiras.';
  return 'Aqui contigo neste canto.';
}
