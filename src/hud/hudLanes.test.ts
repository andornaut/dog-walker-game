import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { type Rect, rectsOverlap } from "../lib/rect";
import { defined } from "../testing/defined";
import { fontFileMetrics } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import {
  CHANGE_CHIP,
  CHANGE_LABEL_STYLE,
  changeChipPlace,
  changeLabelRoom,
  hudLanes,
} from "./hudLanes";
import { messageStripLayout } from "./messageStrip";
import { DOG_CARD, ownerTabRect } from "./walkHud";

const layout = SCREEN_LAYOUT;
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

// A heart change's label, on as many lines as its style holds and as wide as its room, sits on
// a chip in its lane, or grown up the card from the lane's bottom, clear of the card's header;
// the text's ink padded inside the chip (every label fits its room: ui/textRoles.test.ts).
describe("a heart change's label", () => {
  const lines = Array.from({ length: CHANGE_LABEL_STYLE.lines ?? 1 }, (_, i) => i + 1);
  it.each(
    lines.flatMap((count) => lanes.heartLabels.map((lane, slot) => [count, slot, lane] as const)),
  )("sets %i lines on a chip over card %i", (count, slot, lane) => {
    const { scale } = CHANGE_LABEL_STYLE;
    const shown = { lines: count, scale, width: changeLabelRoom(lane.width) };
    const { chip, text: caps } = changeChipPlace(BODY, lane, shown);
    const inkBottom = caps.y + inkRowsOfLines(BODY, count) * scale;
    const card = defined(layout.dogSlots[slot]);
    expect(chip.y).toBeGreaterThanOrEqual(card.y + DOG_CARD.dogFace.y);
    expect(chip.y + chip.height).toBeLessThanOrEqual(lane.y + lane.height);
    expect(chip.x + chip.width).toBeLessThanOrEqual(lane.x + lane.width);
    expect(caps.y - chip.y).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
    expect(chip.y + chip.height - inkBottom).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
  });

  it("keeps a one-line chip in its lane", () => {
    const lane = defined(lanes.heartLabels[0]);
    const shown = { lines: 1, scale: CHANGE_LABEL_STYLE.scale, width: 0 };
    const { chip } = changeChipPlace(BODY, lane, shown);
    expect(chip.y).toBeGreaterThanOrEqual(lane.y);
  });
});
