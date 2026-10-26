import { applyAction, createGame, getLegalActions } from '../src/engine';
import type { Action, GameState } from '../src/engine';
import { TEST_CATALOG, testArguments } from '../src/engine/fixtures';
import { nextRandom } from '../src/engine/rng';

const iterations = 10000;

function newGame(seed: number): GameState {
  return createGame({
    seed,
    catalog: TEST_CATALOG,
    decks: { p1: testArguments(), p2: testArguments() },
    champions: { p1: 'test-champion', p2: 'test-champion-2' },
  });
}

function mulliganBoth(state: GameState): GameState {
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

let state = mulliganBoth(newGame(1));
let rng = 12345;
let games = 1;
const durations: number[] = [];

while (durations.length < iterations) {
  if (state.phase === 'over') {
    state = mulliganBoth(newGame(games + 1));
    games += 1;
    continue;
  }

  const legal = getLegalActions(state, state.priority);
  if (legal.length === 0) {
    state = mulliganBoth(newGame(games + 1));
    games += 1;
    continue;
  }

  const next = nextRandom(rng);
  rng = next.state;
  const action = legal[Math.floor(next.value * legal.length)] as Action;
  const start = performance.now();
  const result = applyAction(state, action);
  durations.push(performance.now() - start);
  if (!result.ok) {
    throw new Error(result.error);
  }
  state = result.state;
}

durations.sort((left, right) => left - right);
const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
console.log(`actions=${durations.length} games=${games} p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms`);
