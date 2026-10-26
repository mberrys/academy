import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine/actions';
import { statsOf } from '../engine/auras';
import { costOf } from '../engine/cost';
import { hasKeyword } from '../engine/keywords';
import { createGame } from '../engine/setup';
import { drainTriggers } from '../engine/triggers';
import type { ActionResult, CardInstance, GameEvent, GameState, PlayerId } from '../engine/types';
import { CARD_CATALOG, DECKS } from './index';

let counter = 0;

function makeCard(defId: string, owner: PlayerId, zone: CardInstance['zone']): CardInstance {
  counter += 1;
  return {
    instanceId: `test-${counter}`,
    defId,
    owner,
    zone,
    damage: 0,
    buffs: [],
    keywordGrants: [],
    costDelta: 0,
    costDeltaExpiresRound: null,
    isCopy: false,
    barrierConsumed: false,
    enteredRound: 0,
  };
}

function game(): GameState {
  const state = createGame({
    seed: 7,
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

function putInHand(state: GameState, defId: string, player: PlayerId = 'p1'): CardInstance {
  const card = makeCard(defId, player, 'hand');
  state.players[player].hand.push(card);
  return card;
}

function putInRow(
  state: GameState,
  defId: string,
  slot: number,
  player: PlayerId = 'p1',
  enteredRound = 1,
): CardInstance {
  const card = makeCard(defId, player, 'row');
  card.slot = slot;
  card.enteredRound = enteredRound;
  state.row[slot] = card;
  return card;
}

function putInBack(state: GameState, defId: string, slot: number, player: PlayerId = 'p1'): CardInstance {
  const card = makeCard(defId, player, 'back');
  card.slot = slot;
  state.back[player][slot] = card;
  return card;
}

function applied(result: ActionResult): GameState {
  if (!result.ok) {
    throw new Error(`action rejected: ${result.error}`);
  }
  return result.state;
}

function passBoth(state: GameState): GameState {
  const first = state.priority;
  const afterFirst = applied(applyAction(state, { type: 'PASS', player: first }));
  return applied(applyAction(afterFirst, { type: 'PASS', player: afterFirst.priority }));
}

function passBack(state: GameState): GameState {
  if (state.priority === 'p1') {
    return state;
  }
  return applied(applyAction(state, { type: 'PASS', player: state.priority }));
}

describe('champions', () => {
  it('Marx creates a Time Bomb when played', () => {
    const state = game();
    const marx = putInHand(state, 'marx');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: marx.instanceId,
      slot: 0,
    }));
    expect(next.players.p1.hand.some((card) => card.defId === 'time-bomb')).toBe(true);
  });

  it('Time Bomb damages the strongest enemy unit at the start of the next turn', () => {
    let state = game();
    const bomb = putInHand(state, 'time-bomb');
    const enemy = putInRow(state, 'capital', 2, 'p2');
    enemy.buffs.push({ attack: 0, health: 3, expiresRound: null });
    state = applied(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: bomb.instanceId }));
    state = passBoth(state);
    expect(state.round).toBe(6);
    state = passBoth(state);
    expect(state.round).toBe(7);
    const hit = state.row.find((card) => card?.instanceId === enemy.instanceId);
    expect(hit?.damage).toBe(4);
  });

  it('Lacan copies an Argument played after a Thinker', () => {
    let state = game();
    putInRow(state, 'lacan', 0);
    const thinker = putInHand(state, 'lecturer');
    const argument = putInHand(state, 'rebuttal');
    const enemy = putInRow(state, 'bulwark', 4, 'p2');
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: thinker.instanceId,
      slot: 1,
    }));
    state = passBack(state);
    const argumentId = state.players.p1.hand.find((card) => card.instanceId === argument.instanceId)!.instanceId;
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: argumentId,
      targetId: enemy.instanceId,
    }));
    const copy = state.players.p1.hand.find((card) => card.defId === 'rebuttal' && card.isCopy);
    expect(copy).toBeDefined();
    expect(copy?.costDelta).toBe(1);
  });

  it('Lacan level 2 makes copies cost 1 and pings the nexus', () => {
    let state = game();
    putInRow(state, 'lacan-2', 0);
    state.players.p1.championLevel = 2;
    const thinker = putInHand(state, 'lecturer');
    const argument = putInHand(state, 'rebuttal');
    const enemy = putInRow(state, 'bulwark', 4, 'p2');
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: thinker.instanceId,
      slot: 1,
    }));
    state = passBack(state);
    const argumentId = state.players.p1.hand.find((card) => card.instanceId === argument.instanceId)!.instanceId;
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: argumentId,
      targetId: enemy.instanceId,
    }));
    state = passBack(state);
    const copy = state.players.p1.hand.find((card) => card.defId === 'rebuttal' && card.isCopy)!;
    expect(copy.costOverride).toBe(1);
    const healthBefore = state.players.p2.health;
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: copy.instanceId,
      targetId: enemy.instanceId,
    }));
    expect(next.players.p2.health).toBe(healthBefore - 1);
  });

  it('Luther summons two Congregants when he attacks', () => {
    const state = game();
    const luther = putInRow(state, 'luther', 0);
    const next = applied(applyAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: [{ attackerId: luther.instanceId, target: { kind: 'nexus' } }],
    }));
    const allies = next.row.filter((card) => card?.owner === 'p1');
    expect(allies).toHaveLength(3);
    expect(allies.filter((card) => card?.defId === 'congregant')).toHaveLength(2);
  });

  it('Luther level 2 gives Congregants +1/+1', () => {
    const state = game();
    putInRow(state, 'luther-2', 0);
    const token = putInRow(state, 'congregant', 1);
    const def = CARD_CATALOG.congregant!;
    expect(statsOf(state, token, def)).toEqual({ attack: 2, health: 2 });
  });

  it('Marx level 2 makes Time Bombs cost 1 and deal 6', () => {
    let state = game();
    putInRow(state, 'marx-2', 0);
    state.players.p1.championLevel = 2;
    const bomb = putInHand(state, 'time-bomb');
    const enemy = putInRow(state, 'capital', 3, 'p2');
    enemy.buffs.push({ attack: 0, health: 5, expiresRound: null });
    expect(costOf(state, 'p1', bomb)).toBe(1);
    state = applied(applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: bomb.instanceId }));
    state = passBoth(state);
    state = passBoth(state);
    const hit = state.row.find((card) => card?.instanceId === enemy.instanceId);
    expect(hit?.damage).toBe(6);
  });
});

