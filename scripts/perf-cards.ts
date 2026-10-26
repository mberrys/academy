import { applyAction, createGame, getLegalActions } from '../src/engine';
import type { Action, GameState } from '../src/engine';
import { nextRandom } from '../src/engine/rng';
import { CARD_CATALOG, DECKS } from '../src/cards';
import type { ChampionId } from '../src/cards';

const MATCHUPS: Array<[ChampionId, ChampionId]> = [
  ['marx', 'lacan'],
  ['lacan', 'luther'],
  ['luther', 'marx'],
];

function requireOk(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

function mulliganed(state: GameState): GameState {
  const p1 = applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] });
  const p2 = applyAction(requireOk(p1), { type: 'MULLIGAN', player: 'p2', cardIds: [] });
  return requireOk(p2);
}

function runGame(seed: number, policy: 'first' | 'random'): GameState {
  const matchup = MATCHUPS[seed % MATCHUPS.length]!;
  const [p1, p2] = matchup;
  let state = mulliganed(createGame({
    seed,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS[p1], p2: DECKS[p2] },
    champions: { p1, p2 },
  }));
  let rng = (seed ^ 0x9e3779b9) >>> 0;
  let actions = 0;

  while (state.phase !== 'over' && actions < 1000) {
    const player = state.phase === 'mulligan'
      ? (state.players.p1.mulliganUsed ? 'p2' : 'p1')
      : state.priority;
    const legal = getLegalActions(state, player);
    if (legal.length === 0) {
      break;
    }

    let action: Action;
    if (policy === 'first') {
      action = legal[0]!;
    } else {
      const next = nextRandom(rng);
      rng = next.state;
      action = legal[Math.floor(next.value * legal.length)]!;
    }

    state = requireOk(applyAction(state, action));
    actions += 1;
  }

  return state;
}

const started = performance.now();
const scripted = runGame(3, 'first');
const scriptedMs = performance.now() - started;
console.log(
  `scripted_ms=${scriptedMs.toFixed(2)} round=${scripted.round} phase=${scripted.phase} winner=${scripted.winner ?? 'none'}`,
);

const wins: Record<string, number> = { p1: 0, p2: 0, draw: 0 };
let crashes = 0;
let unfinished = 0;

for (let seed = 1; seed <= 1000; seed += 1) {
  try {
    const state = runGame(seed, 'random');
    if (state.phase !== 'over' || !state.winner) {
      unfinished += 1;
      continue;
    }
    wins[state.winner] = (wins[state.winner] ?? 0) + 1;
  } catch (error) {
    crashes += 1;
    if (crashes <= 5) {
      console.error(`seed ${seed}: ${String(error)}`);
    }
  }
}

console.log(
  `games=1000 crashes=${crashes} unfinished=${unfinished} p1=${wins.p1} p2=${wins.p2} draws=${wins.draw}`,
);
