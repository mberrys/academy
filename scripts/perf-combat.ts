import { applyAction, createGame } from '../src/engine';
import type { CardInstance, GameState, PlayerId } from '../src/engine';
import { TEST_CATALOG, testArguments } from '../src/engine/fixtures';

function newGame(seed: number): GameState {
  return createGame({
    seed,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function mulliganed(state: GameState): GameState {
  const p1 = applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] });
  if (!p1.ok) {
    throw new Error(p1.error);
  }
  const p2 = applyAction(p1.state, { type: 'MULLIGAN', player: 'p2', cardIds: [] });
  if (!p2.ok) {
    throw new Error(p2.error);
  }
  return p2.state;
}

function makeUnit(id: string, defId: string, owner: PlayerId, slot: number): CardInstance {
  return {
    instanceId: id,
    defId,
    owner,
    zone: 'row',
    slot,
    damage: 0,
    costDelta: 0,
    grantedKeywords: [],
    isCopy: false,
    barrierConsumed: false,
    enteredRound: 0,
  };
}

function scenario(seed: number): GameState {
  const state = mulliganed(newGame(seed));
  state.row = Array.from({ length: 6 }, () => null);
  state.row[0] = makeUnit('p1-quick', 'test-quick', 'p1', 0);
  state.row[1] = makeUnit('p2-target', 'test-thinker', 'p2', 1);
  state.row[2] = makeUnit('p2-blocker', 'test-thinker', 'p2', 2);
  state.row[4] = makeUnit('p1-thinker', 'test-thinker', 'p1', 4);
  return state;
}

const durations: number[] = [];

for (let index = 0; index < 1000; index += 1) {
  const state = scenario(index + 1);
  const start = performance.now();

  const declared = applyAction(state, {
    type: 'DECLARE_ATTACK',
    player: 'p1',
    assignments: [
      { attackerId: 'p1-quick', target: { kind: 'unit', instanceId: 'p2-target' } },
      { attackerId: 'p1-thinker', target: { kind: 'nexus' } },
    ],
  });
  if (!declared.ok) {
    throw new Error(declared.error);
  }

  const resolved = applyAction(declared.state, {
    type: 'ASSIGN_INTERCEPTORS',
    player: 'p2',
    interceptors: [{ attackerId: 'p1-quick', blockerId: 'p2-blocker' }],
  });
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  durations.push(performance.now() - start);
}

durations.sort((left, right) => left - right);
const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
console.log(`combats=${durations.length} p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms`);
