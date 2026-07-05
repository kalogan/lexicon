/**
 * run/cards-extra3 — the FOURTH wave, focused on three appetites the earlier
 * waves only glanced at: the TIME economy (grant / convert / spend seconds),
 * the RARE letters Q/X/J/Z (single and stacked), and the BIG-word length tiers
 * (7+/9+), capped by two permanent-mult snowball legendaries.
 *
 * These deliberately FEED and READ the accumulators the other waves built — a
 * time-granter here fuels Time Broker / Overclock; a length card stacks on Tome /
 * Scholar / Marathon; a rare-letter card compounds Rare-Letter / Curator. Two new
 * hunts open up: "load the clock, then cash it out" and "chase 2+ rare letters in
 * one word for a permanent mult".
 *
 * Same golden rule as the earlier waves: every card changes WHAT you hunt, not
 * merely how much you score. apply() runs on PREVIEW too, so cards here only READ
 * run state (run.permaMult / run.runWords / run.seenFirst) — they never mutate it.
 * Order still matters — chip-from-time / spend-time cards read the live
 * accumulator, so place them AFTER whatever feeds them.
 */
import type { Card } from "./engine.js";

// ── Time economy (grant seconds on new signals) ──────────────────────────────

export const METRONOME: Card = {
  id: "metronome",
  name: "Metronome",
  kind: "dictionary",
  rarity: "common",
  text: "4-5 letter words restore 2s — a steady tempo drip",
  apply(ctx) {
    if (ctx.props.len >= 4 && ctx.props.len <= 5) {
      ctx.timeGain += 2;
      ctx.trigger("Metronome", "+2s");
    }
  },
};

export const WELLSPRING: Card = {
  id: "wellspring",
  name: "Wellspring",
  kind: "dictionary",
  rarity: "uncommon",
  text: "vowel-heavy words (4+ vowels) restore 3s",
  apply(ctx) {
    if (ctx.props.vowels >= 4) {
      ctx.timeGain += 3;
      ctx.trigger("Wellspring", "+3s (vowels)");
    }
  },
};

export const LODESTONE: Card = {
  id: "lodestone",
  name: "Lodestone",
  kind: "dictionary",
  rarity: "uncommon",
  text: "rare letters (Q/X/J/Z) restore 3s each — fuel the clock with hard letters",
  apply(ctx) {
    if (ctx.props.rareLetters > 0) {
      const add = ctx.props.rareLetters * 3;
      ctx.timeGain += add;
      ctx.trigger("Lodestone", `+${add}s (rare)`);
    }
  },
};

export const RESERVOIR: Card = {
  id: "reservoir",
  name: "Reservoir",
  kind: "dictionary",
  rarity: "common",
  text: "double letters restore 1s AND +12 chips each (DD, LL…)",
  apply(ctx) {
    if (ctx.props.doubles > 0) {
      const chips = ctx.props.doubles * 12;
      ctx.timeGain += ctx.props.doubles;
      ctx.chips += chips;
      ctx.trigger("Reservoir", `+${ctx.props.doubles}s, +${chips}`);
    }
  },
};

// ── Time → score converters (place AFTER your time-granters) ──────────────────

export const SUNDIAL: Card = {
  id: "sundial",
  name: "Sundial",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.3 mult per second this word restores (place AFTER your time cards)",
  apply(ctx) {
    if (ctx.timeGain > 0) {
      const add = Math.round(ctx.timeGain) * 0.3;
      ctx.mult += add;
      ctx.trigger("Sundial", `+${add.toFixed(1)} mult`);
    }
  },
};

export const SPENDTHRIFT: Card = {
  id: "spendthrift",
  name: "Spendthrift",
  kind: "dictionary",
  rarity: "rare",
  text: "spend 3s to gain +50 chips on 6+ letter words (place AFTER your time cards)",
  apply(ctx) {
    if (ctx.props.len >= 6 && ctx.timeGain >= 3) {
      ctx.timeGain -= 3;
      ctx.chips += 50;
      ctx.trigger("Spendthrift", "-3s → +50");
    }
  },
};

// ── Rare letters (single, then stacked — the hunt for Q/X/J/Z density) ────────

export const SCRABBLER: Card = {
  id: "scrabbler",
  name: "Scrabbler",
  kind: "dictionary",
  rarity: "common",
  text: "+30 chips per rare letter (Q/X/J/Z)",
  apply(ctx) {
    if (ctx.props.rareLetters > 0) {
      const add = ctx.props.rareLetters * 30;
      ctx.chips += add;
      ctx.trigger("Scrabbler", `+${add}`);
    }
  },
};

