import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { deckOf, testArguments, TEST_CATALOG } from './fixtures';
import { createGame } from './setup';
import type { ActionResult, CardInstance, GameState } from './types';

let instanceCounter = 0;

function readyWithChallenger(): GameState {
  let state = createGame({
    seed: 1,
    catalog: TEST_CATALOG,
    decks: { p1: deckOf('test-challenger'), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
  state = ok(applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] }));
  state = ok(applyAction(state, { type: 'MULLIGAN', player: 'p2', cardIds: [] }));
  state.players.p1.energy = 10;
  return state;
}

function ok(result: ActionResult): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

function enemy(state: GameState, slot: number): CardInstance {
  const card: CardInstance = {
    instanceId: `p2-enemy-${instanceCounter}`,
    defId: 'test-thinker',
    owner: 'p2',
    zone: 'row',
    slot,
    damage: 0,
    buffs: [],
    keywordGrants: [],
    costDelta: 0,
    costDeltaExpiresRound: null,
    isCopy: false,
    barrierConsumed: false,
    enteredRound: 0,
  };
  instanceCounter += 1;
  state.row[slot] = card;
  return card;
}

function playChallenger(state: GameState, slot: number): { state: GameState; events: { type: string }[] } {
  const card = state.players.p1.hand[0];
  if (!card) {
    throw new Error('The challenger is missing from hand');
  }
  const result = applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: card.instanceId, slot });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { state: result.state, events: result.events };
}

describe('challenger', () => {
  it('pulls the nearest enemy into an adjacent empty slot', () => {
    let state = readyWithChallenger();
    const target = enemy(state, 5);
    const played = playChallenger(state, 0);
    state = played.state;
    expect(state.row[1]?.instanceId).toBe(target.instanceId);
    expect(state.row[5]).toBeNull();
    expect(played.events.some((event) => event.type === 'challenged')).toBe(true);
  });

  it('does nothing when no adjacent slot is free', () => {
    let state = readyWithChallenger();
    const near = enemy(state, 1);
    const far = enemy(state, 5);
    const played = playChallenger(state, 0);
    state = played.state;
    expect(state.row[1]?.instanceId).toBe(near.instanceId);
    expect(state.row[5]?.instanceId).toBe(far.instanceId);
    expect(played.events.some((event) => event.type === 'challenged')).toBe(false);
  });

  it('does nothing when the opponent has no units', () => {
    const played = playChallenger(readyWithChallenger(), 0);
    expect(played.events.some((event) => event.type === 'challenged')).toBe(false);
  });
});
