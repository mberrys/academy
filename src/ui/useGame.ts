import { useCallback, useEffect, useReducer } from 'react';
import { applyAction, createGame } from '../engine';
import { chooseAction } from '../ai/choose';
import { CARD_CATALOG, DECKS } from '../cards';
import type { ChampionId } from '../cards';
import type { Action, ActionError, GameState } from '../engine/types';

export type Screen = 'select' | 'match' | 'result';

type GameStore = {
  game: GameState | null;
  screen: Screen;
  champion: ChampionId | null;
  error: ActionError | null;
};

type GameAction =
  | { type: 'start'; champion: ChampionId; seed: number; aiChampion: ChampionId }
  | { type: 'play'; action: Action }
  | { type: 'reset' };

const INITIAL: GameStore = {
  game: null,
  screen: 'select',
  champion: null,
  error: null,
};

const CHAMPION_IDS: ChampionId[] = ['marx', 'lacan', 'luther'];

function startGame(champion: ChampionId, seed: number, aiChampion: ChampionId): GameState {
  let game = createGame({
    seed,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS[champion], p2: DECKS[aiChampion] },
    champions: { p1: champion, p2: aiChampion },
  });

  const p1 = applyAction(game, { type: 'MULLIGAN', player: 'p1', cardIds: [] });
  if (p1.ok) {
    game = p1.state;
  }
  const p2 = applyAction(game, { type: 'MULLIGAN', player: 'p2', cardIds: [] });
  if (p2.ok) {
    game = p2.state;
  }
  return game;
}

function reducer(state: GameStore, action: GameAction): GameStore {
  switch (action.type) {
    case 'start':
      return {
        game: startGame(action.champion, action.seed, action.aiChampion),
        screen: 'match',
        champion: action.champion,
        error: null,
      };
    case 'play': {
      if (!state.game) {
        return state;
      }
      const result = applyAction(state.game, action.action);
      if (!result.ok) {
        return { ...state, error: result.error };
      }
      return {
        ...state,
        game: result.state,
        screen: result.state.phase === 'over' ? 'result' : 'match',
        error: null,
      };
    }
    case 'reset':
      return INITIAL;
  }
}

export function useGame() {
  const [store, dispatch] = useReducer(reducer, INITIAL);

  const play = useCallback((action: Action) => {
    dispatch({ type: 'play', action });
  }, []);

  const start = useCallback((champion: ChampionId) => {
    const seed = (Math.floor(Math.random() * 0xffffffff) || 1) >>> 0;
    const others = CHAMPION_IDS.filter((id) => id !== champion);
    const aiChampion = others[seed % others.length] ?? others[0]!;
    dispatch({ type: 'start', champion, seed, aiChampion });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  useEffect(() => {
    if (!store.game || store.screen !== 'match') {
      return;
    }
    const game = store.game;
    if (game.phase !== 'actions') {
      return;
    }
    const aiTurn = game.combat ? game.combat.defender === 'p2' : game.priority === 'p2';
    if (!aiTurn) {
      return;
    }

    const timer = window.setTimeout(() => {
      const start = performance.now();
      try {
        play(chooseAction(game, 'p2'));
      } catch {
        play({ type: 'PASS', player: 'p2' });
      }
      window.requestAnimationFrame(() => {
        performance.measure('ai-render', { start, end: performance.now() });
      });
    }, 420);

    return () => window.clearTimeout(timer);
  }, [store.game, store.screen, play]);

  return { ...store, start, play, reset };
}
