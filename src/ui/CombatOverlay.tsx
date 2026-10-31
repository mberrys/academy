import { useEffect, useRef, useState } from 'react';
import { adjacentSlots } from '../engine/zones';
import type { ActionError, CardInstance, GameState, InterceptorAssignment } from '../engine/types';

type CombatOverlayProps = {
  state: GameState;
  onConfirm: (interceptors: InterceptorAssignment[]) => void;
  error: ActionError | null;
};

export function CombatOverlay({ state, onConfirm, error }: CombatOverlayProps) {
  const combat = state.combat;
  const [blocks, setBlocks] = useState<Record<string, string>>({});
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  if (!combat) {
    return null;
  }

  // A blocker can intercept only one attacker, so chips used by another attacker are disabled.
  const blockerClaims = new Map(
    Object.entries(blocks)
      .filter(([, blockerId]) => blockerId)
      .map(([attackerId, blockerId]) => [blockerId, attackerId]),
  );

  const submit = () => {
    const interceptors = Object.entries(blocks)
      .filter(([, blockerId]) => blockerId)
      .map(([attackerId, blockerId]) => ({ attackerId, blockerId }));
    onConfirm(interceptors);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Combat">
      <div className="overlay-panel">
        <h2 className="overlay-title">Combat</h2>
        <p className="overlay-lede">
          Assign a blocker to an attacker, or take the damage. Only adjacent allies can block.
        </p>

        {combat.assignments.map((assignment, index) => {
          const attacker = state.row.find((card) => card?.instanceId === assignment.attackerId);
          const attackerName = attacker ? state.catalog[attacker.defId]?.name ?? 'An attacker' : 'An attacker';
          const targetRef = assignment.target;
          const target = targetRef.kind === 'unit'
            ? state.row.find((card) => card?.instanceId === targetRef.instanceId)
            : undefined;
          const targetName = targetRef.kind === 'nexus'
            ? 'your nexus'
            : target
              ? state.catalog[target.defId]?.name ?? 'a unit'
              : 'a unit';
          const blockers = target?.slot === undefined
            ? []
            : adjacentSlots(target.slot)
                .map((slot) => state.row[slot])
                .filter((card): card is CardInstance => card != null && card.owner === 'p1');

          return (
            <div className="combat-row" key={assignment.attackerId}>
              <div className="combat-line">
                <strong>{attackerName}</strong> attacks <strong>{targetName}</strong>.
              </div>
              <div className="combat-blockers">
                <button
                  ref={index === 0 ? firstRef : undefined}
                  type="button"
                  className={`blocker-chip ${!blocks[assignment.attackerId] ? 'is-selected' : ''}`}
                  onClick={() => setBlocks((previous) => ({ ...previous, [assignment.attackerId]: '' }))}
                >
                  No block
                </button>
                {blockers.map((blocker) => {
                  const name = state.catalog[blocker.defId]?.name ?? 'Ally';
                  const claimedByOther = blockerClaims.has(blocker.instanceId)
                    && blockerClaims.get(blocker.instanceId) !== assignment.attackerId;
                  return (
                    <button
                      key={blocker.instanceId}
                      type="button"
                      disabled={claimedByOther}
                      className={`blocker-chip ${blocks[assignment.attackerId] === blocker.instanceId ? 'is-selected' : ''}`}
                      onClick={() => setBlocks((previous) => ({ ...previous, [assignment.attackerId]: blocker.instanceId }))}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {blockers.length === 0 && (
                <span className="hint">No adjacent ally can block. The attack goes through.</span>
              )}
            </div>
          );
        })}

        {error && <div className="error-note" role="alert">That block was rejected: {error}.</div>}

        <div className="overlay-actions">
          <button type="button" className="btn btn-primary" onClick={submit}>
            Confirm blocks
          </button>
        </div>
      </div>
    </div>
  );
}
