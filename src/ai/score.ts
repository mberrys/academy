import { statsOf } from '../engine/auras';
import { findChampion } from '../engine/champions';
import { otherPlayer } from '../engine/types';
import type { CardInstance, GameState, PlayerId } from '../engine/types';

function unitValue(state: GameState, card: CardInstance): number {
  const def = state.catalog[card.defId];
  if (!def) {
    return 0;
  }

  const stats = statsOf(state, card, def);
  let value = stats.attack * 4 + stats.health * 2.5;
  for (const keyword of def.keywords ?? []) {
    if (keyword === 'quickAttack') {
      value += 3;
    } else if (keyword === 'barrier') {
      value += 2;
    } else if (keyword === 'tough') {
      value += 2;
    } else if (keyword === 'overwhelm') {
      value += 2;
    }
  }
  if (def.type === 'champion') {
    value += 8;
  }
  if (def.type === 'token') {
    value -= 1;
  }
  return value;
}

function boardValue(state: GameState, player: PlayerId): number {
  let value = 0;
  for (const card of state.row) {
    if (card?.owner === player) {
      value += unitValue(state, card);
    }
  }
  return value;
}

function backValue(state: GameState, player: PlayerId): number {
  return state.back[player].filter((card) => card !== null).length * 5;
}

function championValue(state: GameState, player: PlayerId): number {
  const champion = findChampion(state, player);
  if (!champion) {
    return 0;
  }
  return state.players[player].championLevel * 12 + state.players[player].championProgress * 2;
}

function delayedValue(state: GameState, player: PlayerId): number {
  return state.delayed.filter((effect) => effect.player === player).length * 4;
}

function combatPressure(state: GameState, player: PlayerId): number {
  const combat = state.combat;
  if (!combat) {
    return 0;
  }

  let value = 0;
  for (const assignment of combat.assignments) {
    const attacker = state.row.find((card) => card?.instanceId === assignment.attackerId);
    if (!attacker) {
      continue;
    }
    const attackerDef = state.catalog[attacker.defId];
    if (!attackerDef) {
      continue;
    }
    const attack = statsOf(state, attacker, attackerDef).attack;

    const targetRef = assignment.target;
    if (targetRef.kind === 'nexus') {
      value += attack * 3;
      continue;
    }

    const target = state.row.find((card) => card?.instanceId === targetRef.instanceId);
    if (!target) {
      value += attack * 2;
      continue;
    }
    const targetDef = state.catalog[target.defId];
    if (!targetDef) {
      continue;
    }
    const remaining = Math.max(0, statsOf(state, target, targetDef).health - target.damage);
    const dealt = Math.min(attack, remaining);
    value += dealt * 2;
    if (attack >= remaining) {
      value += unitValue(state, target) * 0.6;
    }
  }

  return combat.attacker === player ? value : -value;
}

export function scoreState(state: GameState, player: PlayerId): number {
  if (state.phase === 'over') {
    if (state.winner === player) {
      return 1_000_000;
    }
    if (state.winner === 'draw') {
      return 0;
    }
    return -1_000_000;
  }

  const enemy = otherPlayer(player);
  const me = state.players[player];
  const them = state.players[enemy];

  let score = (me.health - them.health) * 12;
  score += boardValue(state, player) - boardValue(state, enemy);
  score += (me.hand.length - them.hand.length) * 2;
  score += (me.energy + me.spellMana - (them.energy + them.spellMana)) * 0.4;
  score += backValue(state, player) - backValue(state, enemy);
  score += championValue(state, player) - championValue(state, enemy);
  score += delayedValue(state, player) - delayedValue(state, enemy);
  score += combatPressure(state, player);
  return score;
}
