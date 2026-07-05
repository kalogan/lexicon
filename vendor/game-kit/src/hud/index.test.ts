import { describe, it, expect } from 'vitest';
import { keyToDir4, DIR4, DIR4_GLYPH } from './index.js';

describe('keyToDir4', () => {
  it('maps the arrow keys', () => {
    expect(keyToDir4('ArrowUp')).toBe('up');
    expect(keyToDir4('ArrowDown')).toBe('down');
    expect(keyToDir4('ArrowLeft')).toBe('left');
    expect(keyToDir4('ArrowRight')).toBe('right');
  });
  it('maps WASD (case-insensitive)', () => {
    expect(keyToDir4('w')).toBe('up');
    expect(keyToDir4('S')).toBe('down');
    expect(keyToDir4('A')).toBe('left');
    expect(keyToDir4('d')).toBe('right');
  });
  it('returns null for non-movement keys', () => {
    expect(keyToDir4('e')).toBeNull();
    expect(keyToDir4(' ')).toBeNull();
    expect(keyToDir4('Enter')).toBeNull();
  });
});

describe('DIR4 / DIR4_GLYPH', () => {
  it('lists all four directions once', () => {
    expect([...DIR4].sort()).toEqual(['down', 'left', 'right', 'up']);
  });
  it('has a glyph for every direction', () => {
    for (const d of DIR4) expect(DIR4_GLYPH[d]).toBeTruthy();
  });
});
