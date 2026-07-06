/**
 * run/cards-extra6 — the SIXTH wave, a content expansion built to sit BESIDE the
 * scaling/combo pack (extra5) without stepping on any of it. Where extra5 watered
 * itself off doubles / rare letters / 7+ length / all-distinct / vowels / prefixes,
 * this pack deliberately farms the structures those relics left on the table:
 *
 *   • SUFFIXES (extra5's growers only banked off PREFIXES),
 *   • the LAST letter being a vowel (an "open" ending),
 *   • the DISTINCT-letter count of a word (breadth, not just "all distinct"),
 *   • words that WRAP (first letter == last letter),
 *   • DESCENDING-length streaks (extra5 only climbed / held steady),
 *   • VOWEL-COUNT echoes (repeat the last word's vowel count),
 *   • NEW-start novelty (reward the FIRST time a letter opens a word).
 *
 * Plus a scatter of fresh flat conditionals and two legendary engines.
 *
 * Golden rules, unchanged from every prior wave:
 *  • apply() runs on PREVIEW, so it only READS run state — never mutates it.
 *    All mutation lives in grow(), which fires once on COMMIT.
 *  • Every accumulating card exposes an accrued(run) tooltip string, null before
 *    anything has banked.
 *  • Each card keys its counter(s) by its OWN id — no cross-card collisions, and
 *    no collision with any earlier pack's ids (all here are `x6-*`).
 */
import type { Card } from "./engine.js";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// ── Flat conditionals on fresh structures ─────────────────────────────────────

export const OPEN_VOWEL: Card = {
  id: "x6-open-vowel",
  name: "Open Ending",
  kind: "dictionary",
  rarity: "common",
  text: "+25 chips when the word ENDS on a vowel (an open ending)",
  apply(ctx) {
    if (VOWELS.has(ctx.props.last)) {
      ctx.chips += 25;
      ctx.trigger("Open Ending", "+25 (vowel end)");
    }
  },
};

export const OUROBOROS: Card = {
  id: "x6-ouroboros",
  name: "Ouroboros",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×2 mult when the word's first and last letters are the SAME (it eats its tail)",
  apply(ctx) {
    if (ctx.props.len >= 3 && ctx.props.first === ctx.props.last) {
      ctx.mult *= 2;
      ctx.trigger("Ouroboros", "×2 (wraps)");
    }
  },
};

export const KALEIDOSCOPE_EYE: Card = {
  id: "x6-broad-spectrum",
  name: "Broad Spectrum",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+4 chips for every DISTINCT letter in the word (breadth, not length)",
  apply(ctx) {
    const add = 4 * ctx.props.distinct;
    if (add > 0) {
      ctx.chips += add;
      ctx.trigger("Broad Spectrum", `+${add} (${ctx.props.distinct} distinct)`);
    }
  },
};

