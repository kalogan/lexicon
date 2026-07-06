/**
 * Codex — LEXICON's design-wiki / almanac, now organized into three tabs:
 *
 *   • Collection   — the browsable reference of everything a run can throw at you:
 *                    the full relic collection, charms, per-board modifiers, and
 *                    boss boards (the original Codex content, unchanged).
 *   • Stats        — lifetime stats from the meta store (runs, best depth, …).
 *   • Achievements — every achievement, unlocked ones in full color, locked ones
 *                    dimmed so they read as goals.
 *
 * Reachable from the title screen; read-only. Relics reuse <RelicCard mode="full">
 * so the collection looks exactly like the draft/shop cards (rarity gem, legendary
 * shimmer, the works). Modifiers + bosses get lighter bespoke cards that echo their
 * in-run banners. The header + ✕ back button stay put; the tab bar stays visible;
 * only the content region below swaps and scrolls.
 */
import { useState } from "react";
import { RelicCard, relicIcon } from "./RelicCard.js";
import { CATALOG } from "./run/cards.js";
import { MODIFIERS, type BoardMod } from "./run/modifiers.js";
import { BOSSES } from "./run/bosses.js";
import { CHARMS, type Charm } from "./run/charms.js";
import type { Card, Rarity } from "./run/engine.js";
import { getStats, getUnlocked, ACHIEVEMENTS } from "./meta.js";

/** Legendary leads, then rare → uncommon → common; ties broken by name. */
const RARITY_ORDER: Record<Rarity, number> = {
  legendary: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
};

function byRarityThenName(a: Card, b: Card): number {
  const r = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
  return r !== 0 ? r : a.name.localeCompare(b.name);
}

/** A tasteful emoji for a board modifier — reuse the relic heuristics, with a
 *  couple of modifier-specific overrides for the non-card boons. */
function modIcon(mod: BoardMod): string {
  if (mod.goldTile) return "◆";
  if (mod.startTimeBonus) return "⏳";
  if (mod.card) return relicIcon(mod.card);
  return mod.tone === "boon" ? "✨" : "🔀";
}

/** A tasteful emoji per charm effect kind — one glyph for what the one-shot does. */
function charmIcon(charm: Charm): string {
  switch (charm.effect.kind) {
    case "plays":
      return "➕";
    case "reroll":
      return "🎲";
    case "doubleNext":
      return "✨";
    case "clearSeals":
      return "🗝️";
    case "permaMult":
      return "📈";
    case "transmute":
      return "🔀";
  }
}

/** Title-cased rarity label for the codex chip (charms never go legendary today). */
const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

/** Same rarity-first-then-name ordering as relics, over charms. */
function charmByRarityThenName(a: Charm, b: Charm): number {
  const r = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
  return r !== 0 ? r : a.name.localeCompare(b.name);
}

type Tab = "Collection" | "Stats" | "Achievements";
const TABS: readonly Tab[] = ["Collection", "Stats", "Achievements"];

