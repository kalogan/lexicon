/**
 * ChallengeScreens — the three framing beats of LEXICON's bounded "Challenge"
 * run (Slice 5). Challenge is a Balatro-shaped climb: 5 antes of score blinds
 * (Small / Big / Boss). These are the moments *between* the boards:
 *
 *  • AnteBanner    — "here's your next challenge" — shown before each blind.
 *  • ChallengeWin  — you cleared the final boss. Celebrate.
 *  • ChallengeLost — you missed a target. A gentle "try again".
 *
 * All three are PURE / presentational: they take a frozen prop shape (a parallel
 * task drives them), render real keyboard-accessible <button>s, and carry no game
 * logic. They reuse the shared warm-paper chrome from styles.css (.menu-veil,
 * .menu-card, .results-*, .btn, .depth-stat, --lex-* vars); the few extra touches
 * live in a scoped <style> block (the RelicCard.tsx pattern) so no other file is
 * edited.
 */
import type { JSX } from "react";
import type { Blind } from "./run/challenge.js";

/* ── AnteBanner ──────────────────────────────────────────────────────────────
 * The punchy "next blind" card. Ante eyebrow, the blind name big, a boss flag +
 * danger treatment when it's a boss, the target shown large, and a Begin CTA.
 */
export function AnteBanner(props: {
  blind: Blind;
  totalAntes: number;
  onStart: () => void;
  /** The active boss (boss blinds only) — its rule is shown so the player can plan. */
  bossRule?: { name: string; blurb: string } | null;
  /** Effective target to show (boss blinds are softened below blind.target). */
  target?: number;
}): JSX.Element {
  const { blind, totalAntes, onStart, bossRule, target } = props;
  const boss = blind.isBoss;
  const shown = target ?? blind.target;
  return (
    <div className="menu-veil">
      <ChallengeStyles />
      <div className={`cs-card cs-ante${boss ? " cs-ante--boss" : ""}`}>
        <div className="cs-eyebrow">
          Ante {blind.ante} <span className="cs-eyebrow-of">/ {totalAntes}</span>
        </div>

        <div className="cs-blind-name">
          {boss && (
            <span className="cs-skull" aria-hidden="true">
              ☠
            </span>
          )}
          {bossRule ? bossRule.name : blind.name}
        </div>

        {boss && <div className="cs-boss-tag">Boss Blind</div>}

        {bossRule && <div className="cs-boss-rule">{bossRule.blurb}</div>}

        <div className="cs-target">
          <span className="cs-target-label">Target</span>
          <span className="cs-target-num">{shown.toLocaleString()}</span>
        </div>

        <button type="button" className="btn primary cs-cta" onClick={onStart} autoFocus>
          Begin
        </button>
      </div>
    </div>
  );
}

/* ── ChallengeWin ────────────────────────────────────────────────────────────
 * Victory — the final boss fell. Gold, a pop-in, and the run's coin haul.
 */
export function ChallengeWin(props: {
  coins: number;
  onExit: () => void;
  /** The stake this run was cleared at (for the flavor line + unlock banner). */
  stakeName?: string;
  /** The next stake this win unlocked, if any. */
  nextStakeName?: string | null;
}): JSX.Element {
  const { coins, onExit, stakeName, nextStakeName } = props;
  return (
    <div className="menu-veil">
      <ChallengeStyles />
      <div className="cs-card cs-win" role="alert">
        <div className="cs-win-burst" aria-hidden="true" />
        <div className="cs-win-eyebrow">Challenge Cleared</div>
        <div className="cs-win-title">YOU WON</div>
        <p className="cs-win-line">
          {stakeName
            ? `You conquered all 5 antes at ${stakeName} stake.`
            : "You built an engine that conquered all 5 antes."}
        </p>
        {nextStakeName && <div className="cs-unlock">🔓 {nextStakeName} Stake unlocked</div>}

        <div className="cs-coins" aria-label={`${coins} coins`}>
          <span aria-hidden="true">🪙</span>
          <span className="cs-coins-num">{coins.toLocaleString()}</span>
        </div>

        <button type="button" className="btn primary cs-cta" onClick={onExit} autoFocus>
          Back to title
        </button>
      </div>
    </div>
  );
}

/* ── ChallengeLost ───────────────────────────────────────────────────────────
 * Defeat — a target was missed. Gentle, encouraging, not punishing.
 */
