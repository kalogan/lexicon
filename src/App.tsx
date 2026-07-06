/**
 * LEXICON — a stylish word-hunt puzzle (Boggle lineage), built on game-kit as a
 * kit-hardening vehicle. Flow: studio ident → title (mode select) → a round on
 * the letter grid → results (with a solver-revealed best possible word). Each
 * difficulty keeps its own best score (kit `settings`).
 */
import { useEffect, useState } from "react";
import { TitleScreen } from "game-kit/title/r3f";
import { StudioLogo } from "./StudioLogo.js";
import { LexiconWordmark } from "./LexiconWordmark.js";
import type { MenuOption } from "game-kit/title";
import { PlayScreen, type RoundResult } from "./PlayScreen.js";
import { ResultsScreen } from "./ResultsScreen.js";
import { RunScreen } from "./RunScreen.js";
import { ClassicSetup } from "./ClassicSetup.js";
import { Codex } from "./Codex.js";
import { TitleBackdrop } from "./TitleBackdrop.js";
import { loadDictionary } from "./dictionary.js";
import { type Mode } from "./modes.js";
import { sound } from "./sound.js";
import * as store from "./store.js";

type Phase = "ident" | "title" | "play" | "results" | "run" | "classic" | "codex";

const DEFAULT_MODE: Mode = { id: "classic-4-180", label: "Classic", size: 4, durationSec: 180, blurb: "" };

export function App() {
  const [phase, setPhase] = useState<Phase>("ident");
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [seed, setSeed] = useState(() => Date.now());
  const [result, setResult] = useState<RoundResult | null>(null);
  const [best, setBest] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);

  // Warm the (async, code-split) dictionary early so it's ready by first play,
  // and attempt to open the audio context now so the studio-ident chime can sound
  // on browsers that permit it (a stone-cold first load stays silent — no gesture).
  useEffect(() => {
    void loadDictionary();
    sound.unlock();
  }, []);

  const startRound = (m: Mode) => {
    setMode(m);
    setSeed(Date.now());
    setBest(store.getBest(m.id));
    setResult(null);
    setIsNewBest(false);
    sound.begin();
    setPhase("play");
  };

  const finishRound = (r: RoundResult) => {
    const prev = store.getBest(mode.id);
    const beat = r.score > prev;
    store.setBest(mode.id, r.score); // raises only
    setBest(Math.max(prev, r.score));
    setIsNewBest(beat && r.score > 0);
    setResult(r);
    sound.timeUp();
    setPhase("results");
  };

  if (phase === "ident") {
    return <StudioLogo onDone={() => setPhase("title")} />;
  }

  if (phase === "title") {
    const options: MenuOption[] = [
      { label: "Roguelike", primary: true, onSelect: () => setPhase("run") },
      { label: "Classic", onSelect: () => setPhase("classic") },
      { label: "Codex", onSelect: () => setPhase("codex") },
    ];
    return (
      <TitleScreen
        title={<LexiconWordmark />}
        subtitle="Build impossible vocabulary engines."
        titleColor="#2b2440"
        backdrop={<TitleBackdrop />}
        options={options}
        layout="split"
        onFirstGesture={() => sound.unlock()}
      />
    );
  }

  if (phase === "run") {
    return <RunScreen onExit={() => setPhase("title")} />;
  }

  if (phase === "codex") {
    return <Codex onExit={() => setPhase("title")} />;
  }

  if (phase === "classic") {
    return (
      <ClassicSetup
        onStart={(size, durationSec) =>
          startRound({ id: `classic-${size}-${durationSec}`, label: `Classic ${size}×${size}`, size, durationSec, blurb: "" })
        }
        onExit={() => setPhase("title")}
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
      seed={seed}
      size={mode.size}
      onPlayAgain={() => startRound(mode)}
      onHome={() => setPhase("title")}
    />
  );
}
