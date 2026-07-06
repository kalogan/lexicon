/**
 * meta.test — the achievement-unlock thresholds. Under vitest/node there's no
 * localStorage, so meta persists nothing between calls; each `record*` therefore
 * evaluates its thresholds against an empty store, which is exactly the unlock
 * LOGIC we assert here (persistence + de-dup is the browser's concern in play).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordWord,
  recordMult,
  recordBoardCleared,
  recordRunEnd,
  recordDeck,
  ACHIEVEMENTS,
} from "./meta.js";

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* node: no localStorage — calls are already independent */
  }
});

describe("recordWord", () => {
  it("unlocks by length, single-word score, and rare letters", () => {
    expect(recordWord(6, 10, 0)).toContain("wordsmith");
    expect(recordWord(9, 10, 0)).toContain("lexicographer");
    expect(recordWord(5, 600, 0)).toContain("overkill");
    expect(recordWord(5, 10, 1)).toContain("rare-air");
  });
  it("does not unlock below thresholds", () => {
    const fresh = recordWord(4, 10, 0);
    expect(fresh).not.toContain("wordsmith");
    expect(fresh).not.toContain("overkill");
    expect(fresh).not.toContain("rare-air");
  });
});

describe("recordMult", () => {
  it("unlocks engine-builder at ×5 (permaMult 4)", () => {
    expect(recordMult(4)).toContain("engine-builder");
    expect(recordMult(3)).not.toContain("engine-builder");
  });
});

describe("recordBoardCleared", () => {
  it("always gives first-steps, and giant-slayer only on a boss", () => {
    expect(recordBoardCleared(1, false)).toContain("first-steps");
    expect(recordBoardCleared(1, true)).toContain("giant-slayer");
    expect(recordBoardCleared(1, false)).not.toContain("giant-slayer");
  });
});

describe("recordRunEnd", () => {
  it("unlocks depth milestones", () => {
    expect(recordRunEnd(6, 100)).toContain("survivor");
    expect(recordRunEnd(10, 100)).toContain("deep-diver");
    expect(recordRunEnd(3, 100)).not.toContain("survivor");
  });
});

describe("recordDeck", () => {
  it("unlocks full-house at 8 relics and stacker at 3 copies", () => {
    expect(recordDeck(["a", "b", "c", "d", "e", "f", "g", "h"])).toContain("full-house");
    expect(recordDeck(["x", "x", "x"])).toContain("stacker");
    expect(recordDeck(["a", "b"])).not.toContain("full-house");
  });
});

describe("ACHIEVEMENTS", () => {
  it("declares every id the recorders can unlock", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of [
      "first-steps", "wordsmith", "rare-air", "giant-slayer", "survivor",
      "engine-builder", "full-house", "stacker", "lexicographer", "overkill", "deep-diver",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
  it("has unique ids and non-empty copy", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });
});
