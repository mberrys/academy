import { statsOf } from './auras';
import { damageNexus, damageUnit, destroyUnit, healNexus } from './damage';
import { scheduleTimeBomb } from './delayed';
import { createInstance, summonClone, summonUnit } from './placement';
import { drawCard } from './turn';
import { MAX_HAND, otherPlayer } from './types';
import { findRowUnit } from './zones';
import type { CardDef, CardInstance, GameEvent, GameState, PlayerId } from './types';

export type EffectPayload = {
  played?: CardInstance;
  summoned?: CardInstance;
  dead?: CardInstance;
};

export type EffectContext = {
  state: GameState;
  source: CardInstance;
  controller: PlayerId;
  targetId?: string;
  payload?: EffectPayload;
  events: GameEvent[];
};

type EffectHandler = (ctx: EffectContext) => void;

function defOf(state: GameState, card: CardInstance): CardDef | undefined {
  return state.catalog[card.defId];
}

function targetOf(ctx: EffectContext): CardInstance | undefined {
  return ctx.targetId ? findRowUnit(ctx.state, ctx.targetId) : undefined;
}

function allyUnits(state: GameState, player: PlayerId): CardInstance[] {
  return state.row.filter((card): card is CardInstance => card !== null && card.owner === player);
}

function enemyUnits(state: GameState, player: PlayerId): CardInstance[] {
  return state.row.filter((card): card is CardInstance => card !== null && card.owner !== player);
}

function buff(card: CardInstance, attack: number, health: number, expiresRound: number | null): void {
  card.buffs.push({ attack, health, expiresRound });
}

function grant(card: CardInstance, keyword: 'quickAttack' | 'challenger' | 'barrier' | 'tough' | 'overwhelm', expiresRound: number | null): void {
  card.keywordGrants.push({ keyword, expiresRound });
}

function draw(state: GameState, player: PlayerId, count: number, events: GameEvent[]): void {
  for (let index = 0; index < count; index += 1) {
    events.push(...drawCard(state, player));
    if (state.phase === 'over') {
      return;
    }
  }
}

function createInHand(
  state: GameState,
  player: PlayerId,
  defId: string,
  events: GameEvent[],
  options?: { costDelta?: number; costOverride?: number; isCopy?: boolean },
): CardInstance | undefined {
  if (!state.catalog[defId] || state.players[player].hand.length >= MAX_HAND) {
    return undefined;
  }

  const card = createInstance(state, defId, player, 'hand');
  card.costDelta = options?.costDelta ?? 0;
  card.costDeltaExpiresRound = null;
  if (options?.costOverride !== undefined) {
    card.costOverride = options.costOverride;
  }
  card.isCopy = options?.isCopy ?? false;
  state.players[player].hand.push(card);
  events.push({ type: 'created', player, defId, isCopy: card.isCopy });
  return card;
}

function returnToHand(state: GameState, card: CardInstance, events: GameEvent[], extraCost = 0): void {
  const index = state.row.findIndex((entry) => entry?.instanceId === card.instanceId);
  if (index < 0) {
    return;
  }

  state.row[index] = null;
  delete card.slot;
  card.zone = 'hand';
  card.damage = 0;
  card.buffs = [];
  card.keywordGrants = [];
  card.barrierConsumed = false;
  if (extraCost !== 0) {
    card.costDelta = extraCost;
    card.costDeltaExpiresRound = state.round;
  }

  const player = state.players[card.owner];
  if (player.hand.length >= MAX_HAND) {
    card.zone = 'discard';
    player.discard.push(card);
  } else {
    player.hand.push(card);
  }
  events.push({ type: 'returned', player: card.owner, instanceId: card.instanceId, defId: card.defId });
}

function weakestNonChampionAlly(state: GameState, player: PlayerId): CardInstance | undefined {
  const units = allyUnits(state, player).filter((card) => state.catalog[card.defId]?.type !== 'champion');
  units.sort((left, right) => {
    const leftDef = state.catalog[left.defId];
    const rightDef = state.catalog[right.defId];
    const leftStats = leftDef ? statsOf(state, left, leftDef) : { attack: 0, health: 0 };
    const rightStats = rightDef ? statsOf(state, right, rightDef) : { attack: 0, health: 0 };
    if (leftStats.attack !== rightStats.attack) {
      return leftStats.attack - rightStats.attack;
    }
    if (leftStats.health !== rightStats.health) {
      return leftStats.health - rightStats.health;
    }
    return (left.slot ?? 0) - (right.slot ?? 0);
  });
  return units[0];
}

