/**
 * run/charms — CHARMS, the run's consumable one-shots. Where Dictionaries and
 * Legendaries are PERSISTENT scoring rules baked into the deck, a charm is held
 * in a few slots and burned for an IMMEDIATE effect, then it's gone: buy back
 * time, re-roll a dead board, load your next word, shatter a boss's seals, or
 * spend a slot to bank permanent mult. RunScreen interprets {@link CharmEffect}
 * — this file is data only, deliberately parallel to bosses.ts.
 */
import { createRng } from "game-kit/prng";
import type { Rarity } from "./engine.js";

/** What a charm DOES when consumed. RunScreen interprets these — data only here. */
export type CharmEffect =
  | { kind: "time"; seconds: number }        // grant +N seconds now
  | { kind: "reroll" }                       // re-roll the board's letters
  | { kind: "doubleNext" }                   // the next scored word counts ×2
  | { kind: "clearSeals" }                   // remove all sealed tiles this board (anti-boss)
  | { kind: "permaMult"; amount: number }    // +amount PERMANENT mult for the rest of the run
  | { kind: "transmute" };                   // change one board tile into any letter you pick

export interface Charm {
  id: string;
  name: string;
  /** Player-facing, terse. */
  blurb: string;
  rarity: Rarity;
  effect: CharmEffect;
}

/** The charm every run starts holding (so players meet the mechanic immediately). A "time" charm. */
export const STARTER_CHARM: Charm = {
  id: "charm-hourglass",
  name: "Hourglass",
  blurb: "Restore 25 seconds.",
  rarity: "common",
  effect: { kind: "time", seconds: 25 },
};

/** All charms, for drops + the Codex. STARTER_CHARM is a member (same object). */
export const CHARMS: readonly Charm[] = [
  STARTER_CHARM,
  {
    id: "charm-stopwatch",
    name: "Stopwatch",
    blurb: "Restore 45 seconds.",
    rarity: "uncommon",
    effect: { kind: "time", seconds: 45 },
  },
  {
    id: "charm-fresh-board",
    name: "Fresh Board",
    blurb: "Re-roll the board into new letters.",
    rarity: "common",
    effect: { kind: "reroll" },
  },
  {
    id: "charm-spotlight",
    name: "Spotlight",
    blurb: "Your next word scores ×2.",
    rarity: "uncommon",
    effect: { kind: "doubleNext" },
  },
  {
    id: "charm-locksmith",
    name: "Locksmith",
    blurb: "Shatter every sealed tile on this board.",
    rarity: "rare",
    effect: { kind: "clearSeals" },
  },
  {
    id: "charm-momentum",
    name: "Momentum",
    blurb: "+0.5 permanent mult for the rest of this run.",
    rarity: "uncommon",
    effect: { kind: "permaMult", amount: 0.5 },
  },
  {
    id: "charm-catalyst",
    name: "Catalyst",
    blurb: "+1.0 permanent mult for the rest of this run.",
    rarity: "rare",
    effect: { kind: "permaMult", amount: 1 },
  },
  {
    id: "charm-transmute",
    name: "Transmute",
    blurb: "Change one board tile into any letter you pick.",
    rarity: "uncommon",
    effect: { kind: "transmute" },
  },
];

/** Deterministically pick a charm from CHARMS by seed (weighted toward commons). */
export function randomCharm(seed: number): Charm {
  // Weight by rarity so drops lean common — the same terse spirit as randomBoss,
  // just with a rarity-weighted bag instead of a flat pick.
  const weightOf = (r: Rarity): number =>
    r === "common" ? 5 : r === "uncommon" ? 3 : r === "rare" ? 2 : 1;
  const bag = CHARMS.flatMap((c) => Array<Charm>(weightOf(c.rarity)).fill(c));
  return bag[createRng(seed >>> 0).int(bag.length)]!;
}
