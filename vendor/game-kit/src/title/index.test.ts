import { describe, it, expect } from 'vitest';
import { progress01, DEFAULT_IDENT_TIMING } from './index.js';

describe('progress01', () => {
  it('clamps to [0,1]', () => {
    expect(progress01(-100, 1000)).toBe(0);
    expect(progress01(0, 1000)).toBe(0);
    expect(progress01(500, 1000)).toBe(0.5);
    expect(progress01(1000, 1000)).toBe(1);
    expect(progress01(5000, 1000)).toBe(1);
  });
  it('treats a non-positive duration as done', () => {
    expect(progress01(0, 0)).toBe(1);
    expect(progress01(10, -5)).toBe(1);
  });
});

describe('DEFAULT_IDENT_TIMING', () => {
  it('fires the cue before the hand-off', () => {
    expect(DEFAULT_IDENT_TIMING.cueMs).toBeLessThan(DEFAULT_IDENT_TIMING.durationMs);
  });
});
