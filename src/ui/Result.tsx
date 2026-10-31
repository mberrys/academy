import { CARD_CATALOG } from '../cards';
import type { ChampionId } from '../cards';
import type { GameState } from '../engine/types';

type ResultProps = {
  state: GameState;
  champion: ChampionId;
  onRematch: () => void;
  onSelect: () => void;
};

export function Result({ state, champion, onRematch, onSelect }: ResultProps) {
  const draw = state.winner === 'draw';
  const won = state.winner === 'p1';
  const title = draw ? 'A draw' : won ? 'You win' : 'The opponent wins';
  const yours = CARD_CATALOG[champion]?.name ?? champion;
  const theirs = CARD_CATALOG[state.players.p2.championDefId]?.name ?? state.players.p2.championDefId;

  return (
    <>
      <div className="topbar">
        <div className="wordmark">
          Academy
          <small>A game of arguments</small>
        </div>
        <div className="topbar-meta">
          <span className="chip">Round {state.round}</span>
          <span className="chip chip-on">Match over</span>
        </div>
      </div>

      <main className="result-screen" aria-label="Result">
        <div className="result-card">
          <div className="result-kicker">The argument is settled</div>
          <h1 className="result-title">{title}</h1>
          <p className="result-line">You played {yours}. {theirs} played the opponent.</p>
          <p className="result-line">
            {draw
              ? 'Neither argument carried the room.'
              : won
                ? 'Your argument carried the room.'
                : 'The room went the other way.'}
          </p>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={onRematch}>
              Play again
            </button>
            <button type="button" className="btn" onClick={onSelect}>
              Choose a champion
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
