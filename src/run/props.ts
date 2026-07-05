/**
 * run/props — the STRUCTURAL properties of a word that the roguelike's cards
 * read to decide "which words matter". All computable from the string itself
 * (no semantic tagging) — length, first/last letter, doubles, vowels, distinct
 * letters, and known prefixes/suffixes. Semantic categories (animal/colour/…)
 * are a later data pipeline; these are free.
 *
 * A "word" here is the lowercase value the board spells (a "Qu" tile already
 * contributes "qu", so `len` counts letters, not tiles).
 */

export interface WordProps {
  word: string;
  /** Letter count. */
  len: number;
  first: string;
  last: string;
  /** Vowel count (a e i o u). */
  vowels: number;
  /** Count of adjacent repeated letters ("letter" → 1 for the "tt"). */
  doubles: number;
  /** Number of distinct letters. */
  distinct: number;
  /** Count of rare letters (q, x, j, z) — for the Rare-Letter Dictionary. */
  rareLetters: number;
  /** True when no letter repeats at all (a "no repeated letters" combo). */
  allDistinct: boolean;
  /** Longest known prefix the word starts with (else null). */
  prefix: string | null;
  /** Longest known suffix the word ends with (else null). */
  suffix: string | null;
}

const RARE = new Set(["q", "x", "j", "z"]);

// Ordered longest-first so we match the most specific affix.
const PREFIXES = [
  "counter", "inter", "trans", "super", "under", "over", "anti", "semi", "non",
  "sub", "pre", "mis", "dis", "out", "un", "re", "in", "de", "en",
].sort((a, b) => b.length - a.length);

const SUFFIXES = [
  "ation", "ness", "ment", "ible", "able", "less", "ful", "ous", "ing", "ies",
  "ion", "est", "ize", "ise", "ly", "ed", "er",
].sort((a, b) => b.length - a.length);

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function matchAffix(word: string, list: string[], where: "start" | "end"): string | null {
  for (const a of list) {
    if (word.length < a.length + 2) continue; // leave a real stem
    if (where === "start" ? word.startsWith(a) : word.endsWith(a)) return a;
  }
  return null;
}

export function wordProps(raw: string): WordProps {
  const word = raw.toLowerCase();
  let vowels = 0;
  let doubles = 0;
  let rareLetters = 0;
  for (let i = 0; i < word.length; i++) {
    if (VOWELS.has(word[i]!)) vowels++;
    if (RARE.has(word[i]!)) rareLetters++;
    if (i > 0 && word[i] === word[i - 1]) doubles++;
  }
  const distinct = new Set(word).size;
  return {
    word,
    len: word.length,
    first: word[0] ?? "",
    last: word[word.length - 1] ?? "",
    vowels,
    doubles,
    distinct,
    rareLetters,
    allDistinct: distinct === word.length,
    prefix: matchAffix(word, PREFIXES, "start"),
    suffix: matchAffix(word, SUFFIXES, "end"),
  };
}
