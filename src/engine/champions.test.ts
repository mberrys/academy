import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { statsOf } from './auras';
import { findChampion } from './champions';
import { destroyUnit } from './damage';
import { resolveDelayed, scheduleTimeBomb } from './delayed';
import { createInstance, summonUnit } from './placement';
import { createGame } from './setup';
import { CARD_CATALOG, DECKS } from '../cards';
import type { CardInstance, GameState, PlayerId } from './types';

function game(): GameState {
  const state = createGame({
    seed: 11,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS.marx, p2: DECKS.lacan },
    champions: { p1: 'marx', p2: 'lacan' },
  });
  state.phase = 'actions';
  state.round = 5;
  state.attackToken = 'p1';
  state.activePlayer = 'p1';
  state.priority = 'p1';
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;
  state.players.p1.hand = [];
  state.players.p2.hand = [];
  state.turnStartPending = false;
  return state;
}

function place(state: GameState, defId: string, slot: number, player: PlayerId = 'p1'): CardInstance {
  const card = createInstance(state, defId, player, 'row');
  card.slot = slot;
  card.enteredRound = 1;
  state.row[slot] = card;
  return card;
}

describe('champion level ups', () => {
  it('Marx levels after three Time Bombs resolve', () => {
    const state = game();
    place(state, 'marx', 0);
    state.players.p2.health = 20;

    for (let index = 0; index < 3; index += 1) {
      const bomb = createInstance(state, 'time-bomb', 'p1', 'hand');
      state.players.p1.hand.push(bomb);
      state.attackToken = 'p1';
      scheduleTimeBomb(state, 'p1', bomb.instanceId);
      state.round += 2;
      resolveDelayed(state, 'p1', []);
    }

    const champion = findChampion(state, 'p1');
    expect(champion?.defId).toBe('marx-2');
    expect(state.players.p1.championLevel).toBe(2);
    expect(statsOf(state, champion!, CARD_CATALOG['marx-2']!)).toEqual({ attack: 4, health: 5 });
  });

  it('Lacan levels after three copied Arguments are played', () => {
    let state = game();
    place(state, 'lacan', 0);
    const enemy = place(state, 'capital', 5, 'p2');

    for (let index = 0; index < 3; index += 1) {
      const copy = createInstance(state, 'rebuttal', 'p1', 'hand');
      copy.isCopy = true;
      state.players.p1.hand.push(copy);
      state.players.p1.energy = 10;
      state.priority = 'p1';
      const result = applyAction(state, {
        type: 'PLAY_CARD',
        player: 'p1',
        cardId: copy.instanceId,
        targetId: enemy.instanceId,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      state = result.state;
      if (index < 2) {
        const passed = applyAction(state, { type: 'PASS', player: 'p2' });
        if (!passed.ok) {
          throw new Error(passed.error);
        }
        state = passed.state;
      }
    }

    const champion = findChampion(state, 'p1');
    expect(champion?.defId).toBe('lacan-2');
    expect(state.players.p1.championLevel).toBe(2);
    expect(statsOf(state, champion!, CARD_CATALOG['lacan-2']!)).toEqual({ attack: 3, health: 5 });
  });

  it('Luther levels after six followers are summoned', () => {
    const state = game();
    place(state, 'luther', 0);
    for (let slot = 1; slot <= 4; slot += 1) {
      summonUnit(state, 'p1', 'congregant', slot, []);
    }
    const first = state.row[1];
    expect(first).not.toBeNull();
    destroyUnit(state, first!, []);
    summonUnit(state, 'p1', 'congregant', 1, []);
    summonUnit(state, 'p1', 'congregant', 5, []);

    const champion = findChampion(state, 'p1');
    expect(champion?.defId).toBe('luther-2');
    expect(state.players.p1.championLevel).toBe(2);
    expect(statsOf(state, champion!, CARD_CATALOG['luther-2']!)).toEqual({ attack: 2, health: 6 });
  });
});
