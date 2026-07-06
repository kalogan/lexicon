/**
 * sim/run.sim — the runnable entry for the balance simulator.
 *
 * Implemented as a Vitest file so it inherits the repo's `game-kit/*` path
 * aliases (vitest.config.ts) and can dynamic-import the word module — plain
 * `tsx` would not resolve the vendored kit. It is NOT part of the normal test
 * run (vitest include is `*.test.ts`); invoke it explicitly:
 *
 *     pnpm sim                      # default N (see DEFAULT_RUNS)
 *     LEXICON_SIM_RUNS=200 pnpm sim # quick smoke
 *     LEXICON_SIM_POLICY=priciest|cheapest|buy-all pnpm sim
 *
 * It writes docs/BALANCE-SIM.md and prints the headline to stdout.
 */
import { describe, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWords } from "./dict.js";
import { playRun, type RunResult } from "./run.js";
import { SHOP_POLICIES, BUY_PRICIEST } from "./policy.js";
import { aggregate, renderMarkdown } from "./report.js";

const DEFAULT_RUNS = 2000;
const STAKE = 1;
const MIN_OWNED_FOR_LIFT = 25;

const num = (v: string | undefined, d: number) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};

describe("LEXICON balance simulation", () => {
  it(
    "plays many Challenge runs and writes docs/BALANCE-SIM.md",
    async () => {
      const RUNS = num(process.env.LEXICON_SIM_RUNS, DEFAULT_RUNS);
      const policy =
        SHOP_POLICIES.find((p) => p.id === process.env.LEXICON_SIM_POLICY) ?? BUY_PRICIEST;
      const seedBase = num(process.env.LEXICON_SIM_SEED, 0xace5) >>> 0;

      // eslint-disable-next-line no-console
      console.log(`\n[sim] loading dictionary…`);
      const words = await loadWords();
      // eslint-disable-next-line no-console
      console.log(`[sim] ${words.length} words. Playing ${RUNS} runs @ Stake ${STAKE}, policy="${policy.id}"…`);

      const t0 = Date.now();
      const results: RunResult[] = [];
      for (let i = 0; i < RUNS; i++) {
        results.push(
          playRun({ seed: (seedBase + i * 0x9e3779b9) >>> 0, stake: STAKE, shopPolicy: policy, words }),
        );
        if ((i + 1) % 200 === 0) {
          const wr = results.filter((r) => r.win).length / results.length;
          // eslint-disable-next-line no-console
          console.log(`[sim]   ${i + 1}/${RUNS} runs — win-rate so far ${(wr * 100).toFixed(1)}%`);
        }
      }
      const elapsedMs = Date.now() - t0;

      const agg = aggregate(results);
      const md = renderMarkdown(agg, {
        policy,
        stake: STAKE,
        minOwnedForLift: MIN_OWNED_FOR_LIFT,
        elapsedMs,
        wordCount: words.length,
      });

      const here = dirname(fileURLToPath(import.meta.url));
      const out = resolve(here, "../../docs/BALANCE-SIM.md");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, md, "utf8");

      const byLift = [...agg.relics].filter((r) => r.owned >= MIN_OWNED_FOR_LIFT).sort((a, b) => b.lift - a.lift);
      // eslint-disable-next-line no-console
      console.log(
        `\n[sim] DONE in ${(elapsedMs / 1000).toFixed(1)}s\n` +
          `[sim]   win-rate ${(agg.winRate * 100).toFixed(1)}% (${agg.wins}/${agg.runs}), avg ante ${agg.avgAnte.toFixed(2)}\n` +
          `[sim]   most dominant: ${byLift.slice(0, 5).map((r) => `${r.name} (${(r.lift * 100).toFixed(0)}%)`).join(", ")}\n` +
          `[sim]   most dead:     ${byLift.slice(-5).reverse().map((r) => `${r.name} (${(r.lift * 100).toFixed(0)}%)`).join(", ")}\n` +
          `[sim]   → ${out}`,
      );
    },
    // Generous timeout — thousands of per-board trie builds.
    30 * 60 * 1000,
  );
});
