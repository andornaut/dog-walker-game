// What vite.config.ts takes from the repository's code, in one module so the config loads it
// through a single Vite module runner, which resolves @andornaut/game-kit as the app does.
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin";
export { precachePlugin } from "../pwa/precachePlugin";
export { atlasPlugin } from "./atlas/atlasPlugin";
export { generatedFilesPlugin } from "./generatedFilesPlugin";
export { PHASER_BUILD } from "./phaserBuild";
export { gitHead, shortCommit } from "@andornaut/game-kit/build/buildVersion";
export { PHASER_ENTRY_ID } from "@andornaut/game-kit/build/phaserBuild";
export { phaserBuildPlugin } from "@andornaut/game-kit/build/vite/phaserBuildPlugin";
