/**
 * run/modifiers — per-board TWISTS, lighter than bosses. Where a boss changes
 * the RULES against you (see run/bosses), a board modifier is a telegraphed,
 * mostly-BENEFICIAL curveball that lands on some regular boards to break up the
 * rhythm: a golden tile, a time gift, or a transient scoring card that only
 * lives on this one board. Boss boards never roll a modifier — callers guard.
 *
 * A modifier's scoring twist is a transient {@link Card} (identical interface to
 * a relic), so it slots straight into the deck the engine scores through. These
 * cards are never drafted — they exist only inside a BoardMod.
 */
import { createRng } from "game-kit/prng";
import type { Card } from "./engine.js";

export interface BoardMod {
  id: string;
  name: string;
  /** Player-facing, telegraphed on the board-mod banner. Terse. */
  blurb: string;
  /** Banner styling: "boon" = clearly good, "twist" = a rewarding curveball. */
  tone: "boon" | "twist";
  /** A transient scoring card active ONLY on this board (I append it to the deck). Optional. */
  card?: Card;
  /** Seconds granted at board start (I add to the time budget). Optional. */
  startTimeBonus?: number;
  /** If true, one random tile becomes a gold gate: words tracing through it get ×goldMult. */
  goldTile?: boolean;
  /** Multiplier for the gold tile (default 2 when goldTile is set). Optional. */
  goldMult?: number;
}

/** Build a transient scoring card for a modifier. Same shape/feel as run/cards. */
function modCard(id: string, name: string, text: string, apply: Card["apply"]): Card {
  return { id: `mod-${id}`, name, kind: "charm", rarity: "uncommon", text, apply };
}

