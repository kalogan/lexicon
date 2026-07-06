/**
 * TitleBackdrop — a quietly-magical, slow-drifting field of Scrabble letter
 * tiles behind LEXICON's title. Fills the big empty space above the wordmark
 * with an ambient "word-hoard": common letters plus a few juicy high-value ones
 * (Q10, Z10, X8, J8, K5) so it reads as a rich vocabulary engine on-brand with
 * "Build impossible vocabulary engines."
 *
 * Self-contained: all styling lives in a scoped inline <style> (mirrors the
 * RelicCard.tsx pattern) so it drops in with zero edits to styles.css. Motion
 * is pure CSS @keyframes — transforms + opacity only (GPU-cheap, no layout
 * thrash). Each tile carries per-tile --dur / animation-delay derived
 * arithmetically from its authored values, so nothing moves in lockstep and
 * there is NO Math.random at render (stable across re-renders). Honours
 * prefers-reduced-motion by freezing all animation (tiles stay visible).
 *
 * The tiles are hand-placed for a pleasing composition biased toward the empty
 * center-top; they deliberately DO NOT spell "LEXICON" (the kit draws that
 * wordmark on top) and stay low-opacity so the title stays legible.
 */

/** Real Scrabble point values. */
const POINTS: Record<string, number> = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

interface TileSpec {
  letter: string;
  /** left, as a % of the field width. */
  x: number;
  /** top, as a % of the field height. */
  y: number;
  /** rendered box size in px. */
  size: number;
  /** resting opacity (kept low — these are ambient). */
  opacity: number;
  /** resting rotation in degrees. */
  rotate: number;
  /** float cycle duration in seconds. */
  dur: number;
  /** animation start offset in seconds (negative → begins mid-cycle). */
  delay: number;
}

/* Hand-authored composition. ~18 tiles clustered in the BAND between the top
 * wordmark and the bottom menu (y ≈ 27–64%), so the drift lives in the open
 * middle of the split layout. A sprinkle of Q/Z/X/J/K makes it feel like a
 * hoard of impossible words. Never spells LEXICON. */
const TILES: readonly TileSpec[] = [
  { letter: "Q", x: 16, y: 30, size: 82, opacity: 0.40, rotate: -8, dur: 13, delay: -2 },
  { letter: "W", x: 46, y: 27, size: 52, opacity: 0.26, rotate: 6, dur: 15, delay: -7 },
  { letter: "Z", x: 74, y: 31, size: 78, opacity: 0.42, rotate: 9, dur: 14, delay: -4 },
  { letter: "S", x: 92, y: 33, size: 38, opacity: 0.18, rotate: -3, dur: 19, delay: -8 },
  { letter: "V", x: 3, y: 34, size: 46, opacity: 0.18, rotate: 8, dur: 17, delay: -12 },
  { letter: "B", x: 40, y: 36, size: 40, opacity: 0.16, rotate: -5, dur: 16, delay: -4 },
  { letter: "J", x: 29, y: 43, size: 68, opacity: 0.38, rotate: 4, dur: 12, delay: -6 },
  { letter: "E", x: 60, y: 41, size: 42, opacity: 0.20, rotate: -6, dur: 18, delay: -3 },
  { letter: "A", x: 90, y: 45, size: 44, opacity: 0.22, rotate: -5, dur: 17, delay: -11 },
  { letter: "T", x: 5, y: 47, size: 50, opacity: 0.24, rotate: 7, dur: 16, delay: -9 },
  { letter: "X", x: 48, y: 50, size: 74, opacity: 0.36, rotate: 5, dur: 12, delay: -10 },
  { letter: "G", x: 78, y: 46, size: 40, opacity: 0.16, rotate: 7, dur: 18, delay: -13 },
  { letter: "I", x: 23, y: 53, size: 36, opacity: 0.16, rotate: -4, dur: 19, delay: -6 },
  { letter: "O", x: 67, y: 54, size: 40, opacity: 0.18, rotate: -7, dur: 17, delay: -1 },
  { letter: "R", x: 13, y: 60, size: 46, opacity: 0.22, rotate: -4, dur: 16, delay: -5 },
  { letter: "K", x: 84, y: 59, size: 60, opacity: 0.32, rotate: 8, dur: 14, delay: -14 },
  { letter: "N", x: 36, y: 62, size: 48, opacity: 0.20, rotate: 6, dur: 15, delay: -15 },
  { letter: "P", x: 60, y: 63, size: 44, opacity: 0.17, rotate: 5, dur: 17, delay: -8 },
];

