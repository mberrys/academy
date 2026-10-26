import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/setup';
import { CARD_CATALOG, DECKS } from '../cards';
import { chooseAction } from './choose';
import { playAiGame } from './selfplay';
import type { GameState, PlayerId } from '../engine/types';

function fixedGame(): GameState {
  const state = createGame({
    seed: 23,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS.marx, p2: DECKS.lacan },
    champions: { p1: 'marx', p2: 'lacan' },
  });
  state.phase = 'actions';
  state.round = 5;
  state.activePlayer = 'p1';
  state.priority = 'p1';
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;
  return state;
}

describe('ai', () => {
  it('plays 200 self play games and beats the random baseline', () => {
    let wins = 0;
    const decisionTimes: number[] = [];
    let maxGameMs = 0;

    for (let seed = 1; seed <= 200; seed += 1) {
      const heuristicPlayer: PlayerId = seed % 2 === 0 ? 'p1' : 'p2';
      const result = playAiGame(seed, heuristicPlayer);

      expect(result.winner).not.toBeNull();
      expect(result.rounds).toBeLessThanOrEqual(20);
      if (result.winner === heuristicPlayer) {
        wins += 1;
      }

      decisionTimes.push(...result.decisionTimes);
      maxGameMs = Math.max(maxGameMs, result.gameMs);
    }

    decisionTimes.sort((left, right) => left - right);
    const p95 = decisionTimes[Math.floor(decisionTimes.length * 0.95)] ?? 0;
    const rate = wins / 200;

    expect(rate).toBeGreaterThanOrEqual(0.55);
    expect(rate).toBeLessThanOrEqual(0.95);
    expect(p95).toBeLessThan(10);
    expect(maxGameMs).toBeLessThan(2000);
  }, 180_000);

  it('does not mutate state and is deterministic', () => {
    const state = fixedGame();
    const before = JSON.stringify(state);
    const first = chooseAction(state, 'p1', 42);
    const second = chooseAction(state, 'p1', 42);

    expect(JSON.stringify(state)).toBe(before);
    expect(first).toEqual(second);
  });
});
