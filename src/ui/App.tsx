import { useEffect, useRef, useState } from 'react';
import { getLegalActions } from '../engine/legality';
import type { Action, ActionError, CardInstance, GameState } from '../engine/types';
import type { ChampionId } from '../cards';
import { Board } from './Board';
import { CombatOverlay } from './CombatOverlay';
import { Hand } from './Hand';
import { Log } from './Log';
import { Result } from './Result';
import { useGame } from './useGame';

const CHAMPION_META: Record<ChampionId, {
  name: string;
  title: string;
  plan: string;
  quote: string;
  stats: string;
  monogram: string;
}> = {
  marx: {
    name: 'Karl Marx',
    title: 'Historical Materialism',
    plan: 'Schedule Time Bombs, then cash them in. Your losses make the next Argument cheaper.',
    quote: '"The philosophers have only interpreted the world."',
    stats: '3 energy · 2 / 4 · control',
    monogram: 'KM',
  },
  lacan: {
    name: 'Jacques Lacan',
    title: 'Psychoanalysis',
    plan: 'Chain a Thinker into an Argument, copy it, and play the copy for value.',
    quote: '"The unconscious is structured like a language."',
    stats: '2 energy · 1 / 4 · combo',
    monogram: 'JL',
  },
  luther: {
    name: 'Martin Luther',
    title: 'Reformation Theology',
    plan: 'Fill the row with Congregants, then make them bigger than the other side.',
    quote: '"Here I stand. I can do no other."',
    stats: '3 energy · 1 / 5 · wide',
    monogram: 'ML',
  },
};

function Topbar({ round, turn, token }: { round?: number; turn?: string; token?: boolean }) {
  return (
    <div className="topbar">
      <div className="wordmark">
        Academy
        <small>A game of arguments</small>
      </div>
      <div className="topbar-meta">
        {round === undefined
          ? <span className="chip">Choose a champion</span>
          : <span className="chip">Round {round}</span>}
        {turn && <span className={`chip ${turn === 'Your turn' ? 'chip-on' : ''}`}>{turn}</span>}
        {token && <span className="chip chip-token">Attack token yours</span>}
      </div>
    </div>
  );
}

function ChampionSelect({ onStart }: { onStart: (champion: ChampionId) => void }) {
  return (
    <main className="select-screen">
      <div className="select-hero">
        <h1 className="select-title">Academy</h1>
        <p className="select-lede">
          A card game about philosophy. Choose a champion, hold the shared row, and argue your way to twenty.
        </p>
        <p className="select-note">Your opponent is drawn from the other two champions.</p>
      </div>

      <div className="champion-grid">
        {(['marx', 'lacan', 'luther'] as ChampionId[]).map((id) => {
          const meta = CHAMPION_META[id];
          return (
            <button
              key={id}
              type="button"
              className="champion-plate"
              onClick={() => onStart(id)}
              aria-label={`Play as ${meta.name}, ${meta.title}. ${meta.plan}`}
            >
              <span className="champion-monogram">{meta.monogram}</span>
              <span className="champion-name">{meta.name}</span>
              <span className="champion-title">{meta.title}</span>
              <span className="champion-plan">{meta.plan}</span>
              <span className="champion-quote">{meta.quote}</span>
              <span className="champion-stats">{meta.stats}</span>
              <span className="champion-cta">Choose this champion</span>
            </button>
          );
        })}
      </div>
      <p className="select-footer">
        Quick Attack · Challenger · Barrier · Tough · Overwhelm. Twenty nexus. One shared row.
      </p>
    </main>
  );
}

function PlayerSummary({ state, player, label }: { state: GameState; player: 'p1' | 'p2'; label: string }) {
  const playerState = state.players[player];
  const champion = state.catalog[playerState.championDefId];
  const school = state.back[player]
    .filter((card): card is CardInstance => card !== null)
    .map((card) => state.catalog[card.defId]?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <section
      className="side-panel"
      aria-label={`${label}. ${champion?.name ?? 'Champion'}. ${playerState.health} nexus health. ${playerState.energy} energy and ${playerState.spellMana} spell mana.`}
    >
      <span className="panel-label">{label}</span>
      <h2>{champion?.name ?? playerState.championDefId}</h2>
      <div className="nexus-row">
        <span className="seal" aria-hidden="true">{playerState.health}</span>
        <span className="nexus-caption">Nexus<br />health</span>
      </div>
      <div className="pips" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={`pip ${index < playerState.energy ? '' : index < playerState.energy + playerState.spellMana ? 'pip-spell' : 'pip-empty'}`}
          />
        ))}
      </div>
      <div className="resource-line">{playerState.energy} energy · {playerState.spellMana} spell mana</div>
      <div className="resource-line">Hand {playerState.hand.length} · Deck {playerState.deck.length}</div>
      <div className="school-line"><span className="school-dot" />{school || 'No School'}</div>
    </section>
  );
}

export type MatchScreenProps = {
  state: GameState;
  onAction: (action: Action) => void;
  error: ActionError | null;
};

