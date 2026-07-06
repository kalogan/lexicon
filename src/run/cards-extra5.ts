/**
 * run/cards-extra5 — the SCALING & COMBO wave, the fix for "relics feel ehh".
 *
 * The earlier packs are almost entirely STATIC: "+X chips when the word has
 * property Y". Play the same word twice and it scores the same twice. This wave
 * is the opposite — its relics WATER themselves. They use the engine's `grow`
 * hook (called once when a word is COMMITTED) to permanently bank value into
 * `run.counters[id]`, and their `apply` READS that counter to scale every FUTURE
 * word. The value you see is the value you built: a Hoarder that has watched ten
 * double-letter words is worth +3 mult forever; a chain that has run six words
 * on the same start is exploding.
 *
 * Two mechanical families here, and this is the whole point of the pack:
 *
 *   1. SCALING — grow() banks a small delta each time a structure appears
 *      (double letters, rare letters, 7+ length, all-distinct, vowel-heavy,
 *      prefixes). apply() reads the bank. Growth affects FUTURE words, never the
 *      one that grew it — correct, and the Balatro "watering can" feel.
 *
 *   2. COMBO / ORDER — grow() reads run.lastFirst (the PREVIOUS word, since
 *      `run` is the pre-commit state) and a streak counter: it EXTENDS the streak
 *      when the ordering condition holds and RESETS it to 0 when broken.
 *      apply() rewards the CURRENT streak length. Play alliteratively, or in
 *      ever-longer words, and the reward compounds; break the pattern and you
 *      start over.
 *
 * Collection scalers (Cartographer / Anthology) read run.seenFirst.size /
 * run.runWords directly — no grow needed — and still expose accrued().
 *
 * Golden rules preserved from the earlier waves:
 *  • apply() runs on PREVIEW too, so it only READS run state — never mutates it.
 *    All mutation happens in grow(), which fires on COMMIT only.
 *  • Every accumulating card exposes an accrued(run) tooltip string.
 *  • Each card keys its counter by its OWN id, so nothing collides.
 */
import type { Card } from "./engine.js";

// ── SCALING: perma-MULT growers (small per-trigger so they compound) ──────────

export const HOARDER: Card = {
  id: "scale-hoarder",
  name: "The Hoarder",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.3 mult for each double-letter word you play (banked all run)",
  apply(ctx) {
    const banked = ctx.run.counters["scale-hoarder"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Hoarder", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.doubles > 0) {
      run.counters["scale-hoarder"] = (run.counters["scale-hoarder"] ?? 0) + 0.3;
    }
  },
  accrued: (run) =>
    run.counters["scale-hoarder"]
      ? `+${run.counters["scale-hoarder"].toFixed(1)} mult banked`
      : null,
};

export const ALCHEMIST: Card = {
  id: "scale-alchemist",
  name: "The Alchemist",
  kind: "dictionary",
  rarity: "rare",
  text: "Permanently gains +0.4 mult for every rare letter (Q/X/J/Z) you play — forever",
  apply(ctx) {
    const banked = ctx.run.counters["scale-alchemist"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Alchemist", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.rareLetters > 0) {
      run.counters["scale-alchemist"] =
        (run.counters["scale-alchemist"] ?? 0) + 0.4 * b.props.rareLetters;
    }
  },
  accrued: (run) =>
    run.counters["scale-alchemist"]
      ? `+${run.counters["scale-alchemist"].toFixed(1)} mult banked`
      : null,
};

