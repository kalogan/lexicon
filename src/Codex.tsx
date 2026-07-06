/**
 * Codex — LEXICON's design-wiki / almanac. A browsable, mobile-first reference of
 * everything a run can throw at you: the full relic collection, the per-board
 * modifiers, and the boss boards. Reachable from the title screen; read-only.
 *
 * Relics reuse <RelicCard mode="full"> so the collection looks exactly like the
 * draft/shop cards (rarity gem, legendary shimmer, the works). Modifiers + bosses
 * get lighter bespoke cards that echo their in-run banners (boon = green, twist =
 * amber, boss = danger). Counts in the subtitle are derived from the data.
 */
import { RelicCard, relicIcon } from "./RelicCard.js";
import { CATALOG } from "./run/cards.js";
import { MODIFIERS, type BoardMod } from "./run/modifiers.js";
import { BOSSES } from "./run/bosses.js";
import { CHARMS, type Charm } from "./run/charms.js";
import type { Card, Rarity } from "./run/engine.js";

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

export function Codex({ onExit }: { onExit: () => void }) {
  const relics = [...CATALOG].sort(byRarityThenName);
  const charms = [...CHARMS].sort(charmByRarityThenName);

  return (
    <div className="codex">
      <CodexCharmStyles />
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
    </div>
  );
}

/* ── Scoped charm styles ──────────────────────────────────────────────────────
 * Charms reuse the `.codex-mod*` card layout; these add a rarity-tinted top
 * accent + a small rarity chip (mirroring RelicCard's --r-* palette). Rendered
 * once via dangerouslySetInnerHTML so Codex needs no styles.css edits.
 */
function CodexCharmStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: CODEX_CHARM_CSS }}
    />
  );
}

const CODEX_CHARM_CSS = `
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
`;

export default Codex;
