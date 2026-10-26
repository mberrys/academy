import { statsOf } from './auras';
import { hasKeyword } from './keywords';
import { removeFromRow } from './zones';
import { otherPlayer } from './types';
import type { CardDef, CardInstance, GameEvent, GameState, PlayerId } from './types';

export function damageUnit(
  state: GameState,
  card: CardInstance,
  def: CardDef,
  amount: number,
  events: GameEvent[],
): { dealt: number; died: boolean; prevented: boolean } {
  if (amount <= 0) {
    return { dealt: 0, died: false, prevented: false };
  }

  if (hasKeyword(state, card, def, 'barrier')) {
    card.barrierConsumed = true;
    events.push({ type: 'damagedUnit', instanceId: card.instanceId, amount: 0, lethal: false });
    return { dealt: 0, died: false, prevented: true };
  }

  const dealt = hasKeyword(state, card, def, 'tough') ? Math.max(0, amount - 1) : amount;
  card.damage += dealt;
  const health = statsOf(state, card, def).health;
  const died = card.damage >= health;
  events.push({ type: 'damagedUnit', instanceId: card.instanceId, amount: dealt, lethal: died });

  if (died) {
    events.push({ type: 'died', instanceId: card.instanceId, defId: card.defId });
    removeFromRow(state, card);
    state.pendingDeaths.push(card);
  }

  return { dealt, died, prevented: false };
}

export function destroyUnit(state: GameState, card: CardInstance, events: GameEvent[]): void {
  events.push({ type: 'died', instanceId: card.instanceId, defId: card.defId });
  removeFromRow(state, card);
  state.pendingDeaths.push(card);
}

export function damageNexus(
  state: GameState,
  player: PlayerId,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) {
    return;
  }
  state.players[player].health -= amount;
  events.push({ type: 'damagedNexus', player, amount });
  if (state.players[player].health <= 0) {
    state.winner = otherPlayer(player);
    state.phase = 'over';
    events.push({ type: 'gameOver', winner: otherPlayer(player) });
  }
}

export function healNexus(
  state: GameState,
  player: PlayerId,
  amount: number,
  events: GameEvent[],
): void {
  const before = state.players[player].health;
  state.players[player].health = Math.min(20, before + amount);
  const healed = state.players[player].health - before;
  if (healed > 0) {
    events.push({ type: 'healed', player, amount: healed });
  }
}
