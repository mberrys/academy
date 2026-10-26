import { adjacentSlots } from './zones';
import type { CardDef, CardInstance, GameEvent, GameState, Keyword } from './types';

export function hasKeyword(card: CardInstance, def: CardDef, keyword: Keyword): boolean {
  const printed = def.keywords?.includes(keyword) ?? false;
  const granted = card.grantedKeywords.includes(keyword);
  if (keyword === 'barrier') {
    return (printed || granted) && !card.barrierConsumed;
  }
  return printed || granted;
}

export function applyChallenger(state: GameState, unit: CardInstance, def: CardDef): GameEvent[] {
  if (!hasKeyword(unit, def, 'challenger') || unit.slot === undefined) {
    return [];
  }

  const empty = adjacentSlots(unit.slot).filter((slot) => !state.row[slot]);
  if (empty.length === 0) {
    return [];
  }

  const enemies = state.row.filter(
    (card): card is CardInstance => card !== null && card.owner !== unit.owner && card.slot !== undefined,
  );
  if (enemies.length === 0) {
    return [];
  }

  const target = [...enemies].sort((left, right) => {
    const leftSlot = left.slot ?? 0;
    const rightSlot = right.slot ?? 0;
    const distance = Math.abs(leftSlot - unit.slot!) - Math.abs(rightSlot - unit.slot!);
    return distance !== 0 ? distance : leftSlot - rightSlot;
  })[0];
  const destination = empty[0];

  if (!target || target.slot === undefined || destination === undefined) {
    return [];
  }

  state.row[target.slot] = null;
  state.row[destination] = target;
  target.slot = destination;
  return [{ type: 'challenged', challengerId: unit.instanceId, targetId: target.instanceId, slot: destination }];
}