export function Codex({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("Collection");

  const relics = [...CATALOG].sort(byRarityThenName);
  const charms = [...CHARMS].sort(charmByRarityThenName);

  return (
    <div className="codex">
      <CodexStyles />
      <header className="codex-header">
        <div className="codex-heading">
          <h1 className="codex-title">Codex</h1>
          <p className="codex-subtitle">
            {relics.length} relics · {charms.length} charms · {MODIFIERS.length} modifiers ·{" "}
            {BOSSES.length} bosses
          </p>
        </div>
        <button type="button" className="codex-close" onClick={onExit} aria-label="Back to title">
          ✕
        </button>
      </header>

      <div className="codex-tabs" role="tablist" aria-label="Codex sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`codex-tab${tab === t ? " codex-tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Collection" && <CollectionTab relics={relics} charms={charms} />}
      {tab === "Stats" && <StatsTab />}
      {tab === "Achievements" && <AchievementsTab />}
    </div>
  );
}

/* ── Collection tab ───────────────────────────────────────────────────────────
 * The original Codex content, verbatim. Reuses `.codex-scroll` for its scroll.
 */
function CollectionTab({ relics, charms }: { relics: Card[]; charms: Charm[] }) {
  return (
    <div className="codex-scroll">
      {/* ── Relics ── */}
      <section className="codex-section">
        <h2 className="codex-section-title">
          Relics <span className="codex-count">{relics.length}</span>
        </h2>
        <div className="codex-relic-grid">
          {relics.map((c) => (
            <RelicCard key={c.id} card={c} mode="full" />
          ))}
        </div>
      </section>

      {/* ── Board Modifiers ── */}
      <section className="codex-section">
        <h2 className="codex-section-title">
          Board Modifiers <span className="codex-count">{MODIFIERS.length}</span>
        </h2>
        <div className="codex-mod-grid">
          {MODIFIERS.map((m) => (
            <div key={m.id} className={`codex-mod codex-mod--${m.tone}`}>
              <div className="codex-mod-top">
                <span className="codex-mod-icon" aria-hidden="true">
                  {modIcon(m)}
                </span>
                <span className="codex-mod-name">{m.name}</span>
                <span className={`codex-tone codex-tone--${m.tone}`}>
                  {m.tone === "boon" ? "BOON" : "TWIST"}
                </span>
              </div>
              <p className="codex-mod-blurb">{m.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Charms ── */}
      <section className="codex-section">
        <h2 className="codex-section-title">
          Charms <span className="codex-count">{charms.length}</span>
        </h2>
        <div className="codex-mod-grid">
          {charms.map((c) => (
            <div key={c.id} className={`codex-mod codex-charm codex-charm--${c.rarity}`}>
              <div className="codex-mod-top">
                <span className="codex-mod-icon" aria-hidden="true">
                  {charmIcon(c)}
                </span>
                <span className="codex-mod-name">{c.name}</span>
                <span className={`codex-charm-rarity codex-charm-rarity--${c.rarity}`}>
                  {RARITY_LABEL[c.rarity]}
                </span>
              </div>
              <p className="codex-mod-blurb">{c.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bosses ── */}
      <section className="codex-section">
        <h2 className="codex-section-title">
          Bosses <span className="codex-count">{BOSSES.length}</span>
        </h2>
        <div className="codex-boss-grid">
          {BOSSES.map((b) => (
            <div key={b.id} className="codex-boss">
              <div className="codex-boss-top">
                <span className="codex-boss-mark" aria-hidden="true">
                  ☠
                </span>
                <span className="codex-boss-name">{b.name}</span>
              </div>
              <p className="codex-boss-blurb">{b.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Stats tab ────────────────────────────────────────────────────────────────
 * A tidy two-column (label · value) list read once from the meta store. All-zero
 * is a perfectly fine "empty" state — no special-casing needed.
 */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function StatsTab() {
  const s = getStats();
  const rows: readonly [string, string][] = [
    ["Runs played", `${s.runs}`],
    ["Time played", formatDuration(s.timePlayed)],
    ["Deepest board", `${s.bestDepth}`],
    ["Best run score", `${s.bestScore}`],
    ["Words played", `${s.totalWords}`],
    ["Longest word", `${s.longestWord} letters`],
    ["Best single word", `${s.bestWordScore}`],
    ["Best mult", `×${(1 + s.bestMult).toFixed(1)}`],
    ["Bosses beaten", `${s.bossesBeaten}`],
  ];

  return (
    <div className="codex-scroll">
      <section className="codex-section">
        <dl className="codex-stats">
          {rows.map(([label, value]) => (
            <div key={label} className="codex-stat">
              <dt className="codex-stat-label">{label}</dt>
              <dd className="codex-stat-value">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/* ── Achievements tab ─────────────────────────────────────────────────────────
 * Unlocked-first grid. Unlocked = accent-tinted, full color. Locked = dimmed +
 * desaturated but still shows name + desc so it reads as a goal.
 */
function AchievementsTab() {
  const unlocked = getUnlocked();
  const ordered = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = unlocked.has(a.id) ? 0 : 1;
    const ub = unlocked.has(b.id) ? 0 : 1;
    return ua - ub;
  });

  return (
    <div className="codex-scroll">
      <section className="codex-section">
        <h2 className="codex-section-title">
          Achievements{" "}
          <span className="codex-count">
            {unlocked.size} / {ACHIEVEMENTS.length} unlocked
          </span>
        </h2>
        <div className="codex-ach-grid">
          {ordered.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                className={`codex-ach${isUnlocked ? " codex-ach--unlocked" : " codex-ach--locked"}`}
              >
                <span className="codex-ach-icon" aria-hidden="true">
                  {a.icon}
                </span>
                <div className="codex-ach-body">
                  <span className="codex-ach-name">{a.name}</span>
                  <span className="codex-ach-desc">{a.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── Scoped styles ────────────────────────────────────────────────────────────
 * Charms reuse the `.codex-mod*` card layout with a rarity-tinted accent. The tab
 * bar, Stats grid, and Achievements grid are new here. Rendered once via
 * dangerouslySetInnerHTML so Codex needs no styles.css edits.
 */
function CodexStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: CODEX_CSS }}
    />
  );
}

const CODEX_CSS = `
/* ── Charms ── */
.codex-charm { border-top: 3px solid var(--charm-accent, var(--r-common)); }
.codex-charm--common { --charm-accent: var(--r-common); }
.codex-charm--uncommon { --charm-accent: var(--r-uncommon); }
.codex-charm--rare { --charm-accent: var(--r-rare); }
.codex-charm--legendary { --charm-accent: var(--r-legendary); }

.codex-charm-rarity {
  margin-left: auto;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--charm-accent, var(--r-common));
  white-space: nowrap;
}

/* ── Tab bar ── */
.codex-tabs {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto 14px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(43, 36, 64, 0.12);
  border-radius: 12px;
}
.codex-tab {
  flex: 1 1 0;
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 9px 10px;
  border-radius: 9px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--lex-muted);
  transition: background 0.15s ease, color 0.15s ease;
}
.codex-tab:hover { color: var(--lex-ink); }
.codex-tab:focus-visible {
  outline: 2px solid var(--lex-accent);
  outline-offset: 2px;
}
.codex-tab--active {
  background: var(--lex-accent);
  color: #fff;
  box-shadow: 0 2px 0 var(--lex-accent-deep);
}
.codex-tab--active:hover { color: #fff; }

/* ── Stats grid ── */
.codex-stats {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.codex-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  background: var(--lex-tile);
  border-radius: 10px;
}
.codex-stat-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--lex-muted);
}
.codex-stat-value {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: var(--lex-ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ── Achievements grid ── */
.codex-ach-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 520px) {
  .codex-ach-grid { grid-template-columns: 1fr 1fr; }
}
.codex-ach {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--lex-tile);
  border: 1px solid rgba(43, 36, 64, 0.1);
}
.codex-ach--unlocked {
  background: rgba(217, 138, 61, 0.12);
  border-color: rgba(217, 138, 61, 0.45);
}
.codex-ach--locked {
  opacity: 0.55;
  filter: grayscale(1);
}
.codex-ach-icon {
  flex: 0 0 auto;
  font-size: 26px;
  line-height: 1;
  width: 34px;
  text-align: center;
}
.codex-ach--locked .codex-ach-icon { opacity: 0.7; }
.codex-ach-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.codex-ach-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--lex-ink);
}
.codex-ach--unlocked .codex-ach-name { color: var(--lex-accent-deep); }
.codex-ach-desc {
  font-size: 12px;
  line-height: 1.35;
  color: var(--lex-muted);
}
`;

export default Codex;
