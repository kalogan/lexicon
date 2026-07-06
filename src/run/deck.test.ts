import { describe, it, expect } from "vitest";
import {
  STARTER_LETTER_DECK,
  MIN_DECK,
  makeBoardFromDeck,
  addLetter,
  removeLetterAt,
  duplicateLetterAt,
  deckComposition,
  expandDist,
  letterOffer,
} from "./deck.js";

describe("STARTER_LETTER_DECK", () => {
  it("is one of every letter (26 distinct tiles, q as 'qu')", () => {
    expect(STARTER_LETTER_DECK).toHaveLength(26);
    expect(new Set(STARTER_LETTER_DECK).size).toBe(26); // all distinct — one of each
    expect(STARTER_LETTER_DECK).toContain("qu");
    expect(STARTER_LETTER_DECK).not.toContain("q"); // q ships as the playable "qu"
    expect(STARTER_LETTER_DECK.length).toBeGreaterThan(MIN_DECK); // enough to fill a board
  });
  it("expandDist round-trips counts", () => {
    expect(expandDist({ a: 2, b: 1 }).sort()).toEqual(["a", "a", "b"]);
  });
});

describe("letterOffer", () => {
  it("returns n distinct valid letters", () => {
    const offer = letterOffer(10);
    expect(offer).toHaveLength(10);
    expect(new Set(offer).size).toBe(10); // distinct
    const valid = new Set<string>([..."abcdefghijklmnoprstuvwxyz".split(""), "qu"]);
    for (const l of offer) expect(valid.has(l)).toBe(true);
  });
});

describe("makeBoardFromDeck", () => {
  it("fills a size×size board using ONLY tiles from the deck", () => {
    const bd = makeBoardFromDeck(STARTER_LETTER_DECK, 123, 5);
    expect(bd.cells).toHaveLength(25);
    const allowed = new Set(STARTER_LETTER_DECK.map((t) => t.toLowerCase()));
    for (const c of bd.cells) expect(allowed.has(c.value)).toBe(true);
  });
  it("is deterministic per seed and varies across seeds", () => {
    const a = makeBoardFromDeck(STARTER_LETTER_DECK, 7).cells.map((c) => c.value);
    const b = makeBoardFromDeck(STARTER_LETTER_DECK, 7).cells.map((c) => c.value);
    const c = makeBoardFromDeck(STARTER_LETTER_DECK, 8).cells.map((x) => x.value);
    expect(a).toEqual(b);
    expect(a.join("")).not.toEqual(c.join(""));
  });
  it("removing a letter from the deck means it can never be dealt", () => {
    // A tiny deck with exactly one 'z' among fillers — remove it, it's gone.
    let deck = ["z", ...Array<string>(30).fill("a")];
    const zIdx = deck.indexOf("z");
    deck = removeLetterAt(deck, zIdx);
    for (let seed = 1; seed <= 50; seed++) {
      const bd = makeBoardFromDeck(deck, seed, 5);
      expect(bd.cells.some((c) => c.value === "z")).toBe(false);
    }
  });
  it("renders Qu tiles as label 'Qu' / value 'qu'", () => {
    const bd = makeBoardFromDeck(["qu", ...Array<string>(30).fill("a")], 3, 5);
    const qu = bd.cells.find((c) => c.value === "qu");
    if (qu) expect(qu.label).toBe("Qu");
  });
});

describe("deck ops", () => {
  it("addLetter appends (lowercased)", () => {
    expect(addLetter(["a"], "Z")).toEqual(["a", "z"]);
  });
  it("duplicateLetterAt copies a tile", () => {
    expect(duplicateLetterAt(["a", "b"], 1)).toEqual(["a", "b", "b"]);
  });
  it("removeLetterAt drops one, but refuses below MIN_DECK", () => {
    const big = Array<string>(MIN_DECK + 1).fill("a");
    expect(removeLetterAt(big, 0)).toHaveLength(MIN_DECK);
    const atFloor = Array<string>(MIN_DECK).fill("a");
    expect(removeLetterAt(atFloor, 0)).toHaveLength(MIN_DECK); // refused
  });
});

describe("deckComposition", () => {
  it("counts letters and sorts vowels-first", () => {
    const comp = deckComposition(["b", "a", "a", "c"]);
    expect(comp[0]).toEqual({ letter: "a", count: 2 }); // vowel leads
    expect(comp.find((x) => x.letter === "b")).toEqual({ letter: "b", count: 1 });
  });
});
