import { applyAction, createGame, getLegalActions, hashState } from '../src/engine';
import type { Action, GameState, PlayerId } from '../src/engine';
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

