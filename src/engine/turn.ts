import { MAX_ENERGY, MAX_HAND, ROUND_CAP, SPELL_MANA_CAP, otherPlayer } from './types';
import type { GameEvent, GameState, PlayerId } from './types';

export function drawCard(state: GameState, player: PlayerId): GameEvent[] {
  const playerState = state.players[player];
  const card = playerState.deck.shift();
  if (!card) {
    state.winner = otherPlayer(player);
    state.phase = 'over';
    return [{ type: 'gameOver', winner: otherPlayer(player) }];
  }

  if (playerState.hand.length >= MAX_HAND) {
    card.zone = 'discard';
    delete card.slot;
    playerState.discard.push(card);
    return [{ type: 'burned', player, defId: card.defId }];
  }

  card.zone = 'hand';
  delete card.slot;
  playerState.hand.push(card);
  return [{ type: 'drew', player, defId: card.defId }];
}

export function startRound(state: GameState): GameEvent[] {
  state.round += 1;
  if (state.round > 1) {
    state.attackToken = otherPlayer(state.attackToken);
  }
  state.phase = 'actions';
  state.combat = null;
  state.combatUsed = false;
  state.turnStartPending = true;
  state.players.p1.argumentDiscount = 0;
  state.players.p1.triggeredThisRound = [];
  state.players.p2.argumentDiscount = 0;
  state.players.p2.triggeredThisRound = [];
  state.players.p1.energy = Math.min(state.round, MAX_ENERGY);
  state.players.p2.energy = Math.min(state.round, MAX_ENERGY);
  state.activePlayer = state.attackToken;
  state.priority = state.attackToken;
  state.consecutivePasses = 0;
  return [{ type: 'roundStarted', round: state.round, activePlayer: state.activePlayer }];
}

export function endRound(state: GameState): GameEvent[] {
  const events: GameEvent[] = [{ type: 'roundEnded', round: state.round }];

  for (const player of ['p1', 'p2'] as const) {
    const playerState = state.players[player];
    playerState.spellMana = Math.min(playerState.spellMana + playerState.energy, SPELL_MANA_CAP);
  }

  const order: PlayerId[] = [state.activePlayer, otherPlayer(state.activePlayer)];
  for (const player of order) {
    events.push(...drawCard(state, player));
    if (state.phase === 'over') {
      return events;
    }
  }

  if (state.round >= ROUND_CAP) {
    state.winner = 'draw';
    state.phase = 'over';
    events.push({ type: 'gameOver', winner: 'draw' });
    return events;
  }

  events.push(...startRound(state));
  return events;
}
