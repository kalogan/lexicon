/**
 * run/cards-extra4 — the FOURTH wave, focused on four hunts the earlier packs
 * only touched glancingly: TEMPO/COMBO (same-start streaks and board pace via
 * lastFirst / boardWords), the "long affixes" family (the big PREFIXES and
 * SUFFIXES beyond RE/UN/PRE & ING/ED/LY), the VOWEL/CONSONANT texture of a word
 * (exact vowel counts, alternation, all-distinct "mosaics"), and DOUBLES /
 * palindrome-ish symmetry.
 *
 * Deliberately synergistic with the earlier waves: the streak cards feed off the
 * same lastFirst signal Alliteration reads; the long-affix cards reward the
 * COUNTER/INTER/TRANS/…NESS/…MENT tail that Affixologist/Headstart only counted
 * generically; Vowel Weaver and Aerial extend the Vowel Hoarder / Consonantal
 * axis; Twin Peaks / Symmetrist stack on Hourglass + Doublet.
 *
 * Same golden rule as the earlier packs: every card changes WHAT you hunt, not
 * merely how much you score. apply() runs on PREVIEW too, so cards only READ run
 * state (lastFirst / boardWords / seenFirst) — they never mutate it. Cards whose
 * value ACCUMULATES over the run expose an `accrued(run)` tooltip string.
 */
import type { Card } from "./engine.js";

const BIG_PREFIXES = new Set([
  "counter", "inter", "trans", "super", "under", "over", "anti", "semi", "non",
  "sub", "mis", "dis", "out", "in", "de", "en",
]);

const BIG_SUFFIXES = new Set([
  "ation", "ness", "ment", "ible", "able", "less", "ful", "ous", "ies",
  "ion", "est", "ize", "ise", "er",
]);

// ── Tempo / combo (same-start streaks + board pace) ──────────────────────────

export const ECHO: Card = {
  id: "echo",
  name: "Echo",
  kind: "dictionary",
  rarity: "common",
  text: "+30 chips when this word starts with the same letter as your last",
  apply(ctx) {
    if (ctx.run.lastFirst && ctx.props.first === ctx.run.lastFirst) {
      ctx.chips += 30;
      ctx.trigger("Echo", "+30 (same start)");
    }
  },
};

export const RELAY: Card = {
  id: "relay",
  name: "Relay",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×2.5 mult when this word ENDS on your last word's starting letter (a handoff)",
  apply(ctx) {
    if (ctx.run.lastFirst && ctx.props.last === ctx.run.lastFirst) {
      ctx.mult *= 2.5;
      ctx.trigger("Relay", "×2.5 (handoff)");
    }
  },
};

export const CROWD_SURGE: Card = {
  id: "crowd-surge",
  name: "Crowd Surge",
  kind: "dictionary",
  rarity: "common",
  text: "+10 chips per word already played this board",
  apply(ctx) {
    if (ctx.run.boardWords > 0) {
      const add = ctx.run.boardWords * 10;
      ctx.chips += add;
      ctx.trigger("Crowd Surge", `+${add}`);
    }
  },
  accrued: (run) =>
    run.boardWords > 0 ? `+${run.boardWords * 10} chips next word (${run.boardWords} on board)` : null,
};

export const OPENING_ACT: Card = {
  id: "opening-act",
  name: "Opening Act",
  kind: "dictionary",
  rarity: "common",
  text: "×2 mult on the FIRST word of each board",
  apply(ctx) {
    if (ctx.run.boardWords === 0) {
      ctx.mult *= 2;
      ctx.trigger("Opening Act", "×2 (first word)");
    }
  },
};

// ── Long-affix family (the big prefixes/suffixes beyond RE/UN/PRE & ING/ED/LY) ─

export const POLYSYLLABLE: Card = {
  id: "polysyllable",
  name: "Polysyllable",
  kind: "dictionary",
  rarity: "uncommon",
  text: "long suffixes (ATION / NESS / MENT / IBLE / OUS…): ×2.5 mult",
  apply(ctx) {
    if (ctx.props.suffix && BIG_SUFFIXES.has(ctx.props.suffix)) {
      ctx.mult *= 2.5;
      ctx.trigger("Polysyllable", "×2.5 (long suffix)");
    }
  },
};

export const COMPOUNDER: Card = {
  id: "compounder",
  name: "Compounder",
  kind: "dictionary",
  rarity: "uncommon",
  text: "long prefixes (COUNTER / INTER / TRANS / SUPER / OVER…): +40 chips",
  apply(ctx) {
    if (ctx.props.prefix && BIG_PREFIXES.has(ctx.props.prefix)) {
      ctx.chips += 40;
      ctx.trigger("Compounder", "+40 (long prefix)");
    }
  },
};

export const NEGATIONIST: Card = {
  id: "negationist",
  name: "Negationist",
  kind: "dictionary",
  rarity: "common",
  text: "negating prefixes (UN / IN / DIS / MIS / NON / ANTI): ×2 mult",
  apply(ctx) {
    if (ctx.props.prefix && ["un", "in", "dis", "mis", "non", "anti"].includes(ctx.props.prefix)) {
      ctx.mult *= 2;
      ctx.trigger("Negationist", "×2 (negation)");
    }
  },
};

