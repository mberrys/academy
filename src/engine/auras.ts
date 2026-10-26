import type { AuraSpec, CardInstance, GameState, PlayerId } from './types';

function auraOf(state: GameState, card: CardInstance): AuraSpec | undefined {
  return state.catalog[card.defId]?.aura;
}

export function hasAura(
  state: GameState,
  player: PlayerId,
  kind: AuraSpec['kind'],
): AuraSpec | undefined {
  for (const card of state.row) {
    if (card?.owner === player) {
      const aura = auraOf(state, card);
      if (aura?.kind === kind) {
        return aura;
      }
    }
  }
  for (const card of state.back[player]) {
    if (card) {
      const aura = auraOf(state, card);
      if (aura?.kind === kind) {
        return aura;
      }
    }
  }
  return undefined;
}

export function statsOf(state: GameState, card: CardInstance, def: { attack?: number; health?: number; type: string; id: string }): {
  attack: number;
  health: number;
} {
  let attack = def.attack ?? 0;
  let health = def.health ?? 0;

  for (const buff of card.buffs) {
    if (buff.expiresRound === null || buff.expiresRound >= state.round) {
      attack += buff.attack;
      health += buff.health;
    }
  }

  if (def.type === 'champion') {
    const aura = hasAura(state, card.owner, 'championBuff');
    if (aura?.kind === 'championBuff') {
      attack += aura.attack;
      health += aura.health;
    }
  }

  if (def.id === 'congregant') {
    const aura = hasAura(state, card.owner, 'congregantBuff');
    if (aura?.kind === 'congregantBuff') {
      attack += aura.attack;
      health += aura.health;
    }
  }

  return { attack: Math.max(0, attack), health: Math.max(0, health) };
}
