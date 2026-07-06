/**
 * Tests for the SCALING & COMBO wave (cards-extra5). These verify the pack's
 * two defining mechanics end-to-end against the real engine state:
 *  • grow() banks value into run.counters (scaling), and apply() reads it back;
 *  • streak counters climb on consecutive matches and RESET when broken;
 *  • accrued() reports the built value, and returns null before anything accrues.
 */
import { describe, it, expect } from "vitest";
import { makeRunState, type Breakdown, type ScoreCtx, type RunState } from "./engine.js";
import { wordProps } from "./props.js";
import {
  HOARDER,
  ALLITERATOR,
  ESCALATION,
  METRONOME_KING,
  CARTOGRAPHER,
  EXTRA_CARDS5,
} from "./cards-extra5.js";

/** Build a Breakdown for a given word (props derived from the string). */
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

/** A fresh ScoreCtx over a given run, capturing triggers. */
function ctxFor(run: RunState, word: string): ScoreCtx {
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

describe("scaling: The Hoarder (perma-mult on double letters)", () => {
  it("grows only on double-letter words and apply() reads the bank", () => {
    const run = makeRunState();

    // accrued is null before anything accrues.
    expect(HOARDER.accrued!(run)).toBeNull();

    // Two double-letter words → +0.3 each; a no-double word banks nothing.
    HOARDER.grow!(run, bd("letter")); // "tt"
    HOARDER.grow!(run, bd("bell")); // "ll"
    HOARDER.grow!(run, bd("cat")); // no double
    expect(run.counters["scale-hoarder"]).toBeCloseTo(0.6, 5);

    // apply() adds the banked mult to a future word.
    const ctx = ctxFor(run, "cat");
    HOARDER.apply(ctx);
    expect(ctx.mult).toBeCloseTo(1.6, 5);

    // accrued reports the built value.
    expect(HOARDER.accrued!(run)).toBe("+0.6 mult banked");
  });

  it("does not score its own growth on the word that grew it (grow is future-facing)", () => {
    const run = makeRunState();
    const ctx = ctxFor(run, "bell");
    HOARDER.apply(ctx); // nothing banked yet
    expect(ctx.mult).toBe(1);
  });
});

describe("combo: The Alliterator (same-start streak climbs, then resets)", () => {
  it("climbs on consecutive same-start words and resets when the letter changes", () => {
    const run = makeRunState();

    // First word: no previous, streak stays 0.
    run.lastFirst = null;
    ALLITERATOR.grow!(run, bd("sun"));
    expect(run.counters["scale-alliterator"]).toBe(0);

    // Now simulate the run having just played an "s" word.
    run.lastFirst = "s";
    ALLITERATOR.grow!(run, bd("star")); // s == s → streak 1
    expect(run.counters["scale-alliterator"]).toBe(1);

    run.lastFirst = "s";
    ALLITERATOR.grow!(run, bd("story")); // s == s → streak 2
    expect(run.counters["scale-alliterator"]).toBe(2);

    // apply() rewards the current streak: +0.5 × 2.
    const ctx = ctxFor(run, "story");
    ALLITERATOR.apply(ctx);
    expect(ctx.mult).toBeCloseTo(2.0, 5);

    // A breaking word (previous was "s", this starts "m") resets to 0.
    run.lastFirst = "s";
    ALLITERATOR.grow!(run, bd("moon"));
    expect(run.counters["scale-alliterator"]).toBe(0);
  });

  it("accrued reports the streak and is null at the start", () => {
    const run = makeRunState();
    expect(ALLITERATOR.accrued!(run)).toBeNull();
    run.counters["scale-alliterator"] = 3;
    expect(ALLITERATOR.accrued!(run)).toBe("3-word alliteration streak (+1.5 mult)");
  });
});

describe("combo: Escalation (ascending-length streak)", () => {
  it("climbs while each word is longer, resets on a shorter word", () => {
    const run = makeRunState();
    ESCALATION.grow!(run, bd("go")); // len 2, first word → streak 0, remember 2
    expect(run.counters["scale-escalation"]).toBe(0);
    ESCALATION.grow!(run, bd("gone")); // 4 > 2 → streak 1
    expect(run.counters["scale-escalation"]).toBe(1);
    ESCALATION.grow!(run, bd("gonzo")); // 5 > 4 → streak 2
    expect(run.counters["scale-escalation"]).toBe(2);
    ESCALATION.grow!(run, bd("go")); // 2 < 5 → reset
    expect(run.counters["scale-escalation"]).toBe(0);
  });

  it("apply reads the climb into chips", () => {
    const run = makeRunState();
    run.counters["scale-escalation"] = 3;
    const ctx = ctxFor(run, "test");
    ESCALATION.apply(ctx);
    expect(ctx.chips).toBe(75); // 25 × 3
  });
});

describe("legendary: The Metronome King (every 5th word banks +1 mult)", () => {
  it("banks +1 mult on the 5th and 10th words only", () => {
    const run = makeRunState();
    for (let i = 0; i < 4; i++) METRONOME_KING.grow!(run, bd("word"));
    expect(run.counters["scale-metronome-king"] ?? 0).toBe(0); // not yet
    METRONOME_KING.grow!(run, bd("word")); // 5th
    expect(run.counters["scale-metronome-king"]).toBe(1);
    for (let i = 0; i < 5; i++) METRONOME_KING.grow!(run, bd("word")); // 6..10
    expect(run.counters["scale-metronome-king"]).toBe(2);

    const ctx = ctxFor(run, "word");
    METRONOME_KING.apply(ctx);
    expect(ctx.mult).toBeCloseTo(3.0, 5); // 1 + 2
  });
});

describe("collection: The Cartographer (scales off distinct starts, no grow)", () => {
  it("reads run.seenFirst.size directly", () => {
    const run = makeRunState();
    expect(CARTOGRAPHER.accrued!(run)).toBeNull();
    run.seenFirst.add("a");
    run.seenFirst.add("b");
    run.seenFirst.add("c");
    const ctx = ctxFor(run, "test");
    CARTOGRAPHER.apply(ctx);
    expect(ctx.mult).toBeCloseTo(1.9, 5); // 1 + 0.3 × 3
    expect(CARTOGRAPHER.accrued!(run)).toBe("3 distinct starts (+0.9 mult)");
  });
});

describe("pack integrity", () => {
  it("exports ~13 cards with unique ids and required accrued on accumulators", () => {
    expect(EXTRA_CARDS5.length).toBeGreaterThanOrEqual(13);
    const ids = EXTRA_CARDS5.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    // Every card that has a grow() (i.e. accumulates) must expose accrued().
    for (const c of EXTRA_CARDS5) {
      if (c.grow) expect(typeof c.accrued).toBe("function");
    }
  });
});
