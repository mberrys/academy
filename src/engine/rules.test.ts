import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { statsOf } from './auras';
import { costOf } from './cost';
import { resolveDelayed, scheduleTimeBomb } from './delayed';
import { validateAction } from './legality';
import { createInstance, summonUnit } from './placement';
import { createGame } from './setup';
import { drainTriggers } from './triggers';
import { drawCard } from './turn';
import { BACK_SLOTS, MAX_HAND, ROW_SLOTS, START_HEALTH } from './types';
import { CARD_CATALOG, DECKS } from '../cards';
import type { CardInstance, GameState, PlayerId } from './types';

function game(): GameState {
  const state = createGame({
    seed: 19,
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
  state.players.p1.spellMana = 0;
  state.players.p2.spellMana = 0;
  state.players.p1.hand = [];
  state.players.p2.hand = [];
  state.turnStartPending = false;
  return state;
}

function place(
  state: GameState,
  defId: string,
  slot: number,
  player: PlayerId = 'p1',
  enteredRound = 1,
): CardInstance {
  const card = createInstance(state, defId, player, 'row');
  card.slot = slot;
  card.enteredRound = enteredRound;
  state.row[slot] = card;
  return card;
}

function placeBack(state: GameState, defId: string, slot: number, player: PlayerId = 'p1'): CardInstance {
  const card = createInstance(state, defId, player, 'back');
  card.slot = slot;
  state.back[player][slot] = card;
  return card;
}

function hand(state: GameState, defId: string, player: PlayerId = 'p1'): CardInstance {
  const card = createInstance(state, defId, player, 'hand');
  state.players[player].hand.push(card);
  return card;
}

describe('appendix rules', () => {
  it('uses the locked board geometry', () => {
    expect(ROW_SLOTS).toBe(6);
    expect(BACK_SLOTS).toBe(2);
    expect(START_HEALTH).toBe(20);
    expect(MAX_HAND).toBe(10);
  });

  it('allows one champion per player', () => {
    const state = game();
    place(state, 'marx', 0);
    const second = hand(state, 'luther');
    const error = validateAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: second.instanceId,
      slot: 1,
    });
    expect(error).toBe('champion-limit');
  });

  it('does not let a unit attack the round it enters play', () => {
    const state = game();
    const unit = place(state, 'lecturer', 0, 'p1', 5);
    const error = validateAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: [{ attackerId: unit.instanceId, target: { kind: 'nexus' } }],
    });
    expect(error).toBe('invalid-attacker');
  });

  it('burns a draw when the hand is full', () => {
    const state = game();
    for (let index = 0; index < MAX_HAND; index += 1) {
      hand(state, 'rebuttal');
    }
    const events = drawCard(state, 'p1');
    expect(events[0]?.type).toBe('burned');
    expect(state.players.p1.hand).toHaveLength(MAX_HAND);
    expect(state.players.p1.discard).toHaveLength(1);
  });

  it('floors a cost at zero', () => {
    const state = game();
    const card = hand(state, 'rebuttal');
    card.costDelta = -5;
    expect(costOf(state, 'p1', card)).toBe(0);
  });

  it('requires a legal target', () => {
    const state = game();
    const card = hand(state, 'rebuttal');
    const error = validateAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: card.instanceId,
    });
    expect(error).toBe('invalid-target');
  });

  it('enforces a minimum attack target', () => {
    const state = game();
    const weak = place(state, 'lecturer', 5, 'p2');
    const card = hand(state, 'name-of-the-father');
    expect(validateAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: card.instanceId,
      targetId: weak.instanceId,
    })).toBe('invalid-target');

    const strong = place(state, 'capital', 4, 'p2');
    expect(validateAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: card.instanceId,
      targetId: strong.instanceId,
    })).toBeNull();
  });

  it('recomputes static bonuses when the source leaves play', () => {
    const state = game();
    placeBack(state, 'existentialism', 0);
    const champion = place(state, 'marx', 1);
    const def = CARD_CATALOG.marx!;
    expect(statsOf(state, champion, def)).toEqual({ attack: 3, health: 5 });
    state.back.p1[0] = null;
    expect(statsOf(state, champion, def)).toEqual({ attack: 2, health: 4 });
  });

  it('summons partially when the row is full', () => {
    const state = game();
    for (let slot = 0; slot < 5; slot += 1) {
      const card = createInstance(state, 'lecturer', 'p1', 'row');
      card.slot = slot;
      state.row[slot] = card;
    }
    expect(summonUnit(state, 'p1', 'congregant', undefined, [])).toBeDefined();
    expect(summonUnit(state, 'p1', 'congregant', undefined, [])).toBeUndefined();
    expect(state.row.filter((card) => card !== null)).toHaveLength(6);
  });

  it('breaks a strongest tie by health', () => {
    const state = game();
    const lecturer = place(state, 'lecturer', 1, 'p2');
    const bulwark = place(state, 'bulwark', 2, 'p2');
    scheduleTimeBomb(state, 'p1', 'bomb-1');
    state.round += 2;
    resolveDelayed(state, 'p1', []);
    expect(bulwark.damage).toBe(3);
    expect(lecturer.damage).toBe(0);
  });

  it('breaks a weakest tie by health', () => {
    const state = game();
    const lecturer = place(state, 'lecturer', 0);
    const bulwark = place(state, 'bulwark', 1);
    const enemy = place(state, 'capital', 5, 'p2');
    const spell = hand(state, 'class-struggle');
    const result = applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
      targetId: enemy.instanceId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.row[0]).toBeNull();
    expect(result.state.row[1]?.instanceId).toBe(bulwark.instanceId);
    expect(result.state.players.p1.discard.some((card) => card.instanceId === lecturer.instanceId)).toBe(true);
  });

  it('transforms a replayed champion at the next turn start', () => {
    const state = game();
    const champion = place(state, 'marx', 0);
    state.players.p1.championProgress = 3;
    state.players.p1.pendingChampionTransform = true;
    state.turnStartPending = true;
    drainTriggers(state, []);
    expect(champion.defId).toBe('marx-2');
    expect(state.players.p1.championLevel).toBe(2);
  });
});
