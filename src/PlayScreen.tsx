/**
 * PlayScreen — a round of Lexicon: trace words on the letter grid before the
 * timer runs out. Drag across adjacent tiles (touch/mouse) to spell; lift to
 * submit. Live colour + a trace line show whether the word is a valid prefix,
 * a real word, or a dead end. Pause for a menu (resume / restart / exit / mute).
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
import { sound } from "./sound.js";

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

function cellAt(x: number, y: number): number {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest("[data-cell]");
  return cell ? Number(cell.getAttribute("data-cell")) : -1;
}

function cellCenter(i: number, size: number): [number, number] {
  return [((i % size) + 0.5) * (100 / size), (Math.floor(i / size) + 0.5) * (100 / size)];
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export function PlayScreen({
  seed,
  size,
  durationSec,
  onDone,
  onRestart,
  onExit,
}: {
  seed: number;
  size: number;
  durationSec: number;
  onDone: (r: RoundResult) => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const board: Board = useMemo(() => makeBoard(seed, size), [seed, size]);
  const [dict, setDict] = useState<Dictionary | null>(() => readyDictionary());
  const [path, setPath] = useState<number[]>([]);
  const [found, setFound] = useState<FoundWord[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(durationSec);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(() => sound.isMuted());
  const [pop, setPop] = useState<{ id: number; points: number } | null>(null);
  const tracing = useRef(false);
  const timed = Number.isFinite(durationSec);
  const ready = dict !== null;
  const running = ready && !menuOpen;

  useEffect(() => {
    if (!dict) loadDictionary().then(setDict);
  }, [dict]);

  // Countdown — paused while the menu is open or the dictionary is still loading.
  useEffect(() => {
    if (!timed || !running) return;
    if (timeLeft <= 0) {
      onDone({ found, score });
      return;
    }
    if (timeLeft <= 10) sound.tick();
    const id = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timed, running]);

  const doFlash = (kind: "ok" | "bad") => {
    setFlash(kind);
    window.setTimeout(() => setFlash(null), 420);
  };

  const extendTo = (i: number) => {
    if (i < 0 || menuOpen) return;
    setPath((p) => {
      let np = p;
      if (p.length && p[p.length - 1] === i) np = p;
      else if (p.length >= 2 && p[p.length - 2] === i) np = p.slice(0, -1); // backtrack
      else if (canExtend(p, i, size)) np = [...p, i];
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
    if (word.length < MIN_WORD_LEN) return;
    if (found.some((f) => f.word === word) || !dict.has(word)) {
      sound.invalid();
      buzz(28);
      return doFlash("bad");
    }
    const points = wordScore(word.length);
    setFound((f) => [{ word, points }, ...f]);
    setScore((s) => s + points);
    setPop({ id: Date.now(), points });
    sound.found(points);
    buzz(12);
    doFlash("ok");
  };

  const curWord = pathWord(path, board);
  let liveKind: "ok" | "prefix" | "dead" | "idle" = "idle";
  if (curWord.length >= 1 && dict) {
    if (curWord.length >= MIN_WORD_LEN && dict.has(curWord) && !found.some((f) => f.word === curWord)) liveKind = "ok";
    else if (dict.hasPrefix(curWord)) liveKind = "prefix";
    else liveKind = "dead";
  }

  const toggleMute = () => {
    const m = !muted;
    sound.setMuted(m);
    setMuted(m);
    if (!m) sound.tap();
  };

  return (
    <div className="play">
      <header className="play-top">
        <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>
        <div className="stat">
          <span className="stat-num" key={score}>
            {score}
          </span>
          <span className="stat-label">score</span>
          {pop && (
            <span key={pop.id} className="points-pop">
              +{pop.points}
            </span>
          )}
        </div>
        <div className={`stat timer${timed && running && timeLeft <= 10 ? " low" : ""}`}>
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
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
          onPointerDown={(e) => {
            if (menuOpen) return;
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
                style={{ ["--i" as string]: i }}
              >
                {c.label}
              </div>
            );
          })}
        </div>
        {path.length >= 2 && (
          <svg className={`trace-line trace-${liveKind}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={path.map((i) => cellCenter(i, size).join(",")).join(" ")}
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

      {!ready && <div className="loading-veil">gathering the dictionary…</div>}

      {menuOpen && (
        <div className="menu-veil">
          <div className="menu-card">
            <div className="menu-title">Paused</div>
            <button className="btn primary" onClick={() => setMenuOpen(false)}>
              Resume
            </button>
            <button className="btn" onClick={onRestart}>
              Restart
            </button>
            <button className="btn" onClick={toggleMute}>
              Sound: {muted ? "off" : "on"}
            </button>
            <button className="btn ghost" onClick={onExit}>
              Exit to menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
