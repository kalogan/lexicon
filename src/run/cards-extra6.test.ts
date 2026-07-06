/**
 * cards-extra6 — unit tests for the sixth relic wave. We prove the SCALING
 * contract on one grower (grow() banks into run.counters, apply() reads it,
 * accrued() reports it), and assert every id in the pack is unique.
 */
import { describe, expect, it } from "vitest";
import { makeRunState, type Breakdown, type ScoreCtx } from "./engine.js";
import { wordProps } from "./props.js";
import { EXTRA_CARDS6, SPECTROMETER, HARMONIC } from "./cards-extra6.js";

function bd(word: string): Breakdown {
  return {
    word,
    props: wordProps(word),
    base: 0,
    chips: 0,
    mult: 1,
    total: 0,
    timeGain: 0,
    permaMultAdd: 0,
    triggers: [],
  };
}

function ctxFor(word: string, run: ReturnType<typeof makeRunState>): ScoreCtx {
  return {
    props: wordProps(word),
    chips: 0,
    mult: 1,
    timeGain: 0,
    permaMultAdd: 0,
    run,
    trigger: () => {},
  };
}

describe("SPECTROMETER (scaling grower)", () => {
  it("banks +0.15 mult per 6+-distinct-letter word and reads it on apply", () => {
    const run = makeRunState();

    // "spectrum" has 8 distinct letters → qualifies.
    expect(wordProps("spectrum").distinct).toBeGreaterThanOrEqual(6);

    // accrued is null before anything has grown.
    expect(SPECTROMETER.accrued!(run)).toBeNull();

    // A short word with <6 distinct letters must NOT grow the bank.
    SPECTROMETER.grow!(run, bd("bee")); // distinct = 2
    expect(run.counters["x6-spectrometer"] ?? 0).toBe(0);

    // Two qualifying words → 0.30 banked.
    SPECTROMETER.grow!(run, bd("spectrum"));
    SPECTROMETER.grow!(run, bd("blizard")); // 7 distinct
    expect(run.counters["x6-spectrometer"]).toBeCloseTo(0.3, 5);

    // apply() reads the bank onto the current word's mult.
    const ctx = ctxFor("cat", run);
    SPECTROMETER.apply(ctx);
    expect(ctx.mult).toBeCloseTo(1.3, 5);

    // accrued now returns a string.
    expect(SPECTROMETER.accrued!(run)).toMatch(/mult banked/);
  });
});

describe("HARMONIC (same-vowel-count streak)", () => {
  it("extends the streak on matching vowel count and resets when it changes", () => {
    const run = makeRunState();

    // First commit: no previous vowel count → streak stays 0, records the count.
    HARMONIC.grow!(run, bd("cat")); // 1 vowel
    expect(run.counters["x6-harmonic"] ?? 0).toBe(0);

    // Same vowel count (1) → streak grows to 1.
    HARMONIC.grow!(run, bd("dog")); // 1 vowel
    expect(run.counters["x6-harmonic"]).toBe(1);

    // apply() rewards the current streak: +0.45 * 1.
    const ctx = ctxFor("sun", run);
    HARMONIC.apply(ctx);
    expect(ctx.mult).toBeCloseTo(1.45, 5);

    // Different vowel count → streak resets to 0.
    HARMONIC.grow!(run, bd("queue")); // 4 vowels
    expect(run.counters["x6-harmonic"]).toBe(0);
  });
});

describe("EXTRA_CARDS6", () => {
  it("has unique ids", () => {
    const ids = EXTRA_CARDS6.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps apply() pure — it never mutates run state", () => {
    const run = makeRunState();
    const before = JSON.stringify({ ...run, seenFirst: [...run.seenFirst] });
    for (const c of EXTRA_CARDS6) c.apply(ctxFor("testword", run));
    const after = JSON.stringify({ ...run, seenFirst: [...run.seenFirst] });
    expect(after).toBe(before);
  });
});
