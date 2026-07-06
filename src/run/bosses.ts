/**
 * run/bosses — the boss boards (every 6th board, per the GDD). A boss doesn't
 * give unfair letters; it changes the RULES of the board, forcing a different
 * way to play: a word constraint (`allow`), sealed tiles you must trace around
 * (`blocked`), and/or a single-word showdown (`oneWord`).
 */
import { createRng } from "game-kit/prng";

export interface Boss {
  id: string;
  name: string;
  /** The rule, shown to the player on the boss banner. */
  blurb: string;
  /** Is this traced word ALLOWED to score on this boss? (else it's rejected) */
  allow?: (word: string, found: ReadonlySet<string>) => boolean;
  /** Board cell indices that are SEALED (untraceable) on this boss. */
  blocked?: (size: number, seed: number) => number[];
  /** If true, the board ends after one submitted word — make it count. */
  oneWord?: boolean;
  /** Discount on the board's target — the CONSTRAINT is the difficulty, so the
   *  score bar comes down to keep the board hard-but-passable (a boss shouldn't
   *  owe the same score as an unconstrained board). One-word bosses need the
   *  deepest cut, since a single word must clear the whole target. */
  targetMult: number;
}

function sealCells(size: number, seed: number, fraction: number): number[] {
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  const n = Math.max(3, Math.floor(size * size * fraction));
  const cells = new Set<number>();
  while (cells.size < n) cells.add(rng.int(size * size));
  return [...cells];
}

export const BOSSES: readonly Boss[] = [
  {
    id: "librarian",
    name: "The Librarian",
    blurb: "Only words of 4+ letters count.",
    allow: (w) => w.length >= 4,
    targetMult: 0.7,
  },
  {
    id: "minimalist",
    name: "The Minimalist",
    blurb: "No word longer than 5 letters.",
    allow: (w) => w.length <= 5,
    targetMult: 0.7,
  },
  {
    id: "echo",
    name: "The Echo",
    blurb: "Never reuse a starting letter.",
    allow: (w, found) => {
      const first = w[0];
      for (const f of found) if (f[0] === first) return false;
      return true;
    },
    targetMult: 0.65,
  },
  {
    id: "warden",
    name: "The Warden",
    blurb: "Sealed tiles — trace around the shadows.",
    blocked: (size, seed) => sealCells(size, seed, 0.18),
    targetMult: 0.72,
  },
  {
    id: "oracle",
    name: "The Oracle",
    blurb: "One word. Make it your masterpiece.",
    oneWord: true,
    targetMult: 0.3,
  },
  {
    id: "oubliette",
    name: "The Oubliette",
    blurb: "One word — and a third of the board is sealed.",
    oneWord: true,
    blocked: (size, seed) => sealCells(size, seed, 0.32),
    targetMult: 0.26,
  },
];

export function randomBoss(seed: number): Boss {
  return BOSSES[createRng(seed >>> 0).int(BOSSES.length)]!;
}
