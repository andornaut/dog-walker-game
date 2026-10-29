import { EventEmitter } from "node:events";

import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { Scene } from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_LAYOUT, homeBarButtons } from "../home/homeLayout";
import { listenHomeBar } from "./homeBarPress";

const PAGE = { page: "the browser's window" };
const exitApp = vi.fn();

// The scenes it reaches read only Phaser's event names, so none of Phaser loads.
vi.mock("phaser", () => ({ Scenes: { Events: {} } }));
vi.mock("@andornaut/game-kit/pwa/exitApp", () => ({
  browserExitPage: () => PAGE,
  exitApp: (page: unknown) => exitApp(page),
}));

const centre = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

// An overlay scene on a home page whose input takes one pointer's presses.
function fakeOverlay() {
  const input = Object.assign(new EventEmitter(), { manager: { pointers: [] } });
  const scene = {
    events: new EventEmitter(),
    game: { events: new EventEmitter() },
    input,
    scene: { isActive: () => false, isPaused: () => false },
    time: { now: 0 },
  } as unknown as Scene;
  const pointer = (point: Point) => ({ ...point, id: 1, isDown: false, wasCanceled: false });
  return {
    down: (point: Point) => input.emit("pointerdown", pointer(point)),
    scene,
    up: (point: Point) => input.emit("pointerup", pointer(point)),
  };
}

// Exit's column, the screen's last.
const EXIT_HIT = homeBarButtons(true).find(([id]) => id === "exit")?.[1].hit;
const EXIT = EXIT_HIT === undefined ? { x: -1, y: -1 } : centre(EXIT_HIT);
const BANK = { x: HOME_LAYOUT.topBar.well.x + 1, y: HOME_LAYOUT.topBar.mid };

describe("the top bar's Exit under an overlay", () => {
  beforeEach(() => {
    exitApp.mockClear();
  });

  // Where a press lands and lifts, and how many times it leaves the game.
  it.each([
    ["leaves the game on the release of a press on it", EXIT, EXIT, 1],
    ["does nothing for a press on it released off it", EXIT, BANK, 0],
    ["does nothing for a press off it released on it", BANK, EXIT, 0],
  ] as const)("%s", (_, down, up, calls) => {
    const overlay = fakeOverlay();
    listenHomeBar(overlay.scene, true, () => undefined);
    overlay.down(down);
    expect(exitApp).not.toHaveBeenCalled();
    overlay.up(up);
    expect(exitApp.mock.calls).toEqual(Array.from({ length: calls }, () => [PAGE]));
  });
});
