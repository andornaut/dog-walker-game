import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import { insetRect, rectsOverlap } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { barTitleLeft } from "../ui/barTitle";
import { closeControl } from "../ui/closeControl";
import { TEXT_STYLE } from "../ui/textFit";
import { overlayRegion } from "./homeBar";
import { cardTitleRow, HOME_LAYOUT, updateModalLayout } from "./homeLayout";
import { MODAL, modalRect } from "./modalLayout";

const area = overlayRegion("home");
const body = { height: 80, width: 180 };

it.each([
  { height: 100, width: 100, x: 130, y: 180 },
  { height: 100, width: 100, x: 130, y: 300 },
  { height: 150, width: 60, x: 120, y: 190 },
])("places fitting content clear of the protected character $x,$y", (avoid) => {
  const placed = modalRect(area, avoid, body);
  expect(inside(placed, insetRect(MODAL.margin, area))).toBe(true);
  expect(rectsOverlap(placed, avoid)).toBe(false);
});

describe.each(["newerSave", "update"] as const)("%s notice", (mode) => {
  it("sizes its title and action without an empty body or obscuring the gate character", () => {
    const title = gameData.homeText[mode].title;
    const ink = inkWidth("font-title", TEXT_STYLE, title.toUpperCase());
    const placed = updateModalLayout(area, {
      action: inkWidth("font-title", TEXT_STYLE, gameData.homeText[mode].button),
      title: ink,
    });
    expect(inside(placed.panel, insetRect(MODAL.margin, area))).toBe(true);
    expect(placed.panel.width).toBeGreaterThanOrEqual(MODAL_CONTENT.minWidth);
    const close = closeControl(placed.panel);
    const row = cardTitleRow(placed.panel);
    const titleInk = {
      height: fontFileMetrics("font-title").capHeight * 2,
      width: ink,
      x: barTitleLeft(row, close, ink),
      y: row.y,
    };
    expect(rectsOverlap(titleInk, close.hit)).toBe(false);
    expect(inside(titleInk, placed.panel)).toBe(true);
    expect(rectsOverlap(placed.panel, { ...HOME_LAYOUT.gate, width: area.width, x: area.x })).toBe(
      false,
    );
    expect(inside(placed.button, placed.panel)).toBe(true);
    expect(rectsOverlap(placed.button, closeControl(placed.panel).hit)).toBe(false);
    expect(placed.panel.y + placed.panel.height - placed.button.y - placed.button.height).toBe(
      MODAL.pad,
    );
    expect(placed.button.y).toBeGreaterThanOrEqual(
      placed.panel.y + fontFileMetrics("font-title").capHeight * 2,
    );
  });
});
