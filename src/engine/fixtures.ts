import type { CardDef } from './types';

export const TEST_CATALOG: Record<string, CardDef> = {
  'test-champion': { id: 'test-champion', name: 'Test Champion', type: 'champion', cost: 3, attack: 2, health: 4 },
  'test-champion-2': { id: 'test-champion-2', name: 'Test Champion Two', type: 'champion', cost: 3, attack: 2, health: 4 },
  'test-thinker': { id: 'test-thinker', name: 'Test Thinker', type: 'thinker', cost: 2, attack: 2, health: 2 },
  'test-big': { id: 'test-big', name: 'Test Big', type: 'thinker', cost: 6, attack: 5, health: 5 },
  'test-argument': { id: 'test-argument', name: 'Test Argument', type: 'argument', cost: 1 },
  'test-school': { id: 'test-school', name: 'Test School', type: 'school', cost: 2 },
  'test-school-2': { id: 'test-school-2', name: 'Test School Two', type: 'school', cost: 2 },
  'test-token': { id: 'test-token', name: 'Test Token', type: 'token', cost: 0, attack: 1, health: 1 },
};

export function deckOf(defId: string, count = 40): string[] {
  return Array.from({ length: count }, () => defId);
}

export function testDeck(championId = 'test-champion'): string[] {
  return [
    championId,
    championId,
    championId,
    'test-school',
    'test-school',
    ...Array.from({ length: 35 }, () => 'test-thinker'),
  ];
}

export function testArguments(): string[] {
  return deckOf('test-argument');
}

export function testUnits(): string[] {
  return deckOf('test-thinker');
}
