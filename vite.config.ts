import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // The home page at / and the game at /play/. public/ is copied as-is.
    rolldownOptions: {
      input: {
        main: "index.html",
        play: "play/index.html",
      },
    },
    // Phaser alone is about 1.4 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in game code still warns.
    chunkSizeWarningLimit: 1600,
  },
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