describe('arguments and schools', () => {
  it('Class Struggle destroys the weakest non-champion ally and deals its attack', () => {
    const state = game();
    const weak = putInRow(state, 'proletariat', 0);
    putInRow(state, 'capital', 1);
    const enemy = putInRow(state, 'capital', 4, 'p2');
    const spell = putInHand(state, 'class-struggle');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
      targetId: enemy.instanceId,
    }));
    expect(next.row[0]).toBeNull();
    const hit = next.row.find((card) => card?.instanceId === enemy.instanceId);
    expect(hit?.damage).toBe(2);
    expect(next.players.p1.discard.some((card) => card.instanceId === weak.instanceId)).toBe(true);
  });

  it('Mirror Stage summons a 1-health copy of an allied non-champion', () => {
    const state = game();
    const original = putInRow(state, 'capital', 0);
    const spell = putInHand(state, 'mirror-stage');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
      targetId: original.instanceId,
    }));
    const capDef = CARD_CATALOG.capital!;
    const copies = next.row.filter(
      (card): card is CardInstance => card !== null && card.owner === 'p1' && card.defId === 'capital',
    );
    expect(copies).toHaveLength(2);
    const copy = copies.find((card) => card.instanceId !== original.instanceId)!;
    expect(statsOf(next, copy, capDef)).toEqual({ attack: 3, health: 1 });
  });

  it('Repeal destroys an enemy School', () => {
    const state = game();
    const school = putInBack(state, 'stoicism', 0, 'p2');
    const spell = putInHand(state, 'repeal');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
      targetId: school.instanceId,
    }));
    expect(next.back.p2[0]).toBeNull();
    expect(next.players.p2.discard.some((card) => card.instanceId === school.instanceId)).toBe(true);
  });

  it('Historical Materialism discounts the next Argument after a unit dies', () => {
    let state = game();
    putInBack(state, 'historical-materialism', 0);
    putInRow(state, 'proletariat', 0);
    putInRow(state, 'capital', 1);
    const enemy = putInRow(state, 'capital', 4, 'p2');
    const struggle = putInHand(state, 'class-struggle');
    const rebuttal = putInHand(state, 'rebuttal');
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: struggle.instanceId,
      targetId: enemy.instanceId,
    }));
    state = passBack(state);
    expect(state.players.p1.argumentDiscount).toBe(1);
    state.players.p1.energy = 0;
    state.players.p1.spellMana = 0;
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: rebuttal.instanceId,
      targetId: enemy.instanceId,
    }));
    expect(next.players.p1.argumentDiscount).toBe(0);
  });

  it('Manifesto damages all enemy units and creates a Time Bomb', () => {
    const state = game();
    const bulwark = putInRow(state, 'capital', 2, 'p2');
    const lecturer = putInRow(state, 'lecturer', 3, 'p2');
    const spell = putInHand(state, 'manifesto');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
    }));
    const hitBulwark = next.row.find((card) => card?.instanceId === bulwark.instanceId);
    expect(hitBulwark?.damage).toBe(3);
    expect(next.row.some((card) => card?.instanceId === lecturer.instanceId)).toBe(false);
    expect(next.players.p1.hand.some((card) => card.defId === 'time-bomb')).toBe(true);
  });

  it('Primal Scene copies each other Argument played this round', () => {
    let state = game();
    const enemy = putInRow(state, 'bulwark', 4, 'p2');
    const rebuttal = putInHand(state, 'rebuttal');
    const primal = putInHand(state, 'primal-scene');
    state = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: rebuttal.instanceId,
      targetId: enemy.instanceId,
    }));
    state = passBack(state);
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: primal.instanceId,
    }));
    expect(next.players.p1.hand.some((card) => card.defId === 'rebuttal' && card.isCopy)).toBe(true);
  });

  it('Reformation Theology buffs summoned followers', () => {
    const state = game();
    putInBack(state, 'reformation-theology', 0);
    const theses = putInHand(state, 'ninety-five-theses');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: theses.instanceId,
    }));
    const def = CARD_CATALOG.congregant!;
    const congregants = next.row.filter(
      (card): card is CardInstance => card !== null && card.defId === 'congregant',
    );
    expect(congregants).toHaveLength(2);
    for (const token of congregants) {
      expect(statsOf(next, token, def)).toEqual({ attack: 2, health: 1 });
    }
  });

  it('Stoicism heals the nexus at the start of the turn', () => {
    const state = game();
    putInBack(state, 'stoicism', 0);
    state.players.p1.health = 15;
    state.turnStartPending = true;
    const events: GameEvent[] = [];
    drainTriggers(state, events);
    expect(state.players.p1.health).toBe(16);
  });

  it('Existentialism gives the champion +1/+1', () => {
    const state = game();
    putInBack(state, 'existentialism', 0);
    const champion = putInRow(state, 'marx', 1);
    const def = CARD_CATALOG.marx!;
    expect(statsOf(state, champion, def)).toEqual({ attack: 3, health: 5 });
  });

  it('Sola Fide grants a temporary buff and Barrier', () => {
    const state = game();
    const unit = putInRow(state, 'capital', 0);
    const spell = putInHand(state, 'sola-fide');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
      targetId: unit.instanceId,
    }));
    const target = next.row[0]!;
    const def = CARD_CATALOG.capital!;
    expect(statsOf(next, target, def)).toEqual({ attack: 4, health: 6 });
    expect(hasKeyword(next, target, def, 'barrier')).toBe(true);
  });

  it('Here I Stand buffs all allied units and grants Overwhelm', () => {
    const state = game();
    putInRow(state, 'lecturer', 0);
    putInRow(state, 'capital', 1);
    const spell = putInHand(state, 'here-i-stand');
    const next = applied(applyAction(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardId: spell.instanceId,
    }));
    const lecturerDef = CARD_CATALOG.lecturer!;
    const capitalDef = CARD_CATALOG.capital!;
    expect(statsOf(next, next.row[0]!, lecturerDef)).toEqual({ attack: 4, health: 4 });
    expect(statsOf(next, next.row[1]!, capitalDef)).toEqual({ attack: 5, health: 6 });
    expect(hasKeyword(next, next.row[0]!, lecturerDef, 'overwhelm')).toBe(true);
  });
});
