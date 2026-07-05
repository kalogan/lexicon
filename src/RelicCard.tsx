/**
 * RelicCard — a collectible-feeling relic tile for LEXICON's roguelike run.
 *
 * Two modes share one visual language (warm paper + amber, rarity-tinted):
 *
 *  • mode="chip"  — the always-visible "your relics" deck row. ICON + NAME only,
 *    no effect text, so a busy deck reads at a glance. Small enough that 3–5 fit
 *    a mobile row. This is the declutter that makes relics feel *collectible*
 *    rather than a wall of rules text.
 *
 *  • mode="full"  — the draft + shop overlays. ICON, prominent NAME, secondary
 *    effect TEXT, a rarity label, and an optional 🪙 price. Clearly a card.
 *
 * Rarity drives a corner gem + top accent + subtle tint; legendary gets a gold
 * shimmer so it reads as *special*. `flash` is the "just triggered" pop (a word
 * lit this relic up). All styling is inline + a tiny scoped <style>, so the file
 * drops in with zero CSS edits elsewhere.
 */
import type { CSSProperties } from "react";
import type { Card, Rarity } from "./run/engine.js";

export interface RelicCardProps {
  card: Card;
  /** "chip" (default) = compact deck tile; "full" = draft/shop card. */
  mode?: "chip" | "full";
  /** The "just triggered" glow/pop — a word fired this relic. */
  flash?: boolean;
  /** When set (shop), renders a 🪙 price row. */
  price?: number;
  /** Dim + non-interactive (e.g. can't afford in shop). */
  disabled?: boolean;
  onClick?: () => void;
}

/* ── Icon ──────────────────────────────────────────────────────────────────
 * Base emoji by kind, upgraded by a keyword scan of the card's name+text when
 * a more specific icon is obviously better. Pure — safe to call anywhere.
 */
const KIND_ICON: Record<Card["kind"], string> = {
  dictionary: "📖",
  charm: "✨",
  legendary: "👑",
};

/** Ordered keyword → emoji rules. First match wins, so put specifics first. */
const ICON_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(time|hourglass|second|clock|tempo)\b/i, "⏳"],
  [/\b(rare[- ]?letter|q\b|z\b|x\b|j\b|jewel|gem|diamond)\b/i, "💎"],
  [/\b(prefix|suffix|affix)\b/i, "🔤"],
  [/\bvowel/i, "🅰️"],
  [/\b(alphabet|letters?|glyph)\b/i, "🔠"],
  [/\b(scholar|tome|library|book|lexicon|encyclop)/i, "📚"],
  [/\b(mult|combo|multiply|multiplier)\b/i, "🔥"],
  [/\b(distinct|mosaic|palette|variety|unique)\b/i, "🎨"],
  [/\b(chip|score|points?|coin|gold|treasure)\b/i, "🪙"],
  [/\b(chain|combo|streak|snowball|cascade)\b/i, "⛓️"],
  [/\b(long|big|giant|huge|epic)\b/i, "📏"],
  [/\b(alliterat|echo|repeat|rhyme)\b/i, "🎵"],
  [/\b(palindrome|mirror|reverse)\b/i, "🪞"],
  [/\b(star|celestial|astral|cosmic)\b/i, "⭐"],
];

/** Derive a tasteful emoji for a relic. Exported for reuse (previews, tooltips). */
export function relicIcon(card: Pick<Card, "name" | "text" | "kind">): string {
  const hay = `${card.name} ${card.text}`;
  for (const [re, emoji] of ICON_RULES) {
    if (re.test(hay)) return emoji;
  }
  return KIND_ICON[card.kind] ?? "🎴";
}

/* ── Rarity palette ─────────────────────────────────────────────────────────
 * Reuses the game's existing --r-* CSS vars; tints/shadows are derived here so
 * the component is self-contained.
 */
interface RaritySkin {
  accent: string;
  /** Faint fill tint layered over the paper tile. */
  tint: string;
  label: string;
}
const RARITY: Record<Rarity, RaritySkin> = {
  common: { accent: "var(--r-common)", tint: "rgba(176,165,150,0.10)", label: "Common" },
  uncommon: { accent: "var(--r-uncommon)", tint: "rgba(111,174,114,0.12)", label: "Uncommon" },
  rare: { accent: "var(--r-rare)", tint: "rgba(95,143,208,0.14)", label: "Rare" },
  legendary: { accent: "var(--r-legendary)", tint: "rgba(217,138,61,0.16)", label: "Legendary" },
};

