/**
 * ChallengeScreen — the bounded "Challenge" run (Slice 3). Unlike Endless, this
 * is a run you can WIN: climb 5 antes of score BLINDS (challenge.ts), each board
 * DEALT FROM YOUR LETTER-DECK (deck.ts). Clear the final boss blind → victory;
 * miss a target → defeat. Between blinds, a shop lets you buy relics and shape
 * your letter-deck.
 *
 * Reuses the run-mode board/trace/scoring + HUD (the `.run` CSS) so it feels like
 * Endless; swaps the endless boards for the ante ladder and random letters for
 * your deck. v1 keeps it lean (no charms/modifiers) — relics + the letter-deck are
 * the build.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { canExtend, pathWord, MIN_WORD_LEN, type Board } from "./board.js";
import { readyDictionary, loadDictionary, type Dictionary } from "./dictionary.js";
import { scoreWord, makeRunState, type RunState, type Card, type Breakdown } from "./run/engine.js";
import { DRAFT_POOL } from "./run/cards.js";
import {
  STARTER_LETTER_DECK,
  makeBoardFromDeck,
  addLetter,
  removeOneLetter,
  letterOffer,
  deckComposition,
  type Tile,
} from "./run/deck.js";
import {
  blindAtStep,
  blindTarget,
  isWin,
  TOTAL_ANTES,
  TOTAL_BLINDS,
  type Blind,
} from "./run/challenge.js";
import { challengeBoss, type Boss } from "./run/bosses.js";
import { challengeModifier, goldCell, type BoardMod } from "./run/modifiers.js";
import { STAKES, stakeRules, stakeAt, clampStake } from "./run/stakes.js";
import { STARTER_CHARM, randomCharm, type Charm } from "./run/charms.js";
import { RelicCard } from "./RelicCard.js";
import * as meta from "./meta.js";
import { ChallengeShop, type ShopRelic, type ShopCharm } from "./ChallengeShop.js";
import { AnteBanner, ChallengeWin, ChallengeLost } from "./ChallengeScreens.js";
import { sound } from "./sound.js";
import { music } from "./music.js";

const SIZE = 6;
const PLAYS_PER_BLIND = 6;
const DISCARDS_PER_BLIND = 3;
const MAX_CHARMS = 3; // consumable slots
const PRICE: Record<Card["rarity"], number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };
// Charms are one-shot, so they price well under persistent relics.
const CHARM_PRICE: Record<Card["rarity"], number> = { common: 2, uncommon: 3, rare: 5, legendary: 8 };
const ADD_LETTER_COST = 3;
const REMOVE_TILE_COST = 2;
const REROLL_COST = 2;
/** Boss blinds already carry a ×1.8 target; the constraint adds difficulty, so
 *  we soften the target toward the boss's Endless discount — blended, not full,
 *  so a boss blind still out-targets the Big blind of its ante. */
const BOSS_SOFTEN = 0.5;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""); // Transmute letter picker

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

function cellAt(x: number, y: number): number {
  const cell = document.elementFromPoint(x, y)?.closest("[data-cell]");
  return cell ? Number(cell.getAttribute("data-cell")) : -1;
}

/** Advance run state immutably (with the scaling-relic grow hook). */
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

function pickRelics(n = 3): ShopRelic[] {
  const out: ShopRelic[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < DRAFT_POOL.length) {
    const i = Math.floor(Math.random() * DRAFT_POOL.length);
    if (used.has(i)) continue;
    used.add(i);
    const card = DRAFT_POOL[i]!;
    out.push({ card, price: PRICE[card.rarity] });
  }
  return out;
}

