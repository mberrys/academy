import { BackZone } from './BackZone';
import { Card } from './Card';
import { Row } from './Row';
import { Slot } from './Slot';
import type { GameState } from '../engine/types';

type BoardProps = {
  state: GameState;
  highlightSlots: Set<number>;
  onSlotClick: (slot: number) => void;
  targetIds: Set<string>;
  onTarget: (instanceId: string) => void;
  attackMode: boolean;
  readyAttackers: Set<string>;
  selectedAttackers: Set<string>;
  onAttacker: (instanceId: string) => void;
  onEnemyTarget: (instanceId: string) => void;
};

export function Board({
  state,
  highlightSlots,
  onSlotClick,
  targetIds,
  onTarget,
  attackMode,
  readyAttackers,
  selectedAttackers,
  onAttacker,
  onEnemyTarget,
}: BoardProps) {
  return (
    <section className="board" aria-label="Shared row">
        <BackZone
          state={state}
          cards={state.back.p2}
          label="Opponent School"
          targetIds={targetIds}
          onTarget={onTarget}
        />

        <div className="row-label">
          <span>Shared row</span>
          <span>Six slots</span>
        </div>

        <Row>
        {state.row.map((card, slot) => {
          if (!card) {
            return (
              <Slot
                key={slot}
                index={slot}
                empty
                highlighted={highlightSlots.has(slot)}
                onClick={() => onSlotClick(slot)}
              />
            );
          }

          const def = state.catalog[card.defId];
          if (!def) {
            return <Slot key={slot} index={slot} empty highlighted={false} />;
          }

          const isTarget = targetIds.has(card.instanceId);
          const isReadyAlly = attackMode && card.owner === 'p1' && readyAttackers.has(card.instanceId);
          const isEnemy = attackMode && card.owner === 'p2';
          const clickable = isTarget || isReadyAlly || isEnemy;

          const handleClick = clickable
            ? () => {
                if (attackMode) {
                  if (card.owner === 'p1' && readyAttackers.has(card.instanceId)) {
                    onAttacker(card.instanceId);
                  } else if (card.owner === 'p2') {
                    onEnemyTarget(card.instanceId);
                  }
                  return;
                }
                if (isTarget) {
                  onTarget(card.instanceId);
                }
              }
            : undefined;

          return (
            <Slot key={slot} index={slot} empty={false}>
              <Card
                def={def}
                card={card}
                state={state}
                size="board"
                highlight={isTarget || isReadyAlly}
                selected={selectedAttackers.has(card.instanceId)}
                onClick={handleClick}
              />
            </Slot>
          );
        })}
      </Row>

      <BackZone
        state={state}
        cards={state.back.p1}
        label="Your School"
        targetIds={targetIds}
        onTarget={onTarget}
      />
    </section>
  );
}
