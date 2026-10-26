import { hasKeyword } from './keywords';
import { findRowUnit, removeFromRow } from './zones';
import { otherPlayer } from './types';
import type {
  AttackAssignment,
  CardDef,
  CardInstance,
  CombatState,
  GameEvent,
  GameState,
  InterceptorAssignment,
  PlayerId,
} from './types';

export function declareAttack(
  state: GameState,
  player: PlayerId,
  assignments: AttackAssignment[],
): GameEvent[] {
  const combat: CombatState = {
    attacker: player,
    defender: otherPlayer(player),
    assignments: assignments.map((assignment) => ({
      attackerId: assignment.attackerId,
      target:
        assignment.target.kind === 'unit'
          ? { kind: 'unit', instanceId: assignment.target.instanceId }
          : { kind: 'nexus' },
    })),
  };
  state.combat = combat;
  state.combatUsed = true;
  state.priority = combat.defender;
  return [{ type: 'attacked', player, assignments: combat.assignments }];
}

export function assignInterceptors(
  state: GameState,
  player: PlayerId,
  interceptors: InterceptorAssignment[],
): GameEvent[] {
  const combat = state.combat;
  if (!combat || combat.defender !== player) {
    return [];
  }

  const events: GameEvent[] = [];
  const assigned = new Map(interceptors.map((interceptor) => [interceptor.attackerId, interceptor.blockerId]));

  for (const assignment of combat.assignments) {
    const blockerId = assigned.get(assignment.attackerId);
    if (blockerId) {
      events.push({ type: 'intercepted', attackerId: assignment.attackerId, blockerId });
    }
    events.push(...resolveAssignment(state, assignment, blockerId));
    if (state.phase === 'over') {
      break;
    }
  }

  state.combat = null;
  state.priority = combat.defender;
  return events;
}

function resolveAssignment(
  state: GameState,
  assignment: AttackAssignment,
  blockerId: string | undefined,
): GameEvent[] {
  const attacker = findRowUnit(state, assignment.attackerId);
  if (!attacker) {
    return [];
  }
  const attackerDef = state.catalog[attacker.defId];
  if (!attackerDef) {
    return [];
  }

  if (assignment.target.kind === 'nexus') {
    return strikeNexus(state, attacker, attackerDef);
  }

  const originalTarget = findRowUnit(state, assignment.target.instanceId);
  if (!originalTarget) {
    return strikeNexus(state, attacker, attackerDef);
  }

  const blocker = blockerId ? findRowUnit(state, blockerId) : undefined;
  const defender = blocker ?? originalTarget;
  return resolveDuel(state, attacker, attackerDef, defender);
}

function resolveDuel(
  state: GameState,
  attacker: CardInstance,
  attackerDef: CardDef,
  defender: CardInstance,
): GameEvent[] {
  const defenderDef = state.catalog[defender.defId];
  if (!defenderDef) {
    return [];
  }

  const events: GameEvent[] = [];
  const attackerDamage = attackerDef.attack ?? 0;
  const defenderDamage = defenderDef.attack ?? 0;
  const quick = hasKeyword(attacker, attackerDef, 'quickAttack');
  const overwhelm = hasKeyword(attacker, attackerDef, 'overwhelm');
  const remaining = Math.max(0, (defenderDef.health ?? 0) - defender.damage);

  const hit = applyDamage(state, defender, defenderDef, attackerDamage, events);
  if (overwhelm && hit.dealt > 0) {
    const excess = Math.max(0, hit.dealt - remaining);
    if (excess > 0) {
      const nexusOwner = defender.owner;
      state.players[nexusOwner].health -= excess;
      events.push({ type: 'damagedNexus', player: nexusOwner, amount: excess });
      if (state.players[nexusOwner].health <= 0) {
        state.winner = attacker.owner;
        state.phase = 'over';
        events.push({ type: 'gameOver', winner: attacker.owner });
        return events;
      }
    }
  }

  if (quick && hit.died) {
    return events;
  }

  applyDamage(state, attacker, attackerDef, defenderDamage, events);
  return events;
}

function strikeNexus(state: GameState, attacker: CardInstance, attackerDef: CardDef): GameEvent[] {
  const amount = attackerDef.attack ?? 0;
  if (amount <= 0) {
    return [];
  }
  const nexusOwner = otherPlayer(attacker.owner);
  const events: GameEvent[] = [];
  state.players[nexusOwner].health -= amount;
  events.push({ type: 'damagedNexus', player: nexusOwner, amount });
  if (state.players[nexusOwner].health <= 0) {
    state.winner = attacker.owner;
    state.phase = 'over';
    events.push({ type: 'gameOver', winner: attacker.owner });
  }
  return events;
}

function applyDamage(
  state: GameState,
  card: CardInstance,
  def: CardDef,
  amount: number,
  events: GameEvent[],
): { dealt: number; died: boolean } {
  if (amount <= 0) {
    return { dealt: 0, died: false };
  }

  if (hasKeyword(card, def, 'barrier')) {
    card.barrierConsumed = true;
    events.push({ type: 'damagedUnit', instanceId: card.instanceId, amount: 0, lethal: false });
    return { dealt: 0, died: false };
  }

  const dealt = hasKeyword(card, def, 'tough') ? Math.max(0, amount - 1) : amount;
  card.damage += dealt;
  const health = def.health ?? 0;
  const died = card.damage >= health;
  events.push({ type: 'damagedUnit', instanceId: card.instanceId, amount: dealt, lethal: died });

  if (died) {
    events.push({ type: 'died', instanceId: card.instanceId, defId: card.defId });
    removeFromRow(state, card);
  }

  return { dealt, died };
}
