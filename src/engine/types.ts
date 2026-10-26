export type PlayerId = 'p1' | 'p2';
export type Phase = 'mulligan' | 'actions' | 'over';
export type Winner = PlayerId | 'draw' | null;
export type CardType = 'champion' | 'thinker' | 'argument' | 'school' | 'token';
export type Keyword = 'quickAttack' | 'challenger' | 'barrier' | 'tough' | 'overwhelm';
export type Zone = 'deck' | 'hand' | 'row' | 'back' | 'discard';

export const ENGINE_NAME = 'academy-engine';
export const ENGINE_VERSION = '0.2.0';
export const ROW_SLOTS = 6;
export const BACK_SLOTS = 2;
export const MAX_HAND = 10;
export const MAX_ENERGY = 10;
export const SPELL_MANA_CAP = 3;
export const ROUND_CAP = 20;
export const START_HEALTH = 20;

export type CardDef = {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  attack?: number;
  health?: number;
  keywords?: Keyword[];
};

export type CardInstance = {
  instanceId: string;
  defId: string;
  owner: PlayerId;
  zone: Zone;
  slot?: number;
  damage: number;
  costDelta: number;
  grantedKeywords: Keyword[];
  isCopy: boolean;
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
  championDefId: string;
  championProgress: number;
  championLevel: 1 | 2;
  mulliganUsed: boolean;
};

export type GameEvent =
  | { type: 'gameStarted'; seed: number }
  | { type: 'mulliganed'; player: PlayerId; count: number }
  | { type: 'drew'; player: PlayerId; defId: string }
  | { type: 'burned'; player: PlayerId; defId: string }
  | { type: 'played'; player: PlayerId; defId: string; slot?: number }
  | { type: 'passed'; player: PlayerId }
  | { type: 'roundStarted'; round: number; activePlayer: PlayerId }
  | { type: 'roundEnded'; round: number }
  | { type: 'gameOver'; winner: PlayerId | 'draw' };

export type GameState = {
  seed: number;
  rngState: number;
  round: number;
  phase: Phase;
  attackToken: PlayerId;
  activePlayer: PlayerId;
  priority: PlayerId;
  consecutivePasses: number;
  players: Record<PlayerId, PlayerState>;
  row: (CardInstance | null)[];
  back: Record<PlayerId, (CardInstance | null)[]>;
  winner: Winner;
  events: GameEvent[];
  catalog: Record<string, CardDef>;
};

export type Action =
  | { type: 'MULLIGAN'; player: PlayerId; cardIds: string[] }
  | { type: 'PLAY_CARD'; player: PlayerId; cardId: string; slot?: number }
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
  | 'mulligan-used';

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

export function isUnitType(type: CardType): boolean {
  return type === 'champion' || type === 'thinker' || type === 'token';
}
