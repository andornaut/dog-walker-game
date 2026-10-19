import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { DOGHOUSE } from "./doghouse";
import { centredInLane, hudLanes } from "./hudLanes";
import { stripLayout } from "./stateStrip";

const layout = screenLayout(SCREEN_CONFIG);
const lanes = hudLanes(layout);

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
    ["the bank and the toast", lanes.bank, lanes.toast],
    ["the bank and the hint", lanes.bank, lanes.hint],
    ["the bank and the road", lanes.bank, layout.roadView],
    ["the toast and the hint", lanes.toast, lanes.hint],
    ["the toast and the strip bubble", lanes.toast, lanes.stripBubble],
    ["the toast and the road", lanes.toast, layout.roadView],
    ["the hint and the road", lanes.hint, layout.roadView],
    ["the strip bubble and the road", lanes.stripBubble, layout.roadView],
    ["the quip and the road", lanes.quip, layout.roadView],
    ...slotPairs,
  ])("keeps %s apart", (_, a, b) => {
    expect(overlaps(a, b)).toBe(false);
  });

  it("keeps every lane on screen, with one heart label per slot", () => {
    expect(lanes.heartLabels).toHaveLength(layout.dogSlots.length);
    const all = [
      lanes.bank,
      lanes.toast,
      lanes.hint,
      lanes.stripBubble,
      lanes.quip,
      ...lanes.heartLabels,
    ];
    for (const lane of all) {
      expect(Math.min(lane.x, lane.y)).toBeGreaterThanOrEqual(0);
      expect(lane.x + lane.width).toBeLessThanOrEqual(SCREEN_CONFIG.width);
      expect(lane.y + lane.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
    }
  });
});

describe("the bank lane", () => {
  it("sits under the money well, as wide as it", () => {
    expect([lanes.bank.x, lanes.bank.x + lanes.bank.width]).toEqual([4, 92]);
    expect(lanes.bank.y).toBe(layout.topBar.y + layout.topBar.height);
  });

  it("keeps the toast left-aligned at x 4, clear of the widest state strip", () => {
    const strip = stripLayout(SCREEN_CONFIG.width, 5);
    expect(lanes.toast.x).toBe(4);
    expect(lanes.toast.x + lanes.toast.width).toBeLessThanOrEqual(strip?.tab.x ?? 0);
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