export function TitleBackdrop() {
  return (
    <div className="lex-bd" aria-hidden="true">
      <BackdropStyles />
      {TILES.map((t, i) => {
        // Per-tile drift/sway, derived arithmetically from the index so it's
        // deterministic (stable across re-renders) yet varied per tile.
        const dx = ((i % 5) - 2) * 7; // -14..+14 px horizontal sway
        const dy = 18 + (i % 4) * 7; // 18..39 px vertical float
        const rot = t.rotate + (i % 2 === 0 ? 8 : -8); // rotation swing target
        const style = {
          left: `${t.x}%`,
          top: `${t.y}%`,
          width: `${t.size}px`,
          height: `${t.size}px`,
          fontSize: `${Math.round(t.size * 0.52)}px`,
          "--o": t.opacity,
          "--rot": `${t.rotate}deg`,
          "--rot2": `${rot}deg`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          "--dur": `${t.dur}s`,
          animationDelay: `${t.delay}s`,
        } as React.CSSProperties;
        return (
          <span className="lex-bd__tile" style={style} key={i}>
            <span className="lex-bd__letter">{t.letter}</span>
            <sub className="lex-bd__pts">{POINTS[t.letter]}</sub>
          </span>
        );
      })}
    </div>
  );
}

function BackdropStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: BACKDROP_CSS }}
    />
  );
}

const BACKDROP_CSS = `
.lex-bd {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /* Split layout: the drift lives in the BAND between the top wordmark and the
     bottom menu — a vertical mask fades tiles out behind both text zones. */
  -webkit-mask-image: linear-gradient(to bottom, transparent 8%, #000 25%, #000 66%, transparent 88%);
  mask-image: linear-gradient(to bottom, transparent 8%, #000 25%, #000 66%, transparent 88%);
}

.lex-bd__tile {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--lex-tile, #fbf7ee);
  border-radius: 16px;
  color: var(--lex-ink, #2b2440);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.01em;
  opacity: var(--o, 0.2);
  transform: translate3d(0, 0, 0) rotate(var(--rot, 0deg));
  box-shadow:
    0 3px 0 rgba(43, 36, 64, 0.12),
    0 6px 16px rgba(43, 36, 64, 0.08);
  will-change: transform, opacity;
  animation: lex-bd-drift var(--dur, 18s) ease-in-out infinite;
}

.lex-bd__letter {
  display: block;
}

/* Tiny corner point value — subscript, offset toward the bottom-right. */
.lex-bd__pts {
  position: absolute;
  right: 14%;
  bottom: 10%;
  font-size: 0.34em;
  font-weight: 700;
  line-height: 1;
  opacity: 0.7;
}

/* Slow float + a few degrees of rotation + a subtle opacity/scale breathe.
 * Everything is transform/opacity only, so it stays on the compositor. */
@keyframes lex-bd-drift {
  0% {
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
    opacity: var(--o);
  }
  50% {
    transform: translate3d(var(--dx), calc(var(--dy) * -1), 0) rotate(var(--rot2)) scale(1.08);
    opacity: calc(var(--o) * 1.4);
  }
  100% {
    transform: translate3d(0, 0, 0) rotate(var(--rot)) scale(1);
    opacity: var(--o);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lex-bd__tile {
    animation: none;
    will-change: auto;
  }
}
`;

export default TitleBackdrop;
