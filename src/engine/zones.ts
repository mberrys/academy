import { BACK_SLOTS, ROW_SLOTS } from './types';
import type { CardInstance, GameState, PlayerId } from './types';

export function emptyRowSlots(state: GameState): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < ROW_SLOTS; slot += 1) {
    if (!state.row[slot]) {
      slots.push(slot);
    }
  }
  return slots;
}

export function emptyBackSlots(state: GameState, player: PlayerId): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < BACK_SLOTS; slot += 1) {
    if (!state.back[player][slot]) {
      slots.push(slot);
    }
  }
  return slots;
}

export function placeUnit(state: GameState, card: CardInstance, slot?: number): number {
  const target = slot ?? state.row.findIndex((entry) => entry === null);
  if (target < 0 || target >= state.row.length || state.row[target]) {
    throw new Error('Unit placement violated validation');
  }
  state.row[target] = card;
  card.zone = 'row';
  card.slot = target;
  card.enteredRound = state.round;
  return target;
}

export function placeSchool(state: GameState, player: PlayerId, card: CardInstance, slot?: number): number {
  const back = state.back[player];
  const target = slot ?? back.findIndex((entry) => entry === null);
  if (target < 0 || target >= back.length || back[target]) {
    throw new Error('School placement violated validation');
  }
  back[target] = card;
  card.zone = 'back';
  card.slot = target;
  return target;
}

export function findRowUnit(state: GameState, instanceId: string): CardInstance | undefined {
  return state.row.find((card) => card?.instanceId === instanceId) ?? undefined;
}

export function adjacentSlots(slot: number): number[] {
  return [slot - 1, slot + 1].filter((candidate) => candidate >= 0 && candidate < ROW_SLOTS);
}

export function removeFromRow(state: GameState, card: CardInstance): void {
  const index = state.row.findIndex((entry) => entry?.instanceId === card.instanceId);
  if (index < 0) {
    return;
  }
  state.row[index] = null;
  delete card.slot;
  card.zone = 'discard';
  state.players[card.owner].discard.push(card);
}
