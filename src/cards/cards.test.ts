import { describe, expect, it } from 'vitest';
import { ALL_CARDS, CARD_CATALOG, CHAMPIONS, DECKS } from './index';
import { validateCatalog, validateDeck } from './validate';
import type { ChampionId } from './decks';

const CHAMPION_IDS: ChampionId[] = ['marx', 'lacan', 'luther'];

describe('card catalog', () => {
  it('has no validation problems', () => {
    expect(validateCatalog()).toEqual([]);
  });

  it('has 45 cards', () => {
    expect(ALL_CARDS).toHaveLength(45);
  });

  it('has 45 catalog entries', () => {
    expect(Object.keys(CARD_CATALOG)).toHaveLength(45);
  });

  it('has six champion rows', () => {
    expect(CHAMPIONS).toHaveLength(6);
  });
});

describe('decklists', () => {
  for (const id of CHAMPION_IDS) {
    it(`${id} is legal`, () => {
      expect(validateDeck(DECKS[id], id)).toEqual([]);
    });

    it(`${id} has 40 cards`, () => {
      expect(DECKS[id]).toHaveLength(40);
    });
  }
});
