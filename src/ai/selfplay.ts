import { applyAction, createGame } from '../engine';
import { CARD_CATALOG, DECKS } from '../cards';
import { chooseAction } from './choose';
import { randomAction } from './random';
import type { Action, PlayerId } from '../engine/types';
import type { ChampionId } from '../cards';

const MATCHUPS: Array<[ChampionId, ChampionId]> = [
  ['marx', 'lacan'],
  ['lacan', 'luther'],
  ['luther', 'marx'],
];

export type GameResult = {
  winner: PlayerId | 'draw' | null;
  rounds: number;
  actions: number;
  decisionTimes: number[];
  gameMs: number;
};

export function playAiGame(seed: number, heuristicPlayer: PlayerId): GameResult {
  const matchup = MATCHUPS[seed % MATCHUPS.length]!;
  const [p1, p2] = matchup;
  let state = createGame({
    seed,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS[p1], p2: DECKS[p2] },
    champions: { p1, p2 },
  });

  let rng = (seed ^ 0x9e3779b9) >>> 0;
  let actions = 0;
  const decisionTimes: number[] = [];
  const started = performance.now();

  while (state.phase !== 'over' && actions < 2000) {
    const player = state.phase === 'mulligan'
      ? (state.players.p1.mulliganUsed ? 'p2' : 'p1')
      : state.priority;

    const decisionStart = performance.now();
    let action: Action;
    if (player === heuristicPlayer) {
      action = chooseAction(state, player, seed ^ actions);
    } else {
      const picked = randomAction(state, player, rng);
      action = picked.action;
      rng = picked.rngState;
    }
    decisionTimes.push(performance.now() - decisionStart);

    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(`illegal ${action.type}: ${result.error}`);
    }
    state = result.state;
    actions += 1;
  }

  return {
    winner: state.winner,
    rounds: state.round,
    actions,
    decisionTimes,
    gameMs: performance.now() - started,
  };
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? String(process.argv[index + 1]) : fallback;
}

export function runSelfPlayCli(): void {
  const games = Number(arg('--games', '200'));
  const seed = Number(arg('--seed', '7'));

  let heuristicWins = 0;
  let randomWins = 0;
  let draws = 0;
  let unfinished = 0;
  let totalRounds = 0;
  let totalActions = 0;
  let maxGameMs = 0;
  const decisionTimes: number[] = [];

  for (let index = 0; index < games; index += 1) {
    const gameSeed = seed + index;
    const heuristicPlayer: PlayerId = gameSeed % 2 === 0 ? 'p1' : 'p2';
    const result = playAiGame(gameSeed, heuristicPlayer);

    if (result.winner === heuristicPlayer) {
      heuristicWins += 1;
    } else if (result.winner === 'draw') {
      draws += 1;
    } else if (result.winner === null) {
      unfinished += 1;
    } else {
      randomWins += 1;
    }

    totalRounds += result.rounds;
    totalActions += result.actions;
    maxGameMs = Math.max(maxGameMs, result.gameMs);
    decisionTimes.push(...result.decisionTimes);
  }

  decisionTimes.sort((left, right) => left - right);
  const p95 = decisionTimes[Math.floor(decisionTimes.length * 0.95)] ?? 0;
  const winRate = games > 0 ? (heuristicWins / games) * 100 : 0;

  console.log(
    `games=${games} heuristic_wins=${heuristicWins} random_wins=${randomWins} draws=${draws} unfinished=${unfinished}`,
  );
  console.log(
    `win_rate=${winRate.toFixed(1)} avg_rounds=${(totalRounds / games).toFixed(2)} avg_actions=${(totalActions / games).toFixed(2)}`,
  );
  console.log(`p95_decision_ms=${p95.toFixed(3)} max_game_ms=${maxGameMs.toFixed(2)}`);
}