export const MONUMENT: Card = {
  id: "scale-monument",
  name: "Monument",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.35 mult each time you play a 7+ letter word (banked all run)",
  apply(ctx) {
    const banked = ctx.run.counters["scale-monument"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("Monument", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.len >= 7) {
      run.counters["scale-monument"] = (run.counters["scale-monument"] ?? 0) + 0.35;
    }
  },
  accrued: (run) =>
    run.counters["scale-monument"]
      ? `+${run.counters["scale-monument"].toFixed(1)} mult banked`
      : null,
};

export const PURIST: Card = {
  id: "scale-purist",
  name: "The Purist",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.25 mult for each no-repeat-letter word (5+) you play",
  apply(ctx) {
    const banked = ctx.run.counters["scale-purist"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Purist", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.allDistinct && b.props.len >= 5) {
      run.counters["scale-purist"] = (run.counters["scale-purist"] ?? 0) + 0.25;
    }
  },
  accrued: (run) =>
    run.counters["scale-purist"]
      ? `+${run.counters["scale-purist"].toFixed(1)} mult banked`
      : null,
};

export const AFFIX_ENGINE: Card = {
  id: "scale-affix-engine",
  name: "Affix Engine",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +0.2 mult each time you play a word with a known prefix",
  apply(ctx) {
    const banked = ctx.run.counters["scale-affix-engine"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("Affix Engine", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.prefix) {
      run.counters["scale-affix-engine"] =
        (run.counters["scale-affix-engine"] ?? 0) + 0.2;
    }
  },
  accrued: (run) =>
    run.counters["scale-affix-engine"]
      ? `+${run.counters["scale-affix-engine"].toFixed(1)} mult banked`
      : null,
};

// ── SCALING: perma-CHIP growers (banked flat chips, read as chips) ────────────

export const GRANARY: Card = {
  id: "scale-granary",
  name: "The Granary",
  kind: "dictionary",
  rarity: "common",
  text: "Permanently gains +8 chips for each vowel-heavy word (3+ vowels) you play",
  apply(ctx) {
    const banked = ctx.run.counters["scale-granary"] ?? 0;
    if (banked > 0) {
      ctx.chips += banked;
      ctx.trigger("The Granary", `+${banked} chips (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.vowels >= 3) {
      run.counters["scale-granary"] = (run.counters["scale-granary"] ?? 0) + 8;
    }
  },
  accrued: (run) =>
    run.counters["scale-granary"]
      ? `+${run.counters["scale-granary"]} chips banked`
      : null,
};

export const MINTMASTER: Card = {
  id: "scale-mintmaster",
  name: "Mintmaster",
  kind: "dictionary",
  rarity: "uncommon",
  text: "Permanently gains +12 chips each time you play a 6+ letter word (banked all run)",
  apply(ctx) {
    const banked = ctx.run.counters["scale-mintmaster"] ?? 0;
    if (banked > 0) {
      ctx.chips += banked;
      ctx.trigger("Mintmaster", `+${banked} chips (banked)`);
    }
  },
  grow(run, b) {
    if (b.props.len >= 6) {
      run.counters["scale-mintmaster"] = (run.counters["scale-mintmaster"] ?? 0) + 12;
    }
  },
  accrued: (run) =>
    run.counters["scale-mintmaster"]
      ? `+${run.counters["scale-mintmaster"]} chips banked`
      : null,
};

// ── COMBO / ORDER: streaks that reward the sequence you play ──────────────────

export const ALLITERATOR: Card = {
  id: "scale-alliterator",
  name: "The Alliterator",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.5 mult per word in your same-starting-letter streak — breaks when you switch letters",
  apply(ctx) {
    const streak = ctx.run.counters["scale-alliterator"] ?? 0;
    if (streak > 0) {
      const add = 0.5 * streak;
      ctx.mult += add;
      ctx.trigger("The Alliterator", `+${add.toFixed(1)} mult (×${streak} streak)`);
    }
  },
  grow(run, b) {
    const same = run.lastFirst !== null && b.props.first === run.lastFirst;
    run.counters["scale-alliterator"] = same
      ? (run.counters["scale-alliterator"] ?? 0) + 1
      : 0;
  },
  accrued: (run) =>
    run.counters["scale-alliterator"]
      ? `${run.counters["scale-alliterator"]}-word alliteration streak (+${(0.5 * run.counters["scale-alliterator"]).toFixed(1)} mult)`
      : null,
};

export const ESCALATION: Card = {
  id: "scale-escalation",
  name: "Escalation",
  kind: "dictionary",
  rarity: "rare",
  text: "+25 chips per step in your ascending-length streak — each word longer than the last; a shorter word resets it",
  apply(ctx) {
    const streak = ctx.run.counters["scale-escalation"] ?? 0;
    if (streak > 0) {
      const add = 25 * streak;
      ctx.chips += add;
      ctx.trigger("Escalation", `+${add} (×${streak} climb)`);
    }
  },
  grow(run, b) {
    const prevLen = run.counters["scale-escalation-len"] ?? 0;
    const longer = prevLen > 0 && b.props.len > prevLen;
    run.counters["scale-escalation"] = longer
      ? (run.counters["scale-escalation"] ?? 0) + 1
      : 0;
    run.counters["scale-escalation-len"] = b.props.len;
  },
  accrued: (run) =>
    run.counters["scale-escalation"]
      ? `${run.counters["scale-escalation"]}-step climb (+${25 * run.counters["scale-escalation"]} chips)`
      : null,
};

export const DRUMBEAT: Card = {
  id: "scale-drumbeat",
  name: "Drumbeat",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.4 mult per repeat in your same-length streak — same length as your last word; a different length resets it",
  apply(ctx) {
    const streak = ctx.run.counters["scale-drumbeat"] ?? 0;
    if (streak > 0) {
      const add = 0.4 * streak;
      ctx.mult += add;
      ctx.trigger("Drumbeat", `+${add.toFixed(1)} mult (×${streak} beat)`);
    }
  },
  grow(run, b) {
    const prevLen = run.counters["scale-drumbeat-len"] ?? 0;
    const same = prevLen > 0 && b.props.len === prevLen;
    run.counters["scale-drumbeat"] = same
      ? (run.counters["scale-drumbeat"] ?? 0) + 1
      : 0;
    run.counters["scale-drumbeat-len"] = b.props.len;
  },
  accrued: (run) =>
    run.counters["scale-drumbeat"]
      ? `${run.counters["scale-drumbeat"]}-word same-length beat (+${(0.4 * run.counters["scale-drumbeat"]).toFixed(1)} mult)`
      : null,
};

// ── COLLECTION scalers (read run.seenFirst / run.runWords directly) ───────────

export const CARTOGRAPHER: Card = {
  id: "scale-cartographer",
  name: "The Cartographer",
  kind: "dictionary",
  rarity: "uncommon",
  text: "+0.3 mult for every DISTINCT starting letter you've used this run",
  apply(ctx) {
    const kinds = ctx.run.seenFirst.size;
    if (kinds > 0) {
      const add = 0.3 * kinds;
      ctx.mult += add;
      ctx.trigger("The Cartographer", `+${add.toFixed(1)} mult (${kinds} letters)`);
    }
  },
  accrued: (run) =>
    run.seenFirst.size > 0
      ? `${run.seenFirst.size} distinct starts (+${(0.3 * run.seenFirst.size).toFixed(1)} mult)`
      : null,
};

export const ANTHOLOGY: Card = {
  id: "scale-anthology",
  name: "The Anthology",
  kind: "dictionary",
  rarity: "common",
  text: "+6 chips for every word you've played this run",
  apply(ctx) {
    const words = ctx.run.runWords;
    if (words > 0) {
      const add = 6 * words;
      ctx.chips += add;
      ctx.trigger("The Anthology", `+${add} (${words} words)`);
    }
  },
  accrued: (run) =>
    run.runWords > 0
      ? `${run.runWords} words played (+${6 * run.runWords} chips)`
      : null,
};

// ── LEGENDARIES: big build-defining engines ───────────────────────────────────

export const METRONOME_KING: Card = {
  id: "scale-metronome-king",
  name: "The Metronome King",
  kind: "legendary",
  rarity: "legendary",
  text: "Every 5th word you play banks +1 mult PERMANENTLY for the rest of the run",
  apply(ctx) {
    const banked = ctx.run.counters["scale-metronome-king"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("The Metronome King", `+${banked.toFixed(1)} mult (banked)`);
    }
  },
  grow(run) {
    const count = (run.counters["scale-metronome-king-count"] ?? 0) + 1;
    run.counters["scale-metronome-king-count"] = count;
    if (count % 5 === 0) {
      run.counters["scale-metronome-king"] =
        (run.counters["scale-metronome-king"] ?? 0) + 1;
    }
  },
  accrued: (run) =>
    run.counters["scale-metronome-king"]
      ? `+${run.counters["scale-metronome-king"].toFixed(1)} mult banked (every 5th word)`
      : null,
};

export const SNOWBALL: Card = {
  id: "scale-snowball",
  name: "Snowball",
  kind: "legendary",
  rarity: "legendary",
  text: "Permanently gains +0.15 mult for EVERY word — it never stops growing (banked all run)",
  apply(ctx) {
    const banked = ctx.run.counters["scale-snowball"] ?? 0;
    if (banked > 0) {
      ctx.mult += banked;
      ctx.trigger("Snowball", `+${banked.toFixed(2)} mult (banked)`);
    }
  },
  grow(run) {
    run.counters["scale-snowball"] = (run.counters["scale-snowball"] ?? 0) + 0.15;
  },
  accrued: (run) =>
    run.counters["scale-snowball"]
      ? `+${run.counters["scale-snowball"].toFixed(2)} mult banked`
      : null,
};

/** Every scaling/combo card, for lookups + pool assembly. */
export const EXTRA_CARDS5: Card[] = [
  HOARDER, ALCHEMIST, MONUMENT, PURIST, AFFIX_ENGINE,
  GRANARY, MINTMASTER,
  ALLITERATOR, ESCALATION, DRUMBEAT,
  CARTOGRAPHER, ANTHOLOGY,
  METRONOME_KING, SNOWBALL,
];
