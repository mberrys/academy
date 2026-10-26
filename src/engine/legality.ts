import { BACK_SLOTS, ROW_SLOTS } from './types';
import type { Action, ActionError, CardDef, CardInstance, GameState, PlayerId } from './types';

export function costOf(card: CardInstance, def: CardDef): number {
  return Math.max(0, def.cost + card.costDelta);
}

function controlledChampion(state: GameState, player: PlayerId): CardInstance | undefined {
  return state.row.find((card) => {
    if (!card) {
      return false;
    }
    return card.owner === player && state.catalog[card.defId]?.type === 'champion';
  }) ?? undefined;
}

function controlledSchool(state: GameState, player: PlayerId, defId: string): CardInstance | undefined {
  return state.back[player].find((card) => card?.defId === defId) ?? undefined;
}

function emptyRowSlots(state: GameState): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < ROW_SLOTS; slot += 1) {
    if (!state.row[slot]) {
      slots.push(slot);
    }
  }
  return slots;
}

function emptyBackSlots(state: GameState, player: PlayerId): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < BACK_SLOTS; slot += 1) {
    if (!state.back[player][slot]) {
      slots.push(slot);
    }
  }
  return slots;
}

export function validateAction(state: GameState, action: Action): ActionError | null {
  if (state.phase === 'over') {
    return 'game-over';
  }

  if (action.type === 'MULLIGAN') {
    if (state.phase !== 'mulligan') {
      return 'wrong-phase';
    }
    const player = state.players[action.player];
    if (player.mulliganUsed) {
      return 'mulligan-used';
    }
    const unique = new Set(action.cardIds);
    if (unique.size !== action.cardIds.length) {
      return 'card-not-in-hand';
    }
    for (const cardId of action.cardIds) {
      if (!player.hand.some((card) => card.instanceId === cardId)) {
        return 'card-not-in-hand';
      }
    }
    return null;
  }

  if (state.phase !== 'actions') {
    return 'wrong-phase';
  }
  if (action.player !== state.priority) {
    return 'not-your-priority';
  }
  if (action.type === 'PASS') {
    return null;
  }

  const player = state.players[action.player];
  const card = player.hand.find((candidate) => candidate.instanceId === action.cardId);
  if (!card) {
    return 'card-not-in-hand';
  }
  const def = state.catalog[card.defId];
  if (!def) {
    return 'invalid-card';
  }

  const cost = costOf(card, def);
  if (def.type === 'argument') {
    return player.spellMana + player.energy >= cost ? null : 'insufficient-energy';
  }
  if (player.energy < cost) {
    return 'insufficient-energy';
  }

  if (def.type === 'school') {
    if (controlledSchool(state, action.player, def.id)) {
      return 'school-limit';
    }
    const slots = emptyBackSlots(state, action.player);
    if (slots.length === 0) {
      return 'back-zone-full';
    }
    if (action.slot !== undefined && !slots.includes(action.slot)) {
      return 'slot-occupied';
    }
    return null;
  }

  if (def.type === 'champion' && controlledChampion(state, action.player)) {
    return 'champion-limit';
  }
  const slots = emptyRowSlots(state);
  if (slots.length === 0) {
    return 'row-full';
  }
  if (action.slot !== undefined && !slots.includes(action.slot)) {
    return 'slot-occupied';
  }
  return null;
}

export function getLegalActions(state: GameState, player: PlayerId = state.priority): Action[] {
  if (state.phase === 'over') {
    return [];
  }

  if (state.phase === 'mulligan') {
    const playerState = state.players[player];
    if (playerState.mulliganUsed) {
      return [];
    }
    const actions: Action[] = [{ type: 'MULLIGAN', player, cardIds: [] }];
    for (const card of playerState.hand) {
      actions.push({ type: 'MULLIGAN', player, cardIds: [card.instanceId] });
    }
    return actions;
  }

  if (player !== state.priority) {
    return [];
  }

  const playerState = state.players[player];
  const actions: Action[] = [];

  for (const card of playerState.hand) {
    const def = state.catalog[card.defId];
    if (!def) {
      continue;
    }
    const cost = costOf(card, def);

    if (def.type === 'argument') {
      if (playerState.spellMana + playerState.energy >= cost) {
        actions.push({ type: 'PLAY_CARD', player, cardId: card.instanceId });
      }
      continue;
    }

    if (playerState.energy < cost) {
      continue;
    }

    if (def.type === 'school') {
      if (controlledSchool(state, player, def.id)) {
        continue;
      }
      for (const slot of emptyBackSlots(state, player)) {
        actions.push({ type: 'PLAY_CARD', player, cardId: card.instanceId, slot });
      }
      continue;
    }

    if (def.type === 'champion' && controlledChampion(state, player)) {
      continue;
    }
    for (const slot of emptyRowSlots(state)) {
      actions.push({ type: 'PLAY_CARD', player, cardId: card.instanceId, slot });
    }
  }

  actions.push({ type: 'PASS', player });
  return actions;
}
