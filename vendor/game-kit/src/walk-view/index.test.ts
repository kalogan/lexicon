import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WALK_VIEW,
  resolveConfig,
  tileToWorld,
  stepHop,
  facingFromDelta,
  followCam,
  billboardYaw,
} from './index.js';

const T = DEFAULT_WALK_VIEW.tile;

describe('resolveConfig', () => {
  it('returns defaults verbatim when nothing is passed', () => {
    expect(resolveConfig()).toBe(DEFAULT_WALK_VIEW);
  });
  it('overrides only the given fields', () => {
    const c = resolveConfig({ hopHeight: 1 });
    expect(c.hopHeight).toBe(1);
    expect(c.tile).toBe(DEFAULT_WALK_VIEW.tile);
  });
});

describe('tileToWorld', () => {
  it('centers the grid on the origin (odd size → middle tile at 0)', () => {
    // 13×9 grid: middle tile (6,4) sits at the origin.
    expect(tileToWorld(6, 4, 13, 9, T)).toEqual([0, 0, 0]);
  });
  it('maps +x tile → +x world, +y tile → +z world', () => {
    const [x0, , z0] = tileToWorld(6, 4, 13, 9, T);
    const [x1, , z1] = tileToWorld(7, 5, 13, 9, T);
    expect(x1 - x0).toBeCloseTo(T);
    expect(z1 - z0).toBeCloseTo(T);
  });
  it('keeps y on the ground plane', () => {
    expect(tileToWorld(2, 3, 10, 10, T)[1]).toBe(0);
  });
});

describe('stepHop', () => {
  it('is 0 at the target tile (dist 0) and at step start (dist = tile)', () => {
    expect(stepHop(0, T, 0.42)).toBeCloseTo(0);
    expect(stepHop(T, T, 0.42)).toBeCloseTo(0);
  });
  it('peaks at the mid-step', () => {
    expect(stepHop(T / 2, T, 0.42)).toBeCloseTo(0.42);
  });
  it('never exceeds the peak and never dips below 0', () => {
    for (let d = 0; d <= T; d += T / 20) {
      const h = stepHop(d, T, 0.42);
      expect(h).toBeGreaterThanOrEqual(-1e-9);
      expect(h).toBeLessThanOrEqual(0.42 + 1e-9);
    }
  });
  it('clamps a >1-tile distance instead of producing a giant hop', () => {
    expect(stepHop(T * 5, T, 0.42)).toBeCloseTo(0); // clamped to p=0
  });
});

describe('facingFromDelta', () => {
  const dz = DEFAULT_WALK_VIEW.faceDeadzone;
  it('returns null inside the deadzone (idle holds last facing)', () => {
    expect(facingFromDelta(0, 0, dz)).toBeNull();
    expect(facingFromDelta(0.01, 0, dz)).toBeNull(); // 0.0001 <= 0.0004
  });
  it('down (+z, toward camera) faces 0 → front toward camera', () => {
    expect(facingFromDelta(0, 1, dz)).toBeCloseTo(0);
  });
  it('right (+x) faces +π/2, left (−x) faces −π/2', () => {
    expect(facingFromDelta(1, 0, dz)).toBeCloseTo(Math.PI / 2);
    expect(facingFromDelta(-1, 0, dz)).toBeCloseTo(-Math.PI / 2);
  });
  it('up (−z, away) faces π', () => {
    expect(Math.abs(facingFromDelta(0, -1, dz)!)).toBeCloseTo(Math.PI);
  });
});

describe('followCam', () => {
  it('sits camUp above and camBack behind the player, looking at lookHeight', () => {
    const { position, look } = followCam(3, 5, DEFAULT_WALK_VIEW);
    expect(position).toEqual([3, DEFAULT_WALK_VIEW.camUp, 5 + DEFAULT_WALK_VIEW.camBack]);
    expect(look).toEqual([3, DEFAULT_WALK_VIEW.lookHeight, 5]);
  });
});

describe('billboardYaw', () => {
  it('camera on +z side → 0 (front already faces it)', () => {
    expect(billboardYaw(0, 0, 0, 10)).toBeCloseTo(0);
  });
  it('camera on +x side → +π/2', () => {
    expect(billboardYaw(0, 0, 10, 0)).toBeCloseTo(Math.PI / 2);
  });
  it('camera behind (−z) → ±π', () => {
    expect(Math.abs(billboardYaw(0, 0, 0, -10))).toBeCloseTo(Math.PI);
  });
  it('degenerate (camera on the object) → 0, not NaN', () => {
    expect(billboardYaw(2, 2, 2, 2)).toBe(0);
  });
});
