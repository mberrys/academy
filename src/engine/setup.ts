import { shuffle } from './rng';
import { BACK_SLOTS, ROW_SLOTS, START_HEALTH } from './types';
import type { CardDef, CardInstance, GameState, PlayerId, PlayerState } from './types';

export type CreateGameOptions = {
  seed: number;
  catalog: Record<string, CardDef>;
  decks: Record<PlayerId, string[]>;
  champions: Record<PlayerId, string>;
  firstPlayer?: PlayerId;
};

export function createGame(options: CreateGameOptions): GameState {
  const firstPlayer = options.firstPlayer ?? 'p1';
  const secondPlayer = firstPlayer === 'p1' ? 'p2' : 'p1';
  let rngState = options.seed >>> 0;
  if (rngState === 0) {
    rngState = 1;
  }

  const players = {} as Record<PlayerId, PlayerState>;
  for (const player of ['p1', 'p2'] as const) {
    const championDef = options.catalog[options.champions[player]];
    if (!championDef || championDef.type !== 'champion') {
      throw new Error(`Champion ${options.champions[player]} is missing or is not a champion`);
    }

    const instances = options.decks[player].map((defId, index): CardInstance => ({
      instanceId: `${player}-${index}`,
      defId,
      owner: player,
      zone: 'deck',
      damage: 0,
      costDelta: 0,
      grantedKeywords: [],
      isCopy: false,
      enteredRound: 0,
    }));

    const shuffled = shuffle(instances, rngState);
    rngState = shuffled.state;
    const deck = shuffled.items;
    const handSize = player === firstPlayer ? 4 : 5;
    const hand = deck.splice(0, handSize);
    for (const card of hand) {
      card.zone = 'hand';
    }

    players[player] = {
      id: player,
      health: START_HEALTH,
      energy: 0,
      spellMana: 0,
      deck,
      hand,
      discard: [],
      playedThisRound: [],
      championDefId: options.champions[player],
      championProgress: 0,
      championLevel: 1,
      mulliganUsed: false,
    };
  }

  const second = players[secondPlayer];
  second.health = START_HEALTH;

  return {
    seed: options.seed,
    rngState,
    round: 0,
    phase: 'mulligan',
    attackToken: firstPlayer,
    activePlayer: firstPlayer,
    priority: firstPlayer,
    consecutivePasses: 0,
    players,
    row: Array.from({ length: ROW_SLOTS }, () => null),
    back: {
      p1: Array.from({ length: BACK_SLOTS }, () => null),
      p2: Array.from({ length: BACK_SLOTS }, () => null),
    },
    winner: null,
    events: [{ type: 'gameStarted', seed: options.seed }],
    catalog: options.catalog,
  };
}
