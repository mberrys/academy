import { describe, expect, it } from 'vitest';
import { createInstance } from './placement';
import { createGame } from './setup';
import { drainTriggers, runTrigger } from './triggers';
import { runEffect } from './effects';
import { CARD_CATALOG, DECKS } from '../cards';
import type { CardInstance, GameEvent, GameState, PlayerId } from './types';

function game(): GameState {
  const state = createGame({
    seed: 17,
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

function placeBack(state: GameState, defId: string, slot: number, player: PlayerId): CardInstance {
  const card = createInstance(state, defId, player, 'back');
  card.slot = slot;
  state.back[player][slot] = card;
  return card;
}

describe('trigger bus', () => {
  it('runs turn start triggers for the active player only', () => {
    const state = game();
    placeBack(state, 'stoicism', 0, 'p1');
    placeBack(state, 'stoicism', 0, 'p2');
    state.players.p1.health = 15;
    state.players.p2.health = 15;
    state.turnStartPending = true;

    drainTriggers(state, []);

    expect(state.players.p1.health).toBe(16);
    expect(state.players.p2.health).toBe(15);
  });

  it('the earlier this round condition sees prior Arguments', () => {
    const state = game();
    const source = createInstance(state, 'capital', 'p1', 'row');
    source.slot = 0;
    state.row[0] = source;
    const enemy = createInstance(state, 'capital', 'p2', 'row');
    enemy.slot = 5;
    state.row[5] = enemy;
    state.players.p1.playedThisRound = ['rebuttal'];

    runEffect('dialectic', {
      state,
      source,
      controller: 'p1',
      targetId: enemy.instanceId,
      events: [],
    });

    expect(enemy.damage).toBe(4);
  });

  it('once per round triggers fire once per source', () => {
    const state = game();
    const school = placeBack(state, 'empiricism', 0, 'p1');
    const events: GameEvent[] = [];

    runTrigger(state, 'onArgumentAfterThinker', school, 'p1', events);
    runTrigger(state, 'onArgumentAfterThinker', school, 'p1', events);

    expect(state.players.p1.hand).toHaveLength(1);
    expect(state.players.p1.triggeredThisRound).toHaveLength(1);
  });

  it('drains a death trigger chain and clears the queue', () => {
    const state = game();
    const student = createInstance(state, 'student', 'p1', 'row');
    student.slot = 0;
    state.row[0] = student;
    state.pendingDeaths.push(student);

    drainTriggers(state, []);

    expect(state.pendingDeaths).toHaveLength(0);
    expect(state.players.p1.hand).toHaveLength(1);
  });
});
