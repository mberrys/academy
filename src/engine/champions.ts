import { statsOf } from './auras';
import { removeFromRow } from './zones';
import type { CardDef, CardInstance, GameEvent, GameState, PlayerId } from './types';

type LevelKind = 'timeBombs' | 'copiesPlayed' | 'followersSummoned';

export function findChampion(state: GameState, player: PlayerId): CardInstance | undefined {
  return state.row.find((card) => card?.owner === player && state.catalog[card.defId]?.type === 'champion') ?? undefined;
}

export function addChampionProgress(
  state: GameState,
  player: PlayerId,
  kind: LevelKind,
  amount: number,
  events: GameEvent[],
): void {
  const playerState = state.players[player];
  if (playerState.championLevel === 2) {
    return;
  }
  const champion = findChampion(state, player);
  if (!champion) {
    return;
  }
  const def = state.catalog[champion.defId];
  if (!def?.levelCondition || def.levelCondition.kind !== kind) {
    return;
  }

  playerState.championProgress += amount;
  if (playerState.championProgress >= def.levelCondition.count) {
    transformChampion(state, player, champion, def, events);
  }
}

export function transformChampion(
  state: GameState,
  player: PlayerId,
  champion: CardInstance,
  def: CardDef,
  events: GameEvent[],
): void {
  if (!def.level2) {
    return;
  }
  const nextDef = state.catalog[def.level2];
  if (!nextDef) {
    return;
  }

  state.players[player].championLevel = 2;
  champion.defId = def.level2;
  events.push({ type: 'leveledUp', player, instanceId: champion.instanceId, defId: def.level2 });

  const health = statsOf(state, champion, nextDef).health;
  if (champion.damage >= health) {
    events.push({ type: 'died', instanceId: champion.instanceId, defId: champion.defId });
    removeFromRow(state, champion);
    state.pendingDeaths.push(champion);
  }
}

export function checkPendingTransform(state: GameState, player: PlayerId, events: GameEvent[]): void {
  const playerState = state.players[player];
  if (!playerState.pendingChampionTransform) {
    return;
  }
  playerState.pendingChampionTransform = false;
  if (playerState.championLevel === 2) {
    return;
  }
  const champion = findChampion(state, player);
  if (!champion) {
    return;
  }
  const def = state.catalog[champion.defId];
  if (!def?.levelCondition) {
    return;
  }
  if (playerState.championProgress >= def.levelCondition.count) {
    transformChampion(state, player, champion, def, events);
  }
}
