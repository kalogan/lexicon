/**
 * solver — the "best word you could have made" engine for Lexicon.
 *
 * Given a FILLED board, find every valid dictionary word traceable on it (legal
 * adjacency chains, no repeated cells) and the highest-scoring one. Used on the
 * results screen to reveal the optimum the player missed.
 *
 * MEMORY: a naive approach builds a 275k-word trie — too heavy for mobile. Instead
 * we first shrink the dictionary to only words *spellable from this board's
 * letters* (a multiset-subset test), typically a few thousand, then build a SMALL
 * trie from those. That trie's `hasPrefix` prunes the exponential grid DFS the
 * instant a running trace can no longer reach any candidate word — which is the
 * whole reason to dogfood the game-kit `wordlist` module here.
 */
import {
  MIN_WORD_LEN,
  neighbors,
  wordScore,
  type Board,
} from "./board.js";
import { createWordSet, type Trie } from "game-kit/wordlist";

export interface SolvedWord {
  /** The lowercase word (Qu spelled as "qu"). */
  word: string;
  /** A cell-index path that traces it (first one found). */
  path: number[];
  /** Boggle score for this word's length. */
  points: number;
}

export interface SolveResult {
  /** Every distinct word found, in discovery order. */
  words: SolvedWord[];
  /** The highest-scoring word (tie-break: longer), or null if none. */
  best: SolvedWord | null;
}

/**
 * Build a multiset (char → count) of every letter available on the board. Each
 * cell contributes its `value`, so a "Qu" cell adds both 'q' and 'u'.
 */
function boardLetterCounts(board: Board): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cell of board.cells) {
    for (const ch of cell.value) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  return counts;
}

/** Is every letter of `word` available in `avail` with enough count? */
function spellableFrom(word: string, avail: Map<string, number>): boolean {
  const need = new Map<string, number>();
  for (const ch of word) {
    const n = (need.get(ch) ?? 0) + 1;
    if (n > (avail.get(ch) ?? 0)) return false;
    need.set(ch, n);
  }
  return true;
}

/**
 * Depth-first search over every legal path on the board, pruned by the trie.
 * Records each distinct dictionary word (>= MIN_WORD_LEN) with the first path
 * that spells it.
 */
function search(board: Board, trie: Trie): Map<string, number[]> {
  const { size, cells } = board;
  const found = new Map<string, number[]>();
  const used = new Array<boolean>(cells.length).fill(false);
  const path: number[] = [];

  function dfs(i: number, current: string): void {
    const word = current + cells[i]!.value;
    // Prune: if no candidate word starts with this trace, abandon the branch.
    if (!trie.hasPrefix(word)) return;

    used[i] = true;
    path.push(i);

    if (word.length >= MIN_WORD_LEN && trie.has(word) && !found.has(word)) {
      found.set(word, [...path]);
    }

    for (const n of neighbors(i, size)) {
      if (!used[n]) dfs(n, word);
    }

    path.pop();
    used[i] = false;
  }

  for (let i = 0; i < cells.length; i++) dfs(i, "");
  return found;
}

/**
 * Solve a filled board: find all valid words and the best one.
 *
 * Async because it lazy-imports the raw word array (the same source
 * `dictionary.ts` uses) to build a board-scoped candidate list.
 */
export async function solveBoard(board: Board): Promise<SolveResult> {
  const mod = await import("an-array-of-english-words");
  const allWords = mod.default;

  const avail = boardLetterCounts(board);
  const candidates: string[] = [];
  for (const w of allWords) {
    if (w.length < MIN_WORD_LEN) continue;
    if (spellableFrom(w, avail)) candidates.push(w);
  }

  const trie = createWordSet(candidates, { minLength: MIN_WORD_LEN });

  const found = search(board, trie);

  const words: SolvedWord[] = [];
  let best: SolvedWord | null = null;
  for (const [word, path] of found) {
    const points = wordScore(word.length);
    const entry: SolvedWord = { word, path, points };
    words.push(entry);
    if (
      best === null ||
      entry.points > best.points ||
      (entry.points === best.points && entry.word.length > best.word.length)
    ) {
      best = entry;
    }
  }

  return { words, best };
}
