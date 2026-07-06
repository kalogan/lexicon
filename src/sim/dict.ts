/**
 * sim/dict — headless word-source access for the balance simulator.
 *
 * The game loads `an-array-of-english-words` async (dictionary.ts / solver.ts).
 * Headlessly we load it ONCE and reuse the array across thousands of boards —
 * building a fresh board-scoped trie per board is the sim's hot path, so we do
 * NOT want to re-import the 275k-word module every time.
 */
import { MIN_WORD_LEN } from "../board.js";

let _words: readonly string[] | null = null;

/** The full lowercase word array (>= MIN_WORD_LEN), loaded once. */
export async function loadWords(): Promise<readonly string[]> {
  if (_words) return _words;
  const mod = await import("an-array-of-english-words");
  _words = mod.default.filter((w) => w.length >= MIN_WORD_LEN);
  return _words;
}
