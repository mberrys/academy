import { addChampionProgress } from './champions';
import { placeUnit } from './zones';
import type { CardInstance, GameEvent, GameState, PlayerId, Zone } from './types';

export function createInstance(
  state: GameState,
  defId: string,
  owner: PlayerId,
  zone: Zone,
): CardInstance {
  return {
    instanceId: `gen-${state.nextInstanceId++}`,
    defId,
    owner,
    zone,
    damage: 0,
    buffs: [],
    keywordGrants: [],
    costDelta: 0,
    costDeltaExpiresRound: null,
    isCopy: false,
    barrierConsumed: false,
    enteredRound: state.round,
  };
}

export function summonUnit(
  state: GameState,
  player: PlayerId,
  defId: string,
  slot: number | undefined,
  events: GameEvent[],
): CardInstance | undefined {
  if (!state.catalog[defId] || state.row.every((entry) => entry !== null)) {
    return undefined;
  }

  const card = createInstance(state, defId, player, 'row');
  const placed = placeUnit(state, card, slot);
  events.push({ type: 'summoned', player, instanceId: card.instanceId, defId, slot: placed });
  state.pendingSummons.push(card);
  addChampionProgress(state, player, 'followersSummoned', 1, events);
  return card;
}

export function summonClone(
  state: GameState,
  player: PlayerId,
  target: CardInstance,
  events: GameEvent[],
): CardInstance | undefined {
  if (state.row.every((entry) => entry !== null)) {
    return undefined;
  }
  const def = state.catalog[target.defId];
  if (!def) {
    return undefined;
  }

  const card = createInstance(state, target.defId, player, 'row');
  card.buffs.push({ attack: 0, health: 1 - (def.health ?? 0), expiresRound: null });
  const placed = placeUnit(state, card);
  events.push({ type: 'summoned', player, instanceId: card.instanceId, defId: card.defId, slot: placed });
  state.pendingSummons.push(card);
  addChampionProgress(state, player, 'followersSummoned', 1, events);
  return card;
}
