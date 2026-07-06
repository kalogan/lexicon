import { describe, it, expect } from "vitest";
import { CATALOG } from "./cards.js";
import { unlockedRelicIds, LOCKABLE_RELIC_IDS, lockedCount, unlockHint } from "./unlocks.js";

const ZERO = { challengeWins: 0, bossesBeaten: 0, topStakeWon: 0, bestDepth: 0 };
const MAXED = { challengeWins: 5, bossesBeaten: 50, topStakeWon: 5, bestDepth: 30 };

describe("unlocks", () => {
  it("locks exactly the legendaries by default", () => {
    const legendaries = CATALOG.filter((c) => c.rarity === "legendary").map((c) => c.id);
    expect([...LOCKABLE_RELIC_IDS].sort()).toEqual([...legendaries].sort());
  });

  it("a fresh player can draft every non-legendary but no legendary", () => {
    const ids = unlockedRelicIds(ZERO);
    for (const c of CATALOG) {
      if (c.rarity === "legendary") expect(ids.has(c.id)).toBe(false);
      else expect(ids.has(c.id)).toBe(true);
    }
    expect(lockedCount(ZERO)).toBe(LOCKABLE_RELIC_IDS.size);
  });

  it("a maxed player has everything unlocked", () => {
    const ids = unlockedRelicIds(MAXED);
    for (const c of CATALOG) expect(ids.has(c.id)).toBe(true);
    expect(lockedCount(MAXED)).toBe(0);
  });

  it("the first Challenge win unlocks a wave of legendaries", () => {
    const before = lockedCount(ZERO);
    const after = lockedCount({ ...ZERO, challengeWins: 1 });
    expect(after).toBeLessThan(before);
  });

  it("every locked relic has a non-empty unlock hint", () => {
    for (const id of LOCKABLE_RELIC_IDS) expect(unlockHint(id).length).toBeGreaterThan(0);
  });
});