export function ChallengeLost(props: { blind: Blind; onExit: () => void }): JSX.Element {
  const { blind, onExit } = props;
  return (
    <div className="menu-veil">
      <ChallengeStyles />
      <div className="cs-card cs-lost" role="alert">
        <div className="menu-title cs-lost-eyebrow">Run over</div>
        <div className="cs-lost-title">Fell at Ante {blind.ante}</div>
        <div className="depth-stat cs-lost-blind">
          {blind.isBoss && (
            <span className="cs-skull-sm" aria-hidden="true">
              ☠
            </span>
          )}
          {blind.name}
        </div>
        <p className="cs-lost-line">
          The {blind.name} held. Build a deeper deck and try again.
        </p>

        <button type="button" className="btn cs-cta" onClick={onExit} autoFocus>
          Back to title
        </button>
      </div>
    </div>
  );
}

/* ── Scoped styles ───────────────────────────────────────────────────────────
 * One <style> per mounted screen; identical content is deduped by the browser
 * (same trick as RelicCard). Everything is scoped under `.cs-*` so nothing leaks,
 * and all color routes through the existing --lex-* vars.
 */
function ChallengeStyles() {
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: CHALLENGE_CSS }}
    />
  );
}

const CHALLENGE_CSS = `
.cs-card {
  position: relative;
  width: min(86vw, 360px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 24px;
  padding: 30px 26px;
  box-shadow: 0 24px 70px rgba(43, 36, 64, 0.3);
  overflow: hidden;
  animation: cs-card-in 0.42s cubic-bezier(0.2, 0.9, 0.3, 1.15);
}
@keyframes cs-card-in {
  from { opacity: 0; transform: translateY(18px) scale(0.94); }
  to { opacity: 1; transform: none; }
}
.cs-cta {
  width: 100%;
  margin-top: 14px;
}

/* ── AnteBanner ── */
.cs-ante--boss {
  border: 1px solid rgba(208, 86, 63, 0.5);
  box-shadow: 0 24px 70px rgba(208, 86, 63, 0.32);
}
.cs-eyebrow {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--lex-muted);
}
.cs-eyebrow-of { opacity: 0.7; }
.cs-blind-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 0.01em;
  color: var(--lex-ink);
  margin-top: 4px;
}
.cs-ante--boss .cs-blind-name { color: var(--lex-bad); }
.cs-skull { font-size: 26px; line-height: 1; }
.cs-boss-tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fff;
  background: var(--lex-bad);
  border-radius: 999px;
  padding: 3px 12px;
  margin-top: 2px;
}
.cs-boss-rule {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--lex-ink);
  max-width: 30ch;
}
.cs-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 14px;
}
.cs-target-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--lex-muted);
}
.cs-target-num {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  color: var(--lex-accent-deep);
  font-variant-numeric: tabular-nums;
}

/* ── ChallengeWin ── */
.cs-win {
  border: 1px solid rgba(217, 138, 61, 0.4);
  box-shadow:
    0 24px 70px rgba(217, 138, 61, 0.34),
    0 0 0 1px rgba(217, 138, 61, 0.25);
  animation: cs-win-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
@keyframes cs-win-in {
  0% { opacity: 0; transform: translateY(20px) scale(0.86); }
  60% { transform: scale(1.03); }
  100% { opacity: 1; transform: none; }
}
/* A soft radial gold burst behind the content. */
.cs-win-burst {
  position: absolute;
  top: -40%;
  left: 50%;
  width: 320px;
  height: 320px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(243, 198, 90, 0.5), transparent 70%);
  pointer-events: none;
  animation: cs-glow 2.6s ease-in-out infinite;
}
@keyframes cs-glow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.cs-win-eyebrow {
  position: relative;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--lex-accent-deep);
}
.cs-win-title {
  position: relative;
  font-size: 52px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--lex-accent-deep);
  text-shadow: 0 2px 10px rgba(217, 138, 61, 0.35);
}
.cs-win-line {
  position: relative;
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--lex-muted);
}
.cs-unlock {
  position: relative;
  margin-top: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--lex-accent-deep);
  background: rgba(217, 138, 61, 0.16);
  border: 1px solid rgba(217, 138, 61, 0.4);
}
.cs-coins {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 8px 18px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(243, 198, 90, 0.28), rgba(217, 138, 61, 0.18));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  font-size: 22px;
}
.cs-coins-num {
  font-size: 26px;
  font-weight: 800;
  color: var(--lex-accent-deep);
  font-variant-numeric: tabular-nums;
}

/* ── ChallengeLost ── */
.cs-lost-eyebrow { margin-bottom: 2px; }
.cs-lost-title {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--lex-ink);
}
.cs-lost-blind {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--lex-bad);
}
.cs-skull-sm { font-size: 14px; line-height: 1; }
.cs-lost-line {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--lex-muted);
}

@media (prefers-reduced-motion: reduce) {
  .cs-card, .cs-win, .cs-win-burst { animation: none !important; }
}
`;
