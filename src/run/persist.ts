/**
 * run/persist — SAVE / RESUME an in-progress run. Roguelikes lose players when a
 * closed tab means a lost run (brutal on mobile), so we snapshot the run at
 * BOARD/BLIND boundaries (and shop/draft entry) to localStorage and offer a
 * "Resume run" on the title.
 *
 * Cards/charms/bosses/modifiers are config objects with functions — NOT JSON —
 * so we serialize them by ID and rehydrate from the catalogs on load. RunState's
 * `seenFirst` Set is stored as an array. A version tag invalidates old snapshots
 * cleanly after a schema change (a stale resume silently becomes "no resume").
 */
import type { Card, RunState } from "./engine.js";
import type { Tile } from "./deck.js";
import { CATALOG } from "./cards.js";
import { CHARMS, type Charm } from "./charms.js";
import { BOSSES, type Boss } from "./bosses.js";
import { MODIFIERS, type BoardMod } from "./modifiers.js";

const KEY = "lexicon:run";
const VERSION = 1;

/** RunState minus the Set (stored as an array so it round-trips through JSON). */
interface RunSnap {
  board: number;
  boardWords: number;
  runWords: number;
  lastFirst: string | null;
  permaMult: number;
  seenFirst: string[];
  counters: Record<string, number>;
}

interface Common {
  v: number;
  coins: number;
  boardSeed: number;
  boardScore: number;
  playsLeft: number;
  discardsLeft: number;
  run: RunSnap;
  found: string[];
  bestWord: { word: string; score: number } | null;
  charms: string[]; // charm ids
  overrides: Record<number, string>;
  sealsCleared: boolean;
  doubleNext: boolean;
}

export interface EndlessSnapshot extends Common {
  mode: "endless";
  phase: "play" | "draft" | "shop";
  boardIdx: number;
  runScore: number;
  timeLeft: number;
  deck: string[]; // relic ids (dups preserved)
  bossId: string | null;
  boardModId: string | null;
  draft: string[]; // relic ids offered in the draft phase
  shopStock: string[]; // relic ids in the shop
}

export interface ChallengeSnapshot extends Common {
  mode: "challenge";
  phase: "intro" | "play" | "shop";
  step: number;
  stake: number;
  runSalt: number;
  letters: Tile[];
  relics: string[]; // relic ids
  shopStock: { cardId: string; price: number }[];
  charmStock: { charmId: string; price: number }[];
}

export type RunSnapshot = EndlessSnapshot | ChallengeSnapshot;

// ── persistence ────────────────────────────────────────────────────────────────

export function saveRun(snap: RunSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* private mode / quota — the in-session run still plays */
  }
}

export function loadRun(): RunSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as RunSnapshot;
    if (!s || s.v !== VERSION) return null;
    if (s.mode !== "endless" && s.mode !== "challenge") return null;
    return s;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ── (de)serialization helpers ────────────────────────────────────────────────────

export const SNAP_VERSION = VERSION;

/** RunState → serializable snap. */
export function toRunSnap(r: RunState): RunSnap {
  return {
    board: r.board,
    boardWords: r.boardWords,
    runWords: r.runWords,
    lastFirst: r.lastFirst,
    permaMult: r.permaMult,
    seenFirst: [...r.seenFirst],
    counters: { ...r.counters },
  };
}

/** Snap → RunState (rebuilds the Set). */
export function fromRunSnap(s: RunSnap): RunState {
  return {
    board: s.board,
    boardWords: s.boardWords,
    runWords: s.runWords,
    lastFirst: s.lastFirst,
    permaMult: s.permaMult,
    seenFirst: new Set(s.seenFirst),
    counters: { ...s.counters },
  };
}

const cardById = new Map(CATALOG.map((c) => [c.id, c] as const));
const charmById = new Map(CHARMS.map((c) => [c.id, c] as const));
const bossById = new Map(BOSSES.map((b) => [b.id, b] as const));
const modById = new Map(MODIFIERS.map((m) => [m.id, m] as const));

/** Rehydrate a relic-id list into Cards (dropping any unknown id), dups preserved. */
export function relicsFromIds(ids: readonly string[]): Card[] {
  const out: Card[] = [];
  for (const id of ids) {
    const c = cardById.get(id);
    if (c) out.push(c);
  }
  return out;
}

export function charmsFromIds(ids: readonly string[]): Charm[] {
  const out: Charm[] = [];
  for (const id of ids) {
    const c = charmById.get(id);
    if (c) out.push(c);
  }
  return out;
}

export function bossFromId(id: string | null): Boss | null {
  return id ? bossById.get(id) ?? null : null;
}

export function modFromId(id: string | null): BoardMod | null {
  return id ? modById.get(id) ?? null : null;
}
