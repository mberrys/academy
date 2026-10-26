import { Card } from './Card';
import type { CardInstance, GameState } from '../engine/types';

type BackZoneProps = {
  state: GameState;
  cards: Array<CardInstance | null>;
  label: string;
  targetIds: Set<string>;
  onTarget: (instanceId: string) => void;
};

export function BackZone({ state, cards, label, targetIds, onTarget }: BackZoneProps) {
  const visible = cards.filter((card): card is CardInstance => card !== null);

  return (
    <div className="back-zone" aria-label={label}>
      <span className="back-zone-label">{label}</span>
      <div className="back-zone-cards">
        {visible.map((card) => {
          const def = state.catalog[card.defId];
          if (!def) {
            return null;
          }
          const targetable = targetIds.has(card.instanceId);
          return (
            <Card
              key={card.instanceId}
              def={def}
              card={card}
              state={state}
              size="mini"
              highlight={targetable}
              onClick={targetable ? () => onTarget(card.instanceId) : undefined}
            />
          );
        })}
      </div>
      {visible.length === 0 && <span className="back-zone-empty-label">No School in play.</span>}
    </div>
  );
}
