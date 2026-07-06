/**
 * sim/run — one headless Challenge run, faithful to ChallengeScreen.tsx.
 *
 * We REUSE the real engine (scoreWord / commit-with-grow), the real ladder
 * (challenge.ts), boss + modifier rolls, the real deck dealing, and the real
 * shop economy (prices, reward × rewardMult, interest, boss charm drop is
 * irrelevant to relic balance so charms are ignored). The bot plays greedily
 * (sim/solver) and shops via a policy (sim/policy). Everything is seeded off a
 * single run seed so a run is fully reproducible.
 *
 * Constants + math are copied 1:1 from ChallengeScreen so the sim's win-rate is
 * the game's win-rate, not a re-balanced approximation:
 *   SIZE=6, PLAYS_PER_BLIND=6, DISCARDS_PER_BLIND=3, PRICE tiers, ADD/REMOVE/
 *   REROLL costs, BOSS_SOFTEN=0.5, boss target blend, interest = min(5, ⌊c/5⌋).
 */
import { createRng, type Rng } from "game-kit/prng";
import { makeBoardFromDeck, STARTER_LETTER_DECK, letterOffer, type Tile } from "../run/deck.js";
import { makeRunState, scoreWord, type Card, type RunState, type Breakdown } from "../run/engine.js";
import { DRAFT_POOL } from "../run/cards.js";
import {
  blindAtStep,
  blindTarget,
  isWin,
  TOTAL_BLINDS,
  type Blind,
} from "../run/challenge.js";
import { challengeBoss, type Boss } from "../run/bosses.js";
import { challengeModifier, goldCell, type BoardMod } from "../run/modifiers.js";
import { stakeRules } from "../run/stakes.js";
import type { ShopRelic } from "../ChallengeShop.js";
import { solveScored } from "./solver.js";
import type { ShopPolicy } from "./policy.js";

// ── Constants copied verbatim from ChallengeScreen.tsx ────────────────────────
const SIZE = 6;
const PLAYS_PER_BLIND = 6;
const DISCARDS_PER_BLIND = 3;
const PRICE: Record<Card["rarity"], number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };
const BOSS_SOFTEN = 0.5;

/** commit() from ChallengeScreen — advance run state with the grow hook. */
function commit(run: RunState, b: Breakdown, deck: readonly Card[]): RunState {
  const counters = { ...run.counters };
  const growCtx: RunState = { ...run, counters };
  for (const c of deck) c.grow?.(growCtx, b);
  const seenFirst = new Set(run.seenFirst);
  seenFirst.add(b.word[0] ?? "");
  return {
    ...run,
    boardWords: run.boardWords + 1,
    runWords: run.runWords + 1,
    lastFirst: b.word[0] ?? null,
    permaMult: run.permaMult + b.permaMultAdd,
    seenFirst,
    counters,
  };
}

/** Draw n distinct relics from the DRAFT_POOL via the run rng (mirrors pickRelics,
 *  which uses Math.random — we make it seeded so runs reproduce). */
function pickRelics(rng: Rng, n = 3): ShopRelic[] {
  const out: ShopRelic[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < n && used.size < DRAFT_POOL.length && guard++ < 5000) {
    const i = rng.int(DRAFT_POOL.length);
    if (used.has(i)) continue;
    used.add(i);
    const card = DRAFT_POOL[i]!;
    out.push({ card, price: PRICE[card.rarity] });
  }
  return out;
}

