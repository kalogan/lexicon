/**
 * LexiconWordmark — the LEXICON title rendered as a row of Scrabble tiles
 * (L1 E1 X8 I1 C3 O1 N1), so the hero mark is made of the same letter tiles that
 * drift in the backdrop. Each tile drops + settles in a staggered cascade on
 * mount, then rests. Self-contained (scoped inline <style>, the RelicCard
 * pattern) and screen-reader friendly (an sr-only "LEXICON" label; the tiles are
 * aria-hidden decoration).
 */
import type { CSSProperties } from "react";

/** LEXICON with real Scrabble point values. */
const LETTERS: ReadonlyArray<readonly [string, number]> = [
  ["L", 1], ["E", 1], ["X", 8], ["I", 1], ["C", 3], ["O", 1], ["N", 1],
];

export function LexiconWordmark() {
  return (
    <div className="lex-wm" aria-label="LEXICON">
      <WordmarkStyles />
      <span className="lex-wm__sr">LEXICON</span>
      <span className="lex-wm__row" aria-hidden="true">
        {LETTERS.map(([ch, pts], i) => (
          <span className="lex-wm__tile" style={{ animationDelay: `${i * 0.085}s` } as CSSProperties} key={i}>
            <span className="lex-wm__letter">{ch}</span>
            <sub className="lex-wm__pts">{pts}</sub>
          </span>
        ))}
      </span>
    </div>
  );
}

function WordmarkStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: WORDMARK_CSS }}
    />
  );
}

const WORDMARK_CSS = `
.lex-wm { display: inline-block; }
.lex-wm__sr {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.lex-wm__row {
  display: flex;
  justify-content: center;
  gap: clamp(3px, 1.2vw, 7px);
  letter-spacing: 0;
}
.lex-wm__tile {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(34px, 11.6vw, 58px);
  height: clamp(34px, 11.6vw, 58px);
  background: var(--lex-tile, #fbf7ee);
  color: var(--lex-ink, #2b2440);
  border-radius: clamp(9px, 3vw, 14px);
  box-shadow:
    0 3px 0 rgba(43, 36, 64, 0.16),
    0 8px 20px rgba(43, 36, 64, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  text-shadow: none;
  animation: lex-wm-drop 0.6s cubic-bezier(0.2, 0.85, 0.25, 1.12) both;
}
.lex-wm__letter {
  font-size: clamp(19px, 6.4vw, 32px);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1;
}
.lex-wm__pts {
  position: absolute;
  right: 13%;
  bottom: 9%;
  font-size: clamp(8px, 2.3vw, 11px);
  font-weight: 700;
  line-height: 1;
  opacity: 0.72;
}
@keyframes lex-wm-drop {
  0% { opacity: 0; transform: translateY(-40px) rotate(-7deg) scale(0.88); }
  55% { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .lex-wm__tile { animation: lex-wm-fade 0.4s ease both; }
}
@keyframes lex-wm-fade { from { opacity: 0; } to { opacity: 1; } }
`;

export default LexiconWordmark;
