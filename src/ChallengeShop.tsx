/**
 * ChallengeShop — the between-blinds SHOP for LEXICON's Challenge mode.
 *
 * Between score "blinds" you spend coins to shape the run: buy RELICS and modify
 * your LETTER-DECK (add a tile / remove a tile). This component is purely
 * PRESENTATIONAL — the parent owns the real economy (coin deduction, deck-min
 * floor, relic ownership). Here we just disable buttons when `coins < cost` and
 * fire the handlers.
 *
 * The panel dresses as a distinct dark "vault" (reusing `.shop-card` / `.shop-head`)
 * so it never reads like the draft screen. Three shelves stack on mobile:
 *   1. relics for sale (reusing <RelicCard mode="full" price disabled onClick />),
 *   2. your deck — a chip viewer with an A–Z "add" picker and a "remove mode",
 *   3. a footer with Reroll + a prominent Continue.
 *
 * All NEW styling lives in a scoped <style> (mirroring RelicCard's pattern), so
 * this file drops in with zero edits to styles.css.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { Card } from "./run/engine.js";
import type { Tile } from "./run/deck.js";
import type { Charm } from "./run/charms.js";
import { deckComposition } from "./run/deck.js";
import { RelicCard } from "./RelicCard.js";

export interface ShopRelic {
  card: Card;
  price: number;
}

export interface ShopCharm {
  charm: Charm;
  price: number;
}

export interface ChallengeShopProps {
  coins: number;
  deck: readonly Tile[];
  relics: readonly ShopRelic[];
  charms: readonly ShopCharm[];
  /** True when the charm slots are full — buying is blocked with a hint. */
  charmSlotsFull: boolean;
  addLetterCost: number;
  removeTileCost: number;
  rerollCost: number;
  onBuyRelic: (card: Card) => void;
  onBuyCharm: (charm: Charm) => void;
  onAddLetter: (letter: string) => void;
  onRemoveTile: (letter: Tile) => void;
  onReroll: () => void;
  onContinue: () => void;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

/** "qu" → "Qu", "a" → "A". */
function tileLabel(t: Tile): string {
  return t === "qu" ? "Qu" : t.toUpperCase();
}

