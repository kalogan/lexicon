/**
 * StudioLogo — the WOVENWILD studio ident shown before LEXICON's title.
 *
 * Ported from CHIMERA so the studio intro is consistent across the WOVENWILD
 * games. The timing / skip / reduced-motion fade / onDone hand-off come from the
 * shared kit <StudioIdent>; this file supplies only the BRAND: the wordmark, the
 * tagline, and the woven-threads-into-a-goober SVG (`WovenwildArt`, self-animated
 * via studio-logo.css keyframes so it runs even backgrounded).
 *
 * A calm chime fires via the kit's `onCue` as the goober's eyes open. It's silent
 * on a stone-cold first load (the AudioContext is still locked before any gesture,
 * since LEXICON has no tap-gate), but plays on later visits once the browser lets
 * audio start — the same behaviour as CHIMERA.
 */
import { useEffect, useState } from "react";
import { StudioIdent } from "game-kit/title/r3f";
import { sound } from "./sound.js";
import "./studio-logo.css";

// Six thread strands sweeping in from the edges to the goober's center — drawn
// on (stroke-dashoffset) then fading as the goober forms.
const THREADS = [
  "M18,44 Q130,150 200,158",
  "M382,40 Q270,150 200,158",
  "M20,268 Q120,200 200,158",
  "M380,272 Q280,200 200,158",
  "M200,14 Q206,90 200,158",
  "M366,158 Q280,150 200,158",
];

/** The WOVENWILD brand mark: threads weaving into a little goober. Pure SVG +
 *  CSS keyframes (studio-logo.css) — no timing/skip logic (the kit owns that). */
function WovenwildArt() {
  return (
    <svg className="studio-art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="studio-threads">
        {THREADS.map((d, i) => (
          <path key={i} className="studio-thread" d={d} pathLength={100} style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </g>
      <g className="studio-goober">
        <ellipse cx={200} cy={168} rx={62} ry={54} className="studio-body" />
        <circle cx={170} cy={132} r={30} className="studio-body" />
        <circle cx={232} cy={138} r={26} className="studio-body" />
        {/* Frog eyes: pale eyeballs on the bulges with dark pupils that open on
            the chime beat. The RIGHT eye squints as the tongue flicks. */}
        <circle cx={173} cy={131} r={15} className="studio-eyeball" />
        <circle cx={177} cy={133} r={6.5} className="studio-pupil" />
        <circle cx={179.5} cy={130.5} r={2.4} className="studio-glint" />
        <g className="studio-eye-right">
          <circle cx={229} cy={136} r={13} className="studio-eyeball" />
          <circle cx={226} cy={138} r={6} className="studio-pupil" />
          <circle cx={228.5} cy={135.5} r={2} className="studio-glint" />
        </g>
      </g>
      {/* Tongue: ~1s after the eyes, it flicks up and to the right — landing
          above-right of the right eye — and locks with a sticky tip. */}
      <g className="studio-tongue">
        <path className="studio-tongue-body" d="M216,182 Q258,150 288,100" />
        <circle className="studio-tongue-tip" cx={288} cy={100} r={8} />
      </g>
    </svg>
  );
}

export function StudioLogo({ onDone }: { onDone: () => void }) {
  // Browsers block ALL audio until a real user gesture — we can't fake one. So the
  // intro waits for one tap (which unlocks audio) and THEN plays with the chime +
  // thwup. Without this, a stone-cold first load is always silent.
  const [woke, setWoke] = useState(false);

  // "thwup" in sync with the tongue lash (~2.05s into the CSS beat). Only once woke.
  useEffect(() => {
    if (!woke) return;
    const id = window.setTimeout(() => sound.thwup(), 2050);
    return () => window.clearTimeout(id);
  }, [woke]);

  if (!woke) {
    return (
      <div
        className="studio-wake"
        role="button"
        tabIndex={0}
        aria-label="Tap to begin"
        onPointerDown={() => {
          sound.unlock();
          setWoke(true);
        }}
      >
        <span className="studio-wake-frog" aria-hidden="true">🐸</span>
        <span className="studio-wake-hint">tap to begin</span>
      </div>
    );
  }

  return (
    <StudioIdent
      wordmark="WOVENWILD"
      tagline="games"
      onDone={onDone}
      onCue={() => sound.chime()}
      timing={{ durationMs: 3200, cueMs: 1900 }}
    >
      <WovenwildArt />
    </StudioIdent>
  );
}

export default StudioLogo;
