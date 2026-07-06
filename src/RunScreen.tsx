/**
 * RunScreen — the roguelike mode (M1+M2). Play a board, race a TIME budget your
 * cards refill, beat the rising target to survive, then draft 1-of-3 cards to
 * grow your engine. The first run ever hands you a pre-stacked "broken" tutorial
 * deck so you feel the snowball immediately; every run after starts fresh and
 * you earn your engine.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { makeBoard, canExtend, pathWord, MIN_WORD_LEN, type Board } from "./board.js";
import { readyDictionary, loadDictionary, type Dictionary } from "./dictionary.js";
import { scoreWord, makeRunState, type RunState, type Card, type Breakdown } from "./run/engine.js";
import { STARTER_DECK, TUTORIAL_DECK, DRAFT_POOL } from "./run/cards.js";
import { randomBoss, type Boss } from "./run/bosses.js";
import { randomModifier, goldCell, type BoardMod } from "./run/modifiers.js";
import { STARTER_CHARM, randomCharm, type Charm } from "./run/charms.js";
import { RelicCard } from "./RelicCard.js";
import { sound } from "./sound.js";
import { music } from "./music.js";

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

const SIZE = 5;
const TIME_BUDGET = 90;
const MAX_CHARMS = 3; // consumable slots
// Target curve — eased from 1.7 to 1.45 so the mid-run wall (boards 4–6) is
// reachable with a decent engine. board1≈100, 3≈210, 5≈442, 6(boss)≈641.
const targetFor = (board: number) => Math.round(100 * Math.pow(1.45, board - 1));

function cellAt(x: number, y: number): number {
  const cell = document.elementFromPoint(x, y)?.closest("[data-cell]");
  return cell ? Number(cell.getAttribute("data-cell")) : -1;
}

/** Advance run state immutably when a word is played (keeps React re-rendering). */
function commit(run: RunState, b: Breakdown): RunState {
  const seenFirst = new Set(run.seenFirst);
  seenFirst.add(b.word[0] ?? "");
  return {
    ...run,
    boardWords: run.boardWords + 1,
    runWords: run.runWords + 1,
    lastFirst: b.word[0] ?? null,
    permaMult: run.permaMult + b.permaMultAdd,
    seenFirst,
  };
}

