import { addChampionProgress, findChampion } from './champions';
import { assignInterceptors, declareAttack } from './combat';
import { costOf } from './cost';
import { applyChallenger } from './keywords';
import { validateAction } from './legality';
import { shuffle } from './rng';
import { drainTriggers, runTrigger } from './triggers';
import { drawCard, endRound, startRound } from './turn';
import { otherPlayer } from './types';
import { placeSchool, placeUnit } from './zones';
import type {
  Action,
  ActionResult,
  CardDef,
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
      events = playCard(next, action.player, action.cardId, action.slot, action.targetId);
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

  drainTriggers(next, events);
  next.events.push(...events);
  return { ok: true, state: next, events: next.events.slice(before) };
}

function spend(player: PlayerState, def: CardDef, cost: number): void {
  let remaining = cost;
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

function playCard(
  state: GameState,
  player: PlayerId,
  cardId: string,
  slot: number | undefined,
  targetId: string | undefined,
): GameEvent[] {
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

  const previousDefId = playerState.playedThisRound.at(-1);
  const previousWasThinker = previousDefId ? state.catalog[previousDefId]?.type === 'thinker' : false;
  const cost = costOf(state, player, card);

  playerState.hand.splice(index, 1);
  spend(playerState, def, cost);

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
  }

  if (def.effects?.some((spec) => spec.trigger === 'onPlay')) {
    runTrigger(state, 'onPlay', card, player, events, { played: card }, targetId);
  }

  if (def.type === 'champion' && def.levelCondition) {
    playerState.championLevel = 1;
    if (playerState.championProgress >= def.levelCondition.count) {
      playerState.pendingChampionTransform = true;
    }
  }

  if (card.isCopy) {
    addChampionProgress(state, player, 'copiesPlayed', 1, events);
    const champion = findChampion(state, player);
    if (champion) {
      runTrigger(state, 'onCopyPlayed', champion, player, events);
    }
  }

  if (def.type !== 'argument' && def.type !== 'school') {
    events.push(...applyChallenger(state, card, def));
  }

  if (def.type === 'argument' && previousWasThinker) {
    for (const unit of state.row) {
      if (unit?.owner === player) {
        runTrigger(state, 'onArgumentAfterThinker', unit, player, events, { played: card });
      }
    }
    for (const school of state.back[player]) {
      if (school) {
        runTrigger(state, 'onArgumentAfterThinker', school, player, events, { played: card });
      }
    }
  }

  playerState.playedThisRound.push(card.defId);
  if (def.type === 'argument') {
    playerState.argumentDiscount = 0;
  }
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
