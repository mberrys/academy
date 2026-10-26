import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchScreen } from './App';
import { createGame } from '../engine/setup';
import { createInstance } from '../engine/placement';
import { CARD_CATALOG, DECKS } from '../cards';
import type { CardInstance, GameState } from '../engine/types';

function fixture(): GameState {
  const state = createGame({
    seed: 5,
    catalog: CARD_CATALOG,
    decks: { p1: DECKS.marx, p2: DECKS.lacan },
    champions: { p1: 'marx', p2: 'lacan' },
  });

  state.phase = 'actions';
  state.round = 7;
  state.attackToken = 'p1';
  state.activePlayer = 'p1';
  state.priority = 'p1';
  state.turnStartPending = false;
  state.players.p1.health = 14;
  state.players.p1.energy = 6;
  state.players.p1.spellMana = 2;
  state.players.p1.hand = [];
  state.players.p2.hand = [];

  const hand = (defId: string): CardInstance => {
    const card = createInstance(state, defId, 'p1', 'hand');
    state.players.p1.hand.push(card);
    return card;
  };
  hand('dialectic');
  hand('rebuttal');

  const champion = createInstance(state, 'marx', 'p1', 'row');
  champion.slot = 0;
  champion.enteredRound = 1;
  state.row[0] = champion;

  return state;
}

describe('MatchScreen', () => {
  it('renders the hand, the row, the nexus, and the energy', () => {
    const state = fixture();
    const html = renderToStaticMarkup(
      <MatchScreen state={state} onAction={() => {}} error={null} />,
    );

    expect(html).toContain('Dialectic');
    expect(html).toContain('Rebuttal');
    expect(html).toContain('Karl Marx');
    expect(html).toContain('14 nexus health');
    expect(html).toContain('6 energy');
    expect(html).toContain('Round 7');
  });
});
