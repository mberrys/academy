import { checkPendingTransform } from './champions';
import { resolveDelayed } from './delayed';
import { runEffect } from './effects';
import type { EffectPayload } from './effects';
import type { CardInstance, GameEvent, GameState, PlayerId, Trigger } from './types';

export function runTrigger(
  state: GameState,
  trigger: Trigger,
  source: CardInstance,
  controller: PlayerId,
  events: GameEvent[],
  payload?: EffectPayload,
  targetId?: string,
): void {
  const def = state.catalog[source.defId];
  if (!def?.effects) {
    return;
  }

  for (const spec of def.effects) {
    if (spec.trigger !== trigger) {
      continue;
    }
    if (spec.oncePerRound) {
      const key = `${source.instanceId}:${spec.effect}`;
      const used = state.players[controller].triggeredThisRound;
      if (used.includes(key)) {
        continue;
      }
      used.push(key);
    }
    runEffect(spec.effect, {
      state,
      source,
      controller,
      events,
      ...(payload ? { payload } : {}),
      ...(targetId ? { targetId } : {}),
    });
    if (state.phase === 'over') {
      break;
    }
  }
}

export function drainTriggers(state: GameState, events: GameEvent[]): void {
  let guard = 0;

  while (
    guard < 200
    && (state.turnStartPending || state.pendingSummons.length > 0 || state.pendingDeaths.length > 0)
  ) {
    guard += 1;

    if (state.turnStartPending) {
      state.turnStartPending = false;
      const active = state.activePlayer;
      resolveDelayed(state, active, events);
      if (state.phase === 'over') {
        break;
      }
      for (const card of state.row) {
        if (card?.owner === active) {
          runTrigger(state, 'turnStart', card, active, events);
        }
      }
      for (const card of state.back[active]) {
        if (card) {
          runTrigger(state, 'turnStart', card, active, events);
        }
      }
      checkPendingTransform(state, active, events);
    }

    while (state.pendingSummons.length > 0) {
      const card = state.pendingSummons.shift();
      if (!card) {
        break;
      }
      runTrigger(state, 'onSummon', card, card.owner, events);
      for (const back of state.back[card.owner]) {
        if (back) {
          runTrigger(state, 'onAllySummon', back, card.owner, events, { summoned: card });
        }
      }
      if (state.phase === 'over') {
        break;
      }
    }

    while (state.pendingDeaths.length > 0) {
      const card = state.pendingDeaths.shift();
      if (!card) {
        break;
      }
      runTrigger(state, 'onDeath', card, card.owner, events);
      for (const back of state.back[card.owner]) {
        if (back) {
          runTrigger(state, 'onAllyDeath', back, card.owner, events, { dead: card });
        }
      }
      if (state.phase === 'over') {
        break;
      }
    }
  }

  if (guard >= 200) {
    throw new Error('Trigger loop exceeded');
  }
}
