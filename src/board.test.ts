import { describe, it, expect } from "vitest";
import {
  makeBoard,
  neighbors,
  canExtend,
  isValidPath,
  pathWord,
  wordScore,
} from "./board.js";

describe("makeBoard", () => {
  it("is deterministic per seed", () => {
    const a = makeBoard(12345);
    const b = makeBoard(12345);
    expect(a.cells.map((c) => c.value)).toEqual(b.cells.map((c) => c.value));
  });
  it("differs across seeds (usually)", () => {
    const a = makeBoard(1).cells.map((c) => c.value).join("");
    const b = makeBoard(2).cells.map((c) => c.value).join("");
    expect(a).not.toEqual(b);
  });
  it("fills a size×size grid with labelled cells", () => {
    const bd = makeBoard(7, 4);
    expect(bd.cells).toHaveLength(16);
    for (const c of bd.cells) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.value).toBe(c.label.toLowerCase());
    }
  });
});

describe("neighbors", () => {
  it("corner cell (0) on a 4×4 has 3 neighbours", () => {
    expect(neighbors(0, 4).sort((x, y) => x - y)).toEqual([1, 4, 5]);
  });
  it("centre cell (5) on a 4×4 has 8 neighbours", () => {
    expect(neighbors(5, 4)).toHaveLength(8);
  });
});

describe("path rules", () => {
  it("canExtend accepts an adjacent unused cell, rejects non-adjacent/reused", () => {
    expect(canExtend([0], 1, 4)).toBe(true); // adjacent
    expect(canExtend([0], 5, 4)).toBe(true); // diagonal
    expect(canExtend([0], 2, 4)).toBe(false); // not adjacent
    expect(canExtend([0, 1], 0, 4)).toBe(false); // reused
    expect(canExtend([], 9, 4)).toBe(true); // empty accepts any
  });
  it("isValidPath validates a chain", () => {
    expect(isValidPath([0, 1, 2, 3], 4)).toBe(true);
    expect(isValidPath([0, 2], 4)).toBe(false); // gap
    expect(isValidPath([0, 1, 1], 4)).toBe(false); // repeat
  });
});

describe("pathWord", () => {
  it("joins cell values, Qu counts as two letters", () => {
    const bd = { size: 2, cells: [{ label: "Qu", value: "qu" }, { label: "I", value: "i" }, { label: "Z", value: "z" }, { label: "A", value: "a" }] };
    expect(pathWord([0, 1, 3], bd)).toBe("quia".slice(0, 0) + "qu" + "i" + "a");
    expect(pathWord([0, 1, 3], bd)).toBe("quia");
  });
});

describe("wordScore", () => {
  it("scores by Boggle length brackets", () => {
    expect(wordScore(2)).toBe(0);
    expect(wordScore(3)).toBe(1);
    expect(wordScore(4)).toBe(1);
    expect(wordScore(5)).toBe(2);
    expect(wordScore(6)).toBe(3);
    expect(wordScore(7)).toBe(5);
    expect(wordScore(8)).toBe(11);
    expect(wordScore(12)).toBe(11);
  });
});
