/**
 * meta — lifetime STATS + ACHIEVEMENTS, persisted to localStorage.
 *
 * One JSON blob under "lexicon:stats" holds the running stats and the set of
 * unlocked achievement ids. RunScreen fires `record*` events as you play; each
 * updates the stats AND checks the achievements it could unlock, returning the
 * ids newly unlocked this call (so the UI can toast them). The Codex reads
 * `getStats()` / `getUnlocked()` / `ACHIEVEMENTS` to render the Stats +
 * Achievements tabs. All storage access is try/caught (private-mode / SSR safe).
 */

import { STAKE_COUNT } from "./run/stakes.js";

const KEY = "lexicon:stats";

export interface Stats {
  /** Runs started. */
  runs: number;
  /** Deepest board ever reached. */
  bestDepth: number;
  /** Highest run score. */
  bestScore: number;
  /** Words played across all runs. */
  totalWords: number;
  /** Longest single word (letters). */
  longestWord: number;
  /** Highest-scoring single word. */
  bestWordScore: number;
  /** Highest permanent mult reached (the +N; base mult is 1+N). */
  bestMult: number;
  /** Boss boards beaten. */
  bossesBeaten: number;
  /** Total real seconds spent in a run. */
  timePlayed: number;
  /** Challenge runs won (cleared the final boss). */
  challengeWins: number;
  /** Highest Challenge stake UNLOCKED (playable). Starts at 1. */
  topStakeUnlocked: number;
  /** Highest Challenge stake ever CLEARED (0 = none yet). */
  topStakeWon: number;
}

const ZERO: Stats = {
  runs: 0,
  bestDepth: 0,
  bestScore: 0,
  totalWords: 0,
  longestWord: 0,
  bestWordScore: 0,
  bestMult: 0,
  bossesBeaten: 0,
  timePlayed: 0,
  challengeWins: 0,
  topStakeUnlocked: 1,
  topStakeWon: 0,
};

interface Store {
  stats: Stats;
  unlocked: string[];
  /** Discovery gating: keys of content the player has ENCOUNTERED in a run
   *  (namespaced — "relic:<id>", "charm:<id>", "mod:<id>", "boss:<id>"). The
   *  Codex shows only seen content in full; the rest reads as a locked silhouette. */
  seen: string[];
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      return { stats: { ...ZERO, ...(s.stats ?? {}) }, unlocked: s.unlocked ?? [], seen: s.seen ?? [] };
    }
  } catch {
    /* fall through to a fresh store */
  }
  // Migrate the legacy standalone bestDepth key, if present.
  let bestDepth = 0;
  try {
    bestDepth = Number(localStorage.getItem("lexicon:bestDepth") ?? 0) || 0;
  } catch {
    /* ignore */
  }
  return { stats: { ...ZERO, bestDepth }, unlocked: [], seen: [] };
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* the in-session values still hold even if persistence fails */
  }
}

export function getStats(): Stats {
  return read().stats;
}

export function getUnlocked(): Set<string> {
  return new Set(read().unlocked);
}

/** The set of encountered content keys (for Codex discovery gating). */
export function getSeen(): Set<string> {
  return new Set(read().seen);
}

/** Mark content keys ENCOUNTERED. Namespaced keys ("relic:tiny", "boss:echo",
 *  "mod:rare-air", "charm:charm-spotlight"). Idempotent; writes only on change. */
