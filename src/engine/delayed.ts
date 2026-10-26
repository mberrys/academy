import { hasAura, statsOf } from './auras';
import { addChampionProgress } from './champions';
import { damageNexus, damageUnit } from './damage';
import { otherPlayer } from './types';
import type { CardInstance, GameEvent, GameState, PlayerId } from './types';

export function scheduleTimeBomb(state: GameState, player: PlayerId, sourceId: string): void {
  const dueRound = state.attackToken === player ? state.round + 2 : state.round + 1;
  state.delayed.push({
    id: `delayed-${state.nextInstanceId++}`,
    player,
    dueRound,
    kind: 'timeBomb',
    sourceId,
  });
}

export function resolveDelayed(state: GameState, player: PlayerId, events: GameEvent[]): void {
  const due = state.delayed.filter((effect) => effect.player === player && effect.dueRound <= state.round);
  state.delayed = state.delayed.filter((effect) => !(effect.player === player && effect.dueRound <= state.round));

  for (const effect of due) {
    if (effect.kind !== 'timeBomb') {
      continue;
    }
    events.push({ type: 'delayedResolved', player, kind: 'timeBomb' });

    const enemies = state.row.filter(
      (card): card is CardInstance => card !== null && card.owner !== player,
    );
    enemies.sort((left, right) => {
      const leftDef = state.catalog[left.defId];
      const rightDef = state.catalog[right.defId];
      const leftStats = leftDef ? statsOf(state, left, leftDef) : { attack: 0, health: 0 };
      const rightStats = rightDef ? statsOf(state, right, rightDef) : { attack: 0, health: 0 };
      if (leftStats.attack !== rightStats.attack) {
        return rightStats.attack - leftStats.attack;
      }
      if (leftStats.health !== rightStats.health) {
        return rightStats.health - leftStats.health;
      }
      return (left.slot ?? 0) - (right.slot ?? 0);
    });

    const target = enemies[0];
    const bonus = hasAura(state, player, 'bombBonus');
    const damage = 4 + (bonus?.kind === 'bombBonus' ? bonus.damage : 0);

    if (target) {
      const def = state.catalog[target.defId];
      if (def) {
        damageUnit(state, target, def, damage, events);
      }
    } else {
      damageNexus(state, otherPlayer(player), 2 + (bonus?.kind === 'bombBonus' ? bonus.damage : 0), events);
    }

    addChampionProgress(state, player, 'timeBombs', 1, events);
    if (state.phase === 'over') {
      break;
    }
  }
}
