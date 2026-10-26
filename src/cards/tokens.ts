import type { CardDef } from '../engine/types';

export const TOKEN_CARDS: CardDef[] = [
  {
    id: 'time-bomb',
    name: 'Time Bomb',
    type: 'argument',
    cost: 2,
    text: 'When you play me, at the start of your next turn, deal 4 damage to the strongest enemy unit. If the enemy controls no units, deal 2 damage to the enemy nexus.',
    effects: [{ trigger: 'onPlay', effect: 'timeBomb' }],
  },
  {
    id: 'congregant',
    name: 'Congregant',
    type: 'token',
    cost: 0,
    attack: 1,
    health: 1,
  },
];
