import type { CardDef } from '../engine/types';

export const SCHOOLS: CardDef[] = [
  {
    id: 'historical-materialism',
    name: 'Historical Materialism',
    type: 'school',
    cost: 2,
    text: 'When one of your units dies, your next Argument this round costs 1 less. This does not stack.',
    effects: [{ trigger: 'onAllyDeath', effect: 'discountArgument' }],
  },
  {
    id: 'psychoanalysis',
    name: 'Psychoanalysis',
    type: 'school',
    cost: 2,
    text: 'The second Argument you play each round costs 1 less.',
  },
  {
    id: 'reformation-theology',
    name: 'Reformation Theology',
    type: 'school',
    cost: 2,
    text: 'When you summon a follower, give it +1/+0.',
    effects: [{ trigger: 'onAllySummon', effect: 'buffFollower' }],
  },
  {
    id: 'stoicism',
    name: 'Stoicism',
    type: 'school',
    cost: 2,
    text: 'At the start of your turn, heal your nexus 1.',
    effects: [{ trigger: 'turnStart', effect: 'healNexusOne' }],
  },
  {
    id: 'empiricism',
    name: 'Empiricism',
    type: 'school',
    cost: 2,
    text: 'The first time each round you play an Argument after a Thinker, draw 1.',
    effects: [{ trigger: 'onArgumentAfterThinker', effect: 'drawOne', oncePerRound: true }],
  },
  {
    id: 'existentialism',
    name: 'Existentialism',
    type: 'school',
    cost: 2,
    text: 'Your champion has +1/+1.',
    aura: { kind: 'championBuff', attack: 1, health: 1 },
  },
];
