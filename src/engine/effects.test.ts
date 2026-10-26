import { describe, it } from 'vitest';
import { EFFECT_IDS, runEffect } from './effects';
import { createInstance } from './placement';
import { createGame } from './setup';
import { CARD_CATALOG, DECKS } from '../cards';
import type { GameEvent, GameState } from './types';

function game(): GameState {
  const state = createGame({
    seed: 13,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS.marx, p2: DECKS.lacan },
    champions: { p1: 'marx', p2: 'lacan' },
  });
  state.phase = 'actions';
  state.round = 5;
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;
  state.players.p1.hand = [];
  state.players.p2.hand = [];
  return state;
}

describe('effect registry', () => {
  it('runs every registered effect without throwing', () => {
    for (const effect of EFFECT_IDS) {
      const state = game();
      const source = createInstance(state, 'capital', 'p1', 'row');
      source.slot = 0;
      state.row[0] = source;
      const events: GameEvent[] = [];
      try {
        runEffect(effect, { state, source, controller: 'p1', events });
      } catch (error) {
        throw new Error(`${effect}: ${String(error)}`);
      }
    }
  });
});
