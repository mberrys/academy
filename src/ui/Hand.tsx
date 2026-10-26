import { Card } from './Card';
import type { CardInstance, GameState } from '../engine/types';

type HandProps = {
  state: GameState;
  cards: CardInstance[];
  selectedId: string | null;
  playableIds: Set<string>;
  onSelect: (instanceId: string) => void;
};

export function Hand({ state, cards, selectedId, playableIds, onSelect }: HandProps) {
  return (
    <section className="hand-section" aria-label="Your hand">
      <div className="hand-head">
        <span className="panel-label">Your hand</span>
        <span className="panel-label">{cards.length} cards</span>
      </div>
      {cards.length === 0 ? (
        <p className="hand-empty">Your hand is empty.</p>
      ) : (
        <div className="hand">
          {cards.map((card) => {
            const def = state.catalog[card.defId];
            if (!def) {
              return null;
            }
            return (
              <Card
                key={card.instanceId}
                def={def}
                card={card}
                state={state}
                size="hand"
                selected={selectedId === card.instanceId}
                playable={playableIds.has(card.instanceId)}
                onClick={() => onSelect(card.instanceId)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
