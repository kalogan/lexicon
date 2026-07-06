/**
 * sim/solver — "what words can I make on this board, and what does each score
 * through my deck?" for the balance bot.
 *
 * Mirrors src/solver.ts's board search (shrink dict to board-spellable words →
 * small trie → pruned DFS over legal traces), but instead of Boggle points it
 * ranks candidates by the REAL engine {@link scoreWord} against the current deck
 * + run state, and it honours the play-time constraints the ChallengeScreen
 * enforces: sealed (blocked) cells, the boss word rule (`allow`), the gold tile,
 * and the already-found set. The bot then just takes the top candidate.
 *
 * The DFS records, for each distinct word, ALL traces (so we can find one that
 * threads the gold tile if that beats the plain trace). We keep this bounded by
 * only tracking whether *a* trace hits the gold cell.
 */
import { MIN_WORD_LEN, neighbors, type Board } from "../board.js";
import { createWordSet, type Trie } from "game-kit/wordlist";
import { scoreWord, type Card, type RunState } from "../run/engine.js";
import type { Boss } from "../run/bosses.js";

export interface Candidate {
  word: string;
  path: number[];
  /** Engine total for this word through the deck + run (incl. gold if traced). */
  total: number;
  /** Does the chosen path thread the gold tile? */
  goldHit: boolean;
}

function boardLetterCounts(board: Board): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cell of board.cells) {
    for (const ch of cell.value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

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
 * DFS over legal traces (respecting sealed cells), pruned by the board-scoped
 * trie. For each distinct word we keep the first plain trace AND (if different)
 * the first trace that hits the gold cell, so the caller can compare scores.
 */
function search(
  board: Board,
  trie: Trie,
  blocked: ReadonlySet<number>,
  goldTile: number,
): Map<string, { plain: number[]; gold: number[] | null }> {
  const { size, cells } = board;
  const found = new Map<string, { plain: number[]; gold: number[] | null }>();
  const used = new Array<boolean>(cells.length).fill(false);
  const path: number[] = [];

  function dfs(i: number, current: string, hitGold: boolean): void {
    const word = current + cells[i]!.value;
    if (!trie.hasPrefix(word)) return;

    used[i] = true;
    path.push(i);
    const nowGold = hitGold || i === goldTile;

    if (word.length >= MIN_WORD_LEN && trie.has(word)) {
      const rec = found.get(word);
      if (!rec) {
        found.set(word, {
          plain: [...path],
          gold: nowGold ? [...path] : null,
        });
      } else if (nowGold && !rec.gold) {
        rec.gold = [...path];
      }
    }

    for (const n of neighbors(i, size)) {
      if (!used[n] && !blocked.has(n)) dfs(n, word, nowGold);
    }

    path.pop();
    used[i] = false;
  }

  for (let i = 0; i < cells.length; i++) {
    if (!blocked.has(i)) dfs(i, "", false);
  }
  return found;
}

/**
 * All legal, deck-scored candidate words on this board, best-first.
 *
 * @param board       the effective board (deck letters, any overrides applied)
 * @param words       the full word source (from sim/dict.loadWords)
 * @param deck        the active scoring deck (relics + any transient mod card)
 * @param run         current run state (permaMult / seenFirst / counters)
 * @param opts.found  words already played this blind (excluded)
 * @param opts.boss   active boss (its `allow` rule filters candidates)
 * @param opts.blocked sealed cell indices (never traced through)
 * @param opts.goldTile lit cell index, or -1
 * @param opts.goldMult multiplier applied to a word that threads the gold tile
 */
export function solveScored(
  board: Board,
  words: readonly string[],
  deck: readonly Card[],
  run: RunState,
  opts: {
    found: ReadonlySet<string>;
    boss: Boss | null;
    blocked: ReadonlySet<number>;
    goldTile: number;
    goldMult: number;
  },
): Candidate[] {
  const { found: alreadyFound, boss, blocked, goldTile, goldMult } = opts;

  // Candidate list scoped to letters actually reachable (skip sealed cells).
  const avail = new Map<string, number>();
  board.cells.forEach((cell, i) => {
    if (blocked.has(i)) return;
    for (const ch of cell.value) avail.set(ch, (avail.get(ch) ?? 0) + 1);
  });
  void boardLetterCounts; // (kept for parity with src/solver; avail is the sealed-aware version)

  const candidates: string[] = [];
  for (const w of words) {
    if (w.length < MIN_WORD_LEN) continue;
    if (spellableFrom(w, avail)) candidates.push(w);
  }
  const trie = createWordSet(candidates, { minLength: MIN_WORD_LEN });

  const traces = search(board, trie, blocked, goldTile);

  const out: Candidate[] = [];
  for (const [word, rec] of traces) {
    if (alreadyFound.has(word)) continue;
    if (boss?.allow && !boss.allow(word, alreadyFound)) continue;

    const base = scoreWord(word, deck, run).total;
    // A gold-threading trace multiplies the final total (matches ChallengeScreen).
    let total = base;
    let path = rec.plain;
    let goldHit = false;
    if (goldTile >= 0 && rec.gold) {
      const goldTotal = Math.round(base * goldMult);
      if (goldTotal > total) {
        total = goldTotal;
        path = rec.gold;
        goldHit = true;
      }
    }
    out.push({ word, path, total, goldHit });
  }

  out.sort((a, b) => b.total - a.total || b.word.length - a.word.length);
  return out;
}
