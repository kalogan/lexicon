import { describe, it, expect } from "vitest";
import { baseChips, scoreWord, commitWord, makeRunState } from "./engine.js";
import { wordProps } from "./props.js";
import { TINY, SCHOLAR, RARE_LETTER, PREFIX, SUFFIX, ALPHABET, TIME_DICT, TIME_BROKER, CHRONOLOGIST } from "./cards.js";

describe("props", () => {
  it("reads structural properties", () => {
    const p = wordProps("QUIZZED");
    expect(p.len).toBe(7);
    expect(p.first).toBe("q");
    expect(p.rareLetters).toBe(3); // q + z + z
    expect(p.doubles).toBe(1); // "zz"
    expect(p.suffix).toBe("ed");
  });
  it("matches prefixes leaving a real stem", () => {
    expect(wordProps("rebuild").prefix).toBe("re");
    expect(wordProps("red").prefix).toBeNull(); // too short after "re"
  });
});

describe("baseChips", () => {
  it("grows super-linearly past 6 letters", () => {
    expect(baseChips(2)).toBe(0);
    expect(baseChips(3)).toBe(10);
    expect(baseChips(8)).toBe(62); // 10 + 5*8 + 2*6
  });
});

describe("single cards", () => {
  it("Scholar doubles mult on 8+ words", () => {
    expect(scoreWord("notebook", [SCHOLAR], makeRunState()).mult).toBe(2);
    expect(scoreWord("cat", [SCHOLAR], makeRunState()).mult).toBe(1);
  });
  it("Tiny adds chips to 3-letter words only", () => {
    expect(scoreWord("cat", [TINY], makeRunState()).chips).toBe(baseChips(3) + 20);
    expect(scoreWord("cats", [TINY], makeRunState()).chips).toBe(baseChips(4));
  });
  it("Rare-Letter ×4 for Q/X/J/Z", () => {
    expect(scoreWord("jazz", [RARE_LETTER], makeRunState()).mult).toBe(4);
  });
  it("Prefix/Suffix fire on the right affixes", () => {
    expect(scoreWord("rebuild", [PREFIX], makeRunState()).mult).toBe(2);
    expect(scoreWord("running", [SUFFIX], makeRunState()).chips).toBe(baseChips(7) + 30);
  });
  it("Alphabet rewards a new starting letter once", () => {
    const run = makeRunState();
    const a = scoreWord("cat", [ALPHABET], run);
    expect(a.chips).toBe(baseChips(3) + 25);
    commitWord(run, a); // 'c' now seen
    expect(scoreWord("cot", [ALPHABET], run).chips).toBe(baseChips(3));
  });
});

describe("the snowball (proves the thesis)", () => {
  it("one long word turns TIME into a chip explosion + permanent mult", () => {
    const run = makeRunState();
    // Order matters: time-granters BEFORE Time Broker.
    const deck = [TIME_DICT, CHRONOLOGIST, TIME_BROKER, SCHOLAR];
    const b = scoreWord("notebook", deck, run); // 8 letters

    expect(b.timeGain).toBe(8); // Time +3, Chronologist +5
    expect(b.permaMultAdd).toBe(0.5); // Chronologist permanent
    // chips = base(62) + Time Broker (8s * 15 = 120) = 182; Scholar ×2 → 364
    expect(b.chips).toBe(62 + 120);
    expect(b.mult).toBe(2);
    expect(b.total).toBe(364);

    // Commit → the permanent mult carries to the NEXT word.
    commitWord(run, b);
    expect(run.permaMult).toBe(0.5);
    expect(scoreWord("cat", [], run).mult).toBe(1.5); // base 1 + permaMult 0.5
  });

  it("stacks across several big words (runaway engine)", () => {
    const run = makeRunState();
    const deck = [CHRONOLOGIST];
    for (const w of ["notebook", "keyboard", "sandwich"]) {
      commitWord(run, scoreWord(w, deck, run));
    }
    expect(run.permaMult).toBeCloseTo(1.5); // 3 big words × 0.5
  });
});
