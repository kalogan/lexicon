/**
 * store — LEXICON's persistence layer, dogfooding game-kit's `settings` module.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The game used to poke localStorage directly from two places:
 *   - App.tsx    → per-mode best score under keys `lexicon:best:<modeId>`.
 *   - sound.ts   → the mute flag under key `lexicon:muted` ("1"/"0").
 * That is exactly the tiny key→value pref/score store the kit's `settings`
 * module was built for, so this file replaces the raw-localStorage scheme with
 * ONE kit-backed settings store. It gives the kit module a real consumer and
 * gives the game a clean, typed, synchronous-feeling API.
 *
 * ── WHY `settings` (not `save`) ─────────────────────────────────────────────
 * `settings` forward-merges persisted values over the current defaults, so a
 * newly-added preference is picked up automatically for existing players, and
 * it supports a `migrate` hook for schema bumps. `save` is a checksummed,
 * all-or-nothing snapshot with no merge/migrate — wrong shape for a small bag
 * of prefs + scores that should evolve additively. So: `settings`.
 *
 * ── PERSISTENCE MODEL ───────────────────────────────────────────────────────
 * A single module-level settings-store singleton holds the WHOLE state object
 * under one localStorage key, "lexicon" (NOT the old per-key scheme). The kit
 * persists `{ version, data: <state> }` there and re-reads on construction.
 * State shape:
 *   { bestByMode: Record<string, number>, muted: boolean }
 * Defaults: every known mode starts at best 0; muted false.
 *
 * ── SSR / STORAGE SAFETY ────────────────────────────────────────────────────
 * We rely on the kit module's own guarantee: when localStorage is unavailable
 * (node / SSR / private mode), it transparently falls back to an in-memory map,
 * so the get/set contract below behaves identically without persistence and
 * never throws. No localStorage guards are needed here.
 */

import { createSettingsStore, type SettingsStore } from "game-kit/settings";
import { MODES } from "./modes.ts";

/** The persisted shape: a flat bag the kit settings store forward-merges. */
export interface LexiconState {
  /** Best score per mode, keyed by `Mode.id`. Missing entry ⇒ treat as 0. */
  bestByMode: Record<string, number>;
  /** Whether sound is muted. */
  muted: boolean;
}

/** localStorage key the whole state object lives under. */
const STORAGE_KEY = "lexicon";

/** Current schema version; bump + add a `migrate` when the shape changes. */
const STORAGE_VERSION = 1;

/** Defaults: every known mode seeded to best 0, unmuted. */
function defaultState(): LexiconState {
  const bestByMode: Record<string, number> = {};
  for (const mode of MODES) bestByMode[mode.id] = 0;
  return { bestByMode, muted: false };
}

/**
 * The single kit-backed settings store for the whole game. Module-level so all
 * callers share one in-memory state + one persisted blob.
 */
const store: SettingsStore<LexiconState> = createSettingsStore<LexiconState>({
  key: STORAGE_KEY,
  version: STORAGE_VERSION,
  defaults: defaultState(),
});

// ── BEST SCORES (per mode) ───────────────────────────────────────────────────

/**
 * Best score for a mode. Returns 0 when the mode has no recorded score (either
 * an unknown id or a fresh install), never NaN/undefined.
 */
export function getBest(modeId: string): number {
  const v = store.get().bestByMode[modeId];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Record a score for a mode, keeping only the HIGHEST seen. A score that does
 * not beat the stored best is ignored (the store is left untouched), so this is
 * safe to call after every round with the round's score.
 */
export function setBest(modeId: string, score: number): void {
  if (!Number.isFinite(score)) return;
  const current = getBest(modeId);
  if (score <= current) return;
  const bestByMode = { ...store.get().bestByMode, [modeId]: score };
  store.set({ bestByMode });
}

// ── MUTE PREFERENCE ──────────────────────────────────────────────────────────

/** Whether sound is currently muted (defaults to false). */
export function getMuted(): boolean {
  return store.get().muted;
}

/** Persist the mute preference. */
export function setMuted(muted: boolean): void {
  store.set({ muted });
}