/** letterOffer, but seeded (the real one uses Math.random). */
function seededLetterOffer(rng: Rng, n = 10): Tile[] {
  const OFFER_WEIGHTS: Record<string, number> = {
    e: 6, a: 5, i: 4, o: 4, u: 3,
    s: 5, t: 5, r: 5, n: 5, l: 4, d: 3, c: 3, g: 3, m: 3, h: 3,
    p: 2, b: 2, f: 2, y: 2, w: 2, qu: 2, k: 1, v: 1, x: 1, z: 1, j: 1,
  };
  const pool: string[] = [];
  for (const [l, w] of Object.entries(OFFER_WEIGHTS)) for (let i = 0; i < w; i++) pool.push(l);
  const out: Tile[] = [];
  const seen = new Set<Tile>();
  let guard = 0;
  while (out.length < n && guard++ < 3000) {
    const l = pool[rng.int(pool.length)]!;
    if (seen.has(l)) continue;
    seen.add(l);
    out.push(l);
  }
  return out;
}
void letterOffer; // real one referenced for provenance; we use the seeded variant

export interface RunResult {
  win: boolean;
  /** Highest ante reached (1..5); a loss records the ante it died on. */
  anteReached: number;
  /** Blinds cleared (0..15). */
  blindsCleared: number;
  /** Relic ids owned at the moment the run ended. */
  ownedRelics: string[];
  /** Relic ids that were OFFERED in any shop during the run (draft + shops). */
  offeredRelics: string[];
  /** Per-relic total engine contribution while owned (sum of triggered word deltas
   *  is hard to attribute cleanly; we approximate "contribution" at the report
   *  layer via win-lift, so here we just track ownership + offers). */
  seed: number;
}

export interface RunConfig {
  seed: number;
  stake: number;
  shopPolicy: ShopPolicy;
  words: readonly string[];
  /** Also draft the opening relic via the policy vs. always taking the priciest. */
}

/**
 * Play one full run. Deterministic given (seed, stake, policy). Returns the
 * outcome + which relics were owned / offered (the balance signal).
 */
