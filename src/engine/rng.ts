export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let mixed = Math.imul(next ^ (next >>> 15), 1 | next);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

export function shuffle<T>(items: readonly T[], state: number): { items: T[]; state: number } {
  const out = [...items];
  let rngState = state;
  for (let index = out.length - 1; index > 0; index -= 1) {
    const next = nextRandom(rngState);
    rngState = next.state;
    const swapIndex = Math.floor(next.value * (index + 1));
    const current = out[index] as T;
    out[index] = out[swapIndex] as T;
    out[swapIndex] = current;
  }
  return { items: out, state: rngState };
}
