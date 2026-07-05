/**
 * ResultsScreen — the end-of-round card: final score, a few proud stats (best
 * word, longest, count), your personal best, and a way back to another round.
 * Personal-best framing (à la the genre's best) — you play against your last game.
 */
import { useEffect, useState } from "react";
import type { FoundWord, RoundResult } from "./PlayScreen.js";
import { makeBoard } from "./board.js";
import { solveBoard, type SolveResult } from "./solver.js";

function pick(found: FoundWord[], better: (a: FoundWord, b: FoundWord) => boolean): FoundWord | null {
  return found.reduce<FoundWord | null>((best, f) => (best && !better(f, best) ? best : f), null);
}

/** Count a number up to `target` over ~0.7s — the satisfying results tally. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= target) return;
    const step = Math.max(1, Math.ceil(target / 30));
    const id = window.setTimeout(() => setShown((s) => Math.min(target, s + step)), 24);
    return () => window.clearTimeout(id);
  }, [shown, target]);
  return shown;
}

export function ResultsScreen({
  result,
  best,
  isNewBest,
  modeLabel,
  seed,
  size,
  onPlayAgain,
  onHome,
}: {
  result: RoundResult;
  best: number;
  isNewBest: boolean;
  modeLabel: string;
  seed: number;
  size: number;
  onPlayAgain: () => void;
  onHome: () => void;
}) {
  const { found, score } = result;
  const shownScore = useCountUp(score);
  const bestWord = pick(found, (a, b) => a.points > b.points || (a.points === b.points && a.word.length > b.word.length));
  const longest = pick(found, (a, b) => a.word.length > b.word.length);

  // Solve the same board to reveal the best possible word + how many exist.
  const [solved, setSolved] = useState<SolveResult | null>(null);
  useEffect(() => {
    let alive = true;
    void solveBoard(makeBoard(seed, size)).then((s) => {
      if (alive) setSolved(s);
    });
    return () => {
      alive = false;
    };
  }, [seed, size]);

  return (
    <div className="results">
      <div className="results-card">
        <div className="results-mode">{modeLabel}</div>
        {isNewBest && <div className="newbest">◈ new best ◈</div>}
        <div className="results-score">{shownScore}</div>
        <div className="results-sub">points · {found.length} words</div>

        <div className="results-stats">
          <div>
            <span className="rs-label">best word</span>
            <span className="rs-val">{bestWord ? `${bestWord.word} (${bestWord.points})` : "—"}</span>
          </div>
          <div>
            <span className="rs-label">longest</span>
            <span className="rs-val">{longest ? longest.word : "—"}</span>
          </div>
          <div>
            <span className="rs-label">best possible</span>
            <span className="rs-val">
              {solved ? (solved.best ? `${solved.best.word} · ${solved.best.points}` : "—") : "solving…"}
            </span>
          </div>
          <div>
            <span className="rs-label">words on board</span>
            <span className="rs-val">{solved ? `${found.length} / ${solved.words.length}` : "solving…"}</span>
          </div>
          <div>
            <span className="rs-label">personal best</span>
            <span className="rs-val">{best}</span>
          </div>
        </div>

        <div className="results-actions">
          <button className="btn primary" onClick={onPlayAgain}>
            Play again →
          </button>
          <button className="btn" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
