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
import { canExtend, pathWord, MIN_WORD_LEN } from "./board.js";
import { readyDictionary, loadDictionary, type Dictionary } from "./dictionary.js";
import { scoreWord, makeRunState, type RunState, type Card, type Breakdown } from "./run/engine.js";
import { STARTER_DECK, DRAFT_POOL } from "./run/cards.js";
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
  isWin,
  TOTAL_ANTES,
  TOTAL_BLINDS,
  type Blind,
} from "./run/challenge.js";
import { RelicCard } from "./RelicCard.js";
import * as meta from "./meta.js";
import { ChallengeShop, type ShopRelic } from "./ChallengeShop.js";
import { AnteBanner, ChallengeWin, ChallengeLost } from "./ChallengeScreens.js";
import { sound } from "./sound.js";
import { music } from "./music.js";

const SIZE = 5;
const PLAYS_PER_BLIND = 6;
const DISCARDS_PER_BLIND = 3;
const PRICE: Record<Card["rarity"], number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };
const ADD_LETTER_COST = 3;
const REMOVE_TILE_COST = 2;
const REROLL_COST = 2;

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

const round1 = (n: number) => Math.round(n * 10) / 10;

export function ChallengeScreen({ onExit }: { onExit: () => void }) {
  const [dict, setDict] = useState<Dictionary | null>(() => readyDictionary());
  const [relics, setRelics] = useState<Card[]>(() => [...STARTER_DECK]);
  const [letters, setLetters] = useState<Tile[]>(() => [...STARTER_LETTER_DECK]);
  const [coins, setCoins] = useState(0);
  const [step, setStep] = useState(0); // which blind (0..TOTAL_BLINDS-1)
  const [phase, setPhase] = useState<"draft" | "intro" | "play" | "shop" | "won" | "lost">("draft");
  // Opening draft: choose 5 of 10 offered letters to add to the base deck.
  const [offer] = useState(() => letterOffer(10));
  const [picked, setPicked] = useState<Set<number>>(() => new Set());

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
  const [inspect, setInspect] = useState<Card | null>(null);
  const [achToast, setAchToast] = useState<string | null>(null);

  const tracing = useRef(false);
  const ending = useRef(false);

  const blind: Blind = blindAtStep(step) ?? blindAtStep(TOTAL_BLINDS - 1)!;
  const target = blind.target;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relics]);

  // Opening draft → add the 5 chosen letters, then into the first ante.
  const confirmDraft = () => {
    const chosen = [...picked].map((i) => offer[i]!).filter(Boolean);
    setLetters((d) => [...d, ...chosen]);
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
    setPlaysLeft(PLAYS_PER_BLIND);
    setDiscardsLeft(DISCARDS_PER_BLIND);
    setFound(new Set());
    setPath([]);
    setRun((r) => ({ ...r, boardWords: 0, lastFirst: null }));
    setPhase("play");
  };

  const clearBlind = () => {
    if (ending.current) return;
    ending.current = true;
    const interest = Math.min(5, Math.floor(coins / 5));
    setCoins((c) => c + blind.reward + interest);
    sound.levelClear();
    if (isWin(step + 1)) {
      meta.recordChallengeWin(); // 🏅 Challenger (the win screen is the celebration)
      setPhase("won"); // cleared the final boss
      return;
    }
    setShopStock(pickRelics());
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
    if (i < 0 || phase !== "play") return;
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
    if (cur.length < MIN_WORD_LEN || !dict) return;
    const word = pathWord(cur, board);
    if (word.length < MIN_WORD_LEN || found.has(word) || !dict.has(word)) {
      sound.invalid();
      buzz(25);
      return;
    }
    const b = scoreWord(word, relics, run);
    const total = b.total;
    setFound((f) => new Set(f).add(word));
    setBoardScore((s) => s + total);
    setRun((r) => commit(r, b, relics));
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
    if (phase !== "play" || discardsLeft <= 0) return;
    setDiscardsLeft((d) => d - 1);
    setBoardSeed(Date.now());
    setFound(new Set());
    setPath([]);
    sound.tap();
    buzz(12);
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
    sound.tap();
  };

  const cur = pathWord(path, board);
  const preview =
    cur.length >= MIN_WORD_LEN && dict && dict.has(cur) && !found.has(cur) ? scoreWord(cur, relics, run) : null;
  const inspectAccrued = inspect?.accrued?.(run) ?? null;

  // ── Overlays ─────────────────────────────────────────────────────────────────
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
            Add 5 &amp; begin →
          </button>
        </div>
      </div>
    );
  }
  if (phase === "intro") {
    return <AnteBanner blind={blind} totalAntes={TOTAL_ANTES} onStart={beginBlind} />;
  }
  if (phase === "won") {
    return <ChallengeWin coins={coins} onExit={onExit} />;
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
        addLetterCost={ADD_LETTER_COST}
        removeTileCost={REMOVE_TILE_COST}
        rerollCost={REROLL_COST}
        onBuyRelic={buyRelic}
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
        </span>
        <span className="plays-pips" aria-label={`${playsLeft} of ${PLAYS_PER_BLIND} plays left`}>
          {Array.from({ length: PLAYS_PER_BLIND }, (_, i) => (
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
          className="board"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          onPointerDown={(e) => {
            if (phase !== "play") return;
            (e.target as Element).releasePointerCapture?.(e.pointerId);
            tracing.current = true;
            extendTo(cellAt(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => tracing.current && extendTo(cellAt(e.clientX, e.clientY))}
          onPointerUp={submit}
          onPointerCancel={submit}
          onPointerLeave={() => tracing.current && submit()}
        >
          {board.cells.map((c, i) => {
            const order = path.indexOf(i);
            return (
              <div
                key={i}
                data-cell={i}
                className={`tile${order >= 0 ? " on" : ""}${order === path.length - 1 ? " head" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

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
