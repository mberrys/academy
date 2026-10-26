import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { deckOf, testArguments, TEST_CATALOG } from './fixtures';
import { getLegalActions, validateAction } from './legality';
import { createGame } from './setup';
import { hashState } from './hash';
import type { ActionResult, CardInstance, GameState } from './types';

function fresh(overrides: { p1?: string[]; p2?: string[] } = {}): GameState {
  return createGame({
    seed: 1,
    catalog: TEST_CATALOG,
    decks: { p1: overrides.p1 ?? testArguments(), p2: overrides.p2 ?? testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function ok(result: ActionResult): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

function mulliganBoth(state: GameState): GameState {
  const p1 = ok(applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] }));
  return ok(applyAction(p1, { type: 'MULLIGAN', player: 'p2', cardIds: [] }));
}

function fillRow(state: GameState): void {
  for (let slot = 0; slot < state.row.length; slot += 1) {
    const card: CardInstance = {
      instanceId: `token-${slot}`,
      defId: 'test-token',
      owner: 'p1',
      zone: 'row',
      slot,
      damage: 0,
      costDelta: 0,
      grantedKeywords: [],
      isCopy: false,
      barrierConsumed: false,
      enteredRound: 1,
    };
    state.row[slot] = card;
  }
}

describe('legality', () => {
  it('rejects a card that is not in hand', () => {
    const state = mulliganBoth(fresh());
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: 'missing' })).toEqual({
      ok: false,
      error: 'card-not-in-hand',
    });
  });

  it('rejects an action from the player without priority', () => {
    let state = mulliganBoth(fresh());
    const first = state.players.p1.hand[0];
    expect(first).toBeDefined();
    state = ok(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: first?.instanceId as string }));
    const second = state.players.p1.hand[0];
    expect(second).toBeDefined();
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: second?.instanceId as string })).toEqual({
      ok: false,
      error: 'not-your-priority',
    });
  });

  it('rejects a card the player cannot afford', () => {
    const state = mulliganBoth(fresh({ p1: deckOf('test-big') }));
    const card = state.players.p1.hand[0];
    expect(card).toBeDefined();
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: card?.instanceId as string })).toEqual({
      ok: false,
      error: 'insufficient-energy',
    });
  });

  it('rejects a unit when the row is full', () => {
    let state = mulliganBoth(fresh({ p1: deckOf('test-thinker') }));
    state.players.p1.energy = 10;
    fillRow(state);
    const card = state.players.p1.hand[0];
    expect(card).toBeDefined();
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: card?.instanceId as string })).toEqual({
      ok: false,
      error: 'row-full',
    });
  });

  it('rejects a second champion', () => {
    let state = mulliganBoth(fresh({ p1: deckOf('test-champion') }));
    state.players.p1.energy = 10;
    const first = state.players.p1.hand[0];
    expect(first).toBeDefined();
    state = ok(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: first?.instanceId as string, slot: 0 }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    const second = state.players.p1.hand[0];
    expect(second).toBeDefined();
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: second?.instanceId as string, slot: 1 })).toEqual({
      ok: false,
      error: 'champion-limit',
    });
  });

  it('rejects a second copy of the same school', () => {
    let state = mulliganBoth(fresh({ p1: deckOf('test-school') }));
    state.players.p1.energy = 10;
    const first = state.players.p1.hand[0];
    expect(first).toBeDefined();
    state = ok(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: first?.instanceId as string, slot: 0 }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    const second = state.players.p1.hand[0];
    expect(second).toBeDefined();
    expect(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: second?.instanceId as string, slot: 1 })).toEqual({
      ok: false,
      error: 'school-limit',
    });
  });

  it('rejects every action after the game is over', () => {
    const state = mulliganBoth(fresh());
    state.phase = 'over';
    state.winner = 'p1';
    expect(applyAction(state, { type: 'PASS', player: 'p1' })).toEqual({ ok: false, error: 'game-over' });
  });

  it('lists legal actions for the priority player only', () => {
    const state = mulliganBoth(fresh());
    const p1 = getLegalActions(state, 'p1');
    const p2 = getLegalActions(state, 'p2');
    expect(p1.some((action) => action.type === 'PLAY_CARD')).toBe(true);
    expect(p1.some((action) => action.type === 'PASS')).toBe(true);
    expect(p2).toEqual([]);
  });

  it('does not mutate state through validation', () => {
    const state = mulliganBoth(fresh({ p1: deckOf('test-big') }));
    const before = hashState(state);
    const card = state.players.p1.hand[0];
    expect(card).toBeDefined();
    const error = validateAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: card?.instanceId as string,
    });
    expect(error).toBe('insufficient-energy');
    expect(hashState(state)).toBe(before);
  });
});
