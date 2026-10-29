import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { type Rect, rectsOverlap } from "../lib/rect";
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

// A heart change's label, its amount on one line as wide as its room, sits on a chip inside its
// lane, the text's ink padded inside the chip (every amount fits its room:
// ui/textRoles.test.ts).
describe("a heart change's label", () => {
  it.each(lanes.heartLabels.map((lane, slot) => [slot, lane] as const))(
    "sets its amount on a chip inside card %i's lane",
    (_slot, lane) => {
      const { scale } = CHANGE_LABEL_STYLE;
      const shown = { lines: 1, scale, width: changeLabelRoom(lane.width) };
      const { chip, text: caps } = changeChipPlace(BODY, lane, shown);
      const inkBottom = caps.y + inkRowsOfLines(BODY, 1) * scale;
      expect(chip.y).toBeGreaterThanOrEqual(lane.y);
      expect(chip.y + chip.height).toBeLessThanOrEqual(lane.y + lane.height);
      expect(chip.x + chip.width).toBeLessThanOrEqual(lane.x + lane.width);
      expect(caps.y - chip.y).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
      expect(chip.y + chip.height - inkBottom).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
    },
  );
});
