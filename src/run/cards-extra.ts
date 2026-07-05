/**
 * run/cards-extra — the SECOND wave of draftable cards, widening the pool so a
 * run can lean into distinct hunts: a Speed-Reader tempo build, a Linguist
 * structure build, a fresh big-word Scholar line, a couple of time engines, and
 * two legendaries that each open a NEW loop the starter set can't.
 *
 * Same golden rule as cards.ts: every card changes WHAT you hunt, not merely how
 * much you score. Order still matters — the chip-from-time and chip-from-mult
 * cards read the accumulator, so place them AFTER whatever feeds them.
 */
import type { Card } from "./engine.js";

// ── Speed Reader (tempo — short words, boards, combos) ───────────────────────

export const RAPID_FIRE: Card = {
  id: "rapid-fire",
  name: "Rapid Fire",
  kind: "dictionary",
  rarity: "common",
  text: "3-4 letter words: +18 chips",
  apply(ctx) {
    if (ctx.props.len >= 3 && ctx.props.len <= 4) {
      ctx.chips += 18;
      ctx.trigger("Rapid Fire", "+18");
    }
  },
};

export const MOMENTUM: Card = {
  id: "momentum",
  name: "Momentum",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.4 mult for every word already played this board",
  apply(ctx) {
    if (ctx.run.boardWords > 0) {
      const add = ctx.run.boardWords * 0.4;
      ctx.mult += add;
      ctx.trigger("Momentum", `+${add.toFixed(1)} mult`);
    }
  },
};

export const ALLITERATION: Card = {
  id: "alliteration",
  name: "Alliteration",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×3 mult when this word starts with the same letter as your last",
  apply(ctx) {
    if (ctx.run.lastFirst && ctx.props.first === ctx.run.lastFirst) {
      ctx.mult *= 3;
      ctx.trigger("Alliteration", "×3 (same start)");
    }
  },
};

// ── Linguist (structure — affixes, vowels, variety, chosen letters) ──────────

export const AFFIXOLOGIST: Card = {
  id: "affixologist",
  name: "Affixologist",
  kind: "dictionary",
  rarity: "common",
  text: "+15 chips for any prefix, +15 more for any suffix",
  apply(ctx) {
    let add = 0;
    if (ctx.props.prefix) add += 15;
    if (ctx.props.suffix) add += 15;
    if (add > 0) {
      ctx.chips += add;
      ctx.trigger("Affixologist", `+${add}`);
    }
  },
};

export const VOWEL_HOARDER: Card = {
  id: "vowel-hoarder",
  name: "Vowel Hoarder",
  kind: "dictionary",
  rarity: "uncommon",
  text: "×2 mult when over half the word's letters are vowels",
  apply(ctx) {
    if (ctx.props.len > 0 && ctx.props.vowels * 2 > ctx.props.len) {
      ctx.mult *= 2;
      ctx.trigger("Vowel Hoarder", "×2 (vowel-heavy)");
    }
  },
};

export const MOSAIC: Card = {
  id: "mosaic",
  name: "Mosaic",
  kind: "dictionary",
  rarity: "common",
  text: "+6 chips per distinct letter (5+ distinct)",
  apply(ctx) {
    if (ctx.props.distinct >= 5) {
      const add = ctx.props.distinct * 6;
      ctx.chips += add;
      ctx.trigger("Mosaic", `+${add}`);
    }
  },
};

export const TERMINAL: Card = {
  id: "terminal-e",
  name: "Terminal E",
  kind: "dictionary",
  rarity: "common",
  text: "words ending in E: ×2 mult",
  apply(ctx) {
    if (ctx.props.last === "e") {
      ctx.mult *= 2;
      ctx.trigger("Terminal E", "×2 (ends in E)");
    }
  },
};

// ── Scholar line (big words — distinct from the starter Scholar) ─────────────

export const TOME: Card = {
  id: "tome",
  name: "Tome",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+12 chips per letter for 7+ letter words",
  apply(ctx) {
    if (ctx.props.len >= 7) {
      const add = ctx.props.len * 12;
      ctx.chips += add;
      ctx.trigger("Tome", `+${add}`);
    }
  },
};

// ── Time interplay ───────────────────────────────────────────────────────────

export const HOURGLASS: Card = {
  id: "hourglass",
  name: "Hourglass",
  kind: "dictionary",
  rarity: "uncommon",
  text: "double letters restore 2s each",
  apply(ctx) {
    if (ctx.props.doubles > 0) {
      const add = ctx.props.doubles * 2;
      ctx.timeGain += add;
      ctx.trigger("Hourglass", `+${add}s`);
    }
  },
};

export const OVERCLOCK: Card = {
  id: "overclock",
  name: "Overclock",
  kind: "dictionary",
  rarity: "rare",
  text: "spend 2s to gain ×2 mult on 5+ letter words (place AFTER your time cards)",
  apply(ctx) {
    if (ctx.props.len >= 5 && ctx.timeGain >= 2) {
      ctx.timeGain -= 2;
      ctx.mult *= 2;
      ctx.trigger("Overclock", "-2s → ×2");
    }
  },
};

// ── Legendaries (rule-benders — each opens a NEW loop) ───────────────────────

export const PANGRAMMER: Card = {
  id: "pangrammer",
  name: "Pangrammer",
  kind: "legendary",
  rarity: "legendary",
  text: "no-repeat-letter words (5+ letters) permanently gain +0.3 mult this run",
  apply(ctx) {
    if (ctx.props.allDistinct && ctx.props.len >= 5) {
      ctx.permaMultAdd += 0.3;
      ctx.trigger("Pangrammer", "+0.3 mult (perm)");
    }
  },
};

export const CURATOR: Card = {
  id: "curator",
  name: "Curator",
  kind: "legendary",
  rarity: "legendary",
  text: "rare letters (Q/X/J/Z): +8s and +40 chips each — a self-fuelling engine",
  apply(ctx) {
    if (ctx.props.rareLetters > 0) {
      ctx.timeGain += ctx.props.rareLetters * 8;
      ctx.chips += ctx.props.rareLetters * 40;
      ctx.trigger("Curator", `+${ctx.props.rareLetters * 8}s, +${ctx.props.rareLetters * 40}`);
    }
  },
};

/** Every extra card, for lookups + pool assembly. */
export const EXTRA_CARDS: readonly Card[] = [
  RAPID_FIRE, MOMENTUM, ALLITERATION,
  AFFIXOLOGIST, VOWEL_HOARDER, MOSAIC, TERMINAL,
  TOME,
  HOURGLASS, OVERCLOCK,
  PANGRAMMER, CURATOR,
];
