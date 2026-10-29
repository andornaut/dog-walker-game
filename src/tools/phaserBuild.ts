import type { PhaserBuild } from "@andornaut/game-kit/build/phaserBuild";

// The production build's Phaser (the kit's build/phaserBuild): without the namespaces the game
// reads nothing from, and without the Canvas renderer, since the game runs on WebGL alone
// (`type: WEBGL` in src/main.ts). phaserBuild.test.ts fails when the game uses something it
// leaves out.
export const PHASER_BUILD: PhaserBuild = {
  flags: { CANVAS_RENDERER: false },
  omitted: [
    "Actions",
    "Class",
    "Curves",
    "DOM",
    "Geom",
    "Physics",
    "Plugins",
    "Structs",
    "Tilemaps",
    "Utils",
  ],
};
