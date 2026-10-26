import { applyAction, createGame, createInstance, hashState } from '../src/engine';
import type { CardInstance, GameEvent, GameState, PlayerId } from '../src/engine';
import { CARD_CATALOG, DECKS } from '../src/cards';
import type { ChampionId } from '../src/cards';

const OPPONENT: Record<ChampionId, ChampionId> = {
  marx: 'lacan',
  lacan: 'luther',
  luther: 'marx',
};

const LEVEL_TWO_ATTACK: Record<ChampionId, number> = {
  marx: 4,
  lacan: 3,
  luther: 2,
};

function requireOk(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

function log(events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === 'leveledUp' || event.type === 'delayedResolved' || event.type === 'gameOver') {
      console.log(JSON.stringify(event));
    }
  }
}

function mulliganed(state: GameState): GameState {
  const p1 = applyAction(state, { type: 'MULLIGAN', player: 'p1', cardIds: [] });
  const p2 = applyAction(requireOk(p1), { type: 'MULLIGAN', player: 'p2', cardIds: [] });
  return requireOk(p2);
}

function newGame(seed: number, champion: ChampionId): GameState {
  return createGame({
    seed,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS[champion], p2: DECKS[OPPONENT[champion]] },
    champions: { p1: champion, p2: OPPONENT[champion] },
  });
}

function place(
  state: GameState,
  defId: string,
  slot: number,
  player: PlayerId = 'p1',
): CardInstance {
  const card = createInstance(state, defId, player, 'row');
  card.slot = slot;
  card.enteredRound = 1;
  state.row[slot] = card;
  return card;
}

function passBoth(state: GameState): GameState {
  const first = applyAction(state, { type: 'PASS', player: state.priority });
  log(first.ok ? first.events : []);
  const afterFirst = requireOk(first);
  const second = applyAction(afterFirst, { type: 'PASS', player: afterFirst.priority });
  log(second.ok ? second.events : []);
  return requireOk(second);
}

function finishAggro(state: GameState, championCard: CardInstance, damage: number): GameState {
  state.players.p2.health = damage;
  state.attackToken = 'p1';
  state.activePlayer = 'p1';
  state.priority = 'p1';
  state.combat = null;
  state.combatUsed = false;
  state.turnStartPending = false;
  const declared = applyAction(state, {
    type: 'DECLARE_ATTACK',
    player: 'p1',
    assignments: [{ attackerId: championCard.instanceId, target: { kind: 'nexus' } }],
  });
  log(declared.ok ? declared.events : []);
  const resolved = applyAction(requireOk(declared), {
    type: 'ASSIGN_INTERCEPTORS',
    player: 'p2',
    interceptors: [],
  });
  log(resolved.ok ? resolved.events : []);
  return requireOk(resolved);
}

export function runChampionDemo(seed: number, choice: string): void {
  const champion = choice as ChampionId;
  if (!DECKS[champion] || !OPPONENT[champion]) {
    throw new Error(`unknown champion ${choice}`);
  }

  let state = mulliganed(newGame(seed, champion));
  state.row = Array.from({ length: 6 }, () => null);
  state.back = { p1: [null, null], p2: [null, null] };
  state.players.p1.hand = [];
  state.players.p2.hand = [];
  state.players.p1.energy = 10;
  state.players.p2.energy = 10;
  state.players.p1.spellMana = 0;
  state.players.p2.spellMana = 0;
  state.round = 5;
  state.attackToken = 'p1';
  state.activePlayer = 'p1';
  state.priority = 'p1';
  state.combat = null;
  state.combatUsed = false;
  state.turnStartPending = false;
  state.players.p2.health = 20;

  const championCard = place(state, champion, 0);
  console.log(`champion=${champion} seed=${seed} opponent=${OPPONENT[champion]}`);

  if (champion === 'marx') {
    for (let index = 0; index < 3; index += 1) {
      const bomb = createInstance(state, 'time-bomb', 'p1', 'hand');
      state.players.p1.hand = [bomb];
      state.players.p1.energy = 10;
      state.priority = 'p1';
      const played = applyAction(state, { type: 'PLAY_CARD', player: 'p1', cardId: bomb.instanceId });
      log(played.ok ? played.events : []);
      state = requireOk(played);
      state = passBoth(state);
      state = passBoth(state);
    }
    state = finishAggro(state, championCard, LEVEL_TWO_ATTACK.marx);
  } else if (champion === 'lacan') {
    const enemy = place(state, 'capital', 5, 'p2');
    for (let index = 0; index < 3; index += 1) {
      const copy = createInstance(state, 'rebuttal', 'p1', 'hand');
      copy.isCopy = true;
      state.players.p1.hand = [copy];
      state.players.p1.energy = 10;
      state.priority = 'p1';
      const played = applyAction(state, {
        type: 'PLAY_CARD',
        player: 'p1',
        cardId: copy.instanceId,
        targetId: enemy.instanceId,
      });
      log(played.ok ? played.events : []);
      state = requireOk(played);
      if (index < 2) {
        const passed = applyAction(state, { type: 'PASS', player: 'p2' });
        log(passed.ok ? passed.events : []);
        state = requireOk(passed);
      }
    }
    state = finishAggro(state, championCard, LEVEL_TWO_ATTACK.lacan);
  } else {
    state.players.p1.championProgress = 5;
    place(state, 'congregant', 1);
    place(state, 'congregant', 2);
    place(state, 'congregant', 3);
    state.players.p2.health = LEVEL_TWO_ATTACK.luther;
    state.attackToken = 'p1';
    state.activePlayer = 'p1';
    state.priority = 'p1';
    state.combat = null;
    state.combatUsed = false;
    state.turnStartPending = false;
    const declared = applyAction(state, {
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: [{ attackerId: championCard.instanceId, target: { kind: 'nexus' } }],
    });
    log(declared.ok ? declared.events : []);
    const resolved = applyAction(requireOk(declared), {
      type: 'ASSIGN_INTERCEPTORS',
      player: 'p2',
      interceptors: [],
    });
    log(resolved.ok ? resolved.events : []);
    state = requireOk(resolved);
  }

  console.log(
    `champion=${champion} seed=${seed} round=${state.round} phase=${state.phase} winner=${state.winner ?? 'none'} level=${state.players.p1.championLevel} hash=${hashState(state)}`,
  );
}
