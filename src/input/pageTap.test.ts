import { clampInto, containsPoint, type Point, type Rect } from "@andornaut/game-kit/rect";
import { type FrameTurn, pageToGame } from "@andornaut/game-kit/view/pagePoint";
import { describe, expect, it } from "vitest";

import { LANE_COUNT, SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { type GestureContext, pointerDown, pointerMove } from "./gestures";
import { walkPagePoint } from "./pageTap";

// The game page in a browser tab: #game is the frame's width, from under the 33px nav bar to over
// the 24px dev bar, and the canvas fills it as src/main.ts asks of Phaser's Scale Manager
// (Scale.FIT, autoCenter CENTER_HORIZONTALLY): the largest zoom that fits, fractional included,
// at #game's top, centred across. The frame is the viewport, or on a touch screen in landscape the
// viewport turned onto its side by turn (the kit's frameTurnPortraitGame.css), so a portrait
// frame as tall as the viewport is wide.
const NAV_BAR = 33;
const DEV_BAR = 24;

const PAGES = {
  "desktop 1280x720": { turn: 0, viewport: { height: 720, width: 1280 } },
  "iPad portrait 1024x1366": { turn: 0, viewport: { height: 1366, width: 1024 } },
  "iPad portrait 820x1180": { turn: 0, viewport: { height: 1180, width: 820 } },
  "iPad turned -90 1180x820": { turn: -90, viewport: { height: 820, width: 1180 } },
  "iPad turned 90 1180x820": { turn: 90, viewport: { height: 820, width: 1180 } },
  "mouse landscape 1180x820": { turn: 0, viewport: { height: 820, width: 1180 } },
  "phone portrait 360x800": { turn: 0, viewport: { height: 800, width: 360 } },
  "phone portrait 412x915": { turn: 0, viewport: { height: 915, width: 412 } },
  "phone turned -90 800x360": { turn: -90, viewport: { height: 360, width: 800 } },
  "phone turned 90 800x360": { turn: 90, viewport: { height: 360, width: 800 } },
} as const satisfies Record<
  string,
  { turn: FrameTurn; viewport: { height: number; width: number } }
>;
type Page = keyof typeof PAGES;

// Boxes in the frame's own pixels, which are the client's on an unturned page.
interface PageBoxes {
  canvas: Rect;
  game: Rect;
  zoom: number;
}

// A point in the frame's pixels in the client's: body turned about its top-left corner, then moved
// back onto the viewport (translateY(100cqh) rotate(-90deg), or translateX(100cqw) rotate(90deg)).
function toClient(page: Page, { x, y }: Point): Point {
  const { turn, viewport } = PAGES[page];
  if (turn === -90) {
    return { x: y, y: viewport.height - x };
  }
  return turn === 90 ? { x: viewport.width - y, y: x } : { x, y };
}

// The canvas's box on the page, as getBoundingClientRect gives it: the turned box's bounds.
function canvasClientBox(page: Page): Rect {
  const { canvas } = pageBoxes(page);
  const a = toClient(page, canvas);
  const b = toClient(page, { x: canvas.x + canvas.width, y: canvas.y + canvas.height });
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { height: Math.max(a.y, b.y) - y, width: Math.max(a.x, b.x) - x, x, y };
}

// A point in the frame's pixels in game pixels, through the turn as src/scenes/pagePresses.ts maps
// it.
function framePointInGame(page: Page, point: Point): Point {
  const client = toClient(page, point);
  return pageToGame(PAGES[page].turn, canvasClientBox(page), SCREEN_LAYOUT.screen, client);
}

function pageBoxes(page: Page): PageBoxes {
  const { turn, viewport } = PAGES[page];
  const frame = turn === 0 ? viewport : { height: viewport.width, width: viewport.height };
  const height = frame.height - NAV_BAR - DEV_BAR;
  const game = { height, width: frame.width, x: 0, y: NAV_BAR };
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
    ["mouse landscape 1180x820", 763 / 560],
    ["desktop 1280x720", 663 / 560],
    ["phone turned -90 800x360", 1],
    ["phone turned 90 800x360", 1],
    ["iPad turned -90 1180x820", 1123 / 560],
    ["iPad turned 90 1180x820", 1123 / 560],
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

// The walk's hit rule on each page, turned or not: a press on the canvas is at its own game point,
// one on the page beside it at walkPagePoint's. Probes are in the frame's pixels. On the screen
// the walk bar is y 0-40, the road's centre x 180, the dog cards y 486-556 and the progress line
// y 556-560.
describe("where a walk press lands", () => {
  const context: GestureContext = {
    config: { laneCount: LANE_COUNT, swipeStartDistance: 20 },
    layout: SCREEN_LAYOUT,
    stepMoves: () => true,
  };
  const landed = (page: Page, framePoint: Point): Point | undefined => {
    const point = framePointInGame(page, framePoint);
    const { screen } = SCREEN_LAYOUT;
    return containsPoint(screen, point.x, point.y) ? point : walkPagePoint(SCREEN_LAYOUT, point);
  };
  const outcome = (page: Page, framePoint: Point): string => {
    const point = landed(page, framePoint);
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
  // A point at game pixels on the canvas, in the frame's pixels.
  const onCanvas = ({ canvas, zoom }: PageBoxes, x: number, y: number) => ({
    x: canvas.x + x * zoom,
    y: canvas.y + y * zoom,
  });
  // Where each probe lands on a page, in the frame's pixels.
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
    "iPad portrait 1024x1366": "nothing",
    "iPad portrait 820x1180": "nothing",
    "iPad turned -90 1180x820": "nothing",
    "iPad turned 90 1180x820": "nothing",
    "mouse landscape 1180x820": "nothing",
    "phone portrait 360x800": "the walk bar's",
    "phone portrait 412x915": "the walk bar's",
    "phone turned -90 800x360": "the walk bar's",
    "phone turned 90 800x360": "the walk bar's",
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
    [
      "mouse landscape 1180x820",
      "#game's bottom row",
      { x: 274, y: 559 },
      { x: 204, y: 559 },
      [-1],
    ],
    ["phone turned -90 800x360", "#game's bottom row", { x: 74, y: 700 }, { x: 144, y: 700 }, [1]],
    ["phone turned 90 800x360", "#game's bottom row", { x: 274, y: 700 }, { x: 204, y: 700 }, [-1]],
    [
      "iPad turned 90 1180x820",
      "the margin left of the road",
      { x: -20, y: 300 },
      { x: 134, y: 300 },
      [1, 1],
    ],
    [
      "mouse landscape 1180x820",
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
      const end = clampInto(
        SCREEN_LAYOUT.screen,
        framePointInGame(page, onCanvas(boxes, to.x, to.y)),
      );
      const moved = pointerMove(dragOnly, end, down.state);
      expect(moved.actions.map(({ direction }) => direction)).toEqual(steps);
    },
  );
});
