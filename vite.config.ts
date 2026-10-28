import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

import { securityHeadersPlugin } from "./src/headers/securityHeadersPlugin";
import { precachePlugin } from "./src/pwa/precachePlugin";
import { atlasPlugin } from "./src/tools/atlas/atlasPlugin";
import { gitHead, shortCommit } from "./src/tools/buildVersion";
import { generatedFilesPlugin } from "./src/tools/generatedFilesPlugin";

// An absolute path in this repository. Vite resolves relative paths against root, which is
// pages/, so every path below goes through here instead.
function repoPath(path: string): string {
  return resolve(import.meta.dirname, path);
}

const packageVersion: string = JSON.parse(readFileSync(repoPath("package.json"), "utf8")).version;

// The service worker's precache reads the map of hashed art this plugin writes.
const atlas = atlasPlugin();

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
  // The version and commit the dev bar shows, typed in src/buildInfo.d.ts. Fixed per commit, so
  // two builds of one commit match.
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __COMMIT__: JSON.stringify(shortCommit(() => gitHead(repoPath(".")), process.env)),
  },
  // atlasPlugin writes public/art/manifest.json from the art files, packs the art's images and
  // sprites into atlas pages, and writes every art file the game loads under /assets/art/ with a
  // content hash in its name, mapped from its path under /art/ in the game's code.
  // generatedFilesPlugin, on the dev server only, rewrites public/art/manifest.json and
  // shared/export/ as the art and src/ change. npm run build writes shared/export/ first.
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  plugins: [
    atlas,
    generatedFilesPlugin({ repoRoot: repoPath(".") }),
    precachePlugin({
      getArtFiles: atlas.api.artFiles,
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
    // Whole-walk tests run several seconds alone and several times that on a loaded host or a
    // CI runner, so the default 5 s is too tight; the slowest blocks set their own, longer limit.
    testTimeout: 30_000,
  },
});
