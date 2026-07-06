/**
 * run/deck — the LETTER DECK for Challenge mode: the bag of tiles your board is
 * dealt from, and the thing you build over a run. This is what turns "bad
 * letters" from RNG into a build decision — remove a tile and you truly stop
 * seeing it.
 *
 * Draw model (the "bit of both"): the deck is a FINITE bag you shape, but it's
 * shuffled fresh and dealt anew each board — so removing a tile guarantees it's
 * gone (control), while every board is still a new hand (variety). Deck SIZE is
 * the dial: a lean deck shows you almost everything each board (precise), a fat
 * deck keeps more surprise.
 *
 * v1: tiles are just letters (lowercase; "qu" is one tile worth two letters, as
 * on the board). Enhancements (wild / ×2 / gold) are a later expansion.
 */
import { createRng } from "game-kit/prng";
import type { Board, Cell } from "../board.js";

/** A letter tile. v1 = a bare letter; "qu" allowed (renders "Qu", spells "qu"). */
export type Tile = string;

/** Expand a letter→count distribution into a flat tile bag. */
export function expandDist(dist: Readonly<Record<string, number>>): Tile[] {
  return Object.entries(dist).flatMap(([letter, n]) => Array<Tile>(n).fill(letter));
}

/**
 * The Challenge BASE deck: one of every letter (a–z), with q as the playable "qu"
 * tile (26 tiles). You draft 5 more at the opening, then add/remove over the run —
 * so building vowels + duplicates of useful letters is the whole deck-craft.
 */
export const STARTER_LETTER_DECK: readonly Tile[] = [
  ..."abcdefghijklmnoprstuvwxyz".split(""),
  "qu",
];

/** The fewest tiles a deck may hold — must cover a board with a little spare. */
export const MIN_DECK = 25;

/** Weighted pool for the opening draft's letter offers (vowels + commons favored,
 *  a little rare-letter spice). */
const OFFER_WEIGHTS: Readonly<Record<string, number>> = {
  e: 6, a: 5, i: 4, o: 4, u: 3,
  s: 5, t: 5, r: 5, n: 5, l: 4, d: 3, c: 3, g: 3, m: 3, h: 3,
  p: 2, b: 2, f: 2, y: 2, w: 2, qu: 2, k: 1, v: 1, x: 1, z: 1, j: 1,
};

/** `n` DISTINCT letters offered at the opening draft, weighted toward the useful
 *  ones so doubling up on vowels/commons is the natural (but not forced) play. */
export function letterOffer(n = 10): Tile[] {
  const pool = expandDist(OFFER_WEIGHTS);
  const out: Tile[] = [];
  const seen = new Set<Tile>();
  let guard = 0;
  while (out.length < n && guard++ < 3000) {
    const l = pool[Math.floor(Math.random() * pool.length)]!;
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out;
}

function tileToCell(t: Tile): Cell {
  const v = t.toLowerCase();
  return { label: v === "qu" ? "Qu" : v.toUpperCase(), value: v };
}

/**
 * Deal a `size`×`size` board from the deck: a seeded Fisher–Yates shuffle of the
 * WHOLE deck, then take the first size*size tiles. Deterministic per seed. If the
 * deck is somehow shorter than the board (shouldn't happen — see {@link MIN_DECK}),
 * it wraps.
 */
export function makeBoardFromDeck(deck: readonly Tile[], seed: number, size = 5): Board {
  const rng = createRng(seed >>> 0);
  const bag = [...deck];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  const need = size * size;
  const cells: Cell[] = [];
  for (let i = 0; i < need; i++) cells.push(tileToCell(bag[i % bag.length]!));
  return { size, cells };
}

/** Add a tile (returns a new deck). */
export function addLetter(deck: readonly Tile[], letter: Tile): Tile[] {
  return [...deck, letter.toLowerCase()];
}

/** Remove the tile at `index` (returns a new deck; refuses to drop below MIN_DECK). */
export function removeLetterAt(deck: readonly Tile[], index: number): Tile[] {
  if (deck.length <= MIN_DECK) return [...deck];
  return deck.filter((_, i) => i !== index);
}

/** Remove ONE copy of `letter` (returns a new deck; refuses to drop below MIN_DECK). */
export function removeOneLetter(deck: readonly Tile[], letter: Tile): Tile[] {
  if (deck.length <= MIN_DECK) return [...deck];
  const i = deck.indexOf(letter);
  return i < 0 ? [...deck] : [...deck.slice(0, i), ...deck.slice(i + 1)];
}

/** Duplicate the tile at `index` (returns a new deck). */
export function duplicateLetterAt(deck: readonly Tile[], index: number): Tile[] {
  const t = deck[index];
  return t === undefined ? [...deck] : [...deck, t];
}

/** letter → count, for the deck viewer (sorted vowels-first then alpha). */
export function deckComposition(deck: readonly Tile[]): { letter: Tile; count: number }[] {
  const counts = new Map<Tile, number>();
  for (const t of deck) counts.set(t, (counts.get(t) ?? 0) + 1);
  const isVowel = (l: string) => "aeiou".includes(l[0] ?? "");
  return [...counts.entries()]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => {
      const va = isVowel(a.letter) ? 0 : 1;
      const vb = isVowel(b.letter) ? 0 : 1;
      return va !== vb ? va - vb : a.letter.localeCompare(b.letter);
    });
}
