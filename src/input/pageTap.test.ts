import { describe, expect, it } from "vitest";

import { gamePoint, onBarePage } from "./pageTap";

describe("onBarePage", () => {
  const root = new EventTarget();
  const body = new EventTarget();
  const container = new EventTarget();
  const bare = [root, body, container];
  it("taps by its rules", () => {
    for (const [, target, expected] of [
      ["the page's root", root, true],
      ["the page's body", body, true],
      ["the game's container beside the canvas", container, true],
      ["the canvas, which has its own rule", new EventTarget(), false],
      ["the site nav or the dev panel", new EventTarget(), false],
      ["no target", null, false],
    ] satisfies readonly [string, EventTarget | null, boolean][]) {
      expect(onBarePage(bare, target)).toBe(expected);
    }
  });
});

describe("gamePoint", () => {
  it("maps a client point through each scaling", () => {
    for (const [, canvas, client, point] of [
      ["an unscaled canvas", { left: 0, top: 0, width: 360 }, { x: 10, y: 20 }, { x: 10, y: 20 }],
      [
        "a canvas at twice the size, centred on a wide page",
        { left: 280, top: 40, width: 720 },
        { x: 100, y: 240 },
        { x: -90, y: 100 },
      ],
    ] as const) {
      expect(gamePoint(canvas, 360, client)).toEqual(point);
    }
  });
});
