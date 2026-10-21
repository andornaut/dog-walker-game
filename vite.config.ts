import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import { atlasPlugin } from "./src/assets/atlas/atlasPlugin";
import { securityHeadersPlugin } from "./src/headers/securityHeadersPlugin";
import { precachePlugin } from "./src/pwa/precachePlugin";
import { generatedFilesPlugin } from "./src/tools/generatedFilesPlugin";

// An absolute path in this repository. Vite resolves relative paths against root, which is
// pages/, so every path below goes through here instead.
function repoPath(path: string): string {
  return resolve(import.meta.dirname, path);
}

export default defineConfig({
  build: {
    // Outside root, so Vite would leave the previous build's files in place without emptyOutDir.
    emptyOutDir: true,
    outDir: repoPath("dist"),
    // The home page at /, the game at /play/ and the game data tables at /data/. Each page's
    // path under pages/ is its URL. public/ is copied as-is.
    rolldownOptions: {
      input: {
        main: repoPath("pages/index.html"),
        play: repoPath("pages/play/index.html"),
        data: repoPath("pages/data/index.html"),
      },
      // Phaser goes in its own chunk, so a game code change keeps its hashed file name and a new
      // service worker's precache gets it from the browser's HTTP cache.
      output: {
        codeSplitting: {
          groups: [{ name: "phaser", test: /[\\/]node_modules[\\/]phaser[\\/]/ }],
        },
      },
    },
    // The Phaser chunk alone is about 1.4 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in Phaser or game code still warns.
    chunkSizeWarningLimit: 1600,
  },
  // atlasPlugin writes public/art/manifest.json from the art files, then packs the art's images
  // and sprites into /art/atlas/ and /art/atlas-manifest.json.
  // generatedFilesPlugin, on the dev server only, rewrites public/art/manifest.json and
  // shared/export/ as the art and src/ change. npm run build writes shared/export/ first.
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  plugins: [
    atlasPlugin(),
    generatedFilesPlugin({ repoRoot: repoPath(".") }),
    precachePlugin({
      pageHtmlFile: "play/index.html",
      serviceWorkerSource: repoPath("src/pwa/serviceWorker.ts"),
    }),
    securityHeadersPlugin(),
  ],
  // The container name the Playwright MCP reaches the dev or preview server by,
  // over the playwright-mcp Docker network. Vite rejects any other Host header.
  preview: {
    allowedHosts: ["dwg-preview"],
  },
  publicDir: repoPath("public"),
  // The pages load their modules as /src/..., which names the repository's src/ rather than
  // pages/src/.
  resolve: {
    alias: { "/src": repoPath("src") },
  },
  root: repoPath("pages"),
  server: {
    allowedHosts: ["dwg-preview"],
    // The dev server serves src/ and node_modules/ from outside root, as /@fs/ URLs.
    fs: { allow: [repoPath(".")] },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    root: repoPath("."),
  },
});
