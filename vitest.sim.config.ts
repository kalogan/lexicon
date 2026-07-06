import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Dedicated config for the headless BALANCE SIMULATOR (src/sim/run.sim.ts).
// The normal vitest.config.ts scopes `include` to *.test.ts so `pnpm test` never
// runs the (slow) sim. This config includes ONLY the sim runner and reuses the
// same game-kit path aliases so the vendored kit + word module resolve.
const kit = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["src/sim/run.sim.ts"],
    // The sim is one long "test"; give the pool room and no flaky retries.
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 30 * 60 * 1000,
  },
  resolve: {
    alias: [
      { find: /^game-kit\/(.*)\/r3f$/, replacement: kit("./vendor/game-kit/src/$1/r3f.tsx") },
      { find: /^game-kit\/(.*)$/, replacement: kit("./vendor/game-kit/src/$1/index.ts") },
      { find: /^game-kit$/, replacement: kit("./vendor/game-kit/src/index.ts") },
    ],
  },
});