export function ChallengeShop(props: ChallengeShopProps): JSX.Element {
  const {
    coins,
    deck,
    relics,
    charms,
    charmSlotsFull,
    addLetterCost,
    removeTileCost,
    rerollCost,
    onBuyRelic,
    onBuyCharm,
    onAddLetter,
    onRemoveTile,
    onReroll,
    onContinue,
  } = props;

  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);

  const comp = deckComposition(deck);
  const canAdd = coins >= addLetterCost;
  const canRemove = coins >= removeTileCost;
  const canReroll = coins >= rerollCost;

  function handlePick(letter: string) {
    onAddLetter(letter.toLowerCase());
    setPicking(false);
  }

  function handleRemove(letter: Tile) {
    if (!canRemove) return;
    onRemoveTile(letter);
  }

  // "Remove mode" only takes effect while removal is still affordable, so the
  // chips fall back to plain (non-tappable) as soon as coins run out — no need
  // to mutate state during render.
  const removeMode = removing && canRemove;

  return (
    <div className="menu-veil" role="dialog" aria-modal="true" aria-label="Shop">
      <ShopStyles />
      <div className="shop-card cshop">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="shop-head">
          <h2 className="shop-title">Shop — Ante break</h2>
          <span className="shop-coins cshop__coins">
            🪙 <span className="cshop__num">{coins}</span>
          </span>
        </header>

        {/* ── Relics for sale ────────────────────────────────────────────── */}
        <section className="cshop__section" aria-label="Relics for sale">
          <h3 className="cshop__h">Relics for sale</h3>
          {relics.length === 0 ? (
            <p className="cshop__soldout">Sold out — nothing left on the shelf.</p>
          ) : (
            <div className="cshop__relics">
              {relics.map(({ card, price }) => (
                <RelicCard
                  key={card.id}
                  card={card}
                  mode="full"
                  price={price}
                  disabled={coins < price}
                  onClick={() => onBuyRelic(card)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Charms for sale ────────────────────────────────────────────── */}
        <section className="cshop__section" aria-label="Charms for sale">
          <h3 className="cshop__h">
            Charms {charmSlotsFull && <span className="cshop__full">· slots full</span>}
          </h3>
          {charms.length === 0 ? (
            <p className="cshop__soldout">Sold out — spent the shelf.</p>
          ) : (
            <div className="cshop__charms">
              {charms.map(({ charm, price }) => {
                const disabled = coins < price || charmSlotsFull;
                return (
                  <button
                    key={charm.id}
                    type="button"
                    className={`cshop__charm cshop__charm--${charm.rarity}`}
                    disabled={disabled}
                    onClick={() => onBuyCharm(charm)}
                    aria-label={`Buy ${charm.name} for ${price} coins — ${charm.blurb}`}
                  >
                    <span className="cshop__charmName">{charm.name}</span>
                    <span className="cshop__charmBlurb">{charm.blurb}</span>
                    <span className="cshop__charmPrice">🪙 {price}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Your letter-deck ───────────────────────────────────────────── */}
        <section className="cshop__section" aria-label="Your deck">
          <div className="cshop__deckHead">
            <h3 className="cshop__h">Your deck ({deck.length} tiles)</h3>
            {removing && (
              <span className="cshop__hint" role="status">
                Tap a tile to remove one copy 🪙 {removeTileCost}
              </span>
            )}
          </div>

          <div className="cshop__chips">
            {comp.map(({ letter, count }) => {
              const label = tileLabel(letter);
              return removeMode ? (
                <button
                  key={letter}
                  type="button"
                  className="cshop__chip cshop__chip--remove"
                  onClick={() => handleRemove(letter)}
                  aria-label={`Remove one ${label} (costs ${removeTileCost} coins)`}
                >
                  <span className="cshop__chipL">{label}</span>
                  <span className="cshop__chipN">×{count}</span>
                  <span className="cshop__chipMinus" aria-hidden="true">
                    −
                  </span>
                </button>
              ) : (
                <span key={letter} className="cshop__chip">
                  <span className="cshop__chipL">{label}</span>
                  <span className="cshop__chipN">×{count}</span>
                </span>
              );
            })}
          </div>

          <div className="cshop__deckActions">
            <button
              type="button"
              className="btn cshop__deckBtn"
              disabled={!canAdd}
              aria-expanded={picking}
              onClick={() => setPicking((p) => !p)}
            >
              + Add a letter <span className="cshop__cost">🪙 {addLetterCost}</span>
            </button>
            <button
              type="button"
              className={`btn cshop__deckBtn${removing ? " cshop__deckBtn--active" : ""}`}
              disabled={!canRemove}
              aria-pressed={removing}
              onClick={() => setRemoving((r) => !r)}
            >
              {removing ? "Done removing" : "Remove a tile"}{" "}
              <span className="cshop__cost">🪙 {removeTileCost} each</span>
            </button>
          </div>

          {picking && (
            <div className="letterpick cshop__picker">
              <div className="cshop__pickerHead">
                <span className="cshop__h">Add which letter?</span>
                <button
                  type="button"
                  className="btn ghost cshop__pickerClose"
                  onClick={() => setPicking(false)}
                >
                  Cancel
                </button>
              </div>
              <div className="letterpick-grid">
                {ALPHABET.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className="letterpick-key"
                    onClick={() => handlePick(l)}
                    aria-label={`Add letter ${l.toUpperCase()}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="shop-actions cshop__footer">
          <button
            type="button"
            className="btn cshop__reroll"
            disabled={!canReroll}
            onClick={onReroll}
          >
            🎲 Reroll <span className="cshop__cost">🪙 {rerollCost}</span>
          </button>
          <button type="button" className="btn primary cshop__continue" onClick={onContinue}>
            Continue →
          </button>
        </footer>
      </div>
    </div>
  );
}

function ShopStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SHOP_CSS }}
    />
  );
}

const SHOP_CSS = `
.cshop {
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cshop__num { font-variant-numeric: tabular-nums; }

.cshop__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cshop__h {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lex-accent);
}

/* ── Relics shelf ── */
.cshop__relics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.cshop__soldout {
  margin: 0;
  font-size: 13px;
  color: rgba(244, 239, 228, 0.6);
  font-style: italic;
}
.cshop__full {
  color: var(--lex-bad);
  font-weight: 800;
}

/* ── Charms shelf ── */
.cshop__charms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.cshop__charm {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(251, 247, 238, 0.1);
  border: 1px solid rgba(251, 247, 238, 0.18);
  border-left-width: 3px;
  color: #f4efe4;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: transform 0.1s ease, background 0.1s ease;
}
.cshop__charm:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(251, 247, 238, 0.16);
}
.cshop__charm:active:not(:disabled) { transform: translateY(0); }
.cshop__charm:disabled { opacity: 0.42; cursor: not-allowed; }
.cshop__charm--common { border-left-color: rgba(244, 239, 228, 0.5); }
.cshop__charm--uncommon { border-left-color: #6fb3a0; }
.cshop__charm--rare { border-left-color: #6aa0e0; }
.cshop__charm--legendary { border-left-color: #d98a3d; }
.cshop__charmName { font-weight: 800; font-size: 14px; }
.cshop__charmBlurb {
  font-size: 11px;
  color: rgba(244, 239, 228, 0.7);
  line-height: 1.25;
}
.cshop__charmPrice {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--lex-accent);
  font-variant-numeric: tabular-nums;
}

/* ── Deck viewer ── */
.cshop__deckHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.cshop__hint {
  font-size: 11px;
  font-weight: 700;
  color: var(--lex-accent);
  font-variant-numeric: tabular-nums;
}
.cshop__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.cshop__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border-radius: 10px;
  background: rgba(251, 247, 238, 0.12);
  border: 1px solid rgba(251, 247, 238, 0.15);
  color: #f4efe4;
  font: inherit;
  line-height: 1;
}
.cshop__chipL { font-weight: 800; font-size: 15px; }
.cshop__chipN {
  font-size: 11px;
  font-weight: 700;
  color: rgba(244, 239, 228, 0.65);
  font-variant-numeric: tabular-nums;
}
button.cshop__chip--remove {
  cursor: pointer;
  transition: transform 0.1s ease, background 0.1s ease, border-color 0.1s ease;
  border-color: rgba(208, 86, 63, 0.55);
  background: rgba(208, 86, 63, 0.18);
}
button.cshop__chip--remove:hover {
  transform: translateY(-2px);
  background: var(--lex-bad);
  border-color: var(--lex-bad);
}
button.cshop__chip--remove:active { transform: translateY(0); }
.cshop__chipMinus {
  font-weight: 900;
  font-size: 15px;
  color: #ffd9d0;
  margin-left: 1px;
}

.cshop__deckActions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.cshop__deckBtn {
  flex: 1 1 45%;
  min-width: 140px;
  padding: 11px 14px;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.cshop__deckBtn--active {
  background: var(--lex-bad);
  color: #fff;
  border-color: transparent;
}
.cshop__cost {
  font-size: 12px;
  font-weight: 800;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cshop__deckBtn:disabled,
.cshop__reroll:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── A–Z picker (reuses .letterpick / .letterpick-grid / .letterpick-key) ── */
.cshop__picker {
  width: 100%;
  box-sizing: border-box;
  animation: none;
}
.cshop__pickerHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cshop__pickerClose { padding: 6px 12px; font-size: 13px; }

/* ── Footer ── */
.cshop__footer {
  margin-top: 4px;
  gap: 10px;
}
.cshop__reroll {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cshop__continue { flex: 1; }

@media (max-width: 420px) {
  .cshop__deckBtn { flex-basis: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  button.cshop__chip--remove { transition: none !important; }
}
`;

export default ChallengeShop;
