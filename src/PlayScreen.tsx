/**
 * PlayScreen — a round of Lexicon: trace words on the letter grid before the
 * timer runs out. Drag across adjacent tiles (touch or mouse) to spell a word;
 * lift to submit. Live feedback colours the current word — ink while it's still
 * a valid prefix, green the moment it's a real word, muted-red at a dead end —
 * and a line follows the trace. Valid words (≥3, unseen) score by length.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  makeBoard,
  canExtend,
  pathWord,
  wordScore,
  MIN_WORD_LEN,
  type Board,
} from "./board.js";
import { loadDictionary, readyDictionary, type Dictionary } from "./dictionary.js";

export interface FoundWord {
  word: string;
  points: number;
}
export interface RoundResult {
  found: FoundWord[];
  score: number;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Index of the DOM cell under a client point, or -1. */
function cellAt(x: number, y: number): number {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest("[data-cell]");
  return cell ? Number(cell.getAttribute("data-cell")) : -1;
}

/** Centre of cell `i` in the board's 0..100 viewBox space (gaps ignored — close
 *  enough for a trace line). */
function cellCenter(i: number, size: number): [number, number] {
  return [((i % size) + 0.5) * (100 / size), (Math.floor(i / size) + 0.5) * (100 / size)];
}

export function PlayScreen({
  seed,
  durationSec,
  onDone,
}: {
  seed: number;
  /** Round length in seconds; `Infinity` = zen (no timer). */
  durationSec: number;
  onDone: (r: RoundResult) => void;
}) {
  const board: Board = useMemo(() => makeBoard(seed), [seed]);
  const [dict, setDict] = useState<Dictionary | null>(() => readyDictionary());
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<FoundWord[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(durationSec);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const tracing = useRef(false);
  const timed = Number.isFinite(durationSec);
  const ready = dict !== null;

  // Ensure the dictionary is loaded (usually already warmed at app mount).
  useEffect(() => {
    if (!dict) loadDictionary().then(setDict);
  }, [dict]);

  // Countdown — only once the dictionary is ready (don't burn time on a loader).
  useEffect(() => {
    if (!timed || !ready) return;
    if (timeLeft <= 0) {
      onDone({ found, score });
      return;
    }
    const id = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timed, ready]);

  const doFlash = (kind: "ok" | "bad") => {
    setFlash(kind);
    window.setTimeout(() => setFlash(null), 420);
  };

  const extendTo = (i: number) => {
    if (i < 0) return;
    setPath((p) => {
      if (p.length && p[p.length - 1] === i) return p;
      if (p.length >= 2 && p[p.length - 2] === i) return p.slice(0, -1); // backtrack
      if (canExtend(p, i, board.size)) return [...p, i];
      return p;
    });
  };

  const submit = () => {
    tracing.current = false;
    const cur = path;
    setPath([]);
    if (cur.length < MIN_WORD_LEN || !dict) return;
    const word = pathWord(cur, board);
    if (word.length < MIN_WORD_LEN) return;
    if (found.some((f) => f.word === word)) return doFlash("bad");
    if (!dict.has(word)) return doFlash("bad");
    const points = wordScore(word.length);
    setFound((f) => [{ word, points }, ...f]);
    setScore((s) => s + points);
    doFlash("ok");
  };

  const curWord = pathWord(path, board);
  // Live state of the in-progress trace, for colour feedback.
  let liveKind: "ok" | "prefix" | "dead" | "idle" = "idle";
  if (curWord.length >= 1 && dict) {
    if (curWord.length >= MIN_WORD_LEN && dict.has(curWord) && !found.some((f) => f.word === curWord)) liveKind = "ok";
    else if (dict.hasPrefix(curWord)) liveKind = "prefix";
    else liveKind = "dead";
  }

  return (
    <div className="play">
      <header className="play-top">
        <div className="stat">
          <span className="stat-num">{score}</span>
          <span className="stat-label">score</span>
        </div>
        <div className={`stat timer${timed && ready && timeLeft <= 10 ? " low" : ""}`}>
          <span className="stat-num">{timed ? mmss(Math.max(0, timeLeft)) : "∞"}</span>
          <span className="stat-label">{timed ? "time" : "zen"}</span>
        </div>
        <div className="stat">
          <span className="stat-num">{found.length}</span>
          <span className="stat-label">words</span>
        </div>
      </header>

      <div className={`current live-${flash ?? liveKind}`}>
        {curWord ? curWord.toUpperCase() : found[0] ? found[0].word.toUpperCase() : "trace a word"}
      </div>

      <div className="board-wrap" style={{ width: "min(92vw, 440px)" }}>
        <div
          className="board"
          style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}
          onPointerDown={(e) => {
            (e.target as Element).releasePointerCapture?.(e.pointerId);
            tracing.current = true;
            extendTo(cellAt(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => {
            if (!tracing.current) return;
            extendTo(cellAt(e.clientX, e.clientY));
          }}
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
              >
                {c.label}
              </div>
            );
          })}
        </div>
        {path.length >= 2 && (
          <svg className={`trace-line trace-${liveKind}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={path.map((i) => cellCenter(i, board.size).join(",")).join(" ")}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      <div className="found">
        {found.length === 0 && <span className="found-empty">found words appear here</span>}
        {found.map((f, k) => (
          <span key={f.word + k} className="chip">
            {f.word} <b>{f.points}</b>
          </span>
        ))}
      </div>

      {!timed && ready && (
        <button className="end-btn" onClick={() => onDone({ found, score })}>
          End round
        </button>
      )}

      {!ready && <div className="loading-veil">gathering the dictionary…</div>}
    </div>
  );
}
