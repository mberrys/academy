import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { testArguments, TEST_CATALOG } from './fixtures';
import { getLegalActions } from './legality';
import { createGame } from './setup';
import { hashState } from './hash';
import type { Action, GameState, PlayerId } from './types';

function fresh(): GameState {
  return createGame({
    seed: 7,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function activePlayer(state: GameState): PlayerId {
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganUsed ? 'p2' : 'p1';
  }
  return state.priority;
}

function record(limit: number): { actions: Action[]; hashes: string[] } {
  let state = fresh();
  const actions: Action[] = [];
  const hashes = [hashState(state)];

  for (let step = 0; step < limit; step += 1) {
    if (state.phase === 'over') {
      break;
    }
    const legal = getLegalActions(state, activePlayer(state));
    const action = legal[0];
    if (!action) {
      break;
    }
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(`Recorded an illegal action: ${result.error}`);
    }
    actions.push(action);
    state = result.state;
    hashes.push(hashState(state));
  }

  return { actions, hashes };
}

describe('replay', () => {
  it('produces the same state hashes from the same seed and actions', () => {
    const first = record(40);
    const replayed = record(40);
    expect(replayed.actions).toEqual(first.actions);
    expect(replayed.hashes).toEqual(first.hashes);
  });

  it('changes nothing when an action is rejected', () => {
    const state = fresh();
    const before = hashState(state);
    const result = applyAction(state, { type: 'PASS', player: 'p1' });
    expect(result).toEqual({ ok: false, error: 'wrong-phase' });
    expect(hashState(state)).toBe(before);
  });
});
