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

/** The starting deck as a letter→count distribution — a balanced, playable bag
 *  (~35% vowels) sized so a 5×5 (25 tiles) shows about half your deck each board. */
const STARTER_DIST: Readonly<Record<string, number>> = {
  a: 4, e: 5, i: 4, o: 3, u: 2, // 18 vowels
  t: 3, n: 3, r: 3, s: 3, // 12
  l: 2, d: 2, g: 2, c: 2, m: 2, h: 2, // 12
  b: 1, f: 1, p: 1, y: 1, k: 1, w: 1, v: 1, // 7
};

/** Expand a letter→count distribution into a flat tile bag. */
export function expandDist(dist: Readonly<Record<string, number>>): Tile[] {
  return Object.entries(dist).flatMap(([letter, n]) => Array<Tile>(n).fill(letter));
}

/** The deck every Challenge run starts with (49 tiles). */
export const STARTER_LETTER_DECK: readonly Tile[] = expandDist(STARTER_DIST);

/** The fewest tiles a deck may hold — must cover a board with a little spare. */
export const MIN_DECK = 25;

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
