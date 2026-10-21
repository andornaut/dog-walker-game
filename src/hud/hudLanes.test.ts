import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { hudLanes } from "./hudLanes";
import { messageStripLayout } from "./messageStrip";
import { DOG_CARD, ownerTabRect, WALK_BAR } from "./walkHud";

const layout = screenLayout(SCREEN_CONFIG);
const lanes = hudLanes(layout);
const messages = messageStripLayout().panel;

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const slotPairs = layout.dogSlots.flatMap((slot, i): [string, Rect, Rect][] => {
  const header = { height: DOG_CARD.dogFace.y, width: slot.width, x: slot.x, y: slot.y };
  const label = lanes.heartLabels[i] ?? slot;
  return [
    [`heart label ${i} and the owners' tabs`, label, lanes.ownerTabs],
    [`heart label ${i} and the road`, label, layout.roadView],
    [`heart label ${i} and the card's header`, label, header],
  ];
});

describe("hudLanes", () => {
  it.each<[string, Rect, Rect]>([
    ["the bank and the walk bar", lanes.bank, layout.topBar],
    ["the bank and the message strip", lanes.bank, messages],
    ["the bank and the road", lanes.bank, layout.roadView],
    ["the message strip and the walk bar", messages, layout.topBar],
    ["the message strip and the road", messages, layout.roadView],
    ["the owners' tabs and the message strip", lanes.ownerTabs, messages],
    ...slotPairs,
  ])("keeps %s apart", (_, a, b) => {
    expect(overlaps(a, b)).toBe(false);
  });

  it("keeps every lane on screen, with one heart label per slot", () => {
    expect(lanes.heartLabels).toHaveLength(layout.dogSlots.length);
    for (const lane of [lanes.bank, messages, lanes.ownerTabs, ...lanes.heartLabels]) {
      expect(Math.min(lane.x, lane.y)).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(SCREEN_CONFIG.width);
      expect(lane.y + lane.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
  });

  it.each(layout.dogSlots.map((slot, i) => [i, slot] as const))(
    "holds card %i's owner tab in the owners' lane",
    (_i, slot) => {
      const tab = ownerTabRect(slot);
      expect(tab.y).toBeGreaterThanOrEqual(lanes.ownerTabs.y);
      expect(tab.y + tab.height).toBeGreaterThan(lanes.ownerTabs.y + lanes.ownerTabs.height - 1);
    },
  );
});

describe("the bank lane", () => {
  it("sits under the message strip, at the cash well's columns", () => {
    expect(lanes.bank.x).toBe(layout.topBar.x + WALK_BAR.cash.well.x);
    expect(lanes.bank.width).toBe(WALK_BAR.cash.well.width);
    expect(lanes.bank.y).toBeGreaterThan(messages.y + messages.height);
  });
});
