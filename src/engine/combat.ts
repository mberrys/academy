import { statsOf } from './auras';
import { damageNexus, damageUnit } from './damage';
import { hasKeyword } from './keywords';
import { runTrigger } from './triggers';
import { findRowUnit } from './zones';
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

  const events: GameEvent[] = [];
  for (const assignment of combat.assignments) {
    const attacker = findRowUnit(state, assignment.attackerId);
    if (attacker) {
      runTrigger(state, 'onAttack', attacker, player, events);
    }
  }

  state.combat = combat;
  state.combatUsed = true;
  state.priority = combat.defender;
  events.push({ type: 'attacked', player, assignments: combat.assignments });
  return events;
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
  const attackerStats = statsOf(state, attacker, attackerDef);
  const defenderStats = statsOf(state, defender, defenderDef);
  const quick = hasKeyword(state, attacker, attackerDef, 'quickAttack');
  const overwhelm = hasKeyword(state, attacker, attackerDef, 'overwhelm');
  const remaining = Math.max(0, defenderStats.health - defender.damage);

  const hit = damageUnit(state, defender, defenderDef, attackerStats.attack, events);
  if (overwhelm && hit.dealt > 0) {
    const excess = Math.max(0, hit.dealt - remaining);
    if (excess > 0) {
      damageNexus(state, defender.owner, excess, events);
      if (state.phase === 'over') {
        return events;
      }
    }
  }

  if (quick && hit.died) {
    return events;
  }

  damageUnit(state, attacker, attackerDef, defenderStats.attack, events);
  return events;
}

function strikeNexus(state: GameState, attacker: CardInstance, attackerDef: CardDef): GameEvent[] {
  const events: GameEvent[] = [];
  const amount = statsOf(state, attacker, attackerDef).attack;
  damageNexus(state, otherPlayer(attacker.owner), amount, events);
  return events;
}
