import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";

import type { Scene } from "phaser";
import { describe, expect, it } from "vitest";

import { openOverlay } from "./overlay";
import { SCENE_KEYS, TAP_BURST_SCENE_KEY } from "./sceneKeys";
import { addTapBurst } from "./uiKit";

type Status = "paused" | "running" | "stopped";

// A game whose scenes keep a status, whose scene operations queue to the next step as
// Phaser's do, and whose tap burst layer draws each burst as a sprite that stays until it is
// destroyed.
function fakeGame() {
  const events = new EventEmitter();
  const statuses = new Map<string, Status>([
    [SCENE_KEYS.start, "running"],
    [TAP_BURST_SCENE_KEY, "running"],
  ]);
  const queue: string[] = [];
  const bursts: { destroyed: boolean }[] = [];
  const layer = {
    add: {
      sprite: () => {
        const burst = Object.assign(new EventEmitter(), {
          destroy: () => {
            burst.destroyed = true;
          },
          destroyed: false,
          play: () => burst,
          scene: layer,
          setDepth: () => burst,
        });
        bursts.push(burst);
        return burst;
      },
    },
    anims: { exists: () => true },
    textures: { exists: () => true },
  };
  const sceneFor = (key: string) =>
    ({
      game: { events },
      scene: {
        get: (other: string) => (other === TAP_BURST_SCENE_KEY ? layer : sceneFor(other)),
        launch: (other: string) => queue.push(`start ${other}`),
        pause: () => queue.push(`pause ${key}`),
      },
    }) as unknown as Scene;
  // One game step: Phaser applies the queued operations between its prestep and poststep.
  const step = () => {
    events.emit("prestep");
    for (const op of queue.splice(0)) {
      const [kind = "", key = ""] = op.split(" ");
      statuses.set(key, kind === "pause" ? "paused" : "running");
    }
    events.emit("poststep");
  };
  return { bursts, queue, sceneFor, statuses, step };
}

describe("a tap on a scene that opens an overlay", () => {
  // taps: how many taps land on the start screen's Settings before the game's next step.
  it.each([
    ["opens it on the same tap", 1],
    ["opens one for a second tap before the next step", 2],
  ])("%s, the burst playing on over it", (_, taps) => {
    const game = fakeGame();
    const start = game.sceneFor(SCENE_KEYS.start);
    for (let tap = 0; tap < taps; tap += 1) {
      addTapBurst(start, 10, 10);
      openOverlay(start, SCENE_KEYS.settings, { resume: SCENE_KEYS.start });
    }
    expect(game.queue).toEqual([`pause ${SCENE_KEYS.start}`, `start ${SCENE_KEYS.settings}`]);
    game.step();
    expect(Object.fromEntries(game.statuses)).toEqual({
      [SCENE_KEYS.settings]: "running",
      [SCENE_KEYS.start]: "paused",
      [TAP_BURST_SCENE_KEY]: "running",
    });
    expect(game.bursts.map(({ destroyed }) => destroyed)).toEqual(Array(taps).fill(false));
  });
});

// Phaser draws scenes in their list's order, and launching a scene keeps its place, so the tap
// burst layer draws over every overlay while only the dev overlay follows it and no scene is
// moved or added at run time.
describe("the tap burst layer", () => {
  const main = readFileSync("src/main.ts", "utf8");
  const list = /scene: \[([^\]]*)\]/.exec(main)?.[1] ?? "";
  const entries = list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  it("is listed last but for the dev overlay", () => {
    expect(entries.slice(-2)).toEqual(["TapBurstScene", "DevOverlayScene"]);
  });

  it("is never drawn under a scene moved or added at run time", () => {
    const moved = readdirSync("src", { recursive: true, withFileTypes: false })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) =>
        /\.scene\.(add|bringToTop|moveAbove|moveDown|moveUp|sendToBack|swapPosition)\(/.test(
          readFileSync(`src/${file}`, "utf8"),
        ),
      );
    expect(moved).toEqual([]);
  });
});
