import type { ReactNode } from 'react';

export function Row({ children }: { children: ReactNode }) {
  return (
    <div className="row" role="group" aria-label="Shared row">
      {children}
    </div>
  );
}