export const MODIFIERS: readonly BoardMod[] = [
  // ── Boons (clearly good) ───────────────────────────────────────────────────
  {
    id: "golden-tile",
    name: "Golden Tile",
    blurb: "One tile glows — any word tracing through it scores ×2.",
    tone: "boon",
    goldTile: true,
    goldMult: 2,
  },
  {
    id: "tailwind",
    name: "Tailwind",
    blurb: "A gust at your back — start this board with +20 seconds.",
    tone: "boon",
    startTimeBonus: 20,
  },
  {
    id: "double-time",
    name: "Double Time",
    blurb: "Every word restores +2s.",
    tone: "boon",
    card: modCard("double-time", "Double Time", "Every word restores +2s", (ctx) => {
      if (ctx.props.len >= 3) {
        ctx.timeGain += 2;
        ctx.trigger("Double Time", "+2s");
      }
    }),
  },
  {
    id: "long-haul",
    name: "Long Haul",
    blurb: "6+ letter words: +35 chips.",
    tone: "boon",
    card: modCard("long-haul", "Long Haul", "6+ letter words: +35 chips", (ctx) => {
      if (ctx.props.len >= 6) {
        ctx.chips += 35;
        ctx.trigger("Long Haul", "+35");
      }
    }),
  },
  // ── Twists (rewarding curveballs) ──────────────────────────────────────────
  {
    id: "vowel-bloom",
    name: "Vowel Bloom",
    blurb: "Vowel-rich words (3+ vowels): ×1.5 mult.",
    tone: "twist",
    card: modCard("vowel-bloom", "Vowel Bloom", "Vowel-rich words (3+ vowels): ×1.5 mult", (ctx) => {
      if (ctx.props.vowels >= 3) {
        ctx.mult *= 1.5;
        ctx.trigger("Vowel Bloom", "×1.5");
      }
    }),
  },
  {
    id: "rare-air",
    name: "Rare Air",
    blurb: "Words with Q/X/J/Z: ×2 mult.",
    tone: "twist",
    card: modCard("rare-air", "Rare Air", "Words with Q/X/J/Z: ×2 mult", (ctx) => {
      if (ctx.props.rareLetters > 0) {
        ctx.mult *= 2;
        ctx.trigger("Rare Air", "×2");
      }
    }),
  },
  {
    id: "prime-cuts",
    name: "Prime Cuts",
    blurb: "Tiny 3-letter words: +40 chips.",
    tone: "twist",
    card: modCard("prime-cuts", "Prime Cuts", "Tiny 3-letter words: +40 chips", (ctx) => {
      if (ctx.props.len === 3) {
        ctx.chips += 40;
        ctx.trigger("Prime Cuts", "+40");
      }
    }),
  },
  {
    id: "encore",
    name: "Encore",
    blurb: "Repeat the last word's starting letter: ×2 mult.",
    tone: "twist",
    card: modCard("encore", "Encore", "Repeat the last word's starting letter: ×2 mult", (ctx) => {
      if (ctx.run.lastFirst && ctx.props.first === ctx.run.lastFirst) {
        ctx.mult *= 2;
        ctx.trigger("Encore", "×2");
      }
    }),
  },
  {
    id: "twin-flame",
    name: "Twin Flame",
    blurb: "Words with a doubled letter: ×2 mult.",
    tone: "twist",
    card: modCard("twin-flame", "Twin Flame", "Words with a doubled letter: ×2 mult", (ctx) => {
      if (ctx.props.doubles > 0) {
        ctx.mult *= 2;
        ctx.trigger("Twin Flame", "×2");
      }
    }),
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    blurb: "No repeated letters: +30 chips.",
    tone: "twist",
    card: modCard("kaleidoscope", "Kaleidoscope", "No repeated letters: +30 chips", (ctx) => {
      if (ctx.props.allDistinct) {
        ctx.chips += 30;
        ctx.trigger("Kaleidoscope", "+30");
      }
    }),
  },
  {
    id: "root-work",
    name: "Root Work",
    blurb: "Words with a known prefix: ×1.5 mult.",
    tone: "twist",
    card: modCard("root-work", "Root Work", "Words with a known prefix: ×1.5 mult", (ctx) => {
      if (ctx.props.prefix) {
        ctx.mult *= 1.5;
        ctx.trigger("Root Work", "×1.5");
      }
    }),
  },
  {
    id: "flourish",
    name: "Flourish",
    blurb: "Words with a known suffix: +25 chips.",
    tone: "twist",
    card: modCard("flourish", "Flourish", "Words with a known suffix: +25 chips", (ctx) => {
      if (ctx.props.suffix) {
        ctx.chips += 25;
        ctx.trigger("Flourish", "+25");
      }
    }),
  },
  {
    id: "spread",
    name: "Spread",
    blurb: "5+ distinct letters: +45 chips.",
    tone: "twist",
    card: modCard("spread", "Spread", "5+ distinct letters: +45 chips", (ctx) => {
      if (ctx.props.distinct >= 5) {
        ctx.chips += 45;
        ctx.trigger("Spread", "+45");
      }
    }),
  },
  {
    id: "marathon",
    name: "Marathon",
    blurb: "7+ letter words: ×2 mult.",
    tone: "twist",
    card: modCard("marathon", "Marathon", "7+ letter words: ×2 mult", (ctx) => {
      if (ctx.props.len >= 7) {
        ctx.mult *= 2;
        ctx.trigger("Marathon", "×2");
      }
    }),
  },
  {
    id: "slow-burn",
    name: "Slow Burn",
    blurb: "4+ letter words: +3s.",
    tone: "boon",
    card: modCard("slow-burn", "Slow Burn", "4+ letter words: +3s", (ctx) => {
      if (ctx.props.len >= 4) {
        ctx.timeGain += 3;
        ctx.trigger("Slow Burn", "+3s");
      }
    }),
  },
  {
    id: "twin-gold",
    name: "Twin Gold",
    blurb: "Two tiles glow — any word tracing through one scores ×2.",
    tone: "boon",
    goldTile: true,
    goldMult: 2,
  },
];

/** Roll a modifier for a REGULAR board, deterministic by seed. ~45% of the time returns
 *  null (a plain board). Callers guard so this is never invoked for boss boards. */
export function randomModifier(seed: number): BoardMod | null {
  const rng = createRng(seed >>> 0);
  // ~45% plain board; otherwise a uniform pick among the modifiers.
  if (rng.next() < 0.45) return null;
  return MODIFIERS[rng.int(MODIFIERS.length)]!;
}

/** Deterministically pick one gold-tile cell index in [0, size*size), avoiding sealed
 *  cells. Returns -1 only if every cell is blocked (never happens in practice). */
export function goldCell(size: number, seed: number, blocked: ReadonlySet<number>): number {
  const total = size * size;
  if (blocked.size >= total) return -1;
  const rng = createRng((seed ^ 0x2545f491) >>> 0);
  // Rejection-sample an unblocked cell; bounded because at least one is free.
  for (let tries = 0; tries < total * 4; tries++) {
    const cell = rng.int(total);
    if (!blocked.has(cell)) return cell;
  }
  // Fallback: scan deterministically from a seeded offset for the first free cell.
  const start = rng.int(total);
  for (let i = 0; i < total; i++) {
    const cell = (start + i) % total;
    if (!blocked.has(cell)) return cell;
  }
  return -1;
}
