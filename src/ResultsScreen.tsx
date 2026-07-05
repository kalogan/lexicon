/**
 * ResultsScreen — the end-of-round card: final score, a few proud stats (best
 * word, longest, count), your personal best, and a way back to another round.
 * Personal-best framing (à la the genre's best) — you play against your last game.
 */
import type { FoundWord, RoundResult } from "./PlayScreen.js";

function pick(found: FoundWord[], better: (a: FoundWord, b: FoundWord) => boolean): FoundWord | null {
  return found.reduce<FoundWord | null>((best, f) => (best && !better(f, best) ? best : f), null);
}

export function ResultsScreen({
  result,
  best,
  isNewBest,
  onPlayAgain,
  onHome,
}: {
  result: RoundResult;
  best: number;
  isNewBest: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}) {
  const { found, score } = result;
  const bestWord = pick(found, (a, b) => a.points > b.points || (a.points === b.points && a.word.length > b.word.length));
  const longest = pick(found, (a, b) => a.word.length > b.word.length);

  return (
    <div className="results">
      <div className="results-card">
        {isNewBest && <div className="newbest">◈ new best ◈</div>}
        <div className="results-score">{score}</div>
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
