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

/* Hand-authored composition. ~18 tiles, biased toward the center-top empty
 * space but spread across the whole field. A sprinkle of Q/Z/X/J/K makes it
 * feel like a hoard of impossible words. Never spells LEXICON. */
const TILES: readonly TileSpec[] = [
  { letter: "Q", x: 18, y: 12, size: 84, opacity: 0.40, rotate: -8, dur: 15, delay: -2 },
  { letter: "W", x: 44, y: 8, size: 58, opacity: 0.30, rotate: 6, dur: 18, delay: -7 },
  { letter: "Z", x: 72, y: 14, size: 78, opacity: 0.42, rotate: 9, dur: 16, delay: -4 },
  { letter: "A", x: 88, y: 26, size: 46, opacity: 0.22, rotate: -5, dur: 20, delay: -11 },
  { letter: "T", x: 6, y: 30, size: 52, opacity: 0.26, rotate: 7, dur: 19, delay: -9 },
  { letter: "J", x: 30, y: 24, size: 66, opacity: 0.36, rotate: 4, dur: 14, delay: -6 },
  { letter: "E", x: 58, y: 22, size: 40, opacity: 0.20, rotate: -6, dur: 22, delay: -3 },
  { letter: "K", x: 82, y: 40, size: 62, opacity: 0.32, rotate: 8, dur: 17, delay: -13 },
  { letter: "R", x: 14, y: 46, size: 44, opacity: 0.22, rotate: -4, dur: 21, delay: -5 },
  { letter: "X", x: 50, y: 38, size: 72, opacity: 0.34, rotate: 5, dur: 15, delay: -10 },
  { letter: "O", x: 68, y: 32, size: 38, opacity: 0.18, rotate: -7, dur: 23, delay: -1 },
  { letter: "N", x: 36, y: 48, size: 48, opacity: 0.20, rotate: 6, dur: 20, delay: -14 },
  { letter: "S", x: 92, y: 56, size: 40, opacity: 0.16, rotate: -3, dur: 24, delay: -8 },
  { letter: "V", x: 4, y: 62, size: 50, opacity: 0.18, rotate: 8, dur: 19, delay: -12 },
  { letter: "M", x: 24, y: 68, size: 42, opacity: 0.15, rotate: -6, dur: 22, delay: -2 },
  { letter: "P", x: 60, y: 60, size: 46, opacity: 0.16, rotate: 5, dur: 21, delay: -15 },
  { letter: "I", x: 78, y: 72, size: 34, opacity: 0.12, rotate: -4, dur: 25, delay: -6 },
  { letter: "G", x: 44, y: 76, size: 38, opacity: 0.13, rotate: 7, dur: 23, delay: -9 },
];

export function TitleBackdrop() {
  return (
    <div className="lex-bd" aria-hidden="true">
      <BackdropStyles />
      {TILES.map((t, i) => {
        // Per-tile drift/sway, derived arithmetically from the index so it's
        // deterministic (stable across re-renders) yet varied per tile.
        const dx = ((i % 5) - 2) * 3; // -6..+6 px horizontal sway
        const dy = 10 + (i % 4) * 4; // 10..22 px vertical float
        const rot = t.rotate + (i % 2 === 0 ? 4 : -4); // rotation swing target
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
  /* a gentle vignette so tiles fade toward the wordmark area, keeping it legible */
  -webkit-mask-image: radial-gradient(140% 120% at 50% 30%, #000 55%, transparent 100%);
  mask-image: radial-gradient(140% 120% at 50% 30%, #000 55%, transparent 100%);
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
    transform: translate3d(var(--dx), calc(var(--dy) * -1), 0) rotate(var(--rot2)) scale(1.04);
    opacity: calc(var(--o) * 1.25);
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
