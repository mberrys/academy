import { assignInterceptors, declareAttack } from './combat';
import { applyChallenger } from './keywords';
import { costOf, validateAction } from './legality';
import { shuffle } from './rng';
import { drawCard, endRound, startRound } from './turn';
import { otherPlayer } from './types';
import { placeSchool, placeUnit } from './zones';
import type {
  Action,
  ActionResult,
  CardDef,
  CardInstance,
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
} from './types';

export function applyAction(state: GameState, action: Action): ActionResult {
  const error = validateAction(state, action);
  if (error) {
    return { ok: false, error };
  }

  const next = structuredClone(state);
  const before = next.events.length;
  let events: GameEvent[] = [];

  switch (action.type) {
    case 'MULLIGAN':
      events = mulligan(next, action.player, action.cardIds);
      break;
    case 'PLAY_CARD':
      events = playCard(next, action.player, action.cardId, action.slot);
      break;
    case 'DECLARE_ATTACK':
      events = declareAttack(next, action.player, action.assignments);
      break;
    case 'ASSIGN_INTERCEPTORS':
      events = assignInterceptors(next, action.player, action.interceptors);
      break;
    case 'PASS':
      events = pass(next, action.player);
      break;
  }

  next.events.push(...events);
  return { ok: true, state: next, events: next.events.slice(before) };
}

function spend(player: PlayerState, def: CardDef, card: CardInstance): void {
  let remaining = costOf(card, def);
  if (def.type === 'argument') {
    const fromSpell = Math.min(player.spellMana, remaining);
    player.spellMana -= fromSpell;
    remaining -= fromSpell;
  }
  player.energy -= remaining;
}

function mulligan(state: GameState, player: PlayerId, cardIds: string[]): GameEvent[] {
  const playerState = state.players[player];
  const selectedIds = new Set(cardIds);
  const selected = playerState.hand.filter((card) => selectedIds.has(card.instanceId));

  playerState.hand = playerState.hand.filter((card) => !selectedIds.has(card.instanceId));
  for (const card of selected) {
    card.zone = 'deck';
    delete card.slot;
    playerState.deck.push(card);
  }

  const shuffled = shuffle(playerState.deck, state.rngState);
  playerState.deck = shuffled.items;
  state.rngState = shuffled.state;

  const events: GameEvent[] = [{ type: 'mulliganed', player, count: selected.length }];
  for (let index = 0; index < selected.length; index += 1) {
    events.push(...drawCard(state, player));
    if (state.phase === 'over') {
      return events;
    }
  }

  playerState.mulliganUsed = true;
  if (state.players.p1.mulliganUsed && state.players.p2.mulliganUsed) {
    events.push(...startRound(state));
  }
  return events;
}

function playCard(state: GameState, player: PlayerId, cardId: string, slot?: number): GameEvent[] {
  const playerState = state.players[player];
  const index = playerState.hand.findIndex((card) => card.instanceId === cardId);
  const card = playerState.hand[index];
  if (!card) {
    return [];
  }
  const def = state.catalog[card.defId];
  if (!def) {
    return [];
  }

  playerState.hand.splice(index, 1);
  spend(playerState, def, card);

  const events: GameEvent[] = [];
  if (def.type === 'argument') {
    card.zone = 'discard';
    delete card.slot;
    playerState.discard.push(card);
    events.push({ type: 'played', player, defId: card.defId });
  } else if (def.type === 'school') {
    const placed = placeSchool(state, player, card, slot);
    events.push({ type: 'played', player, defId: card.defId, slot: placed });
  } else {
    const placed = placeUnit(state, card, slot);
    events.push({ type: 'played', player, defId: card.defId, slot: placed });
    events.push(...applyChallenger(state, card, def));
  }

  playerState.playedThisRound.push(card.defId);
  state.consecutivePasses = 0;
  state.priority = otherPlayer(player);
  return events;
}

function pass(state: GameState, player: PlayerId): GameEvent[] {
  state.consecutivePasses += 1;
  const events: GameEvent[] = [{ type: 'passed', player }];
  if (state.consecutivePasses >= 2) {
    events.push(...endRound(state));
  } else {
    state.priority = otherPlayer(player);
  }
  return events;
}
