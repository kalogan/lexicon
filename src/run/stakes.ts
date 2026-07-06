/**
 * run/stakes — the STAKES ladder for Challenge mode: a Balatro/Slay-the-Spire
 * "ascension" system. Each Challenge run is played at a Stake (a difficulty tier).
 * Clearing a run at Stake N unlocks Stake N+1, so difficulty scales WITH the
 * player's skill instead of being a flat wall — you only meet the harder rules
 * once you've earned them.
 *
 * Stakes are CUMULATIVE: reaching a stake keeps every lower stake's rule and adds
 * its own. {@link stakeRules} folds stakes 1..N into one flat {@link StakeRules}
 * the run reads (target/reward multipliers, interest on/off, bosses on Big blinds,
 * a plays delta). Pure data + a fold — no rng, no UI.
 */

/** One difficulty tier. `blurb` describes what THIS tier ADDS over the last. */
export interface Stake {
  /** 1-based tier. */
  id: number;
  name: string;
  /** Chip color (hex) for the stake pip/badge. */
  color: string;
  /** What this stake adds on top of the previous. */
  blurb: string;
}

/** The stake ladder, easiest → hardest. */
export const STAKES: readonly Stake[] = [
  { id: 1, name: "White", color: "#e8e2d4", blurb: "The standard climb — no extra rules." },
  { id: 2, name: "Red", color: "#d0563f", blurb: "Blind rewards cut 25% — a leaner economy." },
  { id: 3, name: "Green", color: "#6fb3a0", blurb: "No interest — banked gold no longer compounds." },
  { id: 4, name: "Black", color: "#4a4560", blurb: "Boss debuffs strike the Big blinds too." },
  { id: 5, name: "Gold", color: "#d98a3d", blurb: "Targets +20% and one fewer play each blind." },
];

/** How many stakes exist (the cap). */
export const STAKE_COUNT = STAKES.length;

/** Clamp an arbitrary number to a valid stake id (1..STAKE_COUNT). */
export function clampStake(n: number): number {
  return Math.max(1, Math.min(STAKE_COUNT, Math.floor(n)));
}

/** Look up a stake by id (clamped). */
export function stakeAt(id: number): Stake {
  return STAKES[clampStake(id) - 1]!;
}

/** The flat rule set active at a stake — every lower stake's rule folded in. */
export interface StakeRules {
  /** Multiplier on every blind target. */
  targetMult: number;
  /** Multiplier on every blind's coin reward. */
  rewardMult: number;
  /** Whether banked gold earns interest on clear. */
  interest: boolean;
  /** Whether Big blinds (not just Boss blinds) carry a boss debuff. */
  bossOnBig: boolean;
  /** Change to plays-per-blind (negative = fewer). */
  playsDelta: number;
}

/** Fold stakes 1..`stake` into one flat rule set. */
export function stakeRules(stake: number): StakeRules {
  const top = clampStake(stake);
  const r: StakeRules = {
    targetMult: 1,
    rewardMult: 1,
    interest: true,
    bossOnBig: false,
    playsDelta: 0,
  };
  for (let s = 2; s <= top; s++) {
    switch (s) {
      case 2: // Red
        r.rewardMult *= 0.75;
        break;
      case 3: // Green
        r.interest = false;
        break;
      case 4: // Black
        r.bossOnBig = true;
        break;
      case 5: // Gold
        r.targetMult *= 1.2;
        r.playsDelta -= 1;
        break;
    }
  }
  return r;
}
