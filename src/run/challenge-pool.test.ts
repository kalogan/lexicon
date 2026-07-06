/**
 * Tests for the Challenge-mode relic exclusions. Challenge has no clock, so
 * TIME-only relics (pure time-granters + pure time-converters) are dead weight and
 * must be dropped from the Challenge draft/shop pool — while relics that touch time
 * but ALSO grant unconditional chips/mult/permaMult stay in.
 */
import { describe, it, expect } from "vitest";
import { CHALLENGE_EXCLUDED_RELICS } from "./challenge-pool.js";
import { DRAFT_POOL, CATALOG } from "./cards.js";

describe("CHALLENGE_EXCLUDED_RELICS", () => {
  it("excludes the pure time-granter relics (apply only grants ctx.timeGain)", () => {
    for (const id of ["time", "hourglass", "metronome", "wellspring", "lodestone", "x6-tailwind"]) {
      expect(CHALLENGE_EXCLUDED_RELICS.has(id)).toBe(true);
    }
  });

  it("excludes the time-converter / time-gated relics (pay 0 without a clock)", () => {
    // Time Broker (chips per second), Sundial (mult per second), Horologist
    // (perma-mult gated on restoring 6s+) all read ctx.timeGain and do nothing
    // once the granters are gone.
    for (const id of ["time-broker", "sundial", "horologist"]) {
      expect(CHALLENGE_EXCLUDED_RELICS.has(id)).toBe(true);
    }
  });

  it("does NOT exclude relics that touch time but also grant chips/mult/permaMult", () => {
    // Overclock (spends time but still ×2), Chronologist (permaMult), Curator
    // (chips), Reservoir/Colossus (chips), Marathon (mult) all work with a dead
    // clock — keep them.
    for (const id of ["overclock", "spendthrift", "chronologist", "curator", "reservoir", "colossus", "marathon"]) {
      expect(CHALLENGE_EXCLUDED_RELICS.has(id)).toBe(false);
    }
  });

  it("every excluded id is a real relic in the CATALOG", () => {
    const known = new Set(CATALOG.map((c) => c.id));
    for (const id of CHALLENGE_EXCLUDED_RELICS) {
      expect(known.has(id)).toBe(true);
    }
  });

  it("the filtered Challenge pool contains none of the excluded relics", () => {
    const challengePool = DRAFT_POOL.filter((c) => !CHALLENGE_EXCLUDED_RELICS.has(c.id));
    for (const c of challengePool) {
      expect(CHALLENGE_EXCLUDED_RELICS.has(c.id)).toBe(false);
    }
    // Sanity: filtering actually removed the excluded relics that live in DRAFT_POOL.
    const draftIds = new Set(DRAFT_POOL.map((c) => c.id));
    const removed = [...CHALLENGE_EXCLUDED_RELICS].filter((id) => draftIds.has(id));
    expect(removed.length).toBeGreaterThan(0);
    expect(challengePool.length).toBe(DRAFT_POOL.length - removed.length);
  });
});
