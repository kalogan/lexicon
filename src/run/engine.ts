/**
 * run/engine — the roguelike scoring engine (the "Balatro of language" heart).
 *
 * A word scores `(baseChips + Σ chip-bonuses) × (Σ mult)`, where the word's
 * structural {@link WordProps} trigger the active deck's cards (Dictionaries /
 * Charms / Legendaries). Cards can also grant TIME (our signature resource) and
 * PERMANENT mult that carries across the run — the ingredients for a snowball:
 * a long word restores time → a card turns time into chips → a legendary bumps a
 * permanent multiplier → the next word is worth more.
 *
 * `scoreWord` is a pure PREVIEW (no mutation), so the UI can show a live
 * breakdown as you trace. `commitWord` applies the run-state deltas when a word
 * is actually played. Card ORDER matters (a time→chips card must sit after the
 * time-granters) — that's deliberate build depth, like Balatro's joker order.
 */
import { wordProps, type WordProps } from "./props.js";

export type CardKind = "dictionary" | "charm" | "legendary";
export type Rarity = "common" | "uncommon" | "rare" | "legendary";

export interface RunState {
  board: number;
  /** Words played on the current board. */
  boardWords: number;
  runWords: number;
  /** First letter of the previously played word (alliteration combos). */
  lastFirst: string | null;
  /** Permanent mult bonus accrued this run (added to every word's base mult). */
  permaMult: number;
  /** Starting letters used at least once this run (Alphabet Dictionary). */
  seenFirst: Set<string>;
  /** Generic card scratch state. */
  counters: Record<string, number>;
}

export function makeRunState(): RunState {
  return {
    board: 1,
    boardWords: 0,
    runWords: 0,
    lastFirst: null,
    permaMult: 0,
    seenFirst: new Set(),
    counters: {},
  };
}

/** Mutable accumulator a card reads + writes while scoring ONE word. */
export interface ScoreCtx {
  props: WordProps;
  chips: number;
  mult: number;
  /** Seconds this word restores. */
  timeGain: number;
  /** Permanent mult to add to the run when this word is committed. */
  permaMultAdd: number;
  run: Readonly<RunState>;
  trigger(card: string, detail: string): void;
}

export interface Card {
  id: string;
  name: string;
  kind: CardKind;
  rarity: Rarity;
  /** Player-facing rules text. */
  text: string;
  /** Mutate the scoring context when this card's condition is met. */
  apply(ctx: ScoreCtx): void;
}

export interface Breakdown {
  word: string;
  base: number;
  chips: number;
  mult: number;
  total: number;
  timeGain: number;
  permaMultAdd: number;
  triggers: { card: string; detail: string }[];
}

/** Base chips by length — grows super-linearly past 6 so long words feel huge. */
export function baseChips(len: number): number {
  if (len < 3) return 0;
  return 10 + (len - 3) * 8 + Math.max(0, len - 6) * 6;
}

/** Score a word through the active deck. PURE — does not mutate the run. */
export function scoreWord(word: string, deck: readonly Card[], run: RunState): Breakdown {
  const props = wordProps(word);
  const base = baseChips(props.len);
  const triggers: Breakdown["triggers"] = [];
  const ctx: ScoreCtx = {
    props,
    chips: base,
    mult: 1 + run.permaMult,
    timeGain: 0,
    permaMultAdd: 0,
    run,
    trigger: (card, detail) => triggers.push({ card, detail }),
  };
  for (const c of deck) c.apply(ctx);
  const total = Math.max(0, Math.round(ctx.chips * ctx.mult));
  return {
    word: props.word,
    base,
    chips: ctx.chips,
    mult: ctx.mult,
    total,
    timeGain: ctx.timeGain,
    permaMultAdd: ctx.permaMultAdd,
    triggers,
  };
}

/** Apply a played word's run-state effects (counters + permanent mult). */
export function commitWord(run: RunState, b: Breakdown): void {
  run.boardWords++;
  run.runWords++;
  run.lastFirst = b.word[0] ?? null;
  run.permaMult += b.permaMultAdd;
  run.seenFirst.add(b.word[0] ?? "");
}
