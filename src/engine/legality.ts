import { statsOf } from './auras';
import { costOf } from './cost';
import { adjacentSlots, emptyBackSlots, emptyRowSlots, findRowUnit } from './zones';
import { otherPlayer } from './types';
import type {
  Action,
  ActionError,
  AttackAssignment,
  CardInstance,
  GameState,
  InterceptorAssignment,
  PlayerId,
  TargetRequirement,
} from './types';

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

function findTarget(
  state: GameState,
  player: PlayerId,
  targetId: string | undefined,
  requirement: TargetRequirement,
): CardInstance | undefined {
  if (!targetId) {
    return undefined;
  }

  if (requirement.kind === 'enemySchool') {
    return state.back[otherPlayer(player)].find((card) => card?.instanceId === targetId) ?? undefined;
  }

  const unit = findRowUnit(state, targetId);
  if (!unit) {
    return undefined;
  }

  switch (requirement.kind) {
    case 'unit':
      break;
    case 'enemyUnit':
      if (unit.owner === player) {
        return undefined;
      }
      break;
    case 'allyUnit':
      if (unit.owner !== player) {
        return undefined;
      }
      break;
    case 'allyNonChampion':
      if (unit.owner !== player || state.catalog[unit.defId]?.type === 'champion') {
        return undefined;
      }
      break;
    default:
      return undefined;
  }

  if (requirement.kind === 'unit' || requirement.kind === 'enemyUnit') {
    if (requirement.minAttack !== undefined) {
      const def = state.catalog[unit.defId];
      if (!def || statsOf(state, unit, def).attack < requirement.minAttack) {
        return undefined;
      }
    }
  }
  return unit;
}

