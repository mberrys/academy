import type { GameEvent, GameState, PlayerId } from '../engine/types';

function who(player: PlayerId): string {
  return player === 'p1' ? 'You' : 'The opponent';
}

function defName(state: GameState, defId: string): string {
  return state.catalog[defId]?.name ?? 'a card';
}

function nameOf(state: GameState, instanceId: string): string {
  const zones = [
    state.row,
    state.back.p1,
    state.back.p2,
    state.players.p1.hand,
    state.players.p2.hand,
    state.players.p1.discard,
    state.players.p2.discard,
  ];
  for (const zone of zones) {
    const card = zone.find((entry) => entry?.instanceId === instanceId);
    if (card) {
      return defName(state, card.defId);
    }
  }
  return 'A unit';
}

function describe(state: GameState, event: GameEvent): string {
  switch (event.type) {
    case 'gameStarted':
      return 'The match begins.';
    case 'mulliganed':
      return `${who(event.player)} mulliganed ${event.count} card${event.count === 1 ? '' : 's'}.`;
    case 'drew':
      return `${who(event.player)} drew a card.`;
    case 'burned':
      return `${who(event.player)} burned a card.`;
    case 'played':
      return `${who(event.player)} played ${defName(state, event.defId)}.`;
    case 'created':
      return `${who(event.player)} created ${defName(state, event.defId)}.`;
    case 'summoned':
      return `${who(event.player)} summoned ${defName(state, event.defId)}.`;
    case 'returned':
      return `${defName(state, event.defId)} returned to hand.`;
    case 'passed':
      return `${who(event.player)} passed.`;
    case 'attacked':
      return `${who(event.player)} declared an attack.`;
    case 'intercepted':
      return 'A blocker stepped into the attack.';
    case 'challenged':
      return `${nameOf(state, event.challengerId)} pulled ${nameOf(state, event.targetId)} into combat.`;
    case 'damagedUnit':
      return `${nameOf(state, event.instanceId)} took ${event.amount} damage.`;
    case 'damagedNexus':
      return `${who(event.player)} nexus took ${event.amount} damage.`;
    case 'healed':
      return `${who(event.player)} nexus healed ${event.amount}.`;
    case 'died':
      return `${defName(state, event.defId)} died.`;
    case 'leveledUp':
      return `${defName(state, event.defId)} reached level two.`;
    case 'delayedResolved':
      return 'A Time Bomb resolved.';
    case 'destroyedSchool':
      return `${defName(state, event.defId)} was destroyed.`;
    case 'roundStarted':
      return `Round ${event.round}. Attack token: ${who(event.activePlayer)}.`;
    case 'roundEnded':
      return `Round ${event.round} ended.`;
    case 'gameOver':
      if (event.winner === 'draw') {
        return 'The match is a draw.';
      }
      return event.winner === 'p1' ? 'You win.' : 'The opponent wins.';
    default:
      return 'The match moved on.';
  }
}

export function Log({ state }: { state: GameState }) {
  const entries = state.events.slice(-10).reverse();
  return (
    <div className="log" aria-live="polite" aria-label="Game log">
      {entries.map((event, index) => (
        <p className="log-entry" key={`${event.type}-${index}`}>{describe(state, event)}</p>
      ))}
    </div>
  );
}
