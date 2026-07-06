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

export function Codex({ onExit }: { onExit: () => void }) {
  const relics = [...CATALOG].sort(byRarityThenName);

  return (
    <div className="codex">
      <header className="codex-header">
        <div className="codex-heading">
          <h1 className="codex-title">Codex</h1>
          <p className="codex-subtitle">
            {relics.length} relics · {MODIFIERS.length} modifiers · {BOSSES.length} bosses
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

export default Codex;
