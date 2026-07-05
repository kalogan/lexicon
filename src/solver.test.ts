import { describe, it, expect } from "vitest";
import { solveBoard } from "./solver.js";
import { wordScore, type Board } from "./board.js";

/**
 * A hand-made 3×3 board (indices row-major):
 *
 *   0:c 1:a 2:t
 *   3:d 4:o 5:g
 *   6:z 7:j 8:x
 *
 * Traceable real words include "cat" (0→1→2), "dog" (3→4→5), "cot" (0→4→2),
 * "cog" (0→4→5), "dot" (3→4→2), "go" — too short (< MIN_WORD_LEN). Filler cells
 * z/j/x keep the tail inert.
 */
const cell = (label: string) => ({ label, value: label.toLowerCase() });
const board: Board = {
  size: 3,
  cells: ["c", "a", "t", "d", "o", "g", "z", "j", "x"].map(cell),
};

describe("solveBoard", () => {
  it("finds traceable dictionary words", async () => {
    const { words } = await solveBoard(board);
    const found = new Set(words.map((w) => w.word));
    expect(found.has("cat")).toBe(true);
    expect(found.has("dog")).toBe(true);
    expect(found.has("cot")).toBe(true);
  });

  it("excludes words that can't be traced legally", async () => {
    const { words } = await solveBoard(board);
    const found = new Set(words.map((w) => w.word));
    // "go" is below MIN_WORD_LEN, so it never counts.
    expect(found.has("go")).toBe(false);
    // "zoo" needs two o's; board has one. Not spellable.
    expect(found.has("zoo")).toBe(false);
  });

  it("returns a best word with correct scoring", async () => {
    const { words, best } = await solveBoard(board);
    expect(best).not.toBeNull();
    expect(best!.points).toBe(wordScore(best!.word.length));
    // No word here scores less than the max present, and every word is scored.
    for (const w of words) {
      expect(w.points).toBeLessThanOrEqual(best!.points);
    }
  });

  it("every reported word traces a legal path spelling that word", async () => {
    const { words } = await solveBoard(board);
    for (const w of words) {
      const spelled = w.path.map((i) => board.cells[i]!.value).join("");
      expect(spelled).toBe(w.word);
      // path has no repeated cells
      expect(new Set(w.path).size).toBe(w.path.length);
    }
  });

  it("returns best = null for a board with no words", async () => {
    const barren: Board = {
      size: 2,
      cells: ["z", "x", "j", "q"].map(cell),
    };
    const { words, best } = await solveBoard(barren);
    expect(words).toHaveLength(0);
    expect(best).toBeNull();
  });
});