export function MatchScreen({ state, onAction, error }: MatchScreenProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [attackMode, setAttackMode] = useState(false);
  const [selectedAttackers, setSelectedAttackers] = useState<string[]>([]);
  const targetChipsRef = useRef<HTMLDivElement>(null);

  const humanTurn = state.phase === 'actions' && !state.combat && state.priority === 'p1';
  const inCombat = state.combat?.defender === 'p1';
  const aiTurn = state.phase === 'actions' && (state.combat ? state.combat.defender === 'p2' : state.priority === 'p2');

  const legal = state.phase === 'actions' ? getLegalActions(state, 'p1') : [];
  const playActions = legal.filter((action): action is Extract<Action, { type: 'PLAY_CARD' }> => action.type === 'PLAY_CARD');
  const playableCardIds = new Set(playActions.map((action) => action.cardId));
  const selectedActions = selectedCardId ? playActions.filter((action) => action.cardId === selectedCardId) : [];
  const targetActions = selectedActions.filter((action) => action.targetId !== undefined);
  const slotActions = selectedActions.filter((action) => action.slot !== undefined);
  const plainAction = selectedActions.find((action) => action.targetId === undefined && action.slot === undefined);

  const selectedCard = selectedCardId
    ? state.players.p1.hand.find((card) => card.instanceId === selectedCardId)
    : undefined;
  const selectedDef = selectedCard ? state.catalog[selectedCard.defId] : undefined;
  const isSchoolSelection = selectedDef?.type === 'school';
  const rowSlotActions = isSchoolSelection ? [] : slotActions;
  const backSlotActions = isSchoolSelection ? slotActions : [];
  const highlightSlots = new Set(rowSlotActions.map((action) => action.slot!));
  const targetIds = new Set(targetActions.map((action) => action.targetId!));

  const readyAttackers = new Set(
    state.row
      .filter((card): card is CardInstance => card !== null && card.owner === 'p1' && card.enteredRound < state.round)
      .map((card) => card.instanceId),
  );
  const canAttack = humanTurn && state.activePlayer === 'p1' && !state.combatUsed && readyAttackers.size > 0;

  const targetName = (instanceId: string): string => {
    const unit = state.row.find((card) => card?.instanceId === instanceId);
    if (unit) {
      return state.catalog[unit.defId]?.name ?? 'Unit';
    }
    const school = [...state.back.p1, ...state.back.p2]
      .find((card) => card?.instanceId === instanceId);
    return school ? state.catalog[school.defId]?.name ?? 'School' : 'Target';
  };

  useEffect(() => {
    setSelectedCardId(null);
    setAttackMode(false);
    setSelectedAttackers([]);
  }, [state.priority, state.round, state.combat?.attacker, state.combat?.defender, state.phase]);

  useEffect(() => {
    if (!selectedCardId || !targetChipsRef.current) {
      return;
    }
    const first = targetChipsRef.current.querySelector('button');
    first?.focus();
  }, [selectedCardId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCardId(null);
        setAttackMode(false);
        setSelectedAttackers([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const playAction = (action: Action) => {
    onAction(action);
    setSelectedCardId(null);
    setAttackMode(false);
    setSelectedAttackers([]);
  };

  const cancelSelection = () => {
    setSelectedCardId(null);
    setAttackMode(false);
    setSelectedAttackers([]);
  };

  const selectCard = (instanceId: string) => {
    setAttackMode(false);
    setSelectedAttackers([]);
    setSelectedCardId((current) => current === instanceId ? null : instanceId);
  };

  const toggleAttacker = (instanceId: string) => {
    if (!attackMode || !readyAttackers.has(instanceId)) {
      return;
    }
    setSelectedAttackers((current) => current.includes(instanceId)
      ? current.filter((id) => id !== instanceId)
      : [...current, instanceId]);
  };

  const attackNexus = () => {
    if (selectedAttackers.length === 0) {
      return;
    }
    onAction({
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: selectedAttackers.map((attackerId) => ({ attackerId, target: { kind: 'nexus' } })),
    });
    setAttackMode(false);
    setSelectedAttackers([]);
  };

  const attackUnit = (instanceId: string) => {
    if (selectedAttackers.length === 0) {
      return;
    }
    onAction({
      type: 'DECLARE_ATTACK',
      player: 'p1',
      assignments: selectedAttackers.map((attackerId) => ({
        attackerId,
        target: { kind: 'unit', instanceId },
      })),
    });
    setAttackMode(false);
    setSelectedAttackers([]);
  };

  const playTarget = (instanceId: string) => {
    const action = targetActions.find((candidate) => candidate.targetId === instanceId);
    if (action) {
      playAction(action);
    }
  };

  const playSlot = (slot: number) => {
    const action = rowSlotActions.find((candidate) => candidate.slot === slot);
    if (action) {
      playAction(action);
    }
  };

  const onEnemyTarget = (instanceId: string) => {
    if (attackMode) {
      attackUnit(instanceId);
      return;
    }
    playTarget(instanceId);
  };

  const toggleAttackMode = () => {
    if (!canAttack) {
      return;
    }
    setSelectedCardId(null);
    setSelectedAttackers([]);
    setAttackMode((current) => !current);
  };

  return (
    <>
      <Topbar
        round={state.round}
        turn={inCombat ? 'Combat' : humanTurn ? 'Your turn' : 'Opponent turn'}
        token={state.attackToken === 'p1'}
      />

      <div className="match-grid">
        <aside className="side-column" aria-label="Opponent and log">
          <PlayerSummary state={state} player="p2" label="Opponent" />
          <Log state={state} />
        </aside>

        <div className="board-column">
          <Board
            state={state}
            highlightSlots={highlightSlots}
            onSlotClick={playSlot}
            targetIds={targetIds}
            onTarget={playTarget}
            attackMode={attackMode}
            readyAttackers={readyAttackers}
            selectedAttackers={new Set(selectedAttackers)}
            onAttacker={toggleAttacker}
            onEnemyTarget={onEnemyTarget}
          />
        </div>

        <aside className="side-column" aria-label="You and controls">
          <PlayerSummary state={state} player="p1" label="You" />
          <section className="side-panel">
            <span className="panel-label">Controls</span>
            <p className="hint">Select a card, then a target or a slot.</p>
            <p className="hint">Tab moves. Enter selects. Escape cancels.</p>
          </section>
        </aside>
      </div>

      <Hand
        state={state}
        cards={state.players.p1.hand}
        selectedId={selectedCardId}
        playableIds={playableCardIds}
        onSelect={selectCard}
      />

      <div className="action-bar" role="toolbar" aria-label="Actions">
        <div className="action-status">
          <span className={`chip ${humanTurn ? 'chip-on' : ''}`}>
            {inCombat ? 'Combat' : humanTurn ? 'Your turn' : 'Opponent turn'}
          </span>
          <span className="turn-note">
            Energy {state.players.p1.energy} · Spell {state.players.p1.spellMana} · Round {state.round}
          </span>
        </div>

        {humanTurn && selectedCardId && (
          <div className="target-chips" ref={targetChipsRef} role="group" aria-label="Play the selected card">
            <span className="target-chip-label">{selectedDef?.name ?? 'Card'}:</span>
            {plainAction && (
              <button type="button" className="target-chip" onClick={() => playAction(plainAction)}>
                Play
              </button>
            )}
            {backSlotActions.map((action) => (
              <button
                key={`back-${action.slot}`}
                type="button"
                className="target-chip"
                onClick={() => playAction(action)}
              >
                School slot {(action.slot ?? 0) + 1}
              </button>
            ))}
            {rowSlotActions.map((action) => (
              <button
                key={`row-${action.slot}`}
                type="button"
                className="target-chip"
                onClick={() => playAction(action)}
              >
                Row slot {(action.slot ?? 0) + 1}
              </button>
            ))}
            {targetActions.map((action) => (
              <button
                key={`target-${action.targetId}`}
                type="button"
                className="target-chip"
                onClick={() => playAction(action)}
              >
                {targetName(action.targetId!)}
              </button>
            ))}
            {selectedActions.length === 0 && <span className="action-hint">No legal play for this card.</span>}
          </div>
        )}

        {humanTurn && attackMode && (
          <div className="action-hint">
            Select ready allies on the board, then choose Attack nexus or an enemy unit.
          </div>
        )}

        <div className="action-buttons">
          {humanTurn && selectedCardId && (
            <button type="button" className="btn btn-ghost" onClick={cancelSelection}>Cancel</button>
          )}
          {humanTurn && attackMode && (
            <button type="button" className="btn btn-ghost" onClick={cancelSelection}>Cancel attack</button>
          )}
          {humanTurn && attackMode && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={attackNexus}
              disabled={selectedAttackers.length === 0}
            >
              Attack nexus
            </button>
          )}
          {humanTurn && !attackMode && canAttack && (
            <button type="button" className="btn" onClick={toggleAttackMode}>Attack</button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => onAction({ type: 'PASS', player: 'p1' })} disabled={!humanTurn}>
            Pass
          </button>
        </div>

        {aiTurn && <span className="thinking">The opponent is considering</span>}
        {error && <div className="error-note" role="alert">That action was rejected. {error}.</div>}
      </div>

      {inCombat && (
        <CombatOverlay
          state={state}
          onConfirm={(interceptors) => onAction({ type: 'ASSIGN_INTERCEPTORS', player: 'p1', interceptors })}
        />
      )}
    </>
  );
}

export function App() {
  const game = useGame();

  if (game.screen === 'select' || !game.game || !game.champion) {
    return <ChampionSelect onStart={game.start} />;
  }

  if (game.screen === 'result') {
    return (
      <Result
        state={game.game}
        champion={game.champion}
        onRematch={() => game.start(game.champion!)}
        onSelect={game.reset}
      />
    );
  }

  return <MatchScreen state={game.game} onAction={game.play} error={game.error} />;
}
