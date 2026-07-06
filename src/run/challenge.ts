/**
 * run/challenge — the ANTE/BLIND ladder for Challenge mode: the bounded,
 * Balatro-shaped run you can WIN. You climb TOTAL_ANTES antes; each ante is
 * three blinds (Small, Big, Boss) with escalating score targets. Clear the
 * final ante's boss and you win; miss a target and the run ends.
 *
 * This module is pure ladder geometry — targets, names, rewards, and the win
 * condition — with no board, no rng, no clock. Slice 3 drives a run through it.
 *
 * Target curve: base(ante) = round(100 · 2^(ante-1)), scaled within the ante by
 * small ×1.0, big ×1.35, boss ×1.8. Per-ante growth (2.0) exceeds the boss
 * multiplier (1.8), so the ladder is STRICTLY INCREASING across ante boundaries
 * too — the last blind of ante N is always below the first of ante N+1. It opens
 * near Endless board-1 (~100) and tops out at a 2,880-point capstone.
 */

export const TOTAL_ANTES = 5;
export const BLINDS_PER_ANTE = 3; // Small, Big, Boss
export const TOTAL_BLINDS = TOTAL_ANTES * BLINDS_PER_ANTE; // 15

/** Base coins for clearing any blind, plus the extra a boss blind pays. */
const BASE_REWARD = 4;
const BOSS_BONUS = 4;

/** Per-ante base target and the within-ante multipliers by blind index. */
const BASE_TARGET = 100;
const ANTE_GROWTH = 2.0;
const BLIND_MULT: readonly number[] = [1.0, 1.35, 1.8]; // Small, Big, Boss
const BLIND_NAMES: readonly string[] = ["Small Blind", "Big Blind", "Boss Blind"];

export interface Blind {
  ante: number; // 1..TOTAL_ANTES
  indexInAnte: number; // 0..BLINDS_PER_ANTE-1 (2 = the boss blind)
  step: number; // global order, 0..TOTAL_BLINDS-1
  name: string; // "Small Blind" | "Big Blind" | "Boss Blind"
  target: number; // score to beat this blind
  isBoss: boolean; // indexInAnte === BLINDS_PER_ANTE-1
  reward: number; // coins awarded for clearing it (base + boss bonus)
}

/** The score target for a given ante + blind index. Escalates per ante AND
 *  within an ante (small < big < boss), monotonically across boundaries. */
export function blindTarget(ante: number, indexInAnte: number): number {
  const base = BASE_TARGET * Math.pow(ANTE_GROWTH, ante - 1);
  return Math.round(base * (BLIND_MULT[indexInAnte] ?? 1));
}

/** Build the blind at a global step (0..TOTAL_BLINDS-1). */
function makeBlind(step: number): Blind {
  const ante = Math.floor(step / BLINDS_PER_ANTE) + 1;
  const indexInAnte = step % BLINDS_PER_ANTE;
  const isBoss = indexInAnte === BLINDS_PER_ANTE - 1;
  return {
    ante,
    indexInAnte,
    step,
    name: BLIND_NAMES[indexInAnte]!,
    target: blindTarget(ante, indexInAnte),
    isBoss,
    reward: BASE_REWARD + (isBoss ? BOSS_BONUS : 0),
  };
}

/** All TOTAL_BLINDS blinds, in play order (step 0..14). */
export function challengeBlinds(): readonly Blind[] {
  return Array.from({ length: TOTAL_BLINDS }, (_, step) => makeBlind(step));
}

/** The blind at a global step, or undefined past the end. */
export function blindAtStep(step: number): Blind | undefined {
  if (step < 0 || step >= TOTAL_BLINDS) return undefined;
  return makeBlind(step);
}

/** True once you've cleared the last blind (step >= TOTAL_BLINDS) — the WIN. */
export function isWin(step: number): boolean {
  return step >= TOTAL_BLINDS;
}
