import { applyAction, createGame, getLegalActions, hashState } from '../src/engine';
import type { Action, CardInstance, GameState, PlayerId } from '../src/engine';
import { nextRandom } from '../src/engine/rng';
import { TEST_CATALOG, testArguments } from '../src/engine/fixtures';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? String(process.argv[index + 1]) : fallback;
}

const seed = Number(arg('--seed', '1'));
const maxRounds = Number(arg('--rounds', '20'));

function newGame(gameSeed: number): GameState {
  return createGame({
    seed: gameSeed,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function mulliganPhasePlayer(state: GameState): PlayerId {
  return state.players.p1.mulliganUsed ? 'p2' : 'p1';
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

function runCombatScenario(): void {
  const state = mulliganed(newGame(3));
  state.row = Array.from({ length: 6 }, () => null);
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;

  const quick = makeUnit('p1-quick', 'test-quick', 'p1', 0);
  const second = makeUnit('p1-thinker', 'test-thinker', 'p1', 4);
  const target = makeUnit('p2-target', 'test-thinker', 'p2', 1);
  const blocker = makeUnit('p2-blocker', 'test-thinker', 'p2', 2);
  state.row[0] = quick;
  state.row[1] = target;
  state.row[2] = blocker;
  state.row[4] = second;

  const declared = applyAction(state, {
    type: 'DECLARE_ATTACK',
    player: 'p1',
    assignments: [
      { attackerId: quick.instanceId, target: { kind: 'unit', instanceId: target.instanceId } },
      { attackerId: second.instanceId, target: { kind: 'nexus' } },
    ],
  });
  if (!declared.ok) {
    throw new Error(declared.error);
  }

  const resolved = applyAction(declared.state, {
    type: 'ASSIGN_INTERCEPTORS',
    player: 'p2',
    interceptors: [{ attackerId: quick.instanceId, blockerId: blocker.instanceId }],
  });
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  for (const event of [...declared.events, ...resolved.events]) {
    console.log(JSON.stringify(event));
  }
  console.log(`p2_health=${resolved.state.players.p2.health} quick_damage=${resolved.state.row[0]?.damage ?? 'gone'}`);
}

if (process.argv.includes('--combat')) {
  runCombatScenario();
  process.exit(0);
}

let state = newGame(seed);
let rng = seed >>> 0;
let actions = 0;
let lastRound = 0;

while (state.phase !== 'over' && state.round <= maxRounds && actions < 500) {
  const player = state.phase === 'mulligan' ? mulliganPhasePlayer(state) : state.priority;
  const legal = getLegalActions(state, player);
  if (legal.length === 0) {
    break;
  }
  const next = nextRandom(rng);
  rng = next.state;
  const action = legal[Math.floor(next.value * legal.length)] as Action;
  const result = applyAction(state, action);
  if (!result.ok) {
    throw new Error(`Illegal action ${action.type}: ${result.error}`);
  }
  state = result.state;
  actions += 1;
  if (state.round !== lastRound) {
    lastRound = state.round;
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    console.log(`round ${state.round} p1=${p1.health}/${p1.energy} p2=${p2.health}/${p2.energy}`);
  }
}

console.log(
  `seed=${seed} round=${state.round} phase=${state.phase} winner=${state.winner ?? 'none'} actions=${actions} hash=${hashState(state)}`,
);

