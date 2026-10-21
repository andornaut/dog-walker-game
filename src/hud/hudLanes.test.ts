import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { DOGHOUSE } from "./doghouse";
import { centredInLane, hudLanes } from "./hudLanes";
import { messageStripLayout } from "./messageStrip";
import { TOP_BAR } from "./topBar";

const layout = screenLayout(SCREEN_CONFIG);
const lanes = hudLanes(layout);
const messages = messageStripLayout().panel;

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const slotPairs = layout.dogSlots.flatMap((slot, i): [string, Rect, Rect][] => {
  const face = { height: 32, width: 32, x: slot.x + DOGHOUSE.ownerFace.x, y: slot.y + 24 };
  const label = lanes.heartLabels[i] ?? slot;
  return [
    [`the quip and owner face ${i}`, lanes.quip, face],
    [`heart label ${i} and its owner face`, label, face],
    [`heart label ${i} and the quip`, label, lanes.quip],
    [`heart label ${i} and the road`, label, layout.roadView],
  ];
});

describe("hudLanes", () => {
  it.each<[string, Rect, Rect]>([
    ["the bank and the top bar", lanes.bank, layout.topBar],
    ["the bank and the message strip", lanes.bank, messages],
    ["the bank and the strip bubble", lanes.bank, lanes.stripBubble],
    ["the bank and the road", lanes.bank, layout.roadView],
    ["the message strip and the top bar", messages, layout.topBar],
    ["the message strip and the strip bubble", messages, lanes.stripBubble],
    ["the message strip and the road", messages, layout.roadView],
    ["the strip bubble and the road", lanes.stripBubble, layout.roadView],
    ["the quip and the road", lanes.quip, layout.roadView],
    ...slotPairs,
  ])("keeps %s apart", (_, a, b) => {
    expect(overlaps(a, b)).toBe(false);
  });

  it("keeps every lane on screen, with one heart label per slot", () => {
    expect(lanes.heartLabels).toHaveLength(layout.dogSlots.length);
    const all = [lanes.bank, messages, lanes.stripBubble, lanes.quip, ...lanes.heartLabels];
    for (const lane of all) {
      expect(Math.min(lane.x, lane.y)).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(SCREEN_CONFIG.width);
      expect(lane.y + lane.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
  });
});

describe("the bank lane", () => {
  it("sits under the message strip, at the money well's columns", () => {
    expect(lanes.bank.x).toBe(TOP_BAR.money.x);
    expect(lanes.bank.width).toBe(TOP_BAR.money.width);
    expect(lanes.bank.y).toBeGreaterThan(messages.y + messages.height);
  });
});

describe("centredInLane", () => {
  const lane = { height: 24, width: 360, x: 0, y: 470 };
  it.each([
    [180, 100, 130],
    [10, 100, 0],
    [350, 100, 260],
    [180, 400, 0],
  ])("centres on %i a bubble %i wide at x %i", (centerX, width, x) => {
    expect(centredInLane(lane, centerX, width)).toBe(x);
  });
});
