/**
 * StudioLogo — LEXICON's WOVENWILD studio intro, rebuilt as an INTERACTIVE scene.
 *
 * The frog (woven from threads into a little goober) forms on mount and settles,
 * with the WOVENWILD / games wordmark. Then it waits: TAP THE FROG and it winks
 * and flies its tongue up-right with a "thwup", then the whole scene fades to the
 * title. That single tap is also what unlocks audio (browsers block all sound
 * until a real gesture — which we can't fake), so the thwup is always audible and
 * always in sync. All motion is CSS keyframes (studio-logo.css); the tongue + wink
 * are gated behind the `--react` state so they only fire on the tap.
 */
import { useEffect, useState } from "react";
import { sound } from "./sound.js";
import "./studio-logo.css";

// Six thread strands sweeping in from the edges to the goober's center.
const THREADS = [
  "M18,44 Q130,150 200,158",
  "M382,40 Q270,150 200,158",
  "M20,268 Q120,200 200,158",
  "M380,272 Q280,200 200,158",
  "M200,14 Q206,90 200,158",
  "M366,158 Q280,150 200,158",
];

/** The frog: threads weave into a goober; pale frog-eyes; a tongue that only
 *  fires when the scene enters `--react`. */
function WovenwildArt() {
  return (
    <svg className="studio-art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g className="studio-threads">
        {THREADS.map((d, i) => (
          <path key={i} className="studio-thread" d={d} pathLength={100} style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </g>
      <g className="studio-goober">
        <ellipse cx={200} cy={168} rx={62} ry={54} className="studio-body" />
        <circle cx={170} cy={132} r={30} className="studio-body" />
        <circle cx={232} cy={138} r={26} className="studio-body" />
        {/* left eye */}
        <circle cx={173} cy={131} r={15} className="studio-eyeball" />
        <circle cx={177} cy={133} r={6.5} className="studio-pupil" />
        <circle cx={179.5} cy={130.5} r={2.4} className="studio-glint" />
        {/* right eye — winks on the tap */}
        <g className="studio-eye-right">
          <circle cx={229} cy={136} r={13} className="studio-eyeball" />
          <circle cx={226} cy={138} r={6} className="studio-pupil" />
          <circle cx={228.5} cy={135.5} r={2} className="studio-glint" />
        </g>
      </g>
      {/* Tongue — flies up and to the right on the tap, above the right eye. */}
      <g className="studio-tongue">
        <path className="studio-tongue-body" d="M216,182 Q258,150 288,100" />
        <circle className="studio-tongue-tip" cx={288} cy={100} r={8} />
      </g>
    </svg>
  );
}

export function StudioLogo({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"rest" | "react">("rest");

  // Once tapped, the wink + tongue play (~0.6s), linger, then fade to the title.
  useEffect(() => {
    if (phase !== "react") return;
    const id = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(id);
  }, [phase, onDone]);

  const tap = () => {
    if (phase !== "rest") return;
    sound.unlock(); // the gesture that unlocks audio
    sound.thwup(); // in sync with the tongue lash
    setPhase("react");
  };

  return (
    <div
      className={`studio-scene studio-scene--${phase}`}
      role="button"
      tabIndex={0}
      aria-label="Tap the frog to begin"
      onPointerDown={tap}
    >
      <WovenwildArt />
      <div className="studio-brand">
        <div className="studio-wordmark">WOVENWILD</div>
        <div className="studio-tag">games</div>
      </div>
      {phase === "rest" && <div className="studio-tap-hint">tap the frog</div>}
    </div>
  );
}

export default StudioLogo;
