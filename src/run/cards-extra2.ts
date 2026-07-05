/**
 * run/cards-extra2 — the THIRD wave, authored for the SHOP/ECONOMY update. With
 * cards now purchasable as well as drafted, the pool needs depth AND deliberate
 * synergy: cards here mostly reward signals the earlier waves already FEED, so
 * stacking them snowballs (doubles → Hourglass time AND Doublet mult; suffixes →
 * Suffix chips AND Cadence time → Time Broker chips; consonant clusters as the
 * mirror of Vowel Hoarder; distinct+long stacking on Mosaic/Tome).
 *
 * Two new build spines open up:
 *  - SYMMETRY: words whose first letter equals their last (Bookend / Boustrophedon).
 *  - COLLECTION: value that scales off run-long progress — letters collected
 *    (`run.seenFirst.size`), words played (`run.runWords`), and a shop-fed
 *    counter (`run.counters`) that other systems increment on commit.
 *
 * IMPORTANT: apply() runs on PREVIEW too, so cards here only READ run state
 * (run.counters / run.runWords / run.seenFirst) — they never mutate it. The game
 * commits counter changes separately.
 *
 * Same golden rule as the earlier waves: every card changes WHAT you hunt, not
 * merely how much. Order still matters — chip-from-time / chip-from-mult / spend-
 * time cards read the live accumulator, so place them AFTER whatever feeds them.
 */
import type { Card } from "./engine.js";

// ── Symmetry spine (first letter === last letter) ────────────────────────────

export const BOOKEND: Card = {
  id: "bookend",
  name: "Bookend",
  kind: "dictionary",
  rarity: "common",
  text: "words that start and end with the same letter: +35 chips",
  apply(ctx) {
    if (ctx.props.len >= 2 && ctx.props.first === ctx.props.last) {
      ctx.chips += 35;
      ctx.trigger("Bookend", "+35 (mirror)");
    }
  },
};

export const BOUSTROPHEDON: Card = {
  id: "boustrophedon",
  name: "Boustrophedon",
  kind: "legendary",
  rarity: "legendary",
  text: "mirror words (start letter = end letter, 5+): ×2 mult AND +0.4 mult this run",
  apply(ctx) {
    if (ctx.props.len >= 5 && ctx.props.first === ctx.props.last) {
      ctx.mult *= 2;
      ctx.permaMultAdd += 0.4;
      ctx.trigger("Boustrophedon", "×2, +0.4 mult (perm)");
    }
  },
};

// ── Consonant clusters (the mirror of Vowel Hoarder) ─────────────────────────

export const CONSONANTAL: Card = {
  id: "consonantal",
  name: "Consonantal",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×2 mult when under a third of the letters are vowels (5+ letters)",
  apply(ctx) {
    if (ctx.props.len >= 5 && ctx.props.vowels * 3 < ctx.props.len) {
      ctx.mult *= 2;
      ctx.trigger("Consonantal", "×2 (cluster)");
    }
  },
};

export const GRINDSTONE: Card = {
  id: "grindstone",
  name: "Grindstone",
  kind: "dictionary",
  rarity: "common",
  text: "+7 chips per consonant (letters that aren't vowels)",
  apply(ctx) {
    const consonants = ctx.props.len - ctx.props.vowels;
    if (consonants > 0) {
      const add = consonants * 7;
      ctx.chips += add;
      ctx.trigger("Grindstone", `+${add}`);
    }
  },
};

// ── Doubles synergy (pairs with Hourglass's double-letter time) ──────────────

export const DOUBLET: Card = {
  id: "doublet",
  name: "Doublet",
  kind: "dictionary",
  rarity: "common",
  text: "+1 mult for each pair of doubled letters (LETTER, BALLOON…)",
  apply(ctx) {
    if (ctx.props.doubles > 0) {
      ctx.mult += ctx.props.doubles;
      ctx.trigger("Doublet", `+${ctx.props.doubles} mult`);
    }
  },
};

// ── Affix synergy (suffix → time, feeding Time Broker / Overclock) ───────────

export const CADENCE: Card = {
  id: "cadence",
  name: "Cadence",
  kind: "dictionary",
  rarity: "uncommon",
  text: "words with a suffix (ING/ED/ION/NESS…) restore 4s",
  apply(ctx) {
    if (ctx.props.suffix) {
      ctx.timeGain += 4;
      ctx.trigger("Cadence", "+4s (suffix)");
    }
  },
};