export function RelicCard({
  card,
  mode = "chip",
  flash = false,
  price,
  disabled = false,
  onClick,
}: RelicCardProps) {
  const skin = RARITY[card.rarity];
  const icon = relicIcon(card);
  const isLegendary = card.rarity === "legendary";
  const interactive = typeof onClick === "function";
  const Tag: "button" | "div" = interactive ? "button" : "div";

  const classes = [
    "relic",
    `relic--${mode}`,
    `relic--r-${card.rarity}`,
    isLegendary ? "relic--legendary" : "",
    flash ? "relic--flash" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const baseStyle: CSSProperties = {
    // rarity vars consumed by the scoped CSS below
    ["--relic-accent" as string]: skin.accent,
    ["--relic-tint" as string]: skin.tint,
    opacity: disabled ? 0.5 : 1,
    cursor: interactive && !disabled ? "pointer" : "default",
  };

  return (
    <>
      <RelicStyles />
      <Tag
        className={classes}
        style={baseStyle}
        onClick={disabled ? undefined : onClick}
        disabled={interactive && disabled ? true : undefined}
        title={mode === "chip" ? `${card.name} — ${card.text}` : undefined}
        type={interactive ? "button" : undefined}
      >
        {/* rarity gem, top-right corner */}
        <span className="relic__gem" aria-hidden="true" />

        {mode === "chip" ? (
          <span className="relic__chipRow">
            <span className="relic__icon relic__icon--chip" aria-hidden="true">
              {icon}
            </span>
            <span className="relic__name relic__name--chip">{card.name}</span>
          </span>
        ) : (
          <>
            <span className="relic__icon relic__icon--full" aria-hidden="true">
              {icon}
            </span>
            <span className="relic__name relic__name--full">{card.name}</span>
            <span className="relic__text">{card.text}</span>
            <span className="relic__footer">
              <span className="relic__rarity">{skin.label}</span>
              {typeof price === "number" && <span className="relic__price">🪙 {price}</span>}
            </span>
          </>
        )}
      </Tag>
    </>
  );
}

/* ── Scoped styles ──────────────────────────────────────────────────────────
 * Rendered once per RelicCard, but the id guard means the browser only keeps
 * one copy in effect (duplicate <style> with identical content is harmless and
 * cheap). Everything is class-scoped under `.relic` so nothing leaks.
 */
function RelicStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: RELIC_CSS }}
    />
  );
}

const RELIC_CSS = `
.relic {
  position: relative;
  appearance: none;
  text-align: left;
  font: inherit;
  color: var(--lex-ink);
  border: 1px solid rgba(43, 36, 64, 0.10);
  border-top: 3px solid var(--relic-accent);
  border-radius: 14px;
  background:
    linear-gradient(180deg, var(--relic-tint), transparent 62%),
    var(--lex-tile);
  box-shadow:
    0 2px 6px rgba(43, 36, 64, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

/* Corner rarity gem — a small faceted lozenge that catches the accent color. */
.relic__gem {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 9px;
  height: 9px;
  border-radius: 3px;
  transform: rotate(45deg);
  background: var(--relic-accent);
  box-shadow:
    0 0 0 2px rgba(251, 247, 238, 0.85),
    0 1px 3px rgba(43, 36, 64, 0.25);
}

.relic__icon { line-height: 1; display: inline-block; }
.relic__name { font-weight: 800; letter-spacing: 0.01em; color: var(--lex-ink); }
.relic__text { color: var(--lex-muted); }

/* ── chip mode ── */
.relic--chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 7px 11px 7px 9px;
  border-top-width: 3px;
  max-width: 150px;
}
.relic__chipRow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.relic__icon--chip { font-size: 16px; }
.relic__name--chip {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
button.relic--chip:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(43, 36, 64, 0.18), inset 0 1px 0 rgba(255,255,255,0.5); }
button.relic--chip:active { transform: translateY(0); }

/* ── full mode ── */
.relic--full {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-height: 132px;
  padding: 16px 14px 12px;
  border-top-width: 4px;
}
.relic__icon--full {
  font-size: 30px;
  margin-bottom: 2px;
  filter: drop-shadow(0 2px 3px rgba(43, 36, 64, 0.18));
}
.relic__name--full { font-size: 15px; line-height: 1.15; }
.relic--full .relic__text { font-size: 12px; line-height: 1.3; }
.relic__footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
}
.relic__rarity {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--relic-accent);
}
.relic__price {
  font-size: 13px;
  font-weight: 800;
  color: var(--lex-accent-deep);
  font-variant-numeric: tabular-nums;
}
button.relic--full:not(:disabled):hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 26px rgba(43, 36, 64, 0.22), inset 0 1px 0 rgba(255,255,255,0.5);
}
button.relic--full:not(:disabled):active { transform: translateY(-1px); }

/* ── legendary: gold glow + slow shimmer sweep ── */
.relic--legendary {
  border-color: rgba(217, 138, 61, 0.35);
  box-shadow:
    0 2px 6px rgba(217, 138, 61, 0.30),
    0 0 0 1px rgba(217, 138, 61, 0.30),
    0 0 18px rgba(217, 138, 61, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.relic--legendary::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 245, 220, 0.55) 48%,
    rgba(255, 255, 255, 0.15) 54%,
    transparent 70%
  );
  transform: translateX(-120%);
  animation: relic-shimmer 3.6s ease-in-out infinite;
}
@keyframes relic-shimmer {
  0%, 62% { transform: translateX(-120%); }
  86%, 100% { transform: translateX(120%); }
}

/* ── flash: the "just triggered" pop ── */
.relic--flash {
  animation: relic-pop 0.7s ease;
  z-index: 1;
}
@keyframes relic-pop {
  0% { transform: translateY(0) scale(1); }
  28% {
    transform: translateY(-6px) scale(1.07);
    box-shadow:
      0 0 0 2px var(--lex-accent),
      0 10px 24px rgba(217, 138, 61, 0.55);
  }
  100% { transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .relic, .relic--legendary::after, .relic--flash { animation: none !important; transition: none !important; }
}
`;

export default RelicCard;
