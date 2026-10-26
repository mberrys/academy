import { CHAMPIONS } from './champions';
import { SCHOOLS } from './schools';
import { MARX_CARDS } from './marx';
import { LACAN_CARDS } from './lacan';
import { LUTHER_CARDS } from './luther';
import { NEUTRAL_CARDS } from './neutral';
import { TOKEN_CARDS } from './tokens';
import type { CardDef } from '../engine/types';

export const ALL_CARDS: CardDef[] = [
  ...CHAMPIONS,
  ...SCHOOLS,
  ...MARX_CARDS,
  ...LACAN_CARDS,
  ...LUTHER_CARDS,
  ...NEUTRAL_CARDS,
  ...TOKEN_CARDS,
];

export const CARD_CATALOG: Record<string, CardDef> = Object.fromEntries(
  ALL_CARDS.map((card) => [card.id, card]),
);

export { CHAMPIONS, SCHOOLS, MARX_CARDS, LACAN_CARDS, LUTHER_CARDS, NEUTRAL_CARDS, TOKEN_CARDS };
export { DECKS } from './decks';
export type { ChampionId } from './decks';
