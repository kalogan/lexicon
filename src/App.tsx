/**
 * LEXICON — a stylish word-hunt puzzle (Boggle lineage), built on game-kit as a
 * kit-hardening vehicle. Flow: studio ident → title (mode select) → a timed (or
 * zen) round on the letter grid → results. THREE-free; the kit supplies the
 * front door (title) and determinism (prng).
 */
import { useState } from "react";
import { StudioIdent, TitleScreen } from "game-kit/title/r3f";
import type { MenuOption } from "game-kit/title";
import { PlayScreen, type RoundResult } from "./PlayScreen.js";
import { ResultsScreen } from "./ResultsScreen.js";

type Phase = "ident" | "title" | "play" | "results";

const BEST_KEY = "lexicon:best";
function loadBest(): number {
  const v = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(v) ? v : 0;
}

export function App() {
  const [phase, setPhase] = useState<Phase>("ident");
  const [durationSec, setDurationSec] = useState(180);
  const [seed, setSeed] = useState(() => Date.now());
  const [result, setResult] = useState<RoundResult | null>(null);
  const [best, setBest] = useState(loadBest);
  const [isNewBest, setIsNewBest] = useState(false);

  const startRound = (dur: number) => {
    setDurationSec(dur);
    setSeed(Date.now());
    setResult(null);
    setIsNewBest(false);
    setPhase("play");
  };

  const finishRound = (r: RoundResult) => {
    const beat = r.score > best;
    if (beat) {
      localStorage.setItem(BEST_KEY, String(r.score));
      setBest(r.score);
    }
    setIsNewBest(beat && r.score > 0);
    setResult(r);
    setPhase("results");
  };

  if (phase === "ident") {
    return <StudioIdent wordmark="WOVENWILD" tagline="games" onDone={() => setPhase("title")} />;
  }

  if (phase === "title") {
    const options: MenuOption[] = [
      { label: "Play · 3 min", primary: true, onSelect: () => startRound(180) },
      { label: "Zen · no timer", onSelect: () => startRound(Infinity) },
    ];
    return (
      <TitleScreen
        title="LEXICON"
        subtitle="Trace the hidden words. Beat your last game."
        titleColor="#2b2440"
        options={options}
      />
    );
  }

  if (phase === "play") {
    return <PlayScreen seed={seed} durationSec={durationSec} onDone={finishRound} />;
  }

  return (
    <ResultsScreen
      result={result ?? { found: [], score: 0 }}
      best={best}
      isNewBest={isNewBest}
      onPlayAgain={() => startRound(durationSec)}
      onHome={() => setPhase("title")}
    />
  );
}
