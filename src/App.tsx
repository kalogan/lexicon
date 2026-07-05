/**
 * LEXICON — a stylish word-hunt puzzle (Boggle-lineage), built on game-kit as a
 * kit-hardening vehicle. This is S0: the shell wired to the kit's front-door
 * flow (studio ident → title) so the kit `title` module gets its 2nd consumer
 * (beyond CHIMERA → STABLE track). The board, word validation (`wordlist`),
 * scoring, and timer land in later slices.
 */
import { useState } from "react";
import { StudioIdent, TitleScreen } from "game-kit/title/r3f";
import type { MenuOption } from "game-kit/title";

type Phase = "ident" | "title" | "play";

export function App() {
  const [phase, setPhase] = useState<Phase>("ident");

  if (phase === "ident") {
    return (
      <StudioIdent
        wordmark="WOVENWILD"
        tagline="games"
        onDone={() => setPhase("title")}
      />
    );
  }

  if (phase === "title") {
    const options: MenuOption[] = [
      { label: "Play →", primary: true, onSelect: () => setPhase("play") },
    ];
    return (
      <TitleScreen
        title="LEXICON"
        subtitle="Find the words. Beat your last game."
        titleColor="#2b2440"
        options={options}
      />
    );
  }

  return (
    <div className="play-stub">
      <p>the board comes next (S1)</p>
      <button onClick={() => setPhase("title")}>← back</button>
    </div>
  );
}
