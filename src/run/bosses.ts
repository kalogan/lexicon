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
  {
    id: "botanist",
    name: "The Botanist",
    blurb: "Every word needs 3+ vowels.",
    allow: (w) => {
      let v = 0;
      for (const c of w) if (c === "a" || c === "e" || c === "i" || c === "o" || c === "u") v++;
      return v >= 3;
    },
    targetMult: 0.62,
  },
  {
    id: "purist",
    name: "The Purist",
    blurb: "No doubled letters — every letter must differ from its neighbour.",
    allow: (w) => {
      for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return false;
      return true;
    },
    targetMult: 0.68,
  },
  {
    id: "collector",
    name: "The Collector",
    blurb: "Every word must carry a rare letter — Q, X, J or Z.",
    allow: (w) => /[qxjz]/.test(w),
    targetMult: 0.6,
  },
  {
    id: "surveyor",
    name: "The Surveyor",
    blurb: "Words must be 4 to 6 letters — no more, no less.",
    allow: (w) => w.length >= 4 && w.length <= 6,
    targetMult: 0.66,
  },
  {
    id: "serpent",
    name: "The Serpent",
    blurb: "Each word must start with the last letter of the one before.",
    allow: (w, found) => {
      let prev: string | null = null;
      for (const f of found) prev = f; // insertion order — the most recent word
      return prev === null || w[0] === prev[prev.length - 1];
    },
    targetMult: 0.62,
  },
  {
    id: "hermit",
    name: "The Hermit",
    blurb: "One word — half the board is sealed. Find the seam.",
    oneWord: true,
    blocked: (size, seed) => sealCells(size, seed, 0.5),
    targetMult: 0.28,
  },
];

export function randomBoss(seed: number): Boss {
  return BOSSES[createRng(seed >>> 0).int(BOSSES.length)]!;
}

/**
 * Bosses eligible for CHALLENGE-mode boss blinds: the "debuff" bosses — word
 * constraints + light seals. The one-word showdowns are excluded: Challenge
 * blinds accumulate a target over several plays, so "the board ends after one
 * word" doesn't fit that loop (and would be brutally swingy against a fixed
 * target). Leaves 9 bosses of real variety.
 */
export const CHALLENGE_BOSSES: readonly Boss[] = BOSSES.filter((b) => !b.oneWord);

/** Deterministically pick a Challenge boss from {@link CHALLENGE_BOSSES}. */
export function challengeBoss(seed: number): Boss {
  return CHALLENGE_BOSSES[createRng(seed >>> 0).int(CHALLENGE_BOSSES.length)]!;
}
