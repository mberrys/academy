import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { hashState } from './hash';
import { testArguments, TEST_CATALOG } from './fixtures';
import { createGame } from './setup';
import type { ActionResult, GameState } from './types';
import type { CreateGameOptions } from './setup';

function fresh(overrides: Partial<CreateGameOptions> = {}): GameState {
  return createGame({
    seed: 1,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
    ...overrides,
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

describe('game setup', () => {
  it('deals four cards to the first player and five to the second', () => {
    const state = fresh();
    expect(state.players.p1.hand).toHaveLength(4);
    expect(state.players.p2.hand).toHaveLength(5);
    expect(state.players.p1.health).toBe(20);
    expect(state.players.p2.health).toBe(20);
    expect(state.phase).toBe('mulligan');
  });

  it('allows one mulligan per player', () => {
    const state = fresh();
    const cardId = state.players.p1.hand[0]?.instanceId;
    expect(cardId).toBeDefined();
    const next = ok(applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [cardId as string] }));
    expect(next.players.p1.hand).toHaveLength(4);
    expect(next.players.p1.mulliganUsed).toBe(true);
    const second = applyAction(next, { type: 'MULLIGAN', player: 'p1', cardIds: [] });
    expect(second).toEqual({ ok: false, error: 'mulligan-used' });
  });

  it('starts round one after both players mulligan', () => {
    const state = mulliganBoth(fresh());
    expect(state.round).toBe(1);
    expect(state.phase).toBe('actions');
    expect(state.attackToken).toBe('p1');
    expect(state.players.p1.energy).toBe(1);
    expect(state.players.p2.energy).toBe(1);
    expect(state.priority).toBe('p1');
  });
});

describe('actions', () => {
  it('plays an argument, spends energy, and passes priority', () => {
    let state = mulliganBoth(fresh());
    const card = state.players.p1.hand[0];
    expect(card).toBeDefined();
    state = ok(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: card?.instanceId as string }));
    expect(state.players.p1.hand).toHaveLength(3);
    expect(state.players.p1.discard).toHaveLength(1);
    expect(state.players.p1.energy).toBe(0);
    expect(state.priority).toBe('p2');
  });

  it('ends the round after two passes and draws one card for each player', () => {
    let state = mulliganBoth(fresh());
    const p1Hand = state.players.p1.hand.length;
    const p2Hand = state.players.p2.hand.length;
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    expect(state.round).toBe(2);
    expect(state.players.p1.hand).toHaveLength(p1Hand + 1);
    expect(state.players.p2.hand).toHaveLength(p2Hand + 1);
    expect(state.attackToken).toBe('p2');
  });

  it('banks up to three unspent energy for arguments', () => {
    let state = mulliganBoth(fresh());
    state.players.p1.energy = 5;
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    expect(state.players.p1.spellMana).toBe(3);
    expect(state.players.p1.energy).toBe(2);
  });

  it('ramps energy to ten and holds the cap', () => {
    let state = mulliganBoth(fresh());
    for (let round = 1; round <= 10; round += 1) {
      expect(state.round).toBe(round);
      expect(state.players.p1.energy).toBe(Math.min(round, 10));
      state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
      state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    }
    expect(state.round).toBe(11);
    expect(state.players.p1.energy).toBe(10);
  });

  it('burns a draw at ten cards', () => {
    let state = mulliganBoth(fresh());
    while (state.players.p1.hand.length < 10) {
      const card = state.players.p1.deck.shift();
      expect(card).toBeDefined();
      if (card) {
        card.zone = 'hand';
        state.players.p1.hand.push(card);
      }
    }
    const deckBefore = state.players.p1.deck.length;
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    expect(state.players.p1.hand).toHaveLength(10);
    expect(state.players.p1.discard).toHaveLength(1);
    expect(state.players.p1.deck).toHaveLength(deckBefore - 1);
  });

  it('loses on deck out', () => {
    let state = mulliganBoth(
      fresh({ decks: { p1: ['test-argument', 'test-argument', 'test-argument', 'test-argument'], p2: testArguments() } }),
    );
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    expect(state.winner).toBe('p2');
    expect(state.phase).toBe('over');
  });

  it('draws at round twenty', () => {
    let state = mulliganBoth(fresh());
    state.round = 20;
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    state = ok(applyAction(state, { type: 'PASS', player: state.priority }));
    expect(state.winner).toBe('draw');
    expect(state.phase).toBe('over');
  });

  it('returns a typed rejection and leaves the state untouched', () => {
    const state = mulliganBoth(fresh());
    const before = hashState(state);
    const result = applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: 'missing' });
    expect(result).toEqual({ ok: false, error: 'card-not-in-hand' });
    expect(hashState(state)).toBe(before);
  });
});
