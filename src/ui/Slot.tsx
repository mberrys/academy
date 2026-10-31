import type { ReactNode } from 'react';

type SlotProps = {
  index: number;
  empty: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  children?: ReactNode;
};

export function Slot({ index, empty, highlighted = false, onClick, children }: SlotProps) {
  if (empty) {
    if (highlighted) {
      return (
        <button
          type="button"
          className="slot-empty slot-highlight"
          onClick={onClick}
          aria-label={`Empty slot ${index + 1}, playable`}
        >
          <span className="slot-number">{index + 1}</span>
          <span className="slot-empty-label">Play here</span>
        </button>
      );
    }

    return (
      <div className="slot-empty" aria-hidden="true">
        <span className="slot-number">{index + 1}</span>
        <span className="slot-empty-label">Open</span>
      </div>
    );
  }

  return (
    <div className="slot">
      <span className="slot-number">{index + 1}</span>
      {children}
    </div>
  );
}