export function markSeen(keys: readonly string[]): void {
  if (keys.length === 0) return;
  const s = read();
  const have = new Set(s.seen);
  let changed = false;
  for (const k of keys) {
    if (!have.has(k)) {
      have.add(k);
      changed = true;
    }
  }
  if (changed) {
    s.seen = [...have];
    write(s);
  }
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

/** Every achievement, in display order (roughly easy → hard). */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-steps", name: "First Steps", desc: "Clear your first board.", icon: "👣" },
  { id: "wordsmith", name: "Wordsmith", desc: "Play a 6+ letter word.", icon: "✍️" },
  { id: "rare-air", name: "Rare Air", desc: "Play a word with Q, X, J, or Z.", icon: "💎" },
  { id: "giant-slayer", name: "Giant Slayer", desc: "Beat a boss board.", icon: "☠️" },
  { id: "survivor", name: "Survivor", desc: "Reach board 6.", icon: "🛡️" },
  { id: "engine-builder", name: "Engine Builder", desc: "Reach ×5 mult in a run.", icon: "🔥" },
  { id: "full-house", name: "Full House", desc: "Own 8 relics at once.", icon: "🎴" },
  { id: "stacker", name: "Stacker", desc: "Own 3 copies of one relic.", icon: "🧱" },
  { id: "lexicographer", name: "Lexicographer", desc: "Play a 9+ letter word.", icon: "📚" },
  { id: "overkill", name: "Overkill", desc: "Score 500+ on a single word.", icon: "💥" },
  { id: "deep-diver", name: "Deep Diver", desc: "Reach board 10.", icon: "🌊" },
  // ── Expansion (mixed difficulty) ──────────────────────────────────────────
  { id: "warmup", name: "Warm-Up", desc: "Play 25 words.", icon: "📖" },
  { id: "regular", name: "Regular", desc: "Start 5 runs.", icon: "🎲" },
  { id: "first-session", name: "First Session", desc: "Play for 10 minutes.", icon: "⌛" },
  { id: "double-trouble", name: "Double Trouble", desc: "Play a word with 2 rare letters (Q/X/J/Z).", icon: "💠" },
  { id: "high-roller", name: "High Roller", desc: "Score 1,000 in a single run.", icon: "💰" },
  { id: "vocabularian", name: "Vocabularian", desc: "Play 100 words.", icon: "🗂️" },
  { id: "descent", name: "Descent", desc: "Reach board 8.", icon: "🪜" },
  { id: "overclocked", name: "Overclocked", desc: "Reach ×8 mult in a run.", icon: "⚡" },
  { id: "boss-rush", name: "Boss Rush", desc: "Beat 5 boss boards.", icon: "⚔️" },
  { id: "dedicated", name: "Dedicated", desc: "Play for 1 hour.", icon: "⏰" },
  { id: "curator", name: "Curator", desc: "Own 12 relics at once.", icon: "🏛️" },
  { id: "nuke", name: "Nuke", desc: "Score 1,500 on a single word.", icon: "☄️" },
  { id: "challenger", name: "Challenger", desc: "Win a Challenge run.", icon: "🏅" },
  { id: "bookworm", name: "Bookworm", desc: "Play 500 words.", icon: "🐛" },
  { id: "abyssal", name: "Abyssal", desc: "Reach board 15.", icon: "🌑" },
  { id: "score-hunter", name: "Score Hunter", desc: "Score 5,000 in a single run.", icon: "🎯" },
  { id: "runaway", name: "Runaway Engine", desc: "Reach ×15 mult in a run.", icon: "🌋" },
  { id: "sesquipedalian", name: "Sesquipedalian", desc: "Play a 12-letter word.", icon: "📏" },
  { id: "nemesis", name: "Nemesis", desc: "Beat 20 boss boards.", icon: "👹" },
  { id: "obsessed", name: "Obsessed", desc: "Play for 5 hours.", icon: "🕰️" },
];

/** Mark ids unlocked in the store (mutates), returning the ones NEW this call. */
function unlock(store: Store, ids: string[]): string[] {
  const have = new Set(store.unlocked);
  const fresh = ids.filter((id) => !have.has(id));
  if (fresh.length) store.unlocked = [...store.unlocked, ...fresh];
  return fresh;
}

export function recordRunStart(): string[] {
  const s = read();
  s.stats.runs += 1;
  const fresh = unlock(s, s.stats.runs >= 5 ? ["regular"] : []);
  write(s);
  return fresh;
}

/** Add real seconds of play (called as a run session ends). Never negative. */
export function addTimePlayed(seconds: number): string[] {
  if (!(seconds > 0)) return [];
  const s = read();
  s.stats.timePlayed += Math.round(seconds);
  const fresh = unlock(s, [
    ...(s.stats.timePlayed >= 600 ? ["first-session"] : []),
    ...(s.stats.timePlayed >= 3600 ? ["dedicated"] : []),
    ...(s.stats.timePlayed >= 18000 ? ["obsessed"] : []),
  ]);
  write(s);
  return fresh;
}

