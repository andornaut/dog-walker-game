import { containsPoint, type Point } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_LAYOUT } from "../data/screen";
import { type GestureContext, pointerDown, pointerMove } from "./gestures";
import { clampInto, gamePoint, onBarePage, walkPagePoint } from "./pageTap";

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

describe("clampInto", () => {
  const rect = { height: 560, width: 360, x: 0, y: 0 };
  it.each([
    ["a point inside stays", { x: 12.5, y: 300 }, { x: 12.5, y: 300 }],
    ["past the left edge", { x: -40, y: 300 }, { x: 0, y: 300 }],
    ["past the right edge, onto the last column", { x: 400, y: 300 }, { x: 359, y: 300 }],
    ["above the top edge", { x: 100, y: -8 }, { x: 100, y: 0 }],
    ["below the bottom edge, onto the last row", { x: 100, y: 700 }, { x: 100, y: 559 }],
    ["past a corner", { x: -5, y: 900 }, { x: 0, y: 559 }],
  ])("%s", (_name, point, expected) => {
    expect(clampInto(rect, point)).toEqual(expected);
  });
});

// The walk's hit rule across two pages: a press on the canvas is at its own game point, one on
// the page beside it at walkPagePoint's. On the screen the walk bar is y 0-40, the road's centre
// x 180, the dog cards y 486-556 and the progress line y 556-560. portrait: a 412x800 phone, its
// 360x560 canvas at the top of #game under the 33px nav bar (x 26-386, y 33-593), so the spare
// height is all below it. landscape: a 1280x720 screen, its canvas centred (x 460-820, y 96-656).
describe("where a walk press lands", () => {
  const canvases = {
    landscape: { left: 460, top: 96, width: 360 },
    portrait: { left: 26, top: 33, width: 360 },
  } as const;
  type Page = keyof typeof canvases;
  const context: GestureContext = {
    config: { laneCount: LANE_COUNT, swipeStartDistance: 20 },
    layout: SCREEN_LAYOUT,
    stepMoves: () => true,
  };
  const landed = (page: Page, client: Point): Point | undefined => {
    const point = gamePoint(canvases[page], SCREEN_LAYOUT.screen.width, client);
    const { screen } = SCREEN_LAYOUT;
    return containsPoint(screen, point.x, point.y) ? point : walkPagePoint(SCREEN_LAYOUT, point);
  };
  const outcome = (page: Page, client: Point): string => {
    const point = landed(page, client);
    if (point === undefined) {
      return "nothing";
    }
    const { actions, state } = pointerDown(context, point);
    if (state.kind !== "dragging") {
      return "the walk bar's";
    }
    if (state.releaseTap !== undefined) {
      return "taps on release";
    }
    return actions[0]?.direction === -1 ? "taps left" : "taps right";
  };

  it.each([
    ["portrait", "the walk bar", { x: 206, y: 50 }, "the walk bar's"],
    ["portrait", "the margin beside the walk bar", { x: 10, y: 50 }, "nothing"],
    ["portrait", "the road's left half", { x: 100, y: 300 }, "taps left"],
    ["portrait", "the road's right half", { x: 300, y: 300 }, "taps right"],
    ["portrait", "the margin left of the road", { x: 10, y: 300 }, "taps left"],
    ["portrait", "the margin right of the road", { x: 405, y: 300 }, "taps right"],
    ["portrait", "a dog card", { x: 206, y: 555 }, "taps on release"],
    ["portrait", "the margin beside a dog card", { x: 5, y: 555 }, "taps on release"],
    ["portrait", "the progress line under the dog cards", { x: 100, y: 591 }, "taps left"],
    ["portrait", "the margin below the dog cards, left half", { x: 100, y: 700 }, "taps left"],
    ["portrait", "the margin below the dog cards, right half", { x: 300, y: 790 }, "taps right"],
    ["portrait", "the page's bottom-left corner", { x: 0, y: 800 }, "taps left"],
    ["landscape", "the margin above the walk bar", { x: 640, y: 60 }, "nothing"],
    ["landscape", "the walk bar", { x: 640, y: 110 }, "the walk bar's"],
    ["landscape", "the margin beside the walk bar", { x: 100, y: 110 }, "nothing"],
    ["landscape", "the road's left half", { x: 500, y: 400 }, "taps left"],
    ["landscape", "the page's left edge beside the road", { x: 0, y: 400 }, "taps left"],
    ["landscape", "the page's right edge beside the road", { x: 1279, y: 400 }, "taps right"],
    ["landscape", "a dog card", { x: 640, y: 616 }, "taps on release"],
    ["landscape", "the margin below the dog cards", { x: 500, y: 700 }, "taps left"],
  ] satisfies readonly [Page, string, Point, string][])(
    "%s, %s: %s",
    (page, _name, client, expected) => {
      expect(outcome(page, client)).toBe(expected);
    },
  );

  // Taps move nothing here, so only the drag's own steps show. A drag's points past the screen
  // clamp to its edge.
  it.each([
    ["the margin below the dog cards", { x: 100, y: 700 }, { x: 170, y: 790 }, [1]],
    ["the margin below the dog cards, leftward", { x: 300, y: 700 }, { x: 230, y: 640 }, [-1]],
    ["the margin left of the road", { x: 10, y: 300 }, { x: 160, y: 320 }, [1, 1]],
    ["a dog card, out past the right edge", { x: 300, y: 555 }, { x: 412, y: 555 }, [1]],
  ])("portrait: a drag from %s steers", (_name, from, to, steps) => {
    const dragOnly = { ...context, stepMoves: () => false };
    const start = landed("portrait", from);
    expect(start).toBeDefined();
    const down = pointerDown(dragOnly, start ?? { x: 0, y: 0 });
    const end = clampInto(SCREEN_LAYOUT.screen, gamePoint(canvases.portrait, 360, to));
    const moved = pointerMove(dragOnly, end, down.state);
    expect(moved.actions.map(({ direction }) => direction)).toEqual(steps);
  });
});
