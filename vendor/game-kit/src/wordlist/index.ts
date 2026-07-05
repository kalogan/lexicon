/**
 * Word-list dictionary — a Trie for word-hunt validation.
 *
 * WHAT: a prefix tree (Trie) that answers two questions fast, over a dictionary
 * the GAME supplies: "is this string a complete word?" (`has`) and "could this
 * string still grow into a word?" (`hasPrefix`).
 *
 * WHY: Boggle-lineage puzzles (word hunt, letter grids) validate a player's
 * drag-trace one letter at a time. `hasPrefix` lets the game PRUNE a live trace
 * the instant it can no longer reach any word — turning an exponential grid
 * search into a bounded one — while `has` confirms a completed word. A flat
 * `Set` answers membership but can't prune, so a Trie is the right shape.
 *
 * HOW: build a Trie from any word source with `createTrie(words)` (or
 * `createWordSet(words, { minLength })` to also drop too-short words). Query with
 * `has` / `hasPrefix`. Everything is normalized to lowercase on both insert and
 * query, so callers may pass any case. Empty strings are ignored.
 *
 * THREE-FREE / REACT-FREE: pure data structure, no I/O, no rendering. Holds NO
 * embedded word data — the dictionary enters through parameters, so this module
 * stays content-free and reusable across games.
 */

/** A node in the prefix tree. */
interface TrieNode {
  /** Child nodes keyed by a single lowercase character. */
  children: Map<string, TrieNode>;
  /** True when a complete inserted word ends at this node. */
  terminal: boolean;
}

function makeNode(): TrieNode {
  return { children: new Map(), terminal: false };
}

/**
 * A prefix tree over a supplied dictionary. Case-insensitive; empty strings are
 * ignored. `size` reflects the number of DISTINCT words inserted.
 */
export interface Trie {
  /**
   * Insert a word. Normalized to lowercase; empty strings are ignored. Inserting
   * the same word twice is a no-op (does not inflate `size`).
   */
  insert(word: string): void;
  /** Exact membership: is `word` a complete inserted entry? Case-insensitive. */
  has(word: string): boolean;
  /**
   * Is any inserted word an extension of `prefix` (including `prefix` itself if
   * it's a word)? The pruning primitive for a live drag-trace. The empty prefix
   * is a prefix of every word, so it's true for any non-empty Trie.
   */
  hasPrefix(prefix: string): boolean;
  /** Count of distinct words inserted. */
  readonly size: number;
}

/**
 * Walk from the root following each character of `key`, returning the node the
 * path lands on, or `undefined` if the path leaves the tree.
 */
function descend(root: TrieNode, key: string): TrieNode | undefined {
  let node: TrieNode | undefined = root;
  for (const ch of key) {
    node = node.children.get(ch);
    if (node === undefined) return undefined;
  }
  return node;
}

/**
 * Create a Trie, optionally seeded from an iterable of words. Each word is
 * inserted via the same normalization as `insert` (lowercased; empties skipped).
 */
export function createTrie(words?: Iterable<string>): Trie {
  const root = makeNode();
  let count = 0;

  const trie: Trie = {
    insert(word: string): void {
      const key = word.toLowerCase();
      if (key.length === 0) return;

      let node = root;
      for (const ch of key) {
        let next = node.children.get(ch);
        if (next === undefined) {
          next = makeNode();
          node.children.set(ch, next);
        }
        node = next;
      }
      // Only count the first time a word becomes terminal.
      if (!node.terminal) {
        node.terminal = true;
        count++;
      }
    },

    has(word: string): boolean {
      const key = word.toLowerCase();
      if (key.length === 0) return false;
      const node = descend(root, key);
      return node !== undefined && node.terminal;
    },

    hasPrefix(prefix: string): boolean {
      const key = prefix.toLowerCase();
      // The empty prefix is a prefix of everything: true iff the Trie is non-empty.
      if (key.length === 0) return root.children.size > 0;
      return descend(root, key) !== undefined;
    },

    get size(): number {
      return count;
    },
  };

  if (words !== undefined) {
    for (const w of words) trie.insert(w);
  }
  return trie;
}

/**
 * Build a Trie from a word source, optionally skipping words shorter than
 * `minLength` (measured AFTER lowercasing, before insertion). Handy for
 * Boggle-style rules where words below a minimum length don't count.
 *
 * `minLength` is applied by character count; words at or above it are inserted.
 * A `minLength` of 0 or 1 (or omitted) keeps everything non-empty.
 */
export function createWordSet(
  words: Iterable<string>,
  opts?: { minLength?: number },
): Trie {
  const minLength = opts?.minLength ?? 0;
  const trie = createTrie();
  for (const w of words) {
    const key = w.toLowerCase();
    if (key.length === 0) continue;
    if (key.length < minLength) continue;
    trie.insert(key);
  }
  return trie;
}