/** A Challenge run was WON at `stake` — bank the win and unlock the next stake. */
export function recordChallengeWin(stake: number): string[] {
  const s = read();
  s.stats.challengeWins += 1;
  s.stats.topStakeWon = Math.max(s.stats.topStakeWon, stake);
  s.stats.topStakeUnlocked = Math.max(s.stats.topStakeUnlocked, Math.min(stake + 1, STAKE_COUNT));
  const fresh = unlock(s, ["challenger"]);
  write(s);
  return fresh;
}

/** A word was scored. len + rareLetters from its props; score is the final total. */
export function recordWord(len: number, score: number, rareLetters: number): string[] {
  const s = read();
  s.stats.totalWords += 1;
  s.stats.longestWord = Math.max(s.stats.longestWord, len);
  s.stats.bestWordScore = Math.max(s.stats.bestWordScore, score);
  const fresh = unlock(s, [
    ...(len >= 6 ? ["wordsmith"] : []),
    ...(len >= 9 ? ["lexicographer"] : []),
    ...(len >= 12 ? ["sesquipedalian"] : []),
    ...(rareLetters > 0 ? ["rare-air"] : []),
    ...(rareLetters >= 2 ? ["double-trouble"] : []),
    ...(score >= 500 ? ["overkill"] : []),
    ...(score >= 1500 ? ["nuke"] : []),
    ...(s.stats.totalWords >= 25 ? ["warmup"] : []),
    ...(s.stats.totalWords >= 100 ? ["vocabularian"] : []),
    ...(s.stats.totalWords >= 500 ? ["bookworm"] : []),
  ]);
  write(s);
  return fresh;
}

/** The run's permanent mult changed (permaMult is the +N; ×5 mult = permaMult 4). */
export function recordMult(permaMult: number): string[] {
  const s = read();
  s.stats.bestMult = Math.max(s.stats.bestMult, permaMult);
  const fresh = unlock(s, [
    ...(permaMult >= 4 ? ["engine-builder"] : []),
    ...(permaMult >= 7 ? ["overclocked"] : []), // ×8
    ...(permaMult >= 14 ? ["runaway"] : []), // ×15
  ]);
  write(s);
  return fresh;
}

export function recordBoardCleared(_boardIdx: number, boss: boolean): string[] {
  const s = read();
  if (boss) s.stats.bossesBeaten += 1;
  const fresh = unlock(s, [
    "first-steps",
    ...(boss ? ["giant-slayer"] : []),
    ...(s.stats.bossesBeaten >= 5 ? ["boss-rush"] : []),
    ...(s.stats.bossesBeaten >= 20 ? ["nemesis"] : []),
  ]);
  write(s);
  return fresh;
}

export function recordRunEnd(depth: number, score: number): string[] {
  const s = read();
  s.stats.bestDepth = Math.max(s.stats.bestDepth, depth);
  s.stats.bestScore = Math.max(s.stats.bestScore, score);
  const fresh = unlock(s, [
    ...(depth >= 6 ? ["survivor"] : []),
    ...(depth >= 8 ? ["descent"] : []),
    ...(depth >= 10 ? ["deep-diver"] : []),
    ...(depth >= 15 ? ["abyssal"] : []),
    ...(score >= 1000 ? ["high-roller"] : []),
    ...(score >= 5000 ? ["score-hunter"] : []),
  ]);
  write(s);
  return fresh;
}

/** The relic deck changed — check ownership achievements (size + stacking). */
export function recordDeck(ids: readonly string[]): string[] {
  const s = read();
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const maxCopies = counts.size ? Math.max(...counts.values()) : 0;
  const fresh = unlock(s, [
    ...(ids.length >= 8 ? ["full-house"] : []),
    ...(ids.length >= 12 ? ["curator"] : []),
    ...(maxCopies >= 3 ? ["stacker"] : []),
  ]);
  write(s);
  return fresh;
}
