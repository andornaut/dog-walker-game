import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { keysOf } from "../lib/records";
import { type Rect, rectsOverlap } from "../lib/rect";
import { firedByText } from "../rules/causes";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import {
  CHANGE_CHIP,
  CHANGE_LABEL_STYLES,
  changeChipPlace,
  changeLabelRoom,
  hudLanes,
} from "./hudLanes";
import { messageStripLayout } from "./messageStrip";
import { DOG_CARD, ownerTabRect } from "./walkHud";

const layout = screenLayout(SCREEN_CONFIG);
const BODY = fontFileMetrics("font-body");
const lanes = hudLanes(layout);
const messages = messageStripLayout(BODY).panel;

describe("hudLanes", () => {
  it("keeps the lanes apart from each other, the walk bar, the road and the cards' headers", () => {
    const slotPairs = layout.dogSlots.flatMap((slot, i): [string, Rect, Rect][] => {
      const header = { height: DOG_CARD.dogFace.y, width: slot.width, x: slot.x, y: slot.y };
      const label = lanes.heartLabels[i] ?? slot;
      return [
        [`heart label ${i} and the owners' tabs`, label, lanes.ownerTabs],
        [`heart label ${i} and the road`, label, layout.roadView],
        [`heart label ${i} and the card's header`, label, header],
      ];
    });
    const pairs: [string, Rect, Rect][] = [
      ["the message strip and the walk bar", messages, layout.topBar],
      ["the message strip and the road", messages, layout.roadView],
      ["the owners' tabs and the message strip", lanes.ownerTabs, messages],
      ...slotPairs,
    ];
    expect(pairs.filter(([, a, b]) => rectsOverlap(a, b)).map(([name]) => name)).toEqual([]);
  });

  it("keeps every lane on screen, with one heart label per slot and each owner tab in its lane", () => {
    expect(lanes.heartLabels).toHaveLength(layout.dogSlots.length);
    for (const lane of [messages, lanes.ownerTabs, ...lanes.heartLabels]) {
      expect(Math.min(lane.x, lane.y)).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(SCREEN_CONFIG.width);
      expect(lane.y + lane.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
    for (const slot of layout.dogSlots) {
      const tab = ownerTabRect(slot);
      expect(tab.y).toBeGreaterThanOrEqual(lanes.ownerTabs.y);
      expect(tab.y + tab.height).toBeGreaterThan(lanes.ownerTabs.y + lanes.ownerTabs.height - 1);
    }
  });
});

// Every cause a heart change's label names, after the largest amount, fits its lane on a chip
// inside the lane, the text's ink padded inside the chip.
describe("a heart change's label", () => {
  it("sets every heart change on a chip inside its lane", () => {
    const modifiers = [
      ...Object.values(gameData.debuffs).map(({ name }) => name),
      ...Object.values(gameData.shopGear).map(({ name }) => name),
      ...Object.values(gameData.upgrades).map(({ name }) => name),
      ...Object.values(gameData.walkerPerks).map(({ name }) => name),
    ];
    const sources = [
      ...modifiers,
      ...Object.values(gameData.encounters).flatMap(({ name, resolution }) => [
        name,
        ...(resolution.kind === "card" ? resolution.options.map((option) => option.name) : []),
      ]),
    ];
    const firedBy = keysOf(gameData.dogs).map((dog) => firedByText(gameData, dog));
    // A heart change names any source or the owner who fires you, over its card.
    const hearts = [...sources, ...firedBy].map((name) => `−10♥ ${name}`);
    const cases = lanes.heartLabels
      .slice(0, 1)
      .flatMap((lane) => [...new Set(hearts)].map((text) => [text, lane] as const));
    const misfits = cases.filter(([text, lane]) => {
      const room = changeLabelRoom(lane.width);
      const fitted = fitInFont("font-body", CHANGE_LABEL_STYLES, room, plainMarks(text));
      const { scale } = fitted.style;
      const shown = { lines: fitted.lines.length, scale, width: fitted.widest };
      const { chip, text: caps } = changeChipPlace(BODY, lane, shown);
      const inkBottom = caps.y + inkRowsOfLines(BODY, shown.lines) * scale;
      return (
        fitted.lines.length > (fitted.style.lines ?? 1) ||
        fitted.widest > room ||
        chip.y < lane.y ||
        chip.y + chip.height > lane.y + lane.height ||
        chip.x + chip.width > lane.x + lane.width ||
        caps.y - chip.y < CHANGE_CHIP.padY ||
        chip.y + chip.height - inkBottom < CHANGE_CHIP.padY
      );
    });
    expect(misfits.map(([text]) => text)).toEqual([]);
  });
});
