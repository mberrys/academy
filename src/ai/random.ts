import { getLegalActions } from '../engine/legality';
import { nextRandom } from '../engine/rng';
import type { Action, GameState, PlayerId } from '../engine/types';

export function randomAction(
  state: GameState,
  player: PlayerId,
  rngState: number,
): { action: Action; rngState: number } {
  const legal = getLegalActions(state, player);
  if (legal.length === 0) {
    throw new Error('no legal actions');
  }
  const next = nextRandom(rngState);
  const action = legal[Math.floor(next.value * legal.length)]!;
  return { action, rngState: next.state };
}