export const STAMMER: Card = {
  id: "x6-stammer",
  name: "The Stammer",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×2.5 mult when the word has TWO or more double-letters (e.g. \"bookkeeper\")",
  apply(ctx) {
    if (ctx.props.doubles >= 2) {
      ctx.mult *= 2.5;
      ctx.trigger("The Stammer", "×2.5 (2+ doubles)");
    }
  },
};

export const TAILWIND: Card = {
  id: "x6-tailwind",
  name: "Tailwind",
  kind: "dictionary",
  rarity: "common",
  text: "+4s time when the word ends with a known suffix (ride the tail)",
  apply(ctx) {
    if (ctx.props.suffix) {
      ctx.timeGain += 4;
      ctx.trigger("Tailwind", `+4s (-${ctx.props.suffix})`);
    }
  },
};

// ── SCALING: growers on structures extra5 didn't farm ─────────────────────────

export const CODA: Card = {
  id: "x6-coda",
  name: "The Coda",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.25 mult each time you play a word ending in a known suffix",
  apply(ctx) {
    const banked = ctx.run.counters["x6-coda"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Coda", `+${banked.toFixed(2)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.suffix) {
      run.counters["x6-coda"] = (run.counters["x6-coda"] ?? 0) + 0.25;
    }
  },
  accrued: (run) =>
    run.counters["x6-coda"]
      ? `+${run.counters["x6-coda"].toFixed(2)} mult banked`
      : null,
};

export const TIDEPOOL: Card = {
  id: "x6-tidepool",
  name: "Tidepool",
  kind: "dictionary",
  rarity: "common",
  text: "Permanently gains +6 chips for every vowel-ending word you play (banked all run)",
  apply(ctx) {
    const banked = ctx.run.counters["x6-tidepool"] ?? 0;
    if (banked > 0) {
      ctx.chips += banked;
      ctx.trigger("Tidepool", `+${banked} chips (banked)`);
    }
  },
  grow(run, b) {
    if (VOWELS.has(b.props.last)) {
      run.counters["x6-tidepool"] = (run.counters["x6-tidepool"] ?? 0) + 6;
    }
  },
  accrued: (run) =>
    run.counters["x6-tidepool"]
      ? `+${run.counters["x6-tidepool"]} chips banked`
      : null,
};

export const SPECTROMETER: Card = {
  id: "x6-spectrometer",
  name: "Spectrometer",
  kind: "dictionary",
  rarity: "rare",
  text: "Permanently gains +0.15 mult for each word with 6+ distinct letters you play",
  apply(ctx) {
    const banked = ctx.run.counters["x6-spectrometer"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("Spectrometer", `+${banked.toFixed(2)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.distinct >= 6) {
      run.counters["x6-spectrometer"] =
        (run.counters["x6-spectrometer"] ?? 0) + 0.15;
    }
  },
  accrued: (run) =>
    run.counters["x6-spectrometer"]
      ? `+${run.counters["x6-spectrometer"].toFixed(2)} mult banked`
      : null,
};

export const SERPENTINE: Card = {
  id: "x6-serpentine",
  name: "Serpentine",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +10 chips each time you play a word that wraps (first letter == last)",
  apply(ctx) {
    const banked = ctx.run.counters["x6-serpentine"] ?? 0;
    if (banked > 0) {
      ctx.chips += banked;
      ctx.trigger("Serpentine", `+${banked} chips (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.len >= 3 && b.props.first === b.props.last) {
      run.counters["x6-serpentine"] = (run.counters["x6-serpentine"] ?? 0) + 10;
    }
  },
  accrued: (run) =>
    run.counters["x6-serpentine"]
      ? `+${run.counters["x6-serpentine"]} chips banked`
      : null,
};

// ── COMBO / ORDER: sequences extra5's climb/hold streaks left open ────────────

export const AVALANCHE: Card = {
  id: "x6-avalanche",
  name: "Avalanche",
  kind: "dictionary",
  rarity: "rare",
  text: "+20 chips per step in your DESCENDING-length streak — each word shorter than the last; a longer/equal word resets it",
  apply(ctx) {
    const streak = ctx.run.counters["x6-avalanche"] ?? 0;
    if (streak > 0) {
      const add = 20 * streak;
      ctx.chips += add;
      ctx.trigger("Avalanche", `+${add} (×${streak} tumble)`);
    }
  },
  grow(run, b) {
    const prevLen = run.counters["x6-avalanche-len"] ?? 0;
    const shorter = prevLen > 0 && b.props.len < prevLen;
    run.counters["x6-avalanche"] = shorter
      ? (run.counters["x6-avalanche"] ?? 0) + 1
      : 0;
    run.counters["x6-avalanche-len"] = b.props.len;
  },
  accrued: (run) =>
    run.counters["x6-avalanche"]
      ? `${run.counters["x6-avalanche"]}-step tumble (+${20 * run.counters["x6-avalanche"]} chips)`
      : null,
};

export const HARMONIC: Card = {
  id: "x6-harmonic",
  name: "Harmonic",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.45 mult per repeat in your same-vowel-count streak — same vowel count as your last word; a different count resets it",
  apply(ctx) {
    const streak = ctx.run.counters["x6-harmonic"] ?? 0;
    if (streak > 0) {
      const add = 0.45 * streak;
      ctx.mult += add;
      ctx.trigger("Harmonic", `+${add.toFixed(2)} mult (×${streak} chord)`);
    }
  },
  grow(run, b) {
    const prev = run.counters["x6-harmonic-vc"] ?? -1;
    const same = prev >= 0 && b.props.vowels === prev;
    run.counters["x6-harmonic"] = same
      ? (run.counters["x6-harmonic"] ?? 0) + 1
      : 0;
    run.counters["x6-harmonic-vc"] = b.props.vowels;
  },
  accrued: (run) =>
    run.counters["x6-harmonic"]
      ? `${run.counters["x6-harmonic"]}-word vowel chord (+${(0.45 * run.counters["x6-harmonic"]).toFixed(2)} mult)`
      : null,
};

export const PIONEER: Card = {
  id: "x6-pioneer",
  name: "The Pioneer",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.3 mult the FIRST time each starting letter is used this run (novelty only)",
  apply(ctx) {
    const banked = ctx.run.counters["x6-pioneer"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Pioneer", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    // run is the PRE-commit state, so seenFirst hasn't yet recorded this word's
    // start — a fresh letter means genuine novelty.
    if (b.props.first && !run.seenFirst.has(b.props.first)) {
      run.counters["x6-pioneer"] = (run.counters["x6-pioneer"] ?? 0) + 0.3;
    }
  },
  accrued: (run) =>
    run.counters["x6-pioneer"]
      ? `+${run.counters["x6-pioneer"].toFixed(1)} mult banked (new starts)`
      : null,
};

// ── LEGENDARIES: build-defining engines ───────────────────────────────────────

export const PRISM_ENGINE: Card = {
  id: "x6-prism-engine",
  name: "The Prism Engine",
  kind: "legendary",
  rarity: "legendary",
  text: "Permanently banks +2 chips for EVERY distinct letter of every word you play — the bank pays out on all future words",
  apply(ctx) {
    const banked = ctx.run.counters["x6-prism-engine"] ?? 0;
    if (banked > 0) {
      ctx.chips += banked;
      ctx.trigger("The Prism Engine", `+${banked} chips (banked)`);
    }
  },
  grow(run, b) {
    run.counters["x6-prism-engine"] =
      (run.counters["x6-prism-engine"] ?? 0) + 2 * b.props.distinct;
  },
  accrued: (run) =>
    run.counters["x6-prism-engine"]
      ? `+${run.counters["x6-prism-engine"]} chips banked`
      : null,
};

export const KEYSTONE: Card = {
  id: "x6-keystone",
  name: "The Keystone",
  kind: "legendary",
  rarity: "legendary",
  text: "Every 4th SUFFIX word you play banks +1 mult PERMANENTLY for the rest of the run",
  apply(ctx) {
    const banked = ctx.run.counters["x6-keystone"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Keystone", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (!b.props.suffix) return;
    const count = (run.counters["x6-keystone-count"] ?? 0) + 1;
    run.counters["x6-keystone-count"] = count;
    if (count % 4 === 0) {
      run.counters["x6-keystone"] = (run.counters["x6-keystone"] ?? 0) + 1;
    }
  },
  accrued: (run) =>
    run.counters["x6-keystone"]
      ? `+${run.counters["x6-keystone"].toFixed(1)} mult banked (every 4th suffix)`
      : null,
};

/** Every extra6 card, for lookups + pool assembly. */
export const EXTRA_CARDS6: Card[] = [
  OPEN_VOWEL, OUROBOROS, KALEIDOSCOPE_EYE, STAMMER, TAILWIND,
  CODA, TIDEPOOL, SPECTROMETER, SERPENTINE,
  AVALANCHE, HARMONIC, PIONEER,
  PRISM_ENGINE, KEYSTONE,
];
