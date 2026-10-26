import { describe, expect, it } from 'vitest';
import { BACK_SLOTS, ENGINE_NAME, ROW_SLOTS } from './index';

describe('engine boundary', () => {
  it('exposes the board dimensions', () => {
    expect(ENGINE_NAME).toBe('academy-engine');
    expect(ROW_SLOTS).toBe(6);
    expect(BACK_SLOTS).toBe(2);
  });
});