const EFFECTS: Record<string, EffectHandler> = {
  damageOne: (ctx) => {
    const target = targetOf(ctx);
    const def = target ? defOf(ctx.state, target) : undefined;
    if (target && def) {
      damageUnit(ctx.state, target, def, 1, ctx.events);
    }
  },

  damageThree: (ctx) => {
    const target = targetOf(ctx);
    const def = target ? defOf(ctx.state, target) : undefined;
    if (target && def) {
      damageUnit(ctx.state, target, def, 3, ctx.events);
    }
  },

  dialectic: (ctx) => {
    const target = targetOf(ctx);
    const def = target ? defOf(ctx.state, target) : undefined;
    if (!target || !def) {
      return;
    }
    const earlier = ctx.state.players[ctx.controller].playedThisRound.some(
      (defId) => ctx.state.catalog[defId]?.type === 'argument',
    );
    damageUnit(ctx.state, target, def, earlier ? 4 : 2, ctx.events);
  },

  returnEnemy: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      returnToHand(ctx.state, target, ctx.events);
    }
  },

  repression: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      returnToHand(ctx.state, target, ctx.events, 1);
    }
  },

  proletariat: (ctx) => {
    const others = allyUnits(ctx.state, ctx.controller).filter(
      (card) => card.instanceId !== ctx.source.instanceId && ctx.state.catalog[card.defId]?.type === 'thinker',
    );
    if (others.length > 0) {
      buff(ctx.source, 1, 1, null);
    }
  },

  capital: (ctx) => {
    ctx.state.players[ctx.controller].energy += 1;
  },

  classStruggle: (ctx) => {
    const weakest = weakestNonChampionAlly(ctx.state, ctx.controller);
    if (!weakest) {
      return;
    }
    const weakestDef = defOf(ctx.state, weakest);
    if (!weakestDef) {
      return;
    }
    const attack = statsOf(ctx.state, weakest, weakestDef).attack;
    destroyUnit(ctx.state, weakest, ctx.events);

    const target = targetOf(ctx);
    const targetDef = target ? defOf(ctx.state, target) : undefined;
    if (target && targetDef) {
      damageUnit(ctx.state, target, targetDef, attack, ctx.events);
    }
  },

  manifesto: (ctx) => {
    for (const enemy of enemyUnits(ctx.state, ctx.controller)) {
      if (!findRowUnit(ctx.state, enemy.instanceId)) {
        continue;
      }
      const def = defOf(ctx.state, enemy);
      if (def) {
        damageUnit(ctx.state, enemy, def, 3, ctx.events);
      }
    }
    createInHand(ctx.state, ctx.controller, 'time-bomb', ctx.events);
  },

  mirrorStage: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      summonClone(ctx.state, ctx.controller, target, ctx.events);
    }
  },

  destroyTarget: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      destroyUnit(ctx.state, target, ctx.events);
    }
  },

  summonOneCongregant: (ctx) => {
    summonUnit(ctx.state, ctx.controller, 'congregant', undefined, ctx.events);
  },

  summonTwoCongregants: (ctx) => {
    summonUnit(ctx.state, ctx.controller, 'congregant', undefined, ctx.events);
    summonUnit(ctx.state, ctx.controller, 'congregant', undefined, ctx.events);
  },

  summonThreeCongregants: (ctx) => {
    for (let index = 0; index < 3; index += 1) {
      summonUnit(ctx.state, ctx.controller, 'congregant', undefined, ctx.events);
    }
  },

  indulgence: (ctx) => {
    ctx.state.players[ctx.controller].energy += 3;
    damageNexus(ctx.state, ctx.controller, 2, ctx.events);
  },

  solaFide: (ctx) => {
    const target = targetOf(ctx);
    if (!target) {
      return;
    }
    buff(target, 1, 2, ctx.state.round);
    grant(target, 'barrier', null);
  },

  congregation: (ctx) => {
    for (const unit of allyUnits(ctx.state, ctx.controller)) {
      if (ctx.state.catalog[unit.defId]?.id === 'congregant') {
        buff(unit, 2, 2, null);
      }
    }
  },

  hereIStand: (ctx) => {
    for (const unit of allyUnits(ctx.state, ctx.controller)) {
      buff(unit, 2, 2, null);
      grant(unit, 'overwhelm', ctx.state.round);
    }
  },

  drawOne: (ctx) => {
    draw(ctx.state, ctx.controller, 1, ctx.events);
  },

  damageNexusOne: (ctx) => {
    damageNexus(ctx.state, otherPlayer(ctx.controller), 1, ctx.events);
  },

  citation: (ctx) => {
    draw(ctx.state, ctx.controller, 1, ctx.events);
    if (ctx.state.back[ctx.controller].some((card) => card !== null)) {
      draw(ctx.state, ctx.controller, 1, ctx.events);
    }
  },

  oratorBuff: (ctx) => {
    const other = allyUnits(ctx.state, ctx.controller).find((card) => card.instanceId !== ctx.source.instanceId);
    if (other) {
      buff(other, 1, 0, ctx.state.round);
    }
  },

  rhetoric: (ctx) => {
    const target = targetOf(ctx);
    if (!target) {
      return;
    }
    buff(target, 2, 0, ctx.state.round);
    grant(target, 'overwhelm', ctx.state.round);
  },

  burden: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      buff(target, -2, 0, ctx.state.round);
    }
  },

  riposte: (ctx) => {
    const target = targetOf(ctx);
    if (target) {
      grant(target, 'barrier', null);
    }
  },

  timeBomb: (ctx) => {
    scheduleTimeBomb(ctx.state, ctx.controller, ctx.source.instanceId);
  },

  repeal: (ctx) => {
    if (!ctx.targetId) {
      return;
    }
    const back = ctx.state.back[otherPlayer(ctx.controller)];
    const index = back.findIndex((card) => card?.instanceId === ctx.targetId);
    const target = index >= 0 ? back[index] : undefined;
    if (!target) {
      return;
    }
    back[index] = null;
    delete target.slot;
    target.zone = 'discard';
    ctx.state.players[target.owner].discard.push(target);
    ctx.events.push({ type: 'destroyedSchool', player: target.owner, instanceId: target.instanceId, defId: target.defId });
  },

  createTimeBomb: (ctx) => {
    createInHand(ctx.state, ctx.controller, 'time-bomb', ctx.events);
  },

  lacanCopy: (ctx) => {
    const played = ctx.payload?.played;
    if (!played) {
      return;
    }
    const isLevelTwo = ctx.source.defId === 'lacan-2';
    createInHand(ctx.state, ctx.controller, played.defId, ctx.events, isLevelTwo
      ? { costOverride: 1, isCopy: true }
      : { costDelta: 1, isCopy: true });
  },

  signifierBuff: (ctx) => {
    buff(ctx.source, 1, 1, null);
  },

  discountArgument: (ctx) => {
    ctx.state.players[ctx.controller].argumentDiscount = 1;
  },

  buffFollower: (ctx) => {
    const summoned = ctx.payload?.summoned;
    if (summoned) {
      buff(summoned, 1, 0, null);
    }
  },

  healNexusOne: (ctx) => {
    healNexus(ctx.state, ctx.controller, 1, ctx.events);
  },

  primalScene: (ctx) => {
    for (const defId of ctx.state.players[ctx.controller].playedThisRound) {
      const def = ctx.state.catalog[defId];
      if (def?.type !== 'argument' || defId === 'primal-scene') {
        continue;
      }
      createInHand(ctx.state, ctx.controller, defId, ctx.events, { isCopy: true });
    }
    draw(ctx.state, ctx.controller, 1, ctx.events);
  },
};

export const EFFECT_IDS = new Set(Object.keys(EFFECTS));

export function runEffect(effect: string, ctx: EffectContext): void {
  EFFECTS[effect]?.(ctx);
}
