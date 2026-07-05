import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Scope tests to the game's own src (the vendored game-kit ships its own tests,
// some of which need peer deps this game doesn't install).
const kit = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: [
      { find: /^game-kit\/(.*)\/r3f$/, replacement: kit("./vendor/game-kit/src/$1/r3f.tsx") },
      { find: /^game-kit\/(.*)$/, replacement: kit("./vendor/game-kit/src/$1/index.ts") },
      { find: /^game-kit$/, replacement: kit("./vendor/game-kit/src/index.ts") },
    ],
  },
});
