import type { CardInstance, GameState } from './types';

function cardView(card: CardInstance | null): unknown {
  if (!card) {
    return null;
  }
  return [card.instanceId, card.defId, card.damage, card.slot ?? null, card.costDelta, card.grantedKeywords, card.isCopy];
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashState(state: GameState): string {
  const view = {
    round: state.round,
    phase: state.phase,
    attackToken: state.attackToken,
    activePlayer: state.activePlayer,
    priority: state.priority,
    consecutivePasses: state.consecutivePasses,
    winner: state.winner,
    players: (['p1', 'p2'] as const).map((player) => {
      const playerState = state.players[player];
      return {
        health: playerState.health,
        energy: playerState.energy,
        spellMana: playerState.spellMana,
        deck: playerState.deck.map(cardView),
        hand: playerState.hand.map(cardView),
        discard: playerState.discard.map(cardView),
        playedThisRound: playerState.playedThisRound,
        championProgress: playerState.championProgress,
        championLevel: playerState.championLevel,
        mulliganUsed: playerState.mulliganUsed,
      };
    }),
    row: state.row.map(cardView),
    back: {
      p1: state.back.p1.map(cardView),
      p2: state.back.p2.map(cardView),
    },
  };
  return fnv1a(JSON.stringify(view));
}