function pickN(deck: readonly Card[], n = 3): Card[] {
  const owned = new Set(deck.map((c) => c.id));
  const pool = DRAFT_POOL.filter((c) => !owned.has(c.id));
  const src = pool.length >= n ? pool : [...pool, ...DRAFT_POOL]; // fall back to dupes late
  const out: Card[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < src.length) {
    const i = Math.floor(Math.random() * src.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(src[i]!);
  }
  return out;
}

const PRICE: Record<Card["rarity"], number> = { common: 4, uncommon: 6, rare: 8, legendary: 12 };

export function RunScreen({ onExit }: { onExit: () => void }) {
  const firstRun = useRef(localStorage.getItem("lexicon:hasRun") !== "1");
  useEffect(() => {
    localStorage.setItem("lexicon:hasRun", "1");
  }, []);

  const [dict, setDict] = useState<Dictionary | null>(() => readyDictionary());
  const [deck, setDeck] = useState<Card[]>(() => [...(firstRun.current ? TUTORIAL_DECK : STARTER_DECK)]);
  const [run, setRun] = useState<RunState>(() => makeRunState());
  const [boardIdx, setBoardIdx] = useState(1);
  const [boardSeed, setBoardSeed] = useState(() => Date.now());
  const board: Board = useMemo(() => makeBoard(boardSeed, SIZE), [boardSeed]);
  // Board modifier — a per-board twist on regular boards (a boss takes the slot
  // instead). The first-ever (tutorial) board stays plain so the snowball reads clean.
  const [boardMod, setBoardMod] = useState<BoardMod | null>(() =>
    firstRun.current ? null : randomModifier(boardSeed),
  );
  const [boardScore, setBoardScore] = useState(0);
  const [runScore, setRunScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => TIME_BUDGET + (boardMod?.startTimeBonus ?? 0));
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  // A real run opens with a 3-way choice; the first-ever run skips it (tutorial deck).
  const [phase, setPhase] = useState<"opening" | "play" | "draft" | "shop" | "dead">(() =>
    firstRun.current ? "play" : "opening",
  );
  const [draft, setDraft] = useState<Card[]>(() => (firstRun.current ? [] : pickN(STARTER_DECK)));
  const [coins, setCoins] = useState(0);
  const [shopStock, setShopStock] = useState<Card[]>([]);
  const [toast, setToast] = useState<Breakdown | null>(null);
  // Relic names that lit up on the last word (for the trigger-glow) + a score-fly.
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const [fly, setFly] = useState<{ id: number; total: number } | null>(null);
  const [boss, setBoss] = useState<Boss | null>(null);
  // Consumable charms: held in a few slots, tapped to fire, then used up.
  const [charms, setCharms] = useState<Charm[]>(() => [STARTER_CHARM]);
  const [doubleNext, setDoubleNext] = useState(false); // Spotlight charm: next word ×2
  const [sealsCleared, setSealsCleared] = useState(false); // Locksmith charm: unseal this board
  const [charmToast, setCharmToast] = useState<string | null>(null);
  const blocked = useMemo(
    () => new Set(sealsCleared ? [] : boss?.blocked?.(SIZE, boardSeed) ?? []),
    [boss, boardSeed, sealsCleared],
  );
  // Gold tile — a modifier can light one cell; a word tracing through it scores ×goldMult.
  const goldTile = useMemo(
    () => (boardMod?.goldTile && !boss ? goldCell(SIZE, boardSeed, blocked) : -1),
    [boardMod, boss, boardSeed, blocked],
  );
  const goldMult = boardMod?.goldMult ?? 2;
  // The modifier's transient scoring card rides along with the deck, this board only.
  const effectiveDeck = useMemo(
    () => (boardMod?.card ? [...deck, boardMod.card] : deck),
    [deck, boardMod],
  );
  // Tap a relic to inspect it (rules + live accrued value).
  const [inspect, setInspect] = useState<Card | null>(null);
  // Meta: deepest board ever reached (persists across runs).
  const bestDepth = useRef(Number(localStorage.getItem("lexicon:bestDepth") ?? 0));
  const [newRecord, setNewRecord] = useState(false);
  const tracing = useRef(false);
  // Boss boards discount the target — the constraint IS the difficulty, so the
  // score bar drops to keep them hard-but-passable (never an unwinnable wall).
  const target = Math.round(targetFor(boardIdx) * (boss?.targetMult ?? 1));
  const ready = dict !== null;
  const running = ready && phase === "play";

  useEffect(() => {
    if (!dict) loadDictionary().then(setDict);
  }, [dict]);

  // Ambient bed for the run; stops when we leave.
  useEffect(() => {
    music.start();
    return () => music.stop();
  }, []);

  // The time economy: tick down while playing; hit 0 → board ends.
  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      if (boardScore >= target) {
        clearBoard();
      } else {
        die();
      }
      return;
    }
    if (timeLeft <= 10) sound.tick();
    const id = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, running]);

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
    if (cur.length < MIN_WORD_LEN || !dict) return;
    const word = pathWord(cur, board);
    if (word.length < MIN_WORD_LEN || found.has(word) || !dict.has(word)) {
      sound.invalid();
      buzz(25);
      return;
    }
    if (boss?.allow && !boss.allow(word, found)) {
      sound.invalid();
      buzz([0, 22, 40, 22]);
      return;
    }
    const raw = scoreWord(word, effectiveDeck, run);
    const triggers = [...raw.triggers];
    // Gold tile: a word tracing through the lit cell scores ×goldMult this board.
    const goldHit = goldTile >= 0 && cur.includes(goldTile);
    let total = raw.total;
    if (goldHit) {
      total = Math.round(total * goldMult);
      triggers.push({ card: "Golden Tile", detail: `×${goldMult}` });
    }
    // Spotlight charm: this word (only) scores ×2, then the charm is spent.
    if (doubleNext) {
      total = total * 2;
      triggers.push({ card: "Spotlight", detail: "×2" });
      setDoubleNext(false);
    }
    const b: Breakdown = { ...raw, total, triggers };
    setFound((f) => new Set(f).add(word));
    setBoardScore((s) => s + total);
    setRunScore((s) => s + total);
    setTimeLeft((t) => t + b.timeGain);
    setRun((r) => commit(r, b));
    setToast(b);
    window.setTimeout(() => setToast((t) => (t === b ? null : t)), 1400);
    // Juice: glow the relics that fired + fly the score up.
    setFlash(new Set(b.triggers.map((t) => t.card)));
    window.setTimeout(() => setFlash(new Set()), 720);
    setFly({ id: Date.now(), total });
    buzz(goldHit ? [0, 14, 22, 14] : 12); // a little pulse on every word; a richer one on gold
    sound.found(Math.min(11, Math.round(total / 40) + 1));
    // One-word boss: this single word decides the board.
    if (boss?.oneWord) {
      const survived = boardScore + total >= target;
      window.setTimeout(() => {
        if (survived) clearBoard();
        else die();
      }, 1300);
    }
  };

  const openingPick = (card: Card) => {
    setDeck((d) => [...d, card]);
    setPhase("play");
  };

  // Fire a charm: apply its one-shot effect, then consume it. Play-phase only.
  const useCharm = (charm: Charm, idx: number) => {
    if (phase !== "play") return;
    const e = charm.effect;
    switch (e.kind) {
      case "time":
        setTimeLeft((t) => t + e.seconds);
        break;
      case "reroll":
        setBoardSeed(Date.now()); // new letters (target/time/score carry over)
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

  const advanceBoard = () => {
    const nb = boardIdx + 1;
    const newSeed = Date.now();
    const isBoss = nb % 6 === 0;
    const nextBoss = isBoss ? randomBoss(newSeed) : null; // a boss every 6th board
    const nextMod = isBoss ? null : randomModifier(newSeed); // a twist on some regular boards
    setBoardIdx(nb);
    setBoardSeed(newSeed);
    setBoss(nextBoss);
    setBoardMod(nextMod);
    setBoardScore(0);
    setTimeLeft(TIME_BUDGET + (nextMod?.startTimeBonus ?? 0));
    setFound(new Set());
    setDoubleNext(false); // per-board charm effects reset
    setSealsCleared(false);
    setRun((r) => ({ ...r, board: r.board + 1, boardWords: 0, lastFirst: null }));
    setPhase("play");
  };

  // Death — record how deep this run got (meta progress) before the dead screen.
  const die = () => {
    if (boardIdx > bestDepth.current) {
      bestDepth.current = boardIdx;
      localStorage.setItem("lexicon:bestDepth", String(boardIdx));
      setNewRecord(true);
    }
    setPhase("dead");
    sound.timeUp();
  };

  // Beating a board: bank coins (base + interest, Balatro-style), a calm chime,
  // then the free draft.
  const clearBoard = () => {
    setCoins((c) => c + 5 + Math.min(5, Math.floor(c / 5)) + (boss ? 8 : 0));
    sound.levelClear();
    // Charm drop: a boss always yields one; regular boards sometimes — if a slot is free.
    if ((boss || Math.random() < 0.35) && charms.length < MAX_CHARMS) {
      const got = randomCharm(Date.now());
      setCharms((cs) => (cs.length < MAX_CHARMS ? [...cs, got] : cs));
      const msg = `✦ found ${got.name}`;
      setCharmToast(msg);
      window.setTimeout(() => setCharmToast((m) => (m === msg ? null : m)), 1800);
    }
    setBoss(null);
    setDraft(pickN(deck));
    setPhase("draft");
  };

  // After the free draft, a shop opens every 3rd board; otherwise straight on.
  const pickDraft = (card: Card) => {
    const next = [...deck, card];
    setDeck(next);
    if (boardIdx % 3 === 0) {
      setShopStock(pickN(next, 4));
      setPhase("shop");
    } else {
      advanceBoard();
    }
  };

  const buy = (card: Card) => {
    const price = PRICE[card.rarity];
    if (coins < price) return;
    setCoins((c) => c - price);
    setDeck((d) => [...d, card]);
    setShopStock((s) => s.filter((c) => c.id !== card.id));
    sound.found(3);
  };

  const reroll = () => {
    if (coins < 2) return;
    setCoins((c) => c - 2);
    setShopStock(pickN(deck, 4));
    sound.tap();
  };

  const cur = pathWord(path, board);
  const previewRaw =
    cur.length >= MIN_WORD_LEN && dict && dict.has(cur) && !found.has(cur) ? scoreWord(cur, effectiveDeck, run) : null;
  // Reflect the gold tile in the live preview when the current trace crosses it.
  const previewGold = !!previewRaw && goldTile >= 0 && path.includes(goldTile);
  const preview = previewRaw
    ? previewGold
      ? { ...previewRaw, total: Math.round(previewRaw.total * goldMult) }
      : previewRaw
    : null;
  const pct = Math.min(100, Math.round((boardScore / target) * 100));
  const inspectAccrued = inspect?.accrued?.(run) ?? null;

  return (
    <div className="run">
      <div className="run-header">
        <button className="icon-btn" aria-label="Exit" onClick={onExit}>
          ✕
        </button>
        <div className="coins" key={coins}>
          🪙 {coins}
        </div>
      </div>

      <header className="run-top">
        <div className="stat">
          <span className="stat-num" key={boardScore}>{boardScore}</span>
          <span className="stat-label">board {boardIdx}</span>
          {fly && (
            <span key={fly.id} className="score-fly">
              +{fly.total}
            </span>
          )}
        </div>
        <div className={`stat timer${running && timeLeft <= 10 ? " low" : ""}`}>
          <span className="stat-num">{Math.max(0, timeLeft)}s</span>
          <span className="stat-label">time</span>
        </div>
        <div className="stat">
          <span className="stat-num">{target}</span>
          <span className="stat-label">target</span>
        </div>
      </header>

      <div className="target-bar">
        <div className="target-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Your relics — the engine you're building. They glow when they fire. */}
      <div className="deck-wrap">
        <span className="deck-label">◈ your relics · {deck.length} · tap to inspect</span>
        <div className="deck">
          {deck.map((c, i) => (
            <RelicCard key={c.id + i} card={c} mode="chip" flash={flash.has(c.name)} onClick={() => setInspect(c)} />
          ))}
        </div>
      </div>

      {/* Charms — one-shot consumables. Tap to fire (spends it). */}
      {charms.length > 0 && (
        <div className="charm-tray">
          <span className="charm-label">✦ charms · tap to use</span>
          <div className="charm-row">
            {charms.map((ch, i) => (
              <button
                key={ch.id + i}
                className={`charm charm--${ch.rarity}`}
                disabled={phase !== "play"}
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

      {charmToast && <div className="charm-toast" key={charmToast}>{charmToast}</div>}

      {boss && phase === "play" && (
        <div className="boss-banner">
          <span className="boss-name">☠ boss · {boss.name}</span>
          <span className="boss-blurb">{boss.blurb}</span>
        </div>
      )}

      {boardMod && phase === "play" && !boss && (
        <div className={`mod-banner mod-${boardMod.tone}`}>
          <span className="mod-name">{boardMod.tone === "boon" ? "✦" : "✧"} {boardMod.name}</span>
          <span className="mod-blurb">{boardMod.blurb}</span>
        </div>
      )}

      {/* Live breakdown / toast */}
      <div className="breakdown">
        {toast ? (
          <span className="bd-toast">
            <b>{toast.word.toUpperCase()}</b> {toast.chips} × {round1(toast.mult)} = <b>{toast.total}</b>
            {toast.timeGain > 0 && <em> +{toast.timeGain}s</em>}
          </span>
        ) : preview ? (
          <span className="bd-live">
            {preview.chips} × {round1(preview.mult)} = <b>{preview.total}</b>
            {preview.timeGain > 0 && <em> +{preview.timeGain}s</em>}
            <small>{preview.triggers.map((t) => t.card).join(" · ")}</small>
          </span>
        ) : (
          <span className="bd-hint">
            {firstRun.current ? "your engine turns long words into time, and time into score — find a long one" : "trace a word"}
          </span>
        )}
      </div>

      <div className="board-wrap" style={{ width: "min(92vw, 420px, calc(100svh - 400px))" }}>
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
            const isBlocked = blocked.has(i);
            const isGold = i === goldTile;
            return (
              <div
                key={i}
                data-cell={i}
                className={`tile${order >= 0 ? " on" : ""}${order === path.length - 1 ? " head" : ""}${isBlocked ? " blocked" : ""}${isGold ? " gold" : ""}`}
                style={{ ["--i" as string]: i }}
              >
                {isBlocked ? "" : c.label}
              </div>
            );
          })}
        </div>
      </div>

      {boardScore >= target && phase === "play" && !boss?.oneWord && (
        <button className="btn primary next-btn" onClick={clearBoard}>
          Target hit — bank &amp; draft →
        </button>
      )}

      {!ready && <div className="loading-veil">gathering the dictionary…</div>}

      {(phase === "draft" || phase === "opening") && (
        <div className="menu-veil">
          <div className="draft-card">
            <div className="menu-title">{phase === "opening" ? "Choose your opening relic" : "Draft a relic"}</div>
            <div className="draft-row">
              {draft.map((c) => (
                <RelicCard
                  key={c.id}
                  card={c}
                  mode="full"
                  onClick={() => (phase === "opening" ? openingPick(c) : pickDraft(c))}
                />
              ))}
            </div>
            {phase === "opening" && (
              <div className="draft-sub">a fresh run — you'll draft the rest between boards</div>
            )}
          </div>
        </div>
      )}

      {phase === "shop" && (
        <div className="menu-veil">
          <div className="shop-card">
            <div className="shop-head">
              <span className="shop-title">🗝️ The Relic Vault</span>
              <span className="shop-coins">🪙 {coins}</span>
            </div>
            <div className="draft-row">
              {shopStock.map((c) => (
                <RelicCard
                  key={c.id}
                  card={c}
                  mode="full"
                  price={PRICE[c.rarity]}
                  disabled={coins < PRICE[c.rarity]}
                  onClick={() => buy(c)}
                />
              ))}
              {shopStock.length === 0 && <div className="draft-sub">sold out — nice haul</div>}
            </div>
            <div className="shop-actions">
              <button className="btn" disabled={coins < 2} onClick={reroll}>
                Reroll · 🪙 2
              </button>
              <button className="btn primary" onClick={advanceBoard}>
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relic inspector — tap a deck chip to see its rules + live accrued value */}
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

      {phase === "dead" && (
        <div className="menu-veil">
          <div className="menu-card">
            <div className="menu-title">Run over</div>
            <div className="results-score">{runScore}</div>
            <div className="results-sub">reached board {boardIdx} · {deck.length} cards</div>
            <div className={`depth-stat${newRecord ? " record" : ""}`}>
              {newRecord ? `★ new record — board ${bestDepth.current}` : `deepest run · board ${bestDepth.current}`}
            </div>
            <button className="btn primary" onClick={onExit}>Back to menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
