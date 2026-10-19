import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    // Phaser alone is about 1.4 MB minified, so the 500 kB default always warns.
    // Set just above it so that growth in game code still warns.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
