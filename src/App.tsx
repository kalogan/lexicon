/**
 * LEXICON — a stylish word-hunt puzzle (Boggle lineage), built on game-kit as a
 * kit-hardening vehicle. Flow: (tap-to-begin gate →) studio ident → title (mode
 * select) → a round on the letter grid → results. Each difficulty keeps its own
 * best score. THREE-free; the kit supplies the front door + determinism (prng).
 */
import { useEffect, useState } from "react";
import { StartGate, StudioIdent, TitleScreen } from "game-kit/title/r3f";
import type { MenuOption } from "game-kit/title";
import { PlayScreen, type RoundResult } from "./PlayScreen.js";
import { ResultsScreen } from "./ResultsScreen.js";
import { loadDictionary } from "./dictionary.js";
import { MODES, type Mode } from "./modes.js";
import { sound } from "./sound.js";

type Phase = "gate" | "ident" | "title" | "play" | "results";

const bestKey = (modeId: string) => `lexicon:best:${modeId}`;
function loadBest(modeId: string): number {
  const v = Number(localStorage.getItem(bestKey(modeId)));
  return Number.isFinite(v) ? v : 0;
}

export function App() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [mode, setMode] = useState<Mode>(MODES[0]!);
  const [seed, setSeed] = useState(() => Date.now());
  const [result, setResult] = useState<RoundResult | null>(null);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  // Warm the (async, code-split) dictionary early so it's ready by first play.
  useEffect(() => {
    void loadDictionary();
  }, []);

  const startRound = (m: Mode) => {
    setMode(m);
    setSeed(Date.now());
    setBest(loadBest(m.id));
    setResult(null);
    setIsNewBest(false);
    sound.begin();
    setPhase("play");
  };

  const finishRound = (r: RoundResult) => {
    const prev = loadBest(mode.id);
    const beat = r.score > prev;
    if (beat) {
      localStorage.setItem(bestKey(mode.id), String(r.score));
      setBest(r.score);
    } else {
      setBest(prev);
    }
    setIsNewBest(beat && r.score > 0);
    setResult(r);
    sound.timeUp();
    setPhase("results");
  };

  if (phase === "gate") {
    return (
      <StartGate
        label="Lexicon"
        hint="tap to begin"
        onBegin={() => {
          sound.unlock();
          setPhase("ident");
        }}
      />
    );
  }

  if (phase === "ident") {
    return <StudioIdent wordmark="WOVENWILD" tagline="games" onDone={() => setPhase("title")} />;
  }

  if (phase === "title") {
    const options: MenuOption[] = MODES.map((m) => ({
      label: `${m.label} · ${m.blurb}`,
      primary: m.id === "standard",
      onSelect: () => startRound(m),
    }));
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
    return (
      <PlayScreen
        key={seed}
        seed={seed}
        size={mode.size}
        durationSec={mode.durationSec}
        onDone={finishRound}
        onRestart={() => startRound(mode)}
        onExit={() => setPhase("title")}
      />
    );
  }

  return (
    <ResultsScreen
      result={result ?? { found: [], score: 0 }}
      best={best}
      isNewBest={isNewBest}
      modeLabel={mode.label}
      onPlayAgain={() => startRound(mode)}
      onHome={() => setPhase("title")}
    />
  );
}
