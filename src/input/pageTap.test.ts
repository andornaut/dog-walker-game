import { clampInto, containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";
import { pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { type GestureContext, pointerDown, pointerMove } from "./gestures";
import { walkPagePoint } from "./pageTap";

// The game page in a browser tab: #game is the viewport's width, from under the 33px nav bar to
// over the 24px dev bar, and the canvas fills it as src/main.ts asks of Phaser's Scale Manager
// (Scale.FIT, autoCenter CENTER_HORIZONTALLY): the largest zoom that fits, fractional included,
// at #game's top, centred across.
const NAV_BAR = 33;
const DEV_BAR = 24;

const PAGES = {
  "desktop 1280x720": { height: 720, width: 1280 },
  "iPad landscape 1180x820": { height: 820, width: 1180 },
  "iPad portrait 1024x1366": { height: 1366, width: 1024 },
  "iPad portrait 820x1180": { height: 1180, width: 820 },
  "phone portrait 360x800": { height: 800, width: 360 },
  "phone portrait 412x915": { height: 915, width: 412 },
} as const;
type Page = keyof typeof PAGES;

interface PageBoxes {
  canvas: Rect;
  game: Rect;
  zoom: number;
}

function pageBoxes(page: Page): PageBoxes {
  const viewport = PAGES[page];
  const height = viewport.height - NAV_BAR - DEV_BAR;
  const game = { height, width: viewport.width, x: 0, y: NAV_BAR };
  const zoom = Math.min(game.width / SCREEN_CONFIG.width, game.height / SCREEN_CONFIG.height);
  const width = SCREEN_CONFIG.width * zoom;
  const x = (game.width - width) / 2;
  return { canvas: { height: SCREEN_CONFIG.height * zoom, width, x, y: game.y }, game, zoom };
}

// Each page's zoom, the canvas filling #game's width or height.
describe("the game page's canvas", () => {
  it.each([
    ["phone portrait 360x800", 1],
    ["phone portrait 412x915", 412 / 360],
    ["iPad portrait 820x1180", 1123 / 560],
    ["iPad portrait 1024x1366", 1309 / 560],
    ["iPad landscape 1180x820", 763 / 560],
    ["desktop 1280x720", 663 / 560],
  ] satisfies readonly [Page, number][])(
    "%s: zoom %f, filling #game's width or height",
    (page, zoom) => {
      const { canvas, game } = pageBoxes(page);
      expect(pageBoxes(page).zoom).toBeCloseTo(zoom, 6);
      expect(canvas.width).toBeLessThanOrEqual(game.width + 1e-9);
      expect(canvas.height).toBeLessThanOrEqual(game.height + 1e-9);
      expect(Math.max(canvas.width / game.width, canvas.height / game.height)).toBeCloseTo(1, 9);
      expect(canvas.y).toBe(game.y);
    },
  );
});

// The walk's hit rule on each page: a press on the canvas is at its own game point, one on the
// page beside it at walkPagePoint's. On the screen the walk bar is y 0-40, the road's centre
// x 180, the dog cards y 486-556 and the progress line y 556-560.
describe("where a walk press lands", () => {
  const context: GestureContext = {
    config: { laneCount: LANE_COUNT, swipeStartDistance: 20 },
    layout: SCREEN_LAYOUT,
    stepMoves: () => true,
  };
  const landed = (page: Page, client: Point): Point | undefined => {
    const point = pageToGame(0, pageBoxes(page).canvas, SCREEN_LAYOUT.screen, client);
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
  // A point at game pixels on the canvas, in client pixels.
  const onCanvas = ({ canvas, zoom }: PageBoxes, x: number, y: number) => ({
    x: canvas.x + x * zoom,
    y: canvas.y + y * zoom,
  });
  // Where each probe lands on a page, in client pixels.
  const PROBES = {
    "#game's bottom row, a quarter across": ({ canvas, game }: PageBoxes) => ({
      x: canvas.x + canvas.width / 4,
      y: game.y + game.height - 1,
    }),
    "#game's left edge beside the road": ({ canvas }: PageBoxes) => ({
      x: 0,
      y: canvas.y + canvas.height / 2,
    }),
    "#game's left edge beside the walk bar": (boxes: PageBoxes) => ({
      ...onCanvas(boxes, 0, 20),
      x: 0,
    }),
    "#game's right edge beside the road": ({ canvas, game }: PageBoxes) => ({
      x: game.width - 1,
      y: canvas.y + canvas.height / 2,
    }),
    "a dog card": (boxes: PageBoxes) => onCanvas(boxes, 180, 520),
    "the road's left half": (boxes: PageBoxes) => onCanvas(boxes, 60, 300),
    "the walk bar": (boxes: PageBoxes) => onCanvas(boxes, 180, 20),
  } as const;
  type Probe = keyof typeof PROBES;
  // What each probe does on every page, but the walk bar's side: the margin there on a page wider
  // than the canvas, and the walk bar itself on a phone the canvas fills across.
  const EVERY_PAGE: Record<Exclude<Probe, "#game's left edge beside the walk bar">, string> = {
    "#game's bottom row, a quarter across": "taps left",
    "#game's left edge beside the road": "taps left",
    "#game's right edge beside the road": "taps right",
    "a dog card": "taps on release",
    "the road's left half": "taps left",
    "the walk bar": "the walk bar's",
  };
  const besideTheBar: Record<Page, string> = {
    "desktop 1280x720": "nothing",
    "iPad landscape 1180x820": "nothing",
    "iPad portrait 1024x1366": "nothing",
    "iPad portrait 820x1180": "nothing",
    "phone portrait 360x800": "the walk bar's",
    "phone portrait 412x915": "the walk bar's",
  };
  const rows = (Object.keys(PAGES) as Page[]).flatMap((page) => [
    ...Object.entries(EVERY_PAGE).map(([probe, expected]) => [page, probe as Probe, expected]),
    [page, "#game's left edge beside the walk bar" as Probe, besideTheBar[page]],
  ]) as [Page, Probe, string][];

  it.each(rows)("%s, %s: %s", (page, probe, expected) => {
    expect(outcome(page, PROBES[probe](pageBoxes(page)))).toBe(expected);
  });

  // Taps move nothing here, so only the drag's own steps show. A drag's points past the screen
  // clamp to its edge. Travel is in game pixels: a lane is 64 wide, the first step at 20.
  it.each([
    ["phone portrait 360x800", "#game's bottom row", { x: 74, y: 700 }, { x: 144, y: 700 }, [1]],
    ["iPad landscape 1180x820", "#game's bottom row", { x: 274, y: 559 }, { x: 204, y: 559 }, [-1]],
    [
      "iPad landscape 1180x820",
      "the margin left of the road",
      { x: -100, y: 300 },
      { x: 134, y: 300 },
      [1, 1],
    ],
    [
      "desktop 1280x720",
      "a dog card, out past the right edge",
      { x: 274, y: 520 },
      { x: 500, y: 520 },
      [1],
    ],
  ] satisfies readonly [Page, string, Point, Point, number[]][])(
    "%s: a drag from %s steers",
    (page, _name, from, to, steps) => {
      const boxes = pageBoxes(page);
      const dragOnly = { ...context, stepMoves: () => false };
      const start = landed(page, onCanvas(boxes, from.x, from.y));
      expect(start).toBeDefined();
      const down = pointerDown(dragOnly, start ?? { x: 0, y: 0 });
      const toClient = onCanvas(boxes, to.x, to.y);
      const end = clampInto(
        SCREEN_LAYOUT.screen,
        pageToGame(0, boxes.canvas, SCREEN_LAYOUT.screen, toClient),
      );
      const moved = pointerMove(dragOnly, end, down.state);
      expect(moved.actions.map(({ direction }) => direction)).toEqual(steps);
    },
  );
});
