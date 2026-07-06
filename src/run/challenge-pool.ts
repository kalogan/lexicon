/**
 * run/challenge-pool — the CHALLENGE-mode relic exclusions.
 *
 * Challenge has NO clock. Where Endless runs on a ticking timer that TIME relics
 * refill (restore 3s, +2s per double, etc.), a Challenge blind is gated purely by
 * PLAYS — you get N plays to hit a score target, and seconds never enter the math.
 * That makes any relic whose ONLY payoff flows through the time economy pure dead
 * weight in Challenge: it either grants time nobody spends, or reads `ctx.timeGain`
 * and pays out ZERO because — with the time-GRANTERS also excluded — there is never
 * any time to convert or a threshold to clear.
 *
 * The balance-sim (docs/BALANCE-SIM.md) corroborates: Time Broker (-7.9%), Time
 * Dictionary (-0.6%), Tailwind (-5.8%) and, worst of the whole pool, Horologist
 * (-32.4%) are all here. We classify from the CODE, not the sim: a relic is excluded
 * ONLY when it does nothing useful without a clock. Relics that spend/read time but
 * ALSO grant an unconditional chip/mult/permaMult (Overclock's ×2, Chronologist's
 * +0.5 perma-mult, Curator's chips, Reservoir/Colossus/Marathon) stay IN — they work
 * fine with a dead clock.
 *
 * This affects the CHALLENGE draft/shop pool ONLY. Endless (RunScreen) is untouched.
 */

/**
 * Relic ids excluded from the Challenge draft + shop pool because their only
 * meaningful effect depends on the (nonexistent) Challenge clock.
 *
 * Two shapes:
 *  1. PURE TIME-GRANTERS — the whole apply() is `ctx.timeGain += …`. In Challenge
 *     that restored time is never spent, so the relic scores nothing.
 *  2. TIME-CONVERTERS / TIME-GATED — apply() reads `ctx.timeGain` and only pays out
 *     when it's positive (or past a threshold). With the granters gone there is no
 *     time to read, so these produce 0.
 */
export const CHALLENGE_EXCLUDED_RELICS: ReadonlySet<string> = new Set<string>([
  // ── Pure time-granters (apply() only does `ctx.timeGain += …`) ──────────────
  "time", //         Time Dictionary — 6+ words restore 3s. Time only.
  "hourglass", //    Hourglass       — doubles restore 2s each. Time only.
  "metronome", //    Metronome       — 4-5 words restore 2s. Time only.
  "wellspring", //   Wellspring      — vowel-heavy words restore 3s. Time only.
  "lodestone", //    Lodestone       — rare letters restore 3s each. Time only.
  "x6-tailwind", //  Tailwind        — suffix words restore 4s. Time only.

  // ── Time-converters / time-gated (read ctx.timeGain, pay 0 without a clock) ──
  "time-broker", //  Time Broker — +15 chips PER second restored; `if (timeGain>0)`
  //                 → 0 in Challenge (no granters left feeding timeGain).
  "sundial", //      Sundial     — +0.3 mult per second restored; `if (timeGain>0)`
  //                 → 0 in Challenge. Same parasite shape as Time Broker.
  "horologist", //   Horologist  — perma +0.4 mult ONLY when a word restores 6s+;
  //                 `if (timeGain>=6)` never true once granters are gone. Its whole
  //                 payoff is a dead time gate — the sim's worst relic (-32.4%).
]);