export function playRun(cfg: RunConfig): RunResult {
  const { seed, stake, shopPolicy, words } = cfg;
  const rng = createRng(seed >>> 0);
  const boardRng = rng.fork(0x51ed);
  const runSalt = rng.fork(0xb055).int(0x7fffffff) >>> 0;

  const rules = stakeRules(stake);
  const playsPerBlind = PLAYS_PER_BLIND + rules.playsDelta;

  // ── Opening draft ───────────────────────────────────────────────────────────
  let letters: Tile[] = [...STARTER_LETTER_DECK];
  const offer = seededLetterOffer(rng, 10);
  // Pick 5: weight toward vowels + commons (the "natural" play the UI nudges).
  const VOWELS = new Set(["a", "e", "i", "o", "u"]);
  const ranked = [...offer].sort((a, b) => {
    const av = VOWELS.has(a) ? 1 : 0;
    const bv = VOWELS.has(b) ? 1 : 0;
    return bv - av;
  });
  letters.push(...ranked.slice(0, 5));

  const offeredRelics = new Set<string>();
  // Opening relic: 1 of 3. The bot takes the priciest (proxy for best) to seed.
  const relicOffer = pickRelics(rng, 3);
  relicOffer.forEach((r) => offeredRelics.add(r.card.id));
  const firstRelic = relicOffer.reduce((best, r) => (r.price > best.price ? r : best)).card;
  let relics: Card[] = [firstRelic];

  let coins = 0;
  let step = 0;
  let run: RunState = makeRunState();

  // ── Blind loop ────────────────────────────────────────────────────────────────
  while (step < TOTAL_BLINDS) {
    const blind: Blind = blindAtStep(step)!;

    const hasBoss = blind.isBoss || (rules.bossOnBig && blind.indexInAnte === 1);
    const boss: Boss | null = hasBoss ? challengeBoss(blind.step ^ runSalt) : null;

    // Target (verbatim ChallengeScreen math).
    let target = Math.round(blind.target * rules.targetMult);
    if (boss) {
      const softened = Math.round(target * (BOSS_SOFTEN + (1 - BOSS_SOFTEN) * boss.targetMult));
      const prev = Math.round(
        blindTarget(blind.ante, Math.max(0, blind.indexInAnte - 1)) * rules.targetMult,
      );
      target = Math.max(prev + 1, softened);
    }

    const boardMod: BoardMod | null = blind.isBoss
      ? null
      : challengeModifier(blind.step ^ runSalt);
    const effectiveDeck: Card[] = boardMod?.card ? [...relics, boardMod.card] : relics;

    // Play the blind: greedy words up to playsPerBlind, with DISCARDS_PER_BLIND
    // board re-deals when the best play can't move the needle.
    let boardScore = 0;
    let playsLeft = playsPerBlind;
    let discardsLeft = DISCARDS_PER_BLIND;
    let boardSeed = boardRng.int(0x7fffffff);
    run = { ...run, boardWords: 0, lastFirst: null };
    const found = new Set<string>();
    let cleared = false;

    while (playsLeft > 0) {
      const board = makeBoardFromDeck(letters, boardSeed, SIZE);
      const blocked = new Set(boss?.blocked?.(SIZE, boardSeed) ?? []);
      const goldTile = boardMod?.goldTile ? goldCell(SIZE, boardSeed, blocked) : -1;
      const goldMult = boardMod?.goldMult ?? 2;

      const cands = solveScored(board, words, effectiveDeck, run, {
        found,
        boss,
        blocked,
        goldTile,
        goldMult,
      });

      const best = cands[0];
      // If nothing playable OR the best word is tiny and we still have discards,
      // re-deal (a discard). Heuristic: discard when best < 8% of remaining need
      // and we can afford to.
      const need = target - boardScore;
      const weakBoard =
        !best || (discardsLeft > 0 && best.total < Math.max(15, need * 0.08));
      if (weakBoard && discardsLeft > 0) {
        discardsLeft--;
        boardSeed = boardRng.int(0x7fffffff);
        found.clear();
        continue;
      }
      if (!best) break; // no legal word and no discards — dead board

      // Play the best word (gold already folded into total by the solver).
      const raw = scoreWord(best.word, effectiveDeck, run);
      let total = raw.total;
      if (best.goldHit) total = Math.round(total * goldMult);
      const b: Breakdown = { ...raw, total, triggers: raw.triggers };
      boardScore += total;
      run = commit(run, b, effectiveDeck);
      found.add(best.word);
      playsLeft--;

      if (boardScore >= target) {
        cleared = true;
        break;
      }
    }

    if (!cleared) {
      // Defeat — record and stop.
      return {
        win: false,
        anteReached: blind.ante,
        blindsCleared: step,
        ownedRelics: relics.map((c) => c.id),
        offeredRelics: [...offeredRelics],
        seed,
      };
    }

    // ── Clear economy (verbatim) ────────────────────────────────────────────────
    const interest = rules.interest ? Math.min(5, Math.floor(coins / 5)) : 0;
    const reward = Math.round(blind.reward * rules.rewardMult);
    coins += reward + interest;

    if (isWin(step + 1)) {
      return {
        win: true,
        anteReached: 5,
        blindsCleared: TOTAL_BLINDS,
        ownedRelics: relics.map((c) => c.id),
        offeredRelics: [...offeredRelics],
        seed,
      };
    }

    // ── Shop ────────────────────────────────────────────────────────────────────
    let shelf = pickRelics(rng, 3);
    shelf.forEach((r) => offeredRelics.add(r.card.id));
    // Let the policy buy until it declines or can't afford. Consume bought offers.
    let guard = 0;
    while (guard++ < 12) {
      const pick = shopPolicy.pickBuy({ coins, offered: shelf, owned: relics });
      if (!pick || pick.price > coins) break;
      coins -= pick.price;
      relics = [...relics, pick.card];
      const i = shelf.findIndex((e) => e.card === pick.card);
      if (i >= 0) shelf = [...shelf.slice(0, i), ...shelf.slice(i + 1)];
    }

    step++;
  }

  // Reached here only by clearing the final blind without the isWin early-return.
  return {
    win: true,
    anteReached: 5,
    blindsCleared: TOTAL_BLINDS,
    ownedRelics: relics.map((c) => c.id),
    offeredRelics: [...offeredRelics],
    seed,
  };
}
