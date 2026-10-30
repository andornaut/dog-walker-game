import { wrapWords } from "@andornaut/game-kit/lines";
import { rectsOverlap } from "@andornaut/game-kit/rect";
import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { HOME_BAR_LAST_FACE, HOME_LAYOUT } from "../home/homeLayout";
import { TITLE_CAP_ROWS } from "../hud/walkHud";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, placedInk } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { closeFace } from "../ui/closeControl";
import { TEXT_SCALE } from "../ui/textFit";
import { topBarContentRows, topBarRects } from "../ui/topBarTrim";
import { helpBody } from "./helpBody";
import { CLOSE_HIT_RECT, dotRects, HELP_LAYOUT, helpActionAt, tapRect } from "./helpLayout";
import type { HelpAction } from "./helpPaging";

// Help's top bar is the home pages': as tall, trimmed alike, its heading's capitals and close
// face centred down the rows between the trim's line and edge as the home bar's button faces
// are, the close face where the home bar's last face is (Exit's, or Settings' where Exit is
// hidden).
describe("help's top bar", () => {
  const { close, heading, topBar } = HELP_LAYOUT;
  const home = HOME_LAYOUT.topBar;
  const homeBar = { height: home.height, width: topBar.width, x: 0, y: 0 };
  const rows = topBarContentRows(topBar.height);
  const capRows = TITLE_CAP_ROWS * TEXT_SCALE;
  const homeFace = { ...HOME_BAR_LAST_FACE, height: home.faceSize, width: home.faceSize };
  // How many more rows a part leaves below it than above it, between the trim's line and edge.
  const offCentre = (top: number, size: number) => rows.bottom - (top + size) - (top - rows.top);

  it.each([
    ["the bar's rect", topBar, homeBar],
    ["the bar's trim", topBarRects(topBar), topBarRects(homeBar)],
    ["the close face", closeFace(close), homeFace],
    [
      "the heading's centring",
      offCentre(heading.y, capRows),
      offCentre(homeFace.y, homeFace.height),
    ],
  ] as const)("matches the home bar's in %s", (_, help, homeValue) => {
    expect(help).toEqual(homeValue);
  });
});

describe("tapRect", () => {
  it("grows small art about its centre to the minimum, keeps a larger side and stays on screen", () => {
    expect(tapRect({ height: 8, width: 8, x: 44, y: 478 })).toEqual({
      height: 44,
      width: 44,
      x: 26,
      y: 460,
    });
    expect(tapRect({ height: 44, width: 110, x: 8, y: 504 }).width).toBe(110);
    expect(tapRect({ height: 4, width: 4, x: 358, y: 558 })).toEqual({
      height: 44,
      width: 44,
      x: 316,
      y: 516,
    });
  });
});

describe("help tap targets", () => {
  const targets = [
    CLOSE_HIT_RECT,
    tapRect(HELP_LAYOUT.previous),
    tapRect(HELP_LAYOUT.next),
    ...dotRects(7).map(tapRect),
  ];

  it("are at least the minimum tap size each way, enclose their art and never overlap", () => {
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
    }
    expect(inside(closeFace(HELP_LAYOUT.close), CLOSE_HIT_RECT)).toBe(true);
    dotRects(7).forEach((dot) => expect(inside(dot, tapRect(dot))).toBe(true));
    targets.forEach((a, i) => {
      targets.slice(i + 1).forEach((b) => expect(rectsOverlap(a, b)).toBe(false));
    });
  });
});

describe("helpActionAt", () => {
  // Taps at the edges of each target and just outside them.
  it("maps a tap on each target to its action, and one outside them to none", () => {
    const taps: [number, number, HelpAction | undefined][] = [
      [330, 20, { kind: "close" }],
      [HELP_LAYOUT.previous.x, HELP_LAYOUT.previous.y, { kind: "previous" }],
      [HELP_LAYOUT.next.x, HELP_LAYOUT.next.y, { kind: "advance" }],
      [26, 458, { kind: "goTo", page: 0 }],
      [333, 482, { kind: "goTo", page: 6 }],
      [180, 200, undefined],
      [180, 457, undefined],
    ];
    for (const [x, y, expected] of taps) {
      expect(helpActionAt(7, { x, y }), `${x}, ${y}`).toEqual(expected);
    }
  });
});

const BODY = fontFileMetrics("font-body");

describe("help pages", () => {
  const { lineHeight, maxLines, scale, width, y } = HELP_LAYOUT.body;
  const dotsTop = Math.min(...dotRects(gameData.help.length).map((dot) => dot.y));
  it("fits every page's body in its lines above the page dots, and its title across the screen", () => {
    const { scale: titleScale, x } = HELP_LAYOUT.title;
    const inkBottom = y + (maxLines - 1) * lineHeight + inkRowsFromCapTop(BODY) * scale;
    expect(inkBottom).toBeLessThanOrEqual(dotsTop);
    const offenders = gameData.help.filter((page) => {
      const lines = wrapWords(
        (line) => bodyTextWidth(scale, line),
        width,
        helpBody(gameData, page),
      );
      const title = placedInk("font-title", { scale: titleScale }, page.title.toUpperCase());
      return (
        lines.some((line) => bodyTextWidth(scale, line) > width) ||
        lines.length > maxLines ||
        x + title.right > HELP_LAYOUT.screen.width - x
      );
    });
    expect(offenders.map(({ title }) => title)).toEqual([]);
  });
});
