/**
 * dictionary — the word list Lexicon validates against, loaded ASYNC so the
 * ~800KB-gz word data is a separate chunk (fast first paint) instead of inlined
 * in the main bundle.
 *
 * Backed by `an-array-of-english-words` (~275k lowercase words). Membership uses
 * a Set (instant, light — mobile-safe vs. a 275k-word trie). Prefix checks (for
 * live "still-a-valid-word?" trace feedback) use binary search over the sorted
 * word array — O(log n), no extra memory. Built once, on first `loadDictionary`.
 */
import { MIN_WORD_LEN } from "./board.js";

export interface Dictionary {
  has(word: string): boolean;
  /** Is `prefix` the start of at least one dictionary word? (empty = true) */
  hasPrefix(prefix: string): boolean;
  size: number;
}

let _promise: Promise<Dictionary> | null = null;
let _ready: Dictionary | null = null;

/** Kick off (or reuse) the async load + build. Warm this early (app mount) so it
 *  is ready by the time a round starts. */
export function loadDictionary(): Promise<Dictionary> {
  if (_promise) return _promise;
  _promise = import("an-array-of-english-words").then((m) => {
    const words = m.default.filter((w) => w.length >= MIN_WORD_LEN);
    words.sort(); // binary search needs sorted; ~no-op if already sorted
    const set = new Set(words);
    const dict: Dictionary = {
      size: set.size,
      has: (w) => set.has(w.toLowerCase()),
      hasPrefix: (p) => {
        const pre = p.toLowerCase();
        if (!pre) return true;
        let lo = 0;
        let hi = words.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (words[mid]! < pre) lo = mid + 1;
          else hi = mid;
        }
        return lo < words.length && words[lo]!.startsWith(pre);
      },
    };
    _ready = dict;
    return dict;
  });
  return _promise;
}

/** The dictionary if it's already built, else null (render a loading state). */
export function readyDictionary(): Dictionary | null {
  return _ready;
}
