import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

// game-kit is vendored under vendor/game-kit (master lives in Crucible, re-vendored
// via `node scripts/vendor-game-kit.mjs --to ../lexicon` from the Crucible root).
// Modules are imported by SUBPATH (game-kit/title, game-kit/title/r3f, …); Vite
// resolves the kit's ".js" specifiers to ".ts". Lexicon is a 2D word game, so it
// only ever imports the kit's THREE-free modules (no three dep needed).
const kit = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^game-kit\/(.*)\/r3f$/, replacement: kit("./vendor/game-kit/src/$1/r3f.tsx") },
      { find: /^game-kit\/(.*)$/, replacement: kit("./vendor/game-kit/src/$1/index.ts") },
      { find: /^game-kit$/, replacement: kit("./vendor/game-kit/src/index.ts") },
    ],
  },
});
