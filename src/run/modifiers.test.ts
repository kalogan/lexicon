import { describe, it, expect } from "vitest";
import { MODIFIERS, randomModifier, goldCell, type BoardMod } from "./modifiers.js";
import { scoreWord, makeRunState, type Card } from "./engine.js";

const ids = new Set(MODIFIERS.map((m) => m.id));

describe("randomModifier", () => {
  it("is deterministic per seed", () => {
    for (const seed of [0, 1, 7, 42, 1000, 999999]) {
      const a = randomModifier(seed);
      const b = randomModifier(seed);
      expect(a).toEqual(b);
    }
  });

  it("returns null for a meaningful fraction of seeds, and non-null for others", () => {
    let nulls = 0;
    let hits = 0;
    for (let seed = 0; seed < 200; seed++) {
      const m = randomModifier(seed);
      if (m === null) nulls++;
      else hits++;
    }
    // ~45% null — assert both branches are exercised, not a knife-edge split.
    expect(nulls).toBeGreaterThan(30);
    expect(hits).toBeGreaterThan(30);
    expect(nulls + hits).toBe(200);
  });

  it("only ever returns a member of MODIFIERS", () => {
    for (let seed = 0; seed < 300; seed++) {
      const m = randomModifier(seed);
      if (m !== null) expect(ids.has(m.id)).toBe(true);
    }
  });
});

describe("goldCell", () => {
  it("returns an in-range, unblocked, deterministic index", () => {
    const size = 5;
    const blocked = new Set<number>([0, 1, 2, 3, 12, 24]);
    for (const seed of [0, 5, 77, 4242]) {
      const cell = goldCell(size, seed, blocked);
      expect(cell).toBe(goldCell(size, seed, blocked)); // deterministic
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(size * size);
      expect(blocked.has(cell)).toBe(false);
    }
  });

  it("avoids blocked cells even when nearly the whole board is sealed", () => {
    const size = 4; // 16 cells; block all but one
    const free = 9;
    const blocked = new Set<number>();
    for (let i = 0; i < size * size; i++) if (i !== free) blocked.add(i);
    expect(goldCell(size, 123, blocked)).toBe(free);
  });

  it("returns -1 only when every cell is blocked", () => {
    const size = 3;
    const blocked = new Set<number>();
    for (let i = 0; i < size * size; i++) blocked.add(i);
    expect(goldCell(size, 1, blocked)).toBe(-1);
  });
});

/** Grab a modifier's transient card (asserting it exists). */
function cardOf(id: string): Card {
  const mod = MODIFIERS.find((m: BoardMod) => m.id === id);
  expect(mod).toBeDefined();
  expect(mod!.card).toBeDefined();
  return mod!.card!;
}

describe("transient modifier cards score correctly", () => {
  it("Long Haul adds 35 chips to a 6+ letter word (and nothing to a short one)", () => {
    const run = makeRunState();
    const deck = [cardOf("long-haul")];
    const long = scoreWord("planets", deck, run); // 7 letters
    const short = scoreWord("cat", deck, run); // 3 letters
    // baseChips is the same reference; the card adds +35 only on the long word.
    expect(long.chips).toBe(long.base + 35);
    expect(short.chips).toBe(short.base);
    expect(long.triggers.some((t) => t.card === "Long Haul")).toBe(true);
  });

  it("Double Time restores +2s on any word of length >= 3", () => {
    const run = makeRunState();
    const b = scoreWord("apple", [cardOf("double-time")], run);
    expect(b.timeGain).toBe(2);
  });

  it("Rare Air doubles mult on a Q/X/J/Z word", () => {
    const run = makeRunState();
    const b = scoreWord("jazz", [cardOf("rare-air")], run);
    expect(b.mult).toBe(2); // base mult 1 × 2
  });

  it("Encore doubles mult only when the last word's first letter repeats", () => {
    const card = cardOf("encore");
    const run = makeRunState();
    run.lastFirst = "s";
    expect(scoreWord("stone", [card], run).mult).toBe(2);
    expect(scoreWord("brick", [card], run).mult).toBe(1);
  });
});