export const HEADSTART: Card = {
  id: "headstart",
  name: "Headstart",
  kind: "dictionary",
  rarity: "common",
  text: "prefixed words (RE/UN/TRANS/INTER…): +5 chips per letter",
  apply(ctx) {
    if (ctx.props.prefix) {
      const add = ctx.props.len * 5;
      ctx.chips += add;
      ctx.trigger("Headstart", `+${add}`);
    }
  },
};

export const CIRCUMFIX: Card = {
  id: "circumfix",
  name: "Circumfix",
  kind: "dictionary",
  rarity: "rare",
  text: "words with BOTH a prefix and a suffix (RE…ING, UN…NESS): ×4 mult",
  apply(ctx) {
    if (ctx.props.prefix && ctx.props.suffix) {
      ctx.mult *= 4;
      ctx.trigger("Circumfix", "×4 (pre+suf)");
    }
  },
};

// ── Big + varied (stacks with Tome / Mosaic / Scholar) ───────────────────────

export const KALEIDOSCOPE: Card = {
  id: "kaleidoscope",
  name: "Kaleidoscope",
  kind: "dictionary",
  rarity: "uncommon",
  text: "7+ letter words with 6+ distinct letters: ×3 mult",
  apply(ctx) {
    if (ctx.props.len >= 7 && ctx.props.distinct >= 6) {
      ctx.mult *= 3;
      ctx.trigger("Kaleidoscope", "×3 (long & varied)");
    }
  },
};

export const MARATHON: Card = {
  id: "marathon",
  name: "Marathon",
  kind: "dictionary",
  rarity: "rare",
  text: "8+ letter words: restore 4s AND ×2 mult — long words fuel the clock",
  apply(ctx) {
    if (ctx.props.len >= 8) {
      ctx.timeGain += 4;
      ctx.mult *= 2;
      ctx.trigger("Marathon", "+4s, ×2");
    }
  },
};

// ── Collection spine (scales off run-long progress; READ-ONLY) ───────────────

export const LEXICOGRAPHER: Card = {
  id: "lexicographer",
  name: "Lexicographer",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+4 chips for every distinct starting letter you've used this run",
  apply(ctx) {
    if (ctx.run.seenFirst.size > 0) {
      const add = ctx.run.seenFirst.size * 4;
      ctx.chips += add;
      ctx.trigger("Lexicographer", `+${add} (${ctx.run.seenFirst.size} letters)`);
    }
  },
};

export const ARCHIVE: Card = {
  id: "archive",
  name: "Archive",
  kind: "dictionary",
  rarity: "common",
  text: "+0.1 mult for every word played this run — a slow-burn snowball",
  apply(ctx) {
    if (ctx.run.runWords > 0) {
      const add = ctx.run.runWords * 0.1;
      ctx.mult += add;
      ctx.trigger("Archive", `+${add.toFixed(1)} mult`);
    }
  },
};

/**
 * Vault reads a shop-fed counter (`run.counters.vault`) that the economy layer
 * banks on commit — e.g. rare-letter or mirror plays deposit into it. Cards here
 * never write it (apply runs on preview); Vault just spends the stored value as
 * chips, turning long-run progress into a growing payout.
 */
export const VAULT: Card = {
  id: "vault",
  name: "Vault",
  kind: "dictionary",
  rarity: "rare",
  text: "+chips equal to your banked Vault (grows as you play rare & mirror words)",
  apply(ctx) {
    const vault = ctx.run.counters.vault ?? 0;
    if (vault > 0) {
      ctx.chips += vault;
      ctx.trigger("Vault", `+${vault} (banked)`);
    }
  },
};

// ── Legendary (opens a NEW loop: collection → permanent mult) ─────────────────

export const POLYGLOT: Card = {
  id: "polyglot",
  name: "Polyglot",
  kind: "legendary",
  rarity: "legendary",
  text: "the FIRST time you use a new starting letter with a 6+ word: +0.3 mult this run",
  apply(ctx) {
    if (ctx.props.len >= 6 && !ctx.run.seenFirst.has(ctx.props.first)) {
      ctx.permaMultAdd += 0.3;
      ctx.trigger("Polyglot", "+0.3 mult (new letter, perm)");
    }
  },
};

/** Every third-wave card, for lookups + pool assembly. */
export const EXTRA_CARDS2: readonly Card[] = [
  BOOKEND, BOUSTROPHEDON,
  CONSONANTAL, GRINDSTONE,
  DOUBLET,
  CADENCE, HEADSTART, CIRCUMFIX,
  KALEIDOSCOPE, MARATHON,
  LEXICOGRAPHER, ARCHIVE, VAULT,
  POLYGLOT,
];
