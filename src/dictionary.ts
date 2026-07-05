/**
 * dictionary — the word list Lexicon validates against.
 *
 * Backed by `an-array-of-english-words` (~275k lowercase words). For membership
 * we use a plain Set: instant O(1) lookup and light memory (mobile-safe) —
 * versus a full 275k-word trie, which is heavy on a phone. (The kit `wordlist`
 * trie's `hasPrefix` — for live-trace prefix glow — is a later polish slice on a
 * smaller candidate set.) Built once, lazily, on first use.
 */
import words from "an-array-of-english-words";
import { MIN_WORD_LEN } from "./board.js";

export interface Dictionary {
  has(word: string): boolean;
  size: number;
}

let _dict: Dictionary | null = null;

export function getDictionary(): Dictionary {
  if (_dict) return _dict;
  const set = new Set<string>();
  for (const w of words) {
    if (w.length >= MIN_WORD_LEN) set.add(w);
  }
  _dict = { has: (w) => set.has(w.toLowerCase()), size: set.size };
  return _dict;
}
