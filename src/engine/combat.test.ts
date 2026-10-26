import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { testArguments, TEST_CATALOG } from './fixtures';
import { createGame } from './setup';
import type {
  ActionResult,
  AttackAssignment,
  CardInstance,
  GameState,
  InterceptorAssignment,
  PlayerId,
} from './types';

let instanceCounter = 0;

function fresh(): GameState {
  return createGame({
    seed: 1,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function ok(result: ActionResult): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

function ready(): GameState {
  let state = fresh();
  state = ok(applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] }));
  state = ok(applyAction(state, { type: 'MULLIGAN', player: 'p2', cardIds: [] }));
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;
  return state;
}

function unit(state: GameState, defId: string, owner: PlayerId, slot: number, enteredRound = 0): CardInstance {
  const card: CardInstance = {
    instanceId: `${owner}-test-${instanceCounter}`,
    defId,
    owner,
    zone: 'row',
    slot,
    damage: 0,
    buffs: [],
    keywordGrants: [],
    costDelta: 0,
    costDeltaExpiresRound: null,
    isCopy: false,
    barrierConsumed: false,
    enteredRound,
  };
  instanceCounter += 1;
  state.row[slot] = card;
  return card;
}

function declare(state: GameState, assignments: AttackAssignment[]): GameState {
  return ok(applyAction(state, { type: 'DECLARE_ATTACK', player: 'p1', assignments }));
}

function assign(state: GameState, interceptors: InterceptorAssignment[] = []): GameState {
  return ok(applyAction(state, { type: 'ASSIGN_INTERCEPTORS', player: 'p2', interceptors }));
}

describe('combat', () => {
  it('deals unblocked damage to the nexus', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }]);
    expect(state.priority).toBe('p2');
    expect(state.combat).not.toBeNull();
    state = assign(state);
    expect(state.players.p2.health).toBe(18);
    expect(state.combat).toBeNull();
    expect(state.priority).toBe('p2');
  });

  it('intercepts from an adjacent slot', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    const target = unit(state, 'test-thinker', 'p2', 1);
    const blocker = unit(state, 'test-thinker', 'p2', 2);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    state = assign(state, [{ attackerId: attacker.instanceId, blockerId: blocker.instanceId }]);
    expect(state.row[0]).toBeNull();
    expect(state.row[1]?.instanceId).toBe(target.instanceId);
    expect(state.row[2]).toBeNull();
  });

  it('refuses interception from a non adjacent slot', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    const target = unit(state, 'test-thinker', 'p2', 1);
    const blocker = unit(state, 'test-thinker', 'p2', 3);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    expect(applyAction(state, {
      type: 'ASSIGN_INTERCEPTORS',
      player: 'p2',
      interceptors: [{ attackerId: attacker.instanceId, blockerId: blocker.instanceId }],
    })).toEqual({ ok: false, error: 'invalid-interceptor' });
  });

  it('refuses two interceptors for one attacker', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    const target = unit(state, 'test-thinker', 'p2', 1);
    const blocker = unit(state, 'test-thinker', 'p2', 2);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    expect(applyAction(state, {
      type: 'ASSIGN_INTERCEPTORS',
      player: 'p2',
      interceptors: [
        { attackerId: attacker.instanceId, blockerId: blocker.instanceId },
        { attackerId: attacker.instanceId, blockerId: blocker.instanceId },
      ],
    })).toEqual({ ok: false, error: 'invalid-interceptor' });
  });

  it('strikes first with quick attack', () => {
    let state = ready();
    const attacker = unit(state, 'test-quick', 'p1', 0);
    const target = unit(state, 'test-thinker', 'p2', 1);
    const blocker = unit(state, 'test-thinker', 'p2', 2);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    state = assign(state, [{ attackerId: attacker.instanceId, blockerId: blocker.instanceId }]);
    expect(state.row[2]).toBeNull();
    expect(state.row[0]).not.toBeNull();
    expect(state.row[0]?.damage).toBe(0);
  });

  it('absorbs one hit with barrier', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    const target = unit(state, 'test-barrier', 'p2', 1);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    state = assign(state);
    expect(state.row[1]?.damage).toBe(0);
    expect(state.row[1]?.barrierConsumed).toBe(true);
    expect(state.row[0]?.damage).toBe(1);
  });

  it('reduces damage by one with tough', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    const target = unit(state, 'test-tough', 'p2', 1);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    state = assign(state);
    expect(state.row[1]?.damage).toBe(1);
    expect(state.row[0]?.damage).toBe(0);
  });

  it('spills excess damage to the nexus with overwhelm', () => {
    let state = ready();
    const attacker = unit(state, 'test-overwhelm', 'p1', 0);
    const target = unit(state, 'test-thinker', 'p2', 1);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: target.instanceId } }]);
    state = assign(state);
    expect(state.players.p2.health).toBe(18);
    expect(state.row[1]).toBeNull();
    expect(state.row[0]?.damage).toBe(2);
  });

  it('redirects a dead target to the nexus', () => {
    let state = ready();
    const first = unit(state, 'test-thinker', 'p1', 0);
    const second = unit(state, 'test-thinker', 'p1', 2);
    const target = unit(state, 'test-token', 'p2', 1);
    state = declare(state, [
      { attackerId: first.instanceId, target: { kind: 'unit', instanceId: target.instanceId } },
      { attackerId: second.instanceId, target: { kind: 'unit', instanceId: target.instanceId } },
    ]);
    state = assign(state);
    expect(state.players.p2.health).toBe(18);
    expect(state.row[1]).toBeNull();
  });

  it('refuses an attack from a unit that entered this round', () => {
    const state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0, 1);
    expect(applyAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }],
    })).toEqual({ ok: false, error: 'invalid-attacker' });
  });

  it('refuses a second attack in the same round', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }]);
    state = assign(state);
    state = ok(applyAction(state, { type: 'PASS', player: 'p2' }));
    expect(applyAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }],
    })).toEqual({ ok: false, error: 'already-attacked' });
  });

  it('refuses any action while interceptors are pending', () => {
    let state = ready();
    const attacker = unit(state, 'test-thinker', 'p1', 0);
    state = declare(state, [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }]);
    expect(applyAction(state, { type: 'PASS', player: 'p2' })).toEqual({ ok: false, error: 'combat-pending' });
  });

  it('refuses an attack from the player without the attack token', () => {
    let state = ready();
    unit(state, 'test-thinker', 'p2', 0);
    state = ok(applyAction(state, { type: 'PASS', player: 'p1' }));
    expect(applyAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p2',
      assignments: [{ attackerId: 'missing', target: { kind: 'nexus' } }],
    })).toEqual({ ok: false, error: 'not-your-turn' });
  });
});
