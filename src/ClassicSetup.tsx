/**
 * ClassicSetup — the Classic-mode configurator. Clicking "Classic" from the
 * title opens this: pick a board difficulty and a time limit, then play. (The
 * roguelike mode is its own flagship flow.)
 */
import { useState } from "react";

const SIZES = [
  { v: 4, l: "4×4" },
  { v: 5, l: "5×5" },
  { v: 6, l: "6×6" },
];
const TIMES = [
  { v: 60, l: "1 min" },
  { v: 180, l: "3 min" },
  { v: 300, l: "5 min" },
  { v: Infinity, l: "Zen" },
];

export function ClassicSetup({
  onStart,
  onExit,
}: {
  onStart: (size: number, durationSec: number) => void;
  onExit: () => void;
}) {
  const [size, setSize] = useState(4);
  const [dur, setDur] = useState(180);

  return (
    <div className="setup">
      <button className="icon-btn menu-btn" aria-label="Back" onClick={onExit}>
        ✕
      </button>
      <div className="setup-card">
        <div className="menu-title">Classic</div>

        <div className="setup-group">
          <span className="setup-label">difficulty</span>
          <div className="pill-row">
            {SIZES.map((s) => (
              <button key={s.v} className={`pill${size === s.v ? " on" : ""}`} onClick={() => setSize(s.v)}>
                {s.l}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-group">
          <span className="setup-label">time</span>
          <div className="pill-row">
            {TIMES.map((t) => (
              <button
                key={String(t.v)}
                className={`pill${dur === t.v ? " on" : ""}`}
                onClick={() => setDur(t.v)}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <button className="btn primary" onClick={() => onStart(size, dur)}>
          Play →
        </button>
      </div>
    </div>
  );
}
