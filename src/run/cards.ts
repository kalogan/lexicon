/**
 * run/cards — the starter card set, drawn straight from the GDD's example
 * Dictionaries, plus the two cards that make a TIME→SCORE snowball possible
 * (Chronologist + Time Broker). Each card follows the golden rule: it changes
 * WHAT you hunt, not merely how much you score.
 *
 * Card ORDER in a deck matters — a time→chips card (Time Broker) must sit AFTER
 * the time-granters to see their seconds. The draft/arrange UI will expose that.
 */
import type { Card } from "./engine.js";

// ── Dictionaries (persistent) ────────────────────────────────────────────────

export const TINY: Card = {
  id: "tiny",
  name: "Tiny Dictionary",
  kind: "dictionary",
  rarity: "common",
  text: "3-letter words: +20 chips",
  apply(ctx) {
    if (ctx.props.len === 3) {
      ctx.chips += 20;
      ctx.trigger("Tiny", "+20");
    }
  },
};

export const SCHOLAR: Card = {
  id: "scholar",
  name: "Scholar Dictionary",
  kind: "dictionary",
  rarity: "uncommon",
  text: "8+ letter words: ×2 mult",
  apply(ctx) {
    if (ctx.props.len >= 8) {
      ctx.mult *= 2;
      ctx.trigger("Scholar", "×2");
    }
  },
};

export const RARE_LETTER: Card = {
  id: "rare-letter",
  name: "Rare-Letter Dictionary",
  kind: "dictionary",
  rarity: "rare",
  text: "words with Q/X/J/Z: ×4 mult",
  apply(ctx) {
    if (ctx.props.rareLetters > 0) {
      ctx.mult *= 4;
      ctx.trigger("Rare-Letter", "×4");
    }
  },
};

export const PREFIX: Card = {
  id: "prefix",
  name: "Prefix Dictionary",
  kind: "dictionary",
  rarity: "common",
  text: "RE / UN / PRE words: ×2 mult",
  apply(ctx) {
    if (ctx.props.prefix && ["re", "un", "pre"].includes(ctx.props.prefix)) {
      ctx.mult *= 2;
      ctx.trigger("Prefix", "×2");
    }
  },
};

export const SUFFIX: Card = {
  id: "suffix",
  name: "Suffix Dictionary",
  kind: "dictionary",
  rarity: "common",
  text: "ING / ED / LY words: +30 chips",
  apply(ctx) {
    if (ctx.props.suffix && ["ing", "ed", "ly"].includes(ctx.props.suffix)) {
      ctx.chips += 30;
      ctx.trigger("Suffix", "+30");
    }
  },
};

export const ALPHABET: Card = {
  id: "alphabet",
  name: "Alphabet Dictionary",
  kind: "dictionary",
  rarity: "common",
  text: "+25 chips the first time you use each starting letter",
  apply(ctx) {
    if (!ctx.run.seenFirst.has(ctx.props.first)) {
      ctx.chips += 25;
      ctx.trigger("Alphabet", "+25 (new letter)");
    }
  },
};

export const TIME_DICT: Card = {
  id: "time",
  name: "Time Dictionary",
  kind: "dictionary",
  rarity: "uncommon",
  text: "6+ letter words restore 3s",
  apply(ctx) {
    if (ctx.props.len >= 6) {
      ctx.timeGain += 3;
      ctx.trigger("Time", "+3s");
    }
  },
};

export const TIME_BROKER: Card = {
  id: "time-broker",
  name: "Time Broker",
  kind: "dictionary",
  rarity: "rare",
  text: "+15 chips per second this word restores (place AFTER your time cards)",
  apply(ctx) {
    if (ctx.timeGain > 0) {
      const add = Math.round(ctx.timeGain) * 15;
      ctx.chips += add;
      ctx.trigger("Time Broker", `+${add}`);
    }
  },
};

// ── Legendary (rule-bender — the "WAIT." moment) ─────────────────────────────

export const CHRONOLOGIST: Card = {
  id: "chronologist",
  name: "Chronologist",
  kind: "legendary",
  rarity: "legendary",
  text: "8+ letter words restore 5s and permanently gain +0.5 mult this run",
  apply(ctx) {
    if (ctx.props.len >= 8) {
      ctx.timeGain += 5;
      ctx.permaMultAdd += 0.5;
      ctx.trigger("Chronologist", "+5s, +0.5 mult (perm)");
    }
  },
};

/** Every card, for lookups. */
export const ALL_CARDS: readonly Card[] = [
  TINY, SCHOLAR, RARE_LETTER, PREFIX, SUFFIX, ALPHABET, TIME_DICT, TIME_BROKER, CHRONOLOGIST,
];

/** A gentle starting deck; everything else is drafted 1-of-3 between boards. */
export const STARTER_DECK: readonly Card[] = [ALPHABET];

/** The draftable pool (everything not in the starter deck). */
export const DRAFT_POOL: readonly Card[] = ALL_CARDS.filter((c) => c.id !== "alphabet");
