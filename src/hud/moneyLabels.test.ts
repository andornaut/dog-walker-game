import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { rectsOverlap } from "../lib/rect";
import { amountText } from "../rules/causes";
import { payFor } from "../rules/run";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { CHANGE_CHIP, CHANGE_LABEL_STYLES } from "./hudLanes";
import { curvePoint, TOP_BAR_POINTS } from "./moments";
import {
  cashChipPlace,
  cashSlot,
  MONEY_LABEL,
  moneyChipPlace,
  moneyFlightPath,
  stackOrders,
} from "./moneyLabels";
import { WALK_BAR, walkBarLayout } from "./walkHud";

const BODY = fontFileMetrics("font-body");
const { width: SCREEN_WIDTH } = SCREEN_CONFIG;
const { road, topBar: TOP_BAR } = screenLayout(SCREEN_CONFIG);
const ROAD_MIDDLE = { x: road.x + road.width / 2, y: road.y + road.height / 2 };
const ONE_LINE = { lines: 1, scale: 2, width: 40 };
const CHIP = moneyChipPlace(BODY, SCREEN_WIDTH, { x: 0, y: 0 }, 0, ONE_LINE).chip;

describe("stackOrders", () => {
  const a = { x: 10, y: 20 };
  const b = { x: 30, y: 20 };
  it.each([
    ["no labels", [], []],
    ["one label", [a], [0]],
    ["labels from two points", [a, b, a, a, b], [0, 0, 1, 2, 1]],
  ])("stacks %s by the labels before them from the same point", (_name, points, orders) => {
    expect(stackOrders(points)).toEqual(orders);
  });
});

describe("moneyChipPlace", () => {
  const { gap, gutter, lift } = MONEY_LABEL;
  const centred = (x: number) => Math.round(x - CHIP.width / 2);
  it.each([
    ["centred over its point", ROAD_MIDDLE, 0, centred(ROAD_MIDDLE.x), 0],
    ["kept inside the left edge", { x: 3, y: ROAD_MIDDLE.y }, 0, gutter, 0],
    [
      "kept inside the right edge",
      { x: SCREEN_WIDTH - 3, y: ROAD_MIDDLE.y },
      0,
      SCREEN_WIDTH - gutter - CHIP.width,
      0,
    ],
    ["stacked over the label before it", ROAD_MIDDLE, 1, centred(ROAD_MIDDLE.x), 1],
    ["stacked over two labels", ROAD_MIDDLE, 2, centred(ROAD_MIDDLE.x), 2],
  ])("pops %s", (_name, from, order, left, below) => {
    const { chip, text } = moneyChipPlace(BODY, SCREEN_WIDTH, from, order, ONE_LINE);
    expect(chip.x).toBe(left);
    expect(chip.y + chip.height).toBe(from.y - lift - below * (chip.height + gap));
    expect(text.x - chip.x).toBe(CHANGE_CHIP.padX);
    const inkBottom = text.y + inkRowsOfLines(BODY, 1) * ONE_LINE.scale;
    expect(text.y - chip.y).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
    expect(chip.y + chip.height - inkBottom).toBeGreaterThanOrEqual(CHANGE_CHIP.padY);
  });
});

describe("cashSlot", () => {
  it.each([
    ["the top slot in an empty column", [], 0],
    ["the slot under a label", [0], 1],
    ["the slot under the lowest label, past a freed slot", [1], 2],
    ["the slot under the lowest of several labels", [2, 0, 1], 3],
  ])("takes %s", (_name, taken, slot) => {
    expect(cashSlot(taken)).toBe(slot);
  });
});

describe("cashChipPlace", () => {
  const { gap } = MONEY_LABEL;
  const { bank } = TOP_BAR_POINTS;
  const bar = walkBarLayout(TOP_BAR);
  const otherParts = [
    bar.zoneWell,
    ...bar.effectWells,
    ...Object.values(bar.buttons).map(({ hit }) => hit),
  ];
  const styles = CHANGE_LABEL_STYLES.map(({ lines, scale }) => ({
    lines: lines ?? 1,
    scale,
    width: MONEY_LABEL.room,
  }));
  const slots = [0, 1, 2];
  it.each(slots.flatMap((slot) => styles.map((text) => [slot, text] as const)))(
    "pops slot %i's widest %j chip under the cash's capitals, centred, clear of the bar's other parts",
    (slot, text) => {
      const { chip } = cashChipPlace(BODY, slot, text);
      expect(Math.abs(chip.x + chip.width / 2 - bank.x)).toBeLessThanOrEqual(1);
      expect(chip.y).toBeGreaterThan(WALK_BAR.cash.capsBottom + gap);
      expect(otherParts.filter((part) => rectsOverlap(part, chip))).toEqual([]);
    },
  );

  it.each(
    slots.flatMap((slot) =>
      styles.flatMap((above) => styles.map((below) => [slot, above, below] as const)),
    ),
  )("stacks slot %i's %j chip clear over the next slot's %j chip", (slot, above, below) => {
    const upper = cashChipPlace(BODY, slot, above).chip;
    const lower = cashChipPlace(BODY, slot + 1, below).chip;
    expect(lower.y - (upper.y + upper.height)).toBeGreaterThanOrEqual(gap);
  });
});

describe("moneyFlightPath", () => {
  const { gutter } = MONEY_LABEL;
  it.each([
    [
      "the road's left edge",
      moneyChipPlace(BODY, SCREEN_WIDTH, { x: road.x, y: ROAD_MIDDLE.y }, 0, ONE_LINE),
    ],
    ["the road's middle", moneyChipPlace(BODY, SCREEN_WIDTH, ROAD_MIDDLE, 0, ONE_LINE)],
    [
      "the road's right edge",
      moneyChipPlace(BODY, SCREEN_WIDTH, { x: road.x + road.width, y: ROAD_MIDDLE.y }, 0, ONE_LINE),
    ],
    ["the cash's top slot", cashChipPlace(BODY, 0, ONE_LINE)],
    ["the cash's third slot", cashChipPlace(BODY, 2, ONE_LINE)],
  ])("flies a chip from %s into the cash, on screen", (_name, { chip }) => {
    const path = moneyFlightPath(chip);
    const at = (t: number) => curvePoint(path.from, path.control, path.to, t);
    expect(at(0)).toEqual({ x: chip.x, y: chip.y });
    const end = at(1);
    const { bank } = TOP_BAR_POINTS;
    expect(Math.abs(end.x + chip.width / 2 - bank.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(end.y + chip.height / 2 - bank.y)).toBeLessThanOrEqual(1);
    for (const t of [0.25, 0.5, 0.75]) {
      const { x, y } = at(t);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeGreaterThanOrEqual(Math.min(gutter, path.to.x));
      expect(x + chip.width).toBeLessThanOrEqual(SCREEN_WIDTH);
    }
  });
});

// Every money change, after the largest amounts, fits the label's room: a card option's or any
// other source's, a zone's pay, and a tip with what changed it.
describe("a money change's label", () => {
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
  const money = [
    ...sources.map((name) => `+$999 ${name}`),
    `${amountText("money", payFor(gameData.tuning))} ${gameData.runText.causes.pay}`,
    ...modifiers.map((name) => `+$99 tip, ${name}`),
  ];
  it("fits every money change", () => {
    const misfits = [...new Set(money)].filter((text) => {
      const { room } = MONEY_LABEL;
      const fitted = fitInFont("font-body", CHANGE_LABEL_STYLES, room, plainMarks(text));
      return fitted.lines.length > (fitted.style.lines ?? 1) || fitted.widest > room;
    });
    expect(misfits).toEqual([]);
  });
});
