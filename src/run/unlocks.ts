/**
 * run/unlocks — real META-PROGRESSION for the relic pool. Every common / uncommon
 * / rare relic is available from run one, but the LEGENDARIES start LOCKED and are
 * earned through milestones — so the game visibly "opens up" as you play (the
 * Balatro/StS unlock loop) instead of showing you everything on day one.
 *
 * Unlocks are DERIVED from lifetime stats (no extra storage): compute the set once
 * at run start and filter the draft/shop pool through it. Locking only legendaries
 * keeps early runs full-featured while still dangling a chase.
 *
 * Which legendary unlocks in which wave is decided deterministically (sorted by id,
 * sliced) so it needs no hand-maintained id list — add a legendary and it simply
 * joins a wave.
 */
import { CATALOG } from "./cards.js";

/** The lifetime signals an unlock can gate on (a subset of meta Stats). */
export interface UnlockProgress {
  challengeWins: number;
  bossesBeaten: number;
  topStakeWon: number;
  bestDepth: number;
}

/** Every legendary relic id, sorted — the locked-by-default pool. */
const LEGENDARY_IDS: readonly string[] = [...CATALOG]
  .filter((c) => c.rarity === "legendary")
  .map((c) => c.id)
  .sort();

/** Split the legendaries into three earn-able waves. */
const WAVE_SIZE = Math.ceil(LEGENDARY_IDS.length / 3);
const WAVES: readonly { ids: readonly string[]; desc: string; met: (p: UnlockProgress) => boolean }[] = [
  {
    ids: LEGENDARY_IDS.slice(0, WAVE_SIZE),
    desc: "Win a Challenge run",
    met: (p) => p.challengeWins >= 1,
  },
  {
    ids: LEGENDARY_IDS.slice(WAVE_SIZE, WAVE_SIZE * 2),
    desc: "Beat 10 boss boards",
    met: (p) => p.bossesBeaten >= 10,
  },
  {
    ids: LEGENDARY_IDS.slice(WAVE_SIZE * 2),
    desc: "Clear a Red+ stake, or reach board 12",
    met: (p) => p.topStakeWon >= 2 || p.bestDepth >= 12,
  },
];

/** Relic ids that start LOCKED (all legendaries). */
export const LOCKABLE_RELIC_IDS: ReadonlySet<string> = new Set(LEGENDARY_IDS);

/** The set of relic ids currently AVAILABLE to draft/shop, given lifetime progress. */
export function unlockedRelicIds(p: UnlockProgress): Set<string> {
  const out = new Set<string>();
  for (const c of CATALOG) if (!LOCKABLE_RELIC_IDS.has(c.id)) out.add(c.id);
  for (const w of WAVES) if (w.met(p)) for (const id of w.ids) out.add(id);
  return out;
}

/** Per-locked-relic unlock hint (for the Codex). Empty string ⇒ not lockable. */
export function unlockHint(relicId: string): string {
  const w = WAVES.find((x) => x.ids.includes(relicId));
  return w ? w.desc : "";
}

/** How many lockable relics remain locked at this progress (for a Codex counter). */
export function lockedCount(p: UnlockProgress): number {
  const unlocked = unlockedRelicIds(p);
  let n = 0;
  for (const id of LOCKABLE_RELIC_IDS) if (!unlocked.has(id)) n++;
  return n;
}
