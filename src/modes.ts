/**
 * modes — Lexicon's difficulty modes. Bigger board = more time. Zen drops the
 * timer entirely. Each mode keeps its own best score (see App).
 */
export interface Mode {
  id: string;
  label: string;
  /** Board edge (size×size grid). */
  size: number;
  /** Round length in seconds; `Infinity` = zen (no timer). */
  durationSec: number;
  /** One-line flavour for the title menu. */
  blurb: string;
}

export const MODES: readonly Mode[] = [
  { id: "standard", label: "Standard", size: 4, durationSec: 180, blurb: "4×4 · 3:00" },
  { id: "advanced", label: "Advanced", size: 5, durationSec: 240, blurb: "5×5 · 4:00" },
  { id: "master", label: "Master", size: 6, durationSec: 300, blurb: "6×6 · 5:00" },
  { id: "zen", label: "Zen", size: 4, durationSec: Infinity, blurb: "4×4 · no timer" },
];

export function modeById(id: string): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0]!;
}