/** Two distinct charms for the shop shelf (rarity-weighted, like Endless drops). */
function pickCharms(n = 2): ShopCharm[] {
  const out: ShopCharm[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const charm = randomCharm(Math.floor(Math.random() * 1e9));
    if (used.has(charm.id)) continue;
    used.add(charm.id);
    out.push({ charm, price: CHARM_PRICE[charm.rarity] });
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function ChallengeScreen({ onExit }: { onExit: () => void }) {
  const [dict, setDict] = useState<Dictionary | null>(() => readyDictionary());
  // No free starter relics — you DRAFT your first relic (1 of 3) at the opening.
  const [relics, setRelics] = useState<Card[]>(() => []);
  const [letters, setLetters] = useState<Tile[]>(() => [...STARTER_LETTER_DECK]);
  const [coins, setCoins] = useState(0);
  const [step, setStep] = useState(0); // which blind (0..TOTAL_BLINDS-1)
  // Difficulty stake for this run. Players who've won pick their stake up front;
  // first-timers skip straight to the draft at Stake I.
  const [stake, setStake] = useState(() => clampStake(meta.getStats().topStakeUnlocked));
  const [phase, setPhase] = useState<
    "stake" | "draft" | "draftRelic" | "intro" | "play" | "shop" | "won" | "lost"
  >(() => (meta.getStats().topStakeUnlocked > 1 ? "stake" : "draft"));
  // Opening draft: choose 5 of 10 offered letters to add to the base deck.
  const [offer] = useState(() => letterOffer(10));
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  // Opening draft: choose 1 of 3 relics to seed your engine.
  const [relicOffer] = useState(() => pickRelics(3).map((r) => r.card));

  const [boardSeed, setBoardSeed] = useState(() => Date.now());
  const board = useMemo(() => makeBoardFromDeck(letters, boardSeed, SIZE), [letters, boardSeed]);
  const [boardScore, setBoardScore] = useState(0);
  const [run, setRun] = useState<RunState>(() => makeRunState());
  const [playsLeft, setPlaysLeft] = useState(PLAYS_PER_BLIND);
  const [discardsLeft, setDiscardsLeft] = useState(DISCARDS_PER_BLIND);
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<Breakdown | null>(null);
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const [fly, setFly] = useState<{ id: number; total: number } | null>(null);
  const [shopStock, setShopStock] = useState<ShopRelic[]>([]);
  const [charmStock, setCharmStock] = useState<ShopCharm[]>([]);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [achToast, setAchToast] = useState<string | null>(null);
  // Consumable charms: held in a few slots, tapped to fire, then spent.
  const [charms, setCharms] = useState<Charm[]>(() => [STARTER_CHARM]);
  const [doubleNext, setDoubleNext] = useState(false); // Spotlight: next word ×2
  const [sealsCleared, setSealsCleared] = useState(false); // Locksmith: unseal this board
  const [charmToast, setCharmToast] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({}); // Transmute tile→letter
  const [transmute, setTransmute] = useState<{ charmIdx: number; target: number | null } | null>(null);
  // Per-run salt so boss blinds vary run-to-run (deterministic within a run).
  const [runSalt] = useState(() => Date.now() >>> 0);

  const tracing = useRef(false);
  const ending = useRef(false);

  const blind: Blind = blindAtStep(step) ?? blindAtStep(TOTAL_BLINDS - 1)!;
  // Stake difficulty rules (cumulative). Read throughout the run.
  const rules = useMemo(() => stakeRules(stake), [stake]);
  const playsPerBlind = PLAYS_PER_BLIND + rules.playsDelta;
  // A blind carries a boss on its Boss blind — and, at Black stake+, its Big blind.
  const hasBoss = blind.isBoss || (rules.bossOnBig && blind.indexInAnte === 1);
  // Boss "debuff": word rule and/or sealed tiles. Stable per step within a run;
  // varies across runs via runSalt.
  const boss: Boss | null = useMemo(
    () => (hasBoss ? challengeBoss(blind.step ^ runSalt) : null),
    [hasBoss, blind.step, runSalt],
  );
  // Target = stake-scaled blind target, then softened for a boss (blended so it
  // still out-targets the previous blind in the ante — the constraint is the rest).
  const target = useMemo(() => {
    const base = Math.round(blind.target * rules.targetMult);
    if (!boss) return base;
    const softened = Math.round(base * (BOSS_SOFTEN + (1 - BOSS_SOFTEN) * boss.targetMult));
    const prev = Math.round(blindTarget(blind.ante, Math.max(0, blind.indexInAnte - 1)) * rules.targetMult);
    return Math.max(prev + 1, softened);
  }, [boss, blind.target, blind.ante, blind.indexInAnte, rules.targetMult]);
  // Sealed cells for a boss board (unless a charm shattered them this blind).
  const blocked = useMemo(
    () => new Set(sealsCleared ? [] : boss?.blocked?.(SIZE, boardSeed) ?? []),
    [boss, boardSeed, sealsCleared],
  );
  // Regular (non-boss) blinds can roll a scoring twist. Stable per blind within a
  // run; a boss blind never carries one (the boss takes the slot).
  const boardMod: BoardMod | null = useMemo(
    () => (blind.isBoss ? null : challengeModifier(blind.step ^ runSalt)),
    [blind.isBoss, blind.step, runSalt],
  );
  // The modifier's transient scoring card rides along with the relics this blind only.
  const effectiveDeck = useMemo(
    () => (boardMod?.card ? [...relics, boardMod.card] : relics),
    [relics, boardMod],
  );
  // Gold tile: a modifier can light one cell; a word tracing it scores ×goldMult.
  const goldTile = useMemo(
    () => (boardMod?.goldTile ? goldCell(SIZE, boardSeed, blocked) : -1),
    [boardMod, boardSeed, blocked],
  );
  const goldMult = boardMod?.goldMult ?? 2;
  // The board the player actually spells on: deck letters with Transmute overrides.
  const effBoard: Board = useMemo(() => {
    if (Object.keys(overrides).length === 0) return board;
    return {
      ...board,
      cells: board.cells.map((c, i) => {
        const o = overrides[i];
        return o ? { label: o.toUpperCase(), value: o.toLowerCase() } : c;
      }),
    };
  }, [board, overrides]);
  const ready = dict !== null;
  const pct = Math.min(100, Math.round((boardScore / target) * 100));

  useEffect(() => {
    if (!dict) loadDictionary().then(setDict);
  }, [dict]);

  useEffect(() => {
    music.start();
    return () => music.stop();
  }, []);

  // Surface a freshly-unlocked achievement as a toast.
  const notifyAch = (fresh: string[]) => {
    if (!fresh.length) return;
    const a = meta.ACHIEVEMENTS.find((x) => x.id === fresh[0]);
    if (!a) return;
    const msg = `🏆 ${a.name}`;
    setAchToast(msg);
    window.setTimeout(() => setAchToast((m) => (m === msg ? null : m)), 2400);
    sound.levelClear();
  };

  // Meta/achievements: count this Challenge run + flush play-time on unmount.
  useEffect(() => {
    notifyAch(meta.recordRunStart());
    const start = Date.now();
    return () => {
      meta.addTimePlayed((Date.now() - start) / 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Relic-ownership achievements (full-house / curator / stacking) as relics change.
  useEffect(() => {
    notifyAch(meta.recordDeck(relics.map((c) => c.id)));
    meta.markSeen(relics.map((c) => `relic:${c.id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relics]);

  // Codex discovery gating: mark content SEEN as it's offered or becomes active.
  useEffect(() => {
    meta.markSeen(relicOffer.map((c) => `relic:${c.id}`));
  }, [relicOffer]);
  useEffect(() => {
    meta.markSeen(shopStock.map((e) => `relic:${e.card.id}`));
  }, [shopStock]);
  useEffect(() => {
    meta.markSeen(charms.map((c) => `charm:${c.id}`));
  }, [charms]);
  useEffect(() => {
    meta.markSeen(charmStock.map((e) => `charm:${e.charm.id}`));
  }, [charmStock]);
  useEffect(() => {
    if (boss) meta.markSeen([`boss:${boss.id}`]);
  }, [boss]);
  useEffect(() => {
    if (boardMod) meta.markSeen([`mod:${boardMod.id}`]);
  }, [boardMod]);

  // Opening draft → add the 5 chosen letters, then on to the relic pick.
  const confirmDraft = () => {
    const chosen = [...picked].map((i) => offer[i]!).filter(Boolean);
    setLetters((d) => [...d, ...chosen]);
    setPhase("draftRelic");
  };
  // Relic pick → seed the run with the chosen relic, then into the first ante.
  const chooseRelic = (card: Card) => {
    setRelics([card]);
    sound.relicShimmer();
    setPhase("intro");
  };
  const togglePick = (i: number) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else if (next.size < 5) next.add(i);
      return next;
    });

  // ── Blind lifecycle ─────────────────────────────────────────────────────────
  const beginBlind = () => {
    ending.current = false;
    setBoardSeed(Date.now());
    setBoardScore(0);
    setPlaysLeft(playsPerBlind);
    setDiscardsLeft(DISCARDS_PER_BLIND);
    setFound(new Set());
    setPath([]);
    setDoubleNext(false); // per-blind charm effects reset
    setSealsCleared(false);
    setOverrides({});
    setTransmute(null);
    setRun((r) => ({ ...r, boardWords: 0, lastFirst: null }));
    setPhase("play");
  };

  const clearBlind = () => {
    if (ending.current) return;
    ending.current = true;
    // Stake economy: interest can be switched off; rewards can be scaled down.
    const interest = rules.interest ? Math.min(5, Math.floor(coins / 5)) : 0;
    const reward = Math.round(blind.reward * rules.rewardMult);
    setCoins((c) => c + reward + interest);
    sound.levelClear();
    if (isWin(step + 1)) {
      meta.recordChallengeWin(stake); // 🏅 Challenger + unlocks the next stake
      setPhase("won"); // cleared the final boss
      return;
    }
    // Boss spoils: clearing a boss blind drops a charm if a slot is free.
    if (boss && charms.length < MAX_CHARMS) {
      const got = randomCharm(Date.now());
      setCharms((cs) => (cs.length < MAX_CHARMS ? [...cs, got] : cs));
      const msg = `✦ ${got.name}`;
      setCharmToast(msg);
      window.setTimeout(() => setCharmToast((m) => (m === msg ? null : m)), 1800);
    }
    setShopStock(pickRelics());
    setCharmStock(pickCharms());
    setPhase("shop");
  };

  const fail = () => {
    if (ending.current) return;
    ending.current = true;
    setPhase("lost");
    sound.timeUp();
  };

  const leaveShop = () => {
    setStep((s) => s + 1);
    setPhase("intro");
  };

  // ── Play ────────────────────────────────────────────────────────────────────
  const extendTo = (i: number) => {
    if (i < 0 || phase !== "play" || blocked.has(i)) return;
    setPath((p) => {
      let np = p;
      if (p.length && p[p.length - 1] === i) np = p;
      else if (p.length >= 2 && p[p.length - 2] === i) np = p.slice(0, -1);
      else if (canExtend(p, i, SIZE)) np = [...p, i];
      if (np.length > p.length) sound.tap();
      return np;
    });
  };

  const submit = () => {
    tracing.current = false;
    const cur = path;
    setPath([]);
    if (transmute || cur.length < MIN_WORD_LEN || !dict) return;
    const word = pathWord(cur, effBoard);
    if (word.length < MIN_WORD_LEN || found.has(word) || !dict.has(word)) {
      sound.invalid();
      buzz(25);
      return;
    }
    // Boss word rule: the word must satisfy the constraint to score.
    if (boss?.allow && !boss.allow(word, found)) {
      sound.invalid();
      buzz([0, 22, 40, 22]);
      return;
    }
    const raw = scoreWord(word, effectiveDeck, run);
    const triggers = [...raw.triggers];
    let total = raw.total;
    // Gold tile: a word tracing through the lit cell scores ×goldMult this blind.
    if (goldTile >= 0 && cur.includes(goldTile)) {
      total = Math.round(total * goldMult);
      triggers.push({ card: "Golden Tile", detail: `×${goldMult}` });
    }
    // Spotlight/Limelight charm: this word (only) scores ×2, then it's spent.
    if (doubleNext) {
      total *= 2;
      triggers.push({ card: "Spotlight", detail: "×2" });
      setDoubleNext(false);
    }
    const b: Breakdown = { ...raw, total, triggers };
    setFound((f) => new Set(f).add(word));
    setBoardScore((s) => s + total);
    setRun((r) => commit(r, b, effectiveDeck));
    setToast(b);
    window.setTimeout(() => setToast((t) => (t === b ? null : t)), 1400);
    setFlash(new Set(b.triggers.map((t) => t.card)));
    window.setTimeout(() => setFlash(new Set()), 720);
    setFly({ id: Date.now(), total });
    buzz(12);
    sound.found(Math.min(11, Math.round(total / 40) + 1));
    if (b.triggers.length > 0) sound.relicShimmer();
    notifyAch([
      ...meta.recordWord(b.props.len, total, b.props.rareLetters),
      ...meta.recordMult(run.permaMult + b.permaMultAdd),
    ]);

    const remaining = playsLeft - 1;
    setPlaysLeft(remaining);
    const survived = boardScore + total >= target;
    if (survived) {
      window.setTimeout(clearBlind, 900);
    } else if (remaining <= 0) {
      window.setTimeout(fail, 1000);
    }
  };

  const discard = () => {
    if (phase !== "play" || discardsLeft <= 0 || transmute) return;
    setDiscardsLeft((d) => d - 1);
    setBoardSeed(Date.now());
    setOverrides({}); // overrides belonged to the old letters
    setFound(new Set());
    setPath([]);
    sound.tap();
    buzz(12);
  };

  // Fire a charm: apply its one-shot effect, then consume it. Play-phase only.
  const useCharm = (charm: Charm, idx: number) => {
    if (phase !== "play" || transmute) return; // one interaction at a time
    const e = charm.effect;
    // Transmute is interactive (pick a tile → pick a letter); consumed on completion.
    if (e.kind === "transmute") {
      setTransmute({ charmIdx: idx, target: null });
      buzz(12);
      return;
    }
    switch (e.kind) {
      case "plays":
        setPlaysLeft((p) => p + e.count);
        break;
      case "reroll":
        setBoardSeed(Date.now()); // new letters (target/score carry over)
        setOverrides({});
        setFound(new Set());
        setPath([]);
        break;
      case "doubleNext":
        setDoubleNext(true);
        break;
      case "clearSeals":
        setSealsCleared(true);
        break;
      case "permaMult":
        setRun((r) => ({ ...r, permaMult: r.permaMult + e.amount }));
        break;
    }
    setCharms((cs) => cs.filter((_, i) => i !== idx));
    const msg = `✦ ${charm.name}`;
    setCharmToast(msg);
    window.setTimeout(() => setCharmToast((m) => (m === msg ? null : m)), 1400);
    sound.found(4);
    buzz(20);
  };

  // Transmute step 2: a letter was chosen for the selected tile — override it,
  // consume the charm, and close the flow.
  const applyTransmute = (letter: string) => {
    if (!transmute || transmute.target === null) return;
    const tgt = transmute.target;
    const charmIdx = transmute.charmIdx;
    setOverrides((o) => ({ ...o, [tgt]: letter.toLowerCase() }));
    setCharms((cs) => cs.filter((_, i) => i !== charmIdx));
    setTransmute(null);
    setPath([]);
    const msg = "✦ Transmute";
    setCharmToast(msg);
    window.setTimeout(() => setCharmToast((m) => (m === msg ? null : m)), 1400);
    sound.found(4);
    buzz(20);
  };

  // ── Shop handlers ─────────────────────────────────────────────────────────────
  const buyRelic = (card: Card) => {
    const price = PRICE[card.rarity];
    if (coins < price) return;
    setCoins((c) => c - price);
    setRelics((d) => [...d, card]);
    // Consume ONE matching offer (allows buying dup copies across shops → stacking).
    setShopStock((s) => {
      const i = s.findIndex((e) => e.card === card);
      return i < 0 ? s : [...s.slice(0, i), ...s.slice(i + 1)];
    });
    sound.coin();
  };
  const buyCharm = (charm: Charm) => {
    const price = CHARM_PRICE[charm.rarity];
    if (coins < price || charms.length >= MAX_CHARMS) return;
    setCoins((c) => c - price);
    setCharms((cs) => (cs.length < MAX_CHARMS ? [...cs, charm] : cs));
    setCharmStock((s) => {
      const i = s.findIndex((e) => e.charm === charm);
      return i < 0 ? s : [...s.slice(0, i), ...s.slice(i + 1)];
    });
    sound.coin();
  };
  const addTile = (letter: string) => {
    if (coins < ADD_LETTER_COST) return;
    setCoins((c) => c - ADD_LETTER_COST);
    setLetters((d) => addLetter(d, letter));
    sound.coin();
  };
  const removeTile = (letter: Tile) => {
    if (coins < REMOVE_TILE_COST) return;
    const next = removeOneLetter(letters, letter);
    if (next.length === letters.length) return; // nothing removed (at the floor / absent)
    setCoins((c) => c - REMOVE_TILE_COST);
    setLetters(next);
    sound.coin();
  };
  const reroll = () => {
    if (coins < REROLL_COST) return;
    setCoins((c) => c - REROLL_COST);
    setShopStock(pickRelics());
    setCharmStock(pickCharms());
    sound.tap();
  };

  const cur = pathWord(path, effBoard);
  const preview =
    cur.length >= MIN_WORD_LEN && dict && dict.has(cur) && !found.has(cur)
      ? scoreWord(cur, effectiveDeck, run)
      : null;
  const inspectAccrued = inspect?.accrued?.(run) ?? null;

  // ── Overlays ─────────────────────────────────────────────────────────────────
  if (phase === "stake") {
    const unlocked = meta.getStats().topStakeUnlocked;
    const sel = stakeAt(stake);
    return (
      <div className="menu-veil">
        <div className="ldraft-card">
          <div className="menu-title">Choose your stake</div>
          <div className="confirm-sub">Each stake stacks a harder rule on the last. Win a run to unlock the next.</div>
          <div className="stake-row">
            {STAKES.map((st) => {
              const locked = st.id > unlocked;
              return (
                <button
                  key={st.id}
                  type="button"
                  className={`stake-chip${st.id === stake ? " sel" : ""}${locked ? " locked" : ""}`}
                  style={{ ["--stake" as string]: st.color }}
                  disabled={locked}
                  onClick={() => setStake(st.id)}
                  aria-pressed={st.id === stake}
                  title={locked ? "Locked — win at the previous stake" : `${st.name} — ${st.blurb}`}
                >
                  <span className="stake-dot" aria-hidden="true" />
                  <span className="stake-chip-name">{locked ? "🔒" : st.name}</span>
                </button>
              );
            })}
          </div>
          <div className="stake-detail">
            <b>{sel.name} Stake</b>
            <span>{sel.blurb}</span>
          </div>
          <button className="btn primary" onClick={() => setPhase("draft")}>
            Begin at {sel.name} →
          </button>
        </div>
      </div>
    );
  }
  if (phase === "draft") {
    const comp = deckComposition(letters);
    return (
      <div className="menu-veil">
        <div className="ldraft-card">
          <div className="menu-title">Build your opening deck</div>
          <div className="confirm-sub">
            You start with one of every letter. Choose 5 more to add — double up on vowels and letters you love.
          </div>
          <div className="ldraft-deck" aria-label="your current deck">
            {comp.map(({ letter, count }) => (
              <span key={letter} className="ldraft-chip">
                {letter === "qu" ? "Qu" : letter.toUpperCase()}
                {count > 1 && <b>×{count}</b>}
              </span>
            ))}
          </div>
          <div className="ldraft-label">Add 5 · {picked.size}/5</div>
          <div className="letterpick-grid">
            {offer.map((l, i) => (
              <button
                key={i}
                type="button"
                className={`letterpick-key${picked.has(i) ? " picked" : ""}`}
                aria-pressed={picked.has(i)}
                onClick={() => togglePick(i)}
              >
                {l === "qu" ? "Qu" : l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={picked.size !== 5} onClick={confirmDraft}>
            Add 5 &amp; continue →
          </button>
        </div>
      </div>
    );
  }
  if (phase === "draftRelic") {
    return (
      <div className="menu-veil">
        <div className="ldraft-card">
          <div className="menu-title">Choose your first relic</div>
          <div className="confirm-sub">
            One of three — the seed of your engine. You&rsquo;ll draft the rest from the shop between blinds.
          </div>
          <div className="relicdraft-row">
            {relicOffer.map((c) => (
              <button key={c.id} type="button" className="relicdraft-pick" onClick={() => chooseRelic(c)}>
                <RelicCard card={c} mode="full" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (phase === "intro") {
    return (
      <AnteBanner
        blind={blind}
        totalAntes={TOTAL_ANTES}
        onStart={beginBlind}
        bossRule={boss ? { name: boss.name, blurb: boss.blurb } : null}
        target={target}
      />
    );
  }
  if (phase === "won") {
    return (
      <ChallengeWin
        coins={coins}
        onExit={onExit}
        stakeName={stakeAt(stake).name}
        nextStakeName={stake < STAKES.length ? stakeAt(stake + 1).name : null}
      />
    );
  }
  if (phase === "lost") {
    return <ChallengeLost blind={blind} onExit={onExit} />;
  }
  if (phase === "shop") {
    return (
      <ChallengeShop
        coins={coins}
        deck={letters}
        relics={shopStock}
        charms={charmStock}
        charmSlotsFull={charms.length >= MAX_CHARMS}
        addLetterCost={ADD_LETTER_COST}
        removeTileCost={REMOVE_TILE_COST}
        rerollCost={REROLL_COST}
        onBuyRelic={buyRelic}
        onBuyCharm={buyCharm}
        onAddLetter={addTile}
        onRemoveTile={removeTile}
        onReroll={reroll}
        onContinue={leaveShop}
      />
    );
  }

  // ── Play screen ───────────────────────────────────────────────────────────────
  return (
    <div className="run">
      <header className="hud-top">
        <button className="icon-btn" aria-label="Exit" onClick={onExit}>
          ✕
        </button>
        <div className="hud-score">
          <div className="hud-score-line">
            <span className="hud-score-num" key={boardScore}>{boardScore}</span>
            <span className="hud-score-target">/ {target}</span>
          </div>
          {run.permaMult > 0 && <span className="hud-mult">×{(1 + run.permaMult).toFixed(1)} mult</span>}
          {fly && (
            <span key={fly.id} className="score-fly">
              +{fly.total}
            </span>
          )}
        </div>
        <div className="coins" key={coins}>
          🪙 {coins}
        </div>
      </header>

      <div className="target-bar">
        <div className="target-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="resource-row">
        <span className={`hud-board${blind.isBoss ? " boss" : ""}`}>
          Ante {blind.ante} · {blind.isBoss ? "☠ " : ""}
          {blind.name}
          {stake > 1 && (
            <span className="stake-badge" style={{ ["--stake" as string]: stakeAt(stake).color }}>
              {stakeAt(stake).name}
            </span>
          )}
        </span>
        <span className="plays-pips" aria-label={`${playsLeft} of ${playsPerBlind} plays left`}>
          {Array.from({ length: playsPerBlind }, (_, i) => (
            <span key={i} className={`pip${i < playsLeft ? " on" : ""}`} />
          ))}
        </span>
        <button className="discard-btn" disabled={phase !== "play" || discardsLeft <= 0} onClick={discard}>
          ↻ {discardsLeft}
        </button>
      </div>

      <div className="deck-wrap">
        <span className="deck-label">◈ relics · {relics.length} · tap to inspect · 🎴 deck {letters.length}</span>
        <div className="deck">
          {relics.map((c, i) => (
            <RelicCard key={c.id + i} card={c} mode="chip" flash={flash.has(c.name)} onClick={() => setInspect(c)} />
          ))}
        </div>
      </div>

      {boss && phase === "play" && (
        <div className="boss-banner">
          <span className="boss-name">☠ boss · {boss.name}</span>
          <span className="boss-blurb">{boss.blurb}</span>
        </div>
      )}

      {boardMod && phase === "play" && (
        <div className={`mod-banner mod-${boardMod.tone}`}>
          <span className="mod-name">
            {boardMod.tone === "boon" ? "✦" : "✧"} {boardMod.name}
          </span>
          <span className="mod-blurb">{boardMod.blurb}</span>
        </div>
      )}

      {/* Charms — one-shot consumables. Tap to fire (spends it). */}
      {charms.length > 0 && (
        <div className="charm-tray">
          <span className="charm-label">✦ charms</span>
          <div className="charm-row">
            {charms.map((ch, i) => (
              <button
                key={ch.id + i}
                className={`charm charm--${ch.rarity}`}
                disabled={phase !== "play" || !!transmute}
                onClick={() => useCharm(ch, i)}
                title={`${ch.name} — ${ch.blurb}`}
              >
                <span className="charm-name">{ch.name}</span>
                <span className="charm-blurb">{ch.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="breakdown">
        {toast ? (
          <span className="bd-toast">
            <b>{toast.word.toUpperCase()}</b> {toast.chips} × {round1(toast.mult)} = <b>{toast.total}</b>
            {toast.triggers.length > 0 && (
              <small>{toast.triggers.map((t) => `${t.card} ${t.detail}`).join(" · ")}</small>
            )}
          </span>
        ) : preview ? (
          <span className="bd-live">
            {preview.chips} × {round1(preview.mult)} = <b>{preview.total}</b>
            {preview.triggers.length > 0 && (
              <small>{preview.triggers.map((t) => `${t.card} ${t.detail}`).join(" · ")}</small>
            )}
          </span>
        ) : (
          <span className="bd-hint">trace a word — dealt from your deck</span>
        )}
      </div>

      {achToast && <div className="ach-toast" key={achToast}>{achToast} <span className="ach-toast-sub">unlocked</span></div>}
      {charmToast && <div className="charm-toast" key={charmToast}>{charmToast}</div>}
      {transmute && transmute.target === null && (
        <div className="charm-toast transmute-hint">🔀 Transmute · tap a tile to change it</div>
      )}

      {inspect && (
        <div className="menu-veil" onClick={() => setInspect(null)}>
          <div className="inspect-card" onClick={(e) => e.stopPropagation()}>
            <RelicCard card={inspect} mode="full" />
            {inspectAccrued ? (
              <div className="accrued">📈 {inspectAccrued}</div>
            ) : (
              <div className="accrued accrued--none">no bonus banked yet this run</div>
            )}
            <button className="btn primary" onClick={() => setInspect(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="board-wrap" style={{ width: "min(var(--run-w, 92vw), 520px, calc(100svh - 380px))" }}>
        <div
          className={`board${transmute && transmute.target === null ? " transmuting" : ""}`}
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          onPointerDown={(e) => {
            if (phase !== "play") return;
            // Transmute: first tap picks the tile to change (no tracing).
            if (transmute && transmute.target === null) {
              const cell = cellAt(e.clientX, e.clientY);
              if (cell >= 0 && !blocked.has(cell)) setTransmute({ ...transmute, target: cell });
              return;
            }
            if (transmute) return; // letter picker open — ignore the board
            (e.target as Element).releasePointerCapture?.(e.pointerId);
            tracing.current = true;
            extendTo(cellAt(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => tracing.current && extendTo(cellAt(e.clientX, e.clientY))}
          onPointerUp={submit}
          onPointerCancel={submit}
          onPointerLeave={() => tracing.current && submit()}
        >
          {effBoard.cells.map((c, i) => {
            const order = path.indexOf(i);
            const isBlocked = blocked.has(i);
            const isMorphed = overrides[i] !== undefined;
            const isGold = i === goldTile;
            return (
              <div
                key={i}
                data-cell={i}
                className={`tile${order >= 0 ? " on" : ""}${order === path.length - 1 ? " head" : ""}${isBlocked ? " blocked" : ""}${isGold ? " gold" : ""}${isMorphed ? " morphed" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                {isBlocked ? "" : c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transmute step 2 — pick the new letter for the chosen tile */}
      {transmute && transmute.target !== null && (
        <div className="menu-veil" onClick={() => setTransmute(null)}>
          <div className="letterpick" onClick={(e) => e.stopPropagation()}>
            <div className="menu-title">Change “{effBoard.cells[transmute.target]?.label}” to…</div>
            <div className="letterpick-grid">
              {ALPHABET.map((ch) => (
                <button key={ch} className="letterpick-key" onClick={() => applyTransmute(ch)}>
                  {ch}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => setTransmute(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {boardScore >= target && phase === "play" && (
        <button className="btn primary next-btn" onClick={clearBlind}>
          Target hit — bank &amp; continue →
        </button>
      )}

      {!ready && <div className="loading-veil">gathering the dictionary…</div>}
    </div>
  );
}

export default ChallengeScreen;
