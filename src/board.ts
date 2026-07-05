/**
 * board — Lexicon's letter grid: Boggle-lineage board generation + path rules.
 *
 * Pure + deterministic (seeded via game-kit's prng). A board is a flat array of
 * `Cell`s in row-major order; adjacency is the 8 neighbours (incl. diagonals).
 * The classic "Qu" die is one CELL but contributes two letters to a word.
 */
import { createRng, type Rng } from "game-kit/prng";

export interface Cell {
  /** What the tile shows, e.g. "A" or "Qu". */
  label: string;
  /** What it contributes to a word, lowercase, e.g. "a" or "qu". */
  value: string;
}

// The standard 16 New-Boggle dice (each a 6-letter face set). "Q" means the
// Qu die — rendered "Qu", worth the letters "qu".
const DICE_4: readonly string[] = [
  "AAEEGN", "ABBJOO", "ACHOPS", "AFFKPS",
  "AOOTTW", "CIMOTU", "DEILRX", "DELRVY",
  "DISTTY", "EEGHNW", "EEINSU", "EHRTVW",
  "EIOSST", "ELRTTY", "HIMNQU", "HLNNRZ",
];

function faceToCell(face: string): Cell {
  if (face === "Q") return { label: "Qu", value: "qu" };
  return { label: face, value: face.toLowerCase() };
}

/** Fisher–Yates shuffle (in place) using the seeded rng. */
function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export interface Board {
  size: number;
  cells: Cell[];
}

/**
 * Roll a `size`×`size` board from a seed: shuffle the dice into grid positions,
 * then roll each die to a random face. (Only 4×4 has authored dice; larger
 * sizes reuse the 4×4 dice cyclically — fine for a seeded letter mix.)
 */
export function makeBoard(seed: number, size = 4): Board {
  const rng = createRng(seed);
  const count = size * size;
  const dice = shuffle([...DICE_4], rng);
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const die = dice[i % dice.length]!;
    const face = die[Math.floor(rng.next() * die.length)]!;
    cells.push(faceToCell(face));
  }
  return { size, cells };
}

/** The 8-neighbour indices of cell `i` on a `size`×`size` grid. */
export function neighbors(i: number, size: number): number[] {
  const x = i % size;
  const y = Math.floor(i / size);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      out.push(ny * size + nx);
    }
  }
  return out;
}

/** Can `next` extend `path`? — it must be on the board, unused, and adjacent
 *  to the current head. An empty path accepts any single cell. */
export function canExtend(path: number[], next: number, size: number): boolean {
  if (next < 0 || next >= size * size) return false;
  if (path.includes(next)) return false;
  if (path.length === 0) return true;
  return neighbors(path[path.length - 1]!, size).includes(next);
}

/** Is `path` a legal chain (each step adjacent, no repeats)? */
export function isValidPath(path: number[], size: number): boolean {
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k++) {
    const c = path[k]!;
    if (seen.has(c)) return false;
    seen.add(c);
    if (k > 0 && !neighbors(path[k - 1]!, size).includes(c)) return false;
  }
  return true;
}

/** The lowercase word a path spells (Qu counts as two letters). */
export function pathWord(path: number[], board: Board): string {
  return path.map((i) => board.cells[i]!.value).join("");
}

/** Standard Boggle scoring by WORD length (letters, so Qu counts as 2). */
export function wordScore(len: number): number {
  if (len < 3) return 0;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11;
}

export const MIN_WORD_LEN = 3;
