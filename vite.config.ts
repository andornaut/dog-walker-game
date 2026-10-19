import { defineConfig } from "vitest/config";

import { securityHeadersPlugin } from "./src/headers/securityHeadersPlugin";
import { precachePlugin } from "./src/pwa/precachePlugin";

export default defineConfig({
  build: {
    // The home page at /, the game at /play/ and the game data tables at /data/.
    // public/ is copied as-is.
    rolldownOptions: {
      input: {
        main: "index.html",
        play: "play/index.html",
        data: "data/index.html",
      },
    },
    // Phaser alone is about 1.4 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in game code still warns.
    chunkSizeWarningLimit: 1600,
  },
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  plugins: [
    precachePlugin({
      pageHtmlFile: "play/index.html",
      serviceWorkerSource: "src/pwa/serviceWorker.ts",
    }),
    securityHeadersPlugin(),
  ],
  // The container name the Playwright MCP reaches the dev or preview server by,
  // over the playwright-mcp Docker network. Vite rejects any other Host header.
  preview: {
    allowedHosts: ["dwg-preview"],
  },
  server: {
    allowedHosts: ["dwg-preview"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
