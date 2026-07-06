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
};

interface Store {
  stats: Stats;
  unlocked: string[];
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      return { stats: { ...ZERO, ...(s.stats ?? {}) }, unlocked: s.unlocked ?? [] };
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
  return { stats: { ...ZERO, bestDepth }, unlocked: [] };
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
];

/** Mark ids unlocked in the store (mutates), returning the ones NEW this call. */
function unlock(store: Store, ids: string[]): string[] {
  const have = new Set(store.unlocked);
  const fresh = ids.filter((id) => !have.has(id));
  if (fresh.length) store.unlocked = [...store.unlocked, ...fresh];
  return fresh;
}

export function recordRunStart(): void {
  const s = read();
  s.stats.runs += 1;
  write(s);
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
    ...(rareLetters > 0 ? ["rare-air"] : []),
    ...(score >= 500 ? ["overkill"] : []),
  ]);
  write(s);
  return fresh;
}

/** The run's permanent mult changed (permaMult is the +N; ×5 mult = permaMult 4). */
export function recordMult(permaMult: number): string[] {
  const s = read();
  s.stats.bestMult = Math.max(s.stats.bestMult, permaMult);
  const fresh = unlock(s, permaMult >= 4 ? ["engine-builder"] : []);
  write(s);
  return fresh;
}

export function recordBoardCleared(_boardIdx: number, boss: boolean): string[] {
  const s = read();
  if (boss) s.stats.bossesBeaten += 1;
  const fresh = unlock(s, ["first-steps", ...(boss ? ["giant-slayer"] : [])]);
  write(s);
  return fresh;
}

export function recordRunEnd(depth: number, score: number): string[] {
  const s = read();
  s.stats.bestDepth = Math.max(s.stats.bestDepth, depth);
  s.stats.bestScore = Math.max(s.stats.bestScore, score);
  const fresh = unlock(s, [
    ...(depth >= 6 ? ["survivor"] : []),
    ...(depth >= 10 ? ["deep-diver"] : []),
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
    ...(maxCopies >= 3 ? ["stacker"] : []),
  ]);
  write(s);
  return fresh;
}