export const NOMINALIZER: Card = {
  id: "nominalizer",
  name: "Nominalizer",
  kind: "dictionary",
  rarity: "common",
  text: "noun-making suffixes (TION / NESS / MENT / ATION): +5 chips per letter",
  apply(ctx) {
    if (ctx.props.suffix && ["ion", "ness", "ment", "ation"].includes(ctx.props.suffix)) {
      const add = ctx.props.len * 5;
      ctx.chips += add;
      ctx.trigger("Nominalizer", `+${add}`);
    }
  },
};

// ── Vowel / consonant texture ────────────────────────────────────────────────

export const AERIAL: Card = {
  id: "aerial",
  name: "Aerial",
  kind: "dictionary",
  rarity: "common",
  text: "+11 chips per vowel",
  apply(ctx) {
    if (ctx.props.vowels > 0) {
      const add = ctx.props.vowels * 11;
      ctx.chips += add;
      ctx.trigger("Aerial", `+${add}`);
    }
  },
};

export const VOWEL_WEAVER: Card = {
  id: "vowel-weaver",
  name: "Vowel Weaver",
  kind: "dictionary",
  rarity: "rare",
  text: "×3 mult when vowels and consonants are within one of each other (balanced, 5+ letters)",
  apply(ctx) {
    const consonants = ctx.props.len - ctx.props.vowels;
    if (ctx.props.len >= 5 && Math.abs(ctx.props.vowels - consonants) <= 1) {
      ctx.mult *= 3;
      ctx.trigger("Vowel Weaver", "×3 (balanced)");
    }
  },
};

export const FIVE_VOWELS: Card = {
  id: "five-vowels",
  name: "Full House",
  kind: "dictionary",
  rarity: "uncommon",
  text: "4+ vowels in one word: +45 chips",
  apply(ctx) {
    if (ctx.props.vowels >= 4) {
      ctx.chips += 45;
      ctx.trigger("Full House", "+45 (vowel-rich)");
    }
  },
};

export const MONOTONE: Card = {
  id: "monotone",
  name: "Monotone",
  kind: "dictionary",
  rarity: "uncommon",
  text: "exactly ONE vowel in a 5+ letter word: ×2.5 mult",
  apply(ctx) {
    if (ctx.props.len >= 5 && ctx.props.vowels === 1) {
      ctx.mult *= 2.5;
      ctx.trigger("Monotone", "×2.5 (one vowel)");
    }
  },
};

// ── Doubles / symmetry ───────────────────────────────────────────────────────

export const TWIN_PEAKS: Card = {
  id: "twin-peaks",
  name: "Twin Peaks",
  kind: "dictionary",
  rarity: "uncommon",
  text: "two or more double-letter pairs (BOOKKEEPER, BALLOON…): ×3 mult",
  apply(ctx) {
    if (ctx.props.doubles >= 2) {
      ctx.mult *= 3;
      ctx.trigger("Twin Peaks", "×3 (double doubles)");
    }
  },
};

export const SYMMETRIST: Card = {
  id: "symmetrist",
  name: "Symmetrist",
  kind: "dictionary",
  rarity: "common",
  text: "+22 chips per double-letter pair",
  apply(ctx) {
    if (ctx.props.doubles > 0) {
      const add = ctx.props.doubles * 22;
      ctx.chips += add;
      ctx.trigger("Symmetrist", `+${add}`);
    }
  },
};

export const NO_ENCORE: Card = {
  id: "no-encore",
  name: "No Encore",
  kind: "dictionary",
  rarity: "rare",
  text: "no-repeat-letter words (6+ letters): +8 chips per letter",
  apply(ctx) {
    if (ctx.props.allDistinct && ctx.props.len >= 6) {
      const add = ctx.props.len * 8;
      ctx.chips += add;
      ctx.trigger("No Encore", `+${add}`);
    }
  },
};

// ── Legendary (tempo build-definer: a run-long same-start streak engine) ──────

export const REFRAIN: Card = {
  id: "refrain",
  name: "Refrain",
  kind: "legendary",
  rarity: "legendary",
  text: "start with the same letter as your last word (4+ letters): +0.3 mult this run",
  apply(ctx) {
    if (ctx.run.lastFirst && ctx.props.first === ctx.run.lastFirst && ctx.props.len >= 4) {
      ctx.permaMultAdd += 0.3;
      ctx.trigger("Refrain", "+0.3 mult (streak, perm)");
    }
  },
  accrued: (run) =>
    run.permaMult > 0 ? `+${run.permaMult.toFixed(1)} mult banked this run` : null,
};

/** Every fourth-wave card, for lookups + pool assembly. */
export const EXTRA_CARDS4: Card[] = [
  ECHO, RELAY, CROWD_SURGE, OPENING_ACT,
  POLYSYLLABLE, COMPOUNDER, NEGATIONIST, NOMINALIZER,
  AERIAL, VOWEL_WEAVER, FIVE_VOWELS, MONOTONE,
  TWIN_PEAKS, SYMMETRIST, NO_ENCORE,
  REFRAIN,
];
