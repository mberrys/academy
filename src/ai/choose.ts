import { applyAction } from '../engine/actions';
import { getLegalActions } from '../engine/legality';
import { scoreState } from './score';
import type { Action, GameState, PlayerId } from '../engine/types';

function tieValue(seed: number, action: Action): number {
  const text = JSON.stringify(action);
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(hash, 31) + text.charCodeAt(index)) >>> 0;
  }
  return hash / 0xffffffff;
}

function pruneSlots(actions: Action[]): Action[] {
  const seenCards = new Set<string>();
  const kept: Action[] = [];
  for (const action of actions) {
    if (action.type === 'PLAY_CARD' && action.slot !== undefined) {
      if (seenCards.has(action.cardId)) {
        continue;
      }
      seenCards.add(action.cardId);
    }
    kept.push(action);
  }
  return kept;
}

export function chooseAction(state: GameState, player: PlayerId, seed = state.rngState): Action {
  const legal = getLegalActions(state, player);
  if (legal.length === 0) {
    throw new Error('no legal actions');
  }
  if (state.phase === 'mulligan') {
    return { type: 'MULLIGAN', player, cardIds: [] };
  }

  let best: Action | null = null;
  let bestScore = -Infinity;

  for (const action of pruneSlots(legal)) {
    const result = applyAction(state, action);
    if (!result.ok) {
      continue;
    }

    let score = scoreState(result.state, player) + tieValue(seed, action) * 0.01;
    if (action.type === 'PASS') {
      score -= 0.1;
    } else if (action.type === 'PLAY_CARD') {
      score += 0.1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  if (!best) {
    throw new Error('no playable actions');
  }
  return best;
}
