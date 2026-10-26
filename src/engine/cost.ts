import { hasAura } from './auras';
import type { CardInstance, GameState, PlayerId } from './types';

function controlsSchool(state: GameState, player: PlayerId, defId: string): boolean {
  return state.back[player].some((card) => card?.defId === defId);
}

export function argumentsPlayedThisRound(state: GameState, player: PlayerId): number {
  return state.players[player].playedThisRound.filter((defId) => state.catalog[defId]?.type === 'argument').length;
}

export function costOf(state: GameState, player: PlayerId, card: CardInstance): number {
  const def = state.catalog[card.defId];
  if (!def) {
    return 0;
  }

  if (card.costOverride !== undefined) {
    return Math.max(0, card.costOverride);
  }

  let cost = def.cost;
  if (card.costDelta !== 0 && (card.costDeltaExpiresRound === null || card.costDeltaExpiresRound >= state.round)) {
    cost += card.costDelta;
  }

  if (def.type === 'argument') {
    const playerState = state.players[player];
    cost -= playerState.argumentDiscount;
    if (controlsSchool(state, player, 'psychoanalysis') && argumentsPlayedThisRound(state, player) === 1) {
      cost -= 1;
    }
  }

  if (def.id === 'time-bomb') {
    const aura = hasAura(state, player, 'bombBonus');
    if (aura?.kind === 'bombBonus') {
      cost = aura.cost;
    }
  }

  return Math.max(0, cost);
}
