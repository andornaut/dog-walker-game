import type * as ConfigModules from "./src/tools/viteConfigModules";
import { gameViteConfig } from "./vendor/game-kit/src/build/vite/gameConfig";

// The kit's Vite and Vitest config (gameViteConfig), which loads the plugins below from
// src/tools/viteConfigModules.ts through a module runner given the kit's alias.
export default gameViteConfig<typeof ConfigModules>({
  // The Phaser chunk alone is about 1.06 MB minified, so the 500 kB default always warns.
  // Set just above it so that growth in Phaser or game code still warns.
  chunkSizeWarningLimit: 1100,
  configModules: "src/tools/viteConfigModules.ts",
  // The home page at /, the game at /play/ and the game data tables at /data/.
  pages: {
    main: "pages/index.html",
    play: "pages/play/index.html",
    data: "pages/data/index.html",
  },
  // atlasPlugin writes public/art/manifest.json from the art files, packs the art's images and
  // sprites into atlas pages, and writes every art file the game loads under /assets/art/ with a
  // content hash in its name, mapped from its path under /art/ in the game's code.
  // generatedFilesPlugin, on the dev server only, rewrites public/art/manifest.json and
  // shared/export/ as the art and src/ change. npm run build writes shared/export/ first.
  // phaserBuildPlugin, in a build only, bundles Phaser from its source without the namespaces the
  // game does not use and without the Canvas renderer (PHASER_BUILD in src/tools/phaserBuild.ts).
  // hashedIconsPlugin writes each icon under a content-hashed name in /assets/ and points the
  // built pages and /manifest.webmanifest there (HASHED_ICONS in src/pwa/icons.ts).
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play,
  // reading the map of hashed art atlasPlugin writes.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  plugins: (modules, repoPath) => {
    const atlas = modules.atlasPlugin();
    return [
      atlas,
      modules.generatedFilesPlugin({ repoRoot: repoPath(".") }),
      modules.phaserBuildPlugin(modules.PHASER_BUILD),
      modules.hashedIconsPlugin({ icons: modules.HASHED_ICONS }),
      modules.precachePlugin({
        getArtFiles: atlas.api.artFiles,
        pageHtmlFile: "play/index.html",
        serviceWorkerSource: repoPath("src/pwa/serviceWorker.ts"),
      }),
      modules.securityHeadersPlugin(),
    ];
  },
  // The container name the Playwright MCP reaches the dev or preview server by, over the
  // playwright-mcp Docker network. Vite rejects any other Host header.
  previewHost: "dwg-preview",
  repoRoot: import.meta.dirname,
  // Whole-walk tests run several seconds alone and several times that on a loaded host or a
  // CI runner, so the default 5 s is too tight; the slowest blocks set their own, longer limit.
  testTimeout: 30_000,
});
