import { describe, expect, it } from "vitest";

import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { gameData } from "../data";
import { fittingTextStyle, type TextFitStyle } from "../layout/textFit";
import { fontInk } from "../testing/fontInk";
import { plainMarks } from "../ui/pixelFont";
import { CELEBRATION_LAYOUT as LAYOUT } from "./celebrationLayout";

const WALKER = {
  height: ROAD_SPRITE_SIZE * 1.5 * LAYOUT.walkerScale,
  width: ROAD_SPRITE_SIZE * LAYOUT.walkerScale,
};

describe("CELEBRATION_LAYOUT", () => {
  it.each([
    ["new walker", LAYOUT.newWalker],
    ["zone done", LAYOUT.zoneDone],
  ])("stands the %s walker centred on its feet line, under both lines", (_name, version) => {
    expect(version.walker.x + WALKER.width / 2).toBe(LAYOUT.centerX);
    expect(version.walker.y + WALKER.height).toBe(version.feetY);
    expect(version.titleY).toBeLessThan(version.subtitleY);
    expect(version.subtitleY).toBeLessThan(version.walker.y);
    expect(version.burst.y).toBeGreaterThan(version.walker.y);
    expect(version.burst.x).toBeLessThan(version.walker.x);
  });
});

// Each version's big line, upper-cased in font-display as addDisplayText draws it.
describe("the celebration's title", () => {
  const { newWalker, zoneDone } = gameData.runText;
  const inkWidth = (title: string) => (style: TextFitStyle) => {
    const ink = fontInk("font-display", style, plainMarks(title).toUpperCase());
    return ink.right - ink.left;
  };

  it.each([newWalker.title, zoneDone.title])("sets %s inside the title room", (title) => {
    const style = fittingTextStyle(LAYOUT.titleStyles, inkWidth(title), LAYOUT.titleRoom);
    expect(inkWidth(title)(style)).toBeLessThanOrEqual(LAYOUT.titleRoom);
  });
});
