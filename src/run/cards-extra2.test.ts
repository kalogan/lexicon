/**
 * Tests for the third-wave (shop/economy) draft cards. Each card is driven
 * through the real `scoreWord` engine on a hand-built run state, asserting a
 * word that clearly triggers it AND one that clearly does not — guarding the
 * golden rule (a card keys off a specific word/run signal, not everything).
 */
import { describe, it, expect } from "vitest";
import { makeRunState, scoreWord, type RunState } from "./engine.js";
import {
  BOOKEND,
  DOUBLET,
  GRINDSTONE,
  CADENCE,
  CIRCUMFIX,
  VAULT,
  LEXICOGRAPHER,
} from "./cards-extra2.js";

function run(patch: Partial<RunState> = {}): RunState {
  return { ...makeRunState(), ...patch };
}

describe("Bookend", () => {
  it("+35 chips when start and end letters match", () => {
    // "level": l…l, len 5 → base 26 + 35 = 61.
    const b = scoreWord("level", [BOOKEND], run());
    expect(b.chips).toBe(61);
    expect(b.total).toBe(61);
  });

  it("no bonus when the ends differ", () => {
    const b = scoreWord("cat", [BOOKEND], run());
    expect(b.chips).toBe(10);
  });
});

describe("Doublet", () => {
  it("+1 mult per doubled-letter pair", () => {
    // "letter": one double (tt) → +1 mult; base(6) = 34 → 68.
    const b = scoreWord("letter", [DOUBLET], run());
    expect(b.mult).toBe(2);
    expect(b.total).toBe(68);
  });

  it("no bonus without doubled letters", () => {
    const b = scoreWord("cat", [DOUBLET], run());
    expect(b.mult).toBe(1);
    expect(b.total).toBe(10);
  });
});

describe("Grindstone", () => {
  it("+7 chips per consonant", () => {
    // "crypt": 0 vowels (y is not a vowel) → 5 consonants → +35; base(5) = 26.
    const b = scoreWord("crypt", [GRINDSTONE], run());
    expect(b.chips).toBe(26 + 35);
    expect(b.total).toBe(61);
  });

  it("adds less for a vowel-heavy word", () => {
    // "audio": 4 vowels of 5 → 1 consonant → +7; base(5) = 26.
    const b = scoreWord("audio", [GRINDSTONE], run());
    expect(b.chips).toBe(26 + 7);
  });
});

describe("Cadence", () => {
  it("restores 4s for a suffixed word", () => {
    // "walking": suffix "ing" → +4s; base(7) = 48, chips unchanged.
    const b = scoreWord("walking", [CADENCE], run());
    expect(b.timeGain).toBe(4);
    expect(b.chips).toBe(48);
  });

  it("no time for a word without a suffix", () => {
    const b = scoreWord("cat", [CADENCE], run());
    expect(b.timeGain).toBe(0);
  });
});

describe("Circumfix", () => {
  it("×4 mult when the word has both a prefix and a suffix", () => {
    // "reading": prefix "re" + suffix "ing" → ×4; base(7) = 48 → 192.
    const b = scoreWord("reading", [CIRCUMFIX], run());
    expect(b.mult).toBe(4);
    expect(b.total).toBe(192);
  });

  it("no bonus with only a suffix", () => {
    // "walking": suffix but no prefix → mult 1.
    const b = scoreWord("walking", [CIRCUMFIX], run());
    expect(b.mult).toBe(1);
  });
});

describe("Vault (reads the shop-banked counter, never writes it)", () => {
  it("+chips equal to the banked vault", () => {
    // counters.vault = 120 → +120 chips; base(3) "cat" = 10.
    const b = scoreWord("cat", [VAULT], run({ counters: { vault: 120 } }));
    expect(b.chips).toBe(130);
    expect(b.total).toBe(130);
  });

  it("nothing banked → no bonus", () => {
    const b = scoreWord("cat", [VAULT], run());
    expect(b.chips).toBe(10);
  });
});

describe("Lexicographer (scales off letters collected this run)", () => {
  it("+4 chips per distinct starting letter seen this run", () => {
    // seenFirst has 3 letters → +12; base(3) = 10.
    const b = scoreWord("cat", [LEXICOGRAPHER], run({ seenFirst: new Set(["a", "b", "c"]) }));
    expect(b.chips).toBe(22);
  });

  it("no bonus at the very start of a run", () => {
    const b = scoreWord("cat", [LEXICOGRAPHER], run());
    expect(b.chips).toBe(10);
  });
});