export const PROSPECTOR: Card = {
  id: "prospector",
  name: "Prospector",
  kind: "dictionary",
  rarity: "uncommon",
  text: "rare letters (Q/X/J/Z) in 6+ letter words: ×2 mult",
  apply(ctx) {
    if (ctx.props.rareLetters > 0 && ctx.props.len >= 6) {
      ctx.mult *= 2;
      ctx.trigger("Prospector", "×2 (rare + long)");
    }
  },
};

export const JACKPOT: Card = {
  id: "jackpot",
  name: "Jackpot",
  kind: "dictionary",
  rarity: "rare",
  text: "×4 mult for words with 2+ rare letters (JUKEBOX, QUIZ…)",
  apply(ctx) {
    if (ctx.props.rareLetters >= 2) {
      ctx.mult *= 4;
      ctx.trigger("Jackpot", "×4 (2+ rare)");
    }
  },
};

// ── Big / long words (length tiers stacking on Tome / Scholar / Marathon) ─────

export const EPIC: Card = {
  id: "epic",
  name: "Epic",
  kind: "dictionary",
  rarity: "uncommon",
  text: "9+ letter words: ×3 mult — the true-giant tier",
  apply(ctx) {
    if (ctx.props.len >= 9) {
      ctx.mult *= 3;
      ctx.trigger("Epic", "×3 (9+)");
    }
  },
};

export const LADDER: Card = {
  id: "ladder",
  name: "Ladder",
  kind: "dictionary",
  rarity: "common",
  text: "+10 chips for every letter beyond 5 (7-letter word = +20)",
  apply(ctx) {
    if (ctx.props.len > 5) {
      const add = (ctx.props.len - 5) * 10;
      ctx.chips += add;
      ctx.trigger("Ladder", `+${add}`);
    }
  },
};

export const COLOSSUS: Card = {
  id: "colossus",
  name: "Colossus",
  kind: "dictionary",
  rarity: "rare",
  text: "7+ letter words: restore 3s AND +25 chips per letter",
  apply(ctx) {
    if (ctx.props.len >= 7) {
      const add = ctx.props.len * 25;
      ctx.timeGain += 3;
      ctx.chips += add;
      ctx.trigger("Colossus", `+3s, +${add}`);
    }
  },
};

// ── Snowball feeders that scale off banked permanent mult ─────────────────────

export const COMPOUND: Card = {
  id: "compound",
  name: "Compound",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+25 chips per full point of permanent mult banked this run",
  apply(ctx) {
    const banked = Math.floor(ctx.run.permaMult);
    if (banked > 0) {
      const add = banked * 25;
      ctx.chips += add;
      ctx.trigger("Compound", `+${add} (${banked}× banked)`);
    }
  },
  accrued: (run) =>
    run.permaMult > 0 ? `+${(Math.floor(run.permaMult) * 25)} chips at current bank` : null,
};

// ── Legendaries (permanent-mult snowballs on hard, distinct conditions) ───────

export const HOROLOGIST: Card = {
  id: "horologist",
  name: "Horologist",
  kind: "legendary",
  rarity: "legendary",
  text: "words that restore 6s or more permanently gain +0.4 mult this run",
  apply(ctx) {
    if (ctx.timeGain >= 6) {
      ctx.permaMultAdd += 0.4;
      ctx.trigger("Horologist", "+0.4 mult (perm)");
    }
  },
  accrued: (run) =>
    run.permaMult > 0 ? `+${run.permaMult.toFixed(1)}× permanent mult banked` : null,
};

export const PHILATELIST: Card = {
  id: "philatelist",
  name: "Philatelist",
  kind: "legendary",
  rarity: "legendary",
  text: "words with a rare letter (Q/X/J/Z) that are 7+ letters: +0.5 mult this run",
  apply(ctx) {
    if (ctx.props.rareLetters > 0 && ctx.props.len >= 7) {
      ctx.permaMultAdd += 0.5;
      ctx.trigger("Philatelist", "+0.5 mult (perm)");
    }
  },
  accrued: (run) =>
    run.permaMult > 0 ? `+${run.permaMult.toFixed(1)}× permanent mult banked` : null,
};

/** Every fourth-wave card, for lookups + pool assembly. */
export const EXTRA_CARDS3: Card[] = [
  METRONOME, WELLSPRING, LODESTONE, RESERVOIR,
  SUNDIAL, SPENDTHRIFT,
  SCRABBLER, PROSPECTOR, JACKPOT,
  EPIC, LADDER, COLOSSUS,
  COMPOUND,
  HOROLOGIST, PHILATELIST,
];
