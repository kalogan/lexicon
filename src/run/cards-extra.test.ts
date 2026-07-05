/**
 * Tests for the second-wave draft cards. We drive each card through the real
 * `scoreWord` engine on a hand-built run state, asserting both a word that
 * clearly triggers it and one that clearly does not — guarding the golden rule
 * (a card must key off a specific word property, not fire on everything).
 */
import { describe, it, expect } from "vitest";
import { makeRunState, scoreWord, type RunState } from "./engine.js";
import {
  MOMENTUM,
  ALLITERATION,
  VOWEL_HOARDER,
  TOME,
  PANGRAMMER,
  CURATOR,
} from "./cards-extra.js";

function run(patch: Partial<RunState> = {}): RunState {
  return { ...makeRunState(), ...patch };
}

describe("Momentum", () => {
  it("adds +0.4 mult per word already played this board", () => {
    // boardWords=3 → +1.2 mult; "cat" base = 10 chips.
    const b = scoreWord("cat", [MOMENTUM], run({ boardWords: 3 }));
    expect(b.chips).toBe(10);
    expect(b.mult).toBeCloseTo(2.2);
    expect(b.total).toBe(22);
  });

  it("does nothing on the first word of a board", () => {
    const b = scoreWord("cat", [MOMENTUM], run({ boardWords: 0 }));
    expect(b.mult).toBe(1);
    expect(b.total).toBe(10);
  });
});

describe("Alliteration", () => {
  it("×3 mult when the word matches the previous first letter", () => {
    const b = scoreWord("sun", [ALLITERATION], run({ lastFirst: "s" }));
    expect(b.mult).toBe(3);
    expect(b.total).toBe(30); // base 10 × 3
  });

  it("no bonus when the first letter differs", () => {
    const b = scoreWord("moon", [ALLITERATION], run({ lastFirst: "s" }));
    expect(b.mult).toBe(1);
  });
});

describe("Vowel Hoarder", () => {
  it("×2 mult when over half the letters are vowels", () => {
    // "audio": 4 vowels of 5 letters → triggers; base(5) = 26.
    const b = scoreWord("audio", [VOWEL_HOARDER], run());
    expect(b.mult).toBe(2);
    expect(b.total).toBe(52);
  });

  it("no bonus for a consonant-heavy word", () => {
    const b = scoreWord("crypt", [VOWEL_HOARDER], run());
    expect(b.mult).toBe(1);
  });
});

describe("Tome", () => {
  it("+12 chips per letter for 7+ letter words", () => {
    // "crystal": base(7) = 48, +7×12 = 84 → 132 chips.
    const b = scoreWord("crystal", [TOME], run());
    expect(b.chips).toBe(132);
    expect(b.total).toBe(132);
  });

  it("does not fire on short words", () => {
    const b = scoreWord("cat", [TOME], run());
    expect(b.chips).toBe(10);
  });
});

describe("Curator (legendary rare-letter engine)", () => {
  it("+8s and +40 chips per rare letter", () => {
    // "jazz": rare letters j, z, z → count 3; base(4) = 18.
    const b = scoreWord("jazz", [CURATOR], run());
    expect(b.timeGain).toBe(24);
    expect(b.chips).toBe(18 + 120);
    expect(b.total).toBe(138);
  });

  it("no bonus without a rare letter", () => {
    const b = scoreWord("cat", [CURATOR], run());
    expect(b.timeGain).toBe(0);
    expect(b.chips).toBe(10);
  });
});

describe("Pangrammer (legendary perma-mult loop)", () => {
  it("grants +0.3 permanent mult for all-distinct 5+ words", () => {
    const b = scoreWord("cloud", [PANGRAMMER], run());
    expect(b.permaMultAdd).toBeCloseTo(0.3);
  });

  it("no perma-mult when a letter repeats", () => {
    const b = scoreWord("hello", [PANGRAMMER], run());
    expect(b.permaMultAdd).toBe(0);
  });
});