export function validateAction(state: GameState, action: Action): ActionError | null {
  if (state.phase === 'over') {
    return 'game-over';
  }

  if (state.combat) {
    if (action.type !== 'ASSIGN_INTERCEPTORS') {
      return 'combat-pending';
    }
    if (action.player !== state.combat.defender) {
      return 'not-your-turn';
    }
    return validateInterceptors(state, action.interceptors);
  }

  if (action.type === 'ASSIGN_INTERCEPTORS') {
    return 'wrong-phase';
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
  if (action.type === 'DECLARE_ATTACK') {
    return validateAttack(state, action.player, action.assignments);
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

  const cost = costOf(state, action.player, card);
  if (def.target && !findTarget(state, action.player, action.targetId, def.target)) {
    return 'invalid-target';
  }
  if (
    def.id === 'class-struggle'
    && !state.row.some(
      (unit) => unit?.owner === action.player && state.catalog[unit.defId]?.type !== 'champion',
    )
  ) {
    return 'invalid-target';
  }
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

function validateAttack(
  state: GameState,
  player: PlayerId,
  assignments: AttackAssignment[],
): ActionError | null {
  if (player !== state.activePlayer) {
    return 'not-your-turn';
  }
  if (state.combatUsed) {
    return 'already-attacked';
  }
  if (assignments.length === 0) {
    return 'no-attackers';
  }

  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (seen.has(assignment.attackerId)) {
      return 'invalid-attacker';
    }
    seen.add(assignment.attackerId);

    const attacker = findRowUnit(state, assignment.attackerId);
    if (!attacker || attacker.owner !== player || attacker.enteredRound >= state.round) {
      return 'invalid-attacker';
    }

    if (assignment.target.kind === 'unit') {
      const target = findRowUnit(state, assignment.target.instanceId);
      if (!target || target.owner === player) {
        return 'invalid-target';
      }
    }
  }
  return null;
}

function validateInterceptors(
  state: GameState,
  interceptors: InterceptorAssignment[],
): ActionError | null {
  const combat = state.combat;
  if (!combat) {
    return 'wrong-phase';
  }

  const seenAttackers = new Set<string>();
  const seenBlockers = new Set<string>();
  const byAttacker = new Map(combat.assignments.map((assignment) => [assignment.attackerId, assignment]));

  for (const interceptor of interceptors) {
    if (seenAttackers.has(interceptor.attackerId) || seenBlockers.has(interceptor.blockerId)) {
      return 'invalid-interceptor';
    }
    seenAttackers.add(interceptor.attackerId);
    seenBlockers.add(interceptor.blockerId);

    const assignment = byAttacker.get(interceptor.attackerId);
    if (!assignment || assignment.target.kind !== 'unit') {
      return 'invalid-interceptor';
    }

    const target = findRowUnit(state, assignment.target.instanceId);
    if (!target || target.slot === undefined) {
      return 'invalid-interceptor';
    }

    const blocker = findRowUnit(state, interceptor.blockerId);
    if (!blocker || blocker.owner !== combat.defender || blocker.slot === undefined) {
      return 'invalid-interceptor';
    }

    if (!adjacentSlots(target.slot).includes(blocker.slot)) {
      return 'invalid-interceptor';
    }
  }
  return null;
}

function targetActions(
  state: GameState,
  player: PlayerId,
  card: CardInstance,
  requirement: TargetRequirement,
): Action[] {
  if (requirement.kind === 'enemySchool') {
    return state.back[otherPlayer(player)]
      .filter((school): school is CardInstance => school !== null)
      .map((school) => ({ type: 'PLAY_CARD', player, cardId: card.instanceId, targetId: school.instanceId }));
  }

  const actions: Action[] = [];
  for (const unit of state.row) {
    if (unit && findTarget(state, player, unit.instanceId, requirement)) {
      actions.push({ type: 'PLAY_CARD', player, cardId: card.instanceId, targetId: unit.instanceId });
    }
  }
  return actions;
}

function legalAttacks(state: GameState, player: PlayerId): Action[] {
  const attackers = state.row.filter(
    (card): card is CardInstance => card !== null && card.owner === player && card.enteredRound < state.round,
  );
  if (attackers.length === 0) {
    return [];
  }

  const enemies = state.row.filter((card): card is CardInstance => card !== null && card.owner !== player);
  const actions: Action[] = [];

  actions.push({
    type: 'DECLARE_ATTACK',
    player,
    assignments: attackers.map((attacker) => ({ attackerId: attacker.instanceId, target: { kind: 'nexus' as const } })),
  });

  for (const attacker of attackers) {
    actions.push({
      type: 'DECLARE_ATTACK',
      player,
      assignments: [{ attackerId: attacker.instanceId, target: { kind: 'nexus' } }],
    });
  }

  for (const enemy of enemies) {
    actions.push({
      type: 'DECLARE_ATTACK',
      player,
      assignments: attackers.map((attacker) => ({
        attackerId: attacker.instanceId,
        target: { kind: 'unit' as const, instanceId: enemy.instanceId },
      })),
    });
  }

  for (const attacker of attackers) {
    for (const enemy of enemies) {
      actions.push({
        type: 'DECLARE_ATTACK',
        player,
        assignments: [{ attackerId: attacker.instanceId, target: { kind: 'unit', instanceId: enemy.instanceId } }],
      });
    }
  }

  return actions;
}

export function getLegalActions(state: GameState, player: PlayerId = state.priority): Action[] {
  if (state.phase === 'over') {
    return [];
  }

  if (state.combat) {
    if (player !== state.combat.defender) {
      return [];
    }
    const actions: Action[] = [{ type: 'ASSIGN_INTERCEPTORS', player, interceptors: [] }];
    for (const assignment of state.combat.assignments) {
      if (assignment.target.kind !== 'unit') {
        continue;
      }
      const target = findRowUnit(state, assignment.target.instanceId);
      if (!target || target.slot === undefined) {
        continue;
      }
      for (const slot of adjacentSlots(target.slot)) {
        const blocker = state.row[slot];
        if (!blocker || blocker.owner !== player) {
          continue;
        }
        actions.push({
          type: 'ASSIGN_INTERCEPTORS',
          player,
          interceptors: [{ attackerId: assignment.attackerId, blockerId: blocker.instanceId }],
        });
      }
    }
    return actions;
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
  if (player === state.activePlayer && !state.combatUsed) {
    actions.push(...legalAttacks(state, player));
  }

  for (const card of playerState.hand) {
    const def = state.catalog[card.defId];
    if (!def) {
      continue;
    }
    const cost = costOf(state, player, card);

    if (def.type === 'argument') {
      if (
        def.id === 'class-struggle'
        && !state.row.some(
          (unit) => unit?.owner === player && state.catalog[unit.defId]?.type !== 'champion',
        )
      ) {
        continue;
      }
      if (playerState.spellMana + playerState.energy >= cost) {
        if (def.target) {
          actions.push(...targetActions(state, player, card, def.target));
        } else {
          actions.push({ type: 'PLAY_CARD', player, cardId: card.instanceId });
        }
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
