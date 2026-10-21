import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import type { Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
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
import { DOG_CARD, ownerTabRect, WALK_BAR } from "./walkHud";

const layout = screenLayout(SCREEN_CONFIG);
const BODY = fontFileMetrics("font-body");
const lanes = hudLanes(BODY, layout);
const messages = messageStripLayout(BODY).panel;

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

// Every cause a change label names, after the largest amounts, fits its lane on a chip inside
// the lane, the text's ink padded inside the chip.
describe("a change label", () => {
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
      ...(resolution.kind === "card"
        ? resolution.options.map((option) => option.cause ?? option.name)
        : []),
    ]),
    ...gameData.world.zones.map(({ name }) => name),
  ];
  const firedBy = (Object.keys(gameData.dogs) as DogId[]).map((dog) => firedByText(gameData, dog));
  // A heart change names any source or the owner who fires you, over its card; a money change
  // names any source or running out of money, or a tip and what changed it, at the bank.
  const hearts = [...sources, ...firedBy].map((name) => `−10♥ ${name}`);
  const money = [
    ...[...sources, gameData.runText.outOfMoney].map((name) => `+$999 ${name}`),
    ...modifiers.map((name) => `+$99 tip, ${name}`),
  ];
  const cases = [
    ...[...new Set(hearts)].map(
      (text) => ["heart", text, lanes.heartLabels[0] ?? lanes.bank, "middle"] as const,
    ),
    ...[...new Set(money)].map((text) => ["bank", text, lanes.bank, "bottom"] as const),
  ];
  it.each(cases)("in the %s lane, sets %j", (_, text, lane, anchor) => {
    const room = changeLabelRoom(lane.width);
    const fitted = fitInFont("font-body", CHANGE_LABEL_STYLES, room, plainMarks(text));
    expect(fitted.lines.length).toBeLessThanOrEqual(fitted.style.lines ?? 1);
    expect(fitted.widest).toBeLessThanOrEqual(room);
    const { scale } = fitted.style;
    const width = fitted.widest;
    const shown = { lines: fitted.lines.length, scale, width };
    const { chip, text: caps } = changeChipPlace(BODY, lane, anchor, shown);
    expect(chip.y).toBeGreaterThanOrEqual(lane.y);
    expect(chip.y + chip.height).toBeLessThanOrEqual(lane.y + lane.height);
    expect(chip.x + chip.width).toBeLessThanOrEqual(lane.x + lane.width);
    const inkBottom = caps.y + inkRowsOfLines(BODY, shown.lines) * scale;
    expect(caps.y - chip.y).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
    expect(chip.y + chip.height - inkBottom).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
  });
});
