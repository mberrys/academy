export type PlayerId = 'p1' | 'p2';
export type Phase = 'mulligan' | 'actions' | 'over';
export type Winner = PlayerId | 'draw' | null;
export type CardType = 'champion' | 'thinker' | 'argument' | 'school' | 'token';
export type Keyword = 'quickAttack' | 'challenger' | 'barrier' | 'tough' | 'overwhelm';
export type Zone = 'deck' | 'hand' | 'row' | 'back' | 'discard';

export const ENGINE_NAME = 'academy-engine';
export const ENGINE_VERSION = '0.4.0';
export const ROW_SLOTS = 6;
export const BACK_SLOTS = 2;
export const MAX_HAND = 10;
export const MAX_ENERGY = 10;
export const SPELL_MANA_CAP = 3;
export const ROUND_CAP = 20;
export const START_HEALTH = 20;

export type Buff = {
  attack: number;
  health: number;
  expiresRound: number | null;
};

export type KeywordGrant = {
  keyword: Keyword;
  expiresRound: number | null;
};

export type TargetRequirement =
  | { kind: 'unit'; minAttack?: number }
  | { kind: 'enemyUnit'; minAttack?: number }
  | { kind: 'allyUnit' }
  | { kind: 'allyNonChampion' }
  | { kind: 'enemySchool' };

export type Trigger =
  | 'onPlay'
  | 'onSummon'
  | 'onDeath'
  | 'onAttack'
  | 'onAllyDeath'
  | 'onAllySummon'
  | 'onArgumentAfterThinker'
  | 'onCopyPlayed'
  | 'turnStart';

export type EffectSpec = {
  trigger: Trigger;
  effect: string;
  oncePerRound?: boolean;
};

export type AuraSpec =
  | { kind: 'championBuff'; attack: number; health: number }
  | { kind: 'congregantBuff'; attack: number; health: number }
  | { kind: 'bombBonus'; cost: number; damage: number };

export type LevelCondition = {
  kind: 'timeBombs' | 'copiesPlayed' | 'followersSummoned';
  count: number;
};

export type DelayedEffect = {
  id: string;
  player: PlayerId;
  dueRound: number;
  kind: 'timeBomb';
  sourceId: string;
};

export type CardDef = {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  attack?: number;
  health?: number;
  keywords?: Keyword[];
  text?: string;
  target?: TargetRequirement;
  effects?: EffectSpec[];
  aura?: AuraSpec;
  level2?: string;
  levelCondition?: LevelCondition;
};

export type CardInstance = {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  zone: Zone;
  slot?: number;
  damage: number;
  buffs: Buff[];
  keywordGrants: KeywordGrant[];
  costDelta: number;
  costDeltaExpiresRound: number | null;
  costOverride?: number;
  isCopy: boolean;
  barrierConsumed: boolean;
  enteredRound: number;
};

export type PlayerState = {
  id: PlayerId;
  health: number;
  energy: number;
  spellMana: number;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  playedThisRound: string[];
  argumentDiscount: number;
  triggeredThisRound: string[];
  championDefId: string;
  championProgress: number;
  championLevel: 1 | 2;
  pendingChampionTransform: boolean;
  mulliganUsed: boolean;
};

export type GameEvent =
  | { type: 'gameStarted'; seed: number }
  | { type: 'mulliganed'; player: PlayerId; count: number }
  | { type: 'drew'; player: PlayerId; defId: string }
  | { type: 'burned'; player: PlayerId; defId: string }
  | { type: 'played'; player: PlayerId; defId: string; slot?: number }
  | { type: 'created'; player: PlayerId; defId: string; isCopy: boolean }
  | { type: 'summoned'; player: PlayerId; instanceId: string; defId: string; slot: number }
  | { type: 'returned'; player: PlayerId; instanceId: string; defId: string }
  | { type: 'passed'; player: PlayerId }
  | { type: 'attacked'; player: PlayerId; assignments: AttackAssignment[] }
  | { type: 'intercepted'; attackerId: string; blockerId: string }
  | { type: 'challenged'; challengerId: string; targetId: string; slot: number }
  | { type: 'damagedUnit'; instanceId: string; amount: number; lethal: boolean }
  | { type: 'damagedNexus'; player: PlayerId; amount: number }
  | { type: 'healed'; player: PlayerId; amount: number }
  | { type: 'died'; instanceId: string; defId: string }
  | { type: 'leveledUp'; player: PlayerId; instanceId: string; defId: string }
  | { type: 'delayedResolved'; player: PlayerId; kind: string }
  | { type: 'destroyedSchool'; player: PlayerId; instanceId: string; defId: string }
  | { type: 'roundStarted'; round: number; activePlayer: PlayerId }
  | { type: 'roundEnded'; round: number }
  | { type: 'gameOver'; winner: PlayerId | 'draw' };

export type AttackTarget =
  | { kind: 'unit'; instanceId: string }
  | { kind: 'nexus' };

export type AttackAssignment = {
  attackerId: string;
  target: AttackTarget;
};

export type InterceptorAssignment = {
  attackerId: string;
  blockerId: string;
};

export type CombatState = {
  attacker: PlayerId;
  defender: PlayerId;
  assignments: AttackAssignment[];
};

export type GameState = {
  seed: number;
  rngState: number;
  round: number;
  phase: Phase;
  attackToken: PlayerId;
  activePlayer: PlayerId;
  priority: PlayerId;
  consecutivePasses: number;
  combat: CombatState | null;
  combatUsed: boolean;
  players: Record<PlayerId, PlayerState>;
  row: (CardInstance | null)[];
  back: Record<PlayerId, (CardInstance | null)[]>;
  delayed: DelayedEffect[];
  pendingDeaths: CardInstance[];
  pendingSummons: CardInstance[];
  turnStartPending: boolean;
  nextInstanceId: number;
  winner: Winner;
  events: GameEvent[];
  catalog: Record<string, CardDef>;
};

export type Action =
  | { type: 'MULLIGAN'; player: PlayerId; cardIds: string[] }
  | { type: 'PLAY_CARD'; player: PlayerId; cardId: string; slot?: number; targetId?: string }
  | { type: 'DECLARE_ATTACK'; player: PlayerId; assignments: AttackAssignment[] }
  | { type: 'ASSIGN_INTERCEPTORS'; player: PlayerId; interceptors: InterceptorAssignment[] }
  | { type: 'PASS'; player: PlayerId };

export type ActionError =
  | 'game-over'
  | 'wrong-phase'
  | 'not-your-priority'
  | 'card-not-in-hand'
  | 'invalid-card'
  | 'insufficient-energy'
  | 'row-full'
  | 'back-zone-full'
  | 'slot-occupied'
  | 'champion-limit'
  | 'school-limit'
  | 'mulligan-used'
  | 'not-your-turn'
  | 'combat-pending'
  | 'already-attacked'
  | 'no-attackers'
  | 'invalid-attacker'
  | 'invalid-target'
  | 'invalid-interceptor';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

export function isUnitType(type: CardType): boolean {
  return type === 'champion' || type === 'thinker' || type === 'token';
}
