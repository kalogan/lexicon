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
import { sound } from "./sound.js";

const SIZE = 4;
const TIME_BUDGET = 75;
const targetFor = (board: number) => Math.round(100 * Math.pow(1.7, board - 1));

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

function pick3(deck: readonly Card[]): Card[] {
  const owned = new Set(deck.map((c) => c.id));
  const pool = DRAFT_POOL.filter((c) => !owned.has(c.id));
  const src = pool.length >= 3 ? pool : [...pool, ...DRAFT_POOL]; // fall back to dupes late
  const out: Card[] = [];
  const used = new Set<number>();
  while (out.length < 3 && used.size < src.length) {
    const i = Math.floor(Math.random() * src.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(src[i]!);
  }
  return out;
}

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
  const [boardScore, setBoardScore] = useState(0);
  const [runScore, setRunScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_BUDGET);
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<"play" | "draft" | "dead">("play");
  const [draft, setDraft] = useState<Card[]>([]);
  const [toast, setToast] = useState<Breakdown | null>(null);
  const tracing = useRef(false);
  const target = targetFor(boardIdx);
  const ready = dict !== null;
  const running = ready && phase === "play";

  useEffect(() => {
    if (!dict) loadDictionary().then(setDict);
  }, [dict]);

  // The time economy: tick down while playing; hit 0 → board ends.
  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      if (boardScore >= target) {
        setDraft(pick3(deck));
        setPhase("draft");
      } else {
        setPhase("dead");
        sound.timeUp();
      }
      return;
    }
    if (timeLeft <= 10) sound.tick();
    const id = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, running]);

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
      return;
    }
    const b = scoreWord(word, deck, run);
    setFound((f) => new Set(f).add(word));
    setBoardScore((s) => s + b.total);
    setRunScore((s) => s + b.total);
    setTimeLeft((t) => t + b.timeGain);
    setRun((r) => commit(r, b));
    setToast(b);
    window.setTimeout(() => setToast((t) => (t === b ? null : t)), 1400);
    sound.found(Math.min(11, Math.round(b.total / 40) + 1));
  };

  const nextBoard = (card: Card) => {
    setDeck((d) => [...d, card]);
    setBoardIdx((n) => n + 1);
    setBoardSeed(Date.now());
    setBoardScore(0);
    setTimeLeft(TIME_BUDGET);
    setFound(new Set());
    setRun((r) => ({ ...r, board: r.board + 1, boardWords: 0, lastFirst: null }));
    setPhase("play");
  };

  const cur = pathWord(path, board);
  const preview =
    cur.length >= MIN_WORD_LEN && dict && dict.has(cur) && !found.has(cur) ? scoreWord(cur, deck, run) : null;
  const pct = Math.min(100, Math.round((boardScore / target) * 100));

  return (
    <div className="run">
      <button className="icon-btn menu-btn" aria-label="Exit" onClick={onExit}>
        ✕
      </button>

      <header className="run-top">
        <div className="stat">
          <span className="stat-num" key={boardScore}>{boardScore}</span>
          <span className="stat-label">board {boardIdx}</span>
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

      {/* Active engine */}
      <div className="deck">
        {deck.map((c, i) => (
          <div key={c.id + i} className={`rcard r-${c.rarity} k-${c.kind}`} title={c.text}>
            <b>{c.name}</b>
            <span>{c.text}</span>
          </div>
        ))}
      </div>

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

      <div className="board-wrap" style={{ width: "min(92vw, 420px)" }}>
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
              <div key={i} data-cell={i} className={`tile${order >= 0 ? " on" : ""}${order === path.length - 1 ? " head" : ""}`} style={{ ["--i" as string]: i }}>
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {boardScore >= target && phase === "play" && (
        <button className="btn primary next-btn" onClick={() => { setDraft(pick3(deck)); setPhase("draft"); }}>
          Target hit — bank &amp; draft →
        </button>
      )}

      {!ready && <div className="loading-veil">gathering the dictionary…</div>}

      {phase === "draft" && (
        <div className="menu-veil">
          <div className="draft-card">
            <div className="menu-title">Draft a Dictionary</div>
            <div className="draft-row">
              {draft.map((c) => (
                <button key={c.id} className={`rcard pick r-${c.rarity} k-${c.kind}`} onClick={() => nextBoard(c)}>
                  <b>{c.name}</b>
                  <span>{c.text}</span>
                  <em className="r-tag">{c.rarity}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "dead" && (
        <div className="menu-veil">
          <div className="menu-card">
            <div className="menu-title">Run over</div>
            <div className="results-score">{runScore}</div>
            <div className="results-sub">reached board {boardIdx} · {deck.length} cards</div>
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
