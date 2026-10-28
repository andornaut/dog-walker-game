import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { rectsOverlap } from "../lib/rect";
import { amountText } from "../rules/causes";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { inkRowsOfLines } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { CHANGE_CHIP, CHANGE_LABEL_STYLES } from "./hudLanes";
import type { ChangeLabel } from "./hudView";
import { MESSAGE_STRIP } from "./messageStrip";
import { curvePoint, TOP_BAR_POINTS } from "./moments";
import {
  cashChipPlace,
  mergeTips,
  MONEY_LABEL,
  moneyChipPlace,
  moneyFlightPath,
  stackOrders,
} from "./moneyLabels";
import { WALK_BAR, walkBarLayout } from "./walkHud";

const BODY = fontFileMetrics("font-body");
const { width: SCREEN_WIDTH } = SCREEN_CONFIG;
const { road, topBar: TOP_BAR } = SCREEN_LAYOUT;
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

describe("cashChipPlace", () => {
  const { bank } = TOP_BAR_POINTS;
  const bar = walkBarLayout(TOP_BAR);
  const otherParts = [
    bar.zoneWell,
    ...bar.effectWells,
    ...Object.values(bar.buttons).map(({ hit }) => hit),
  ];
  const stripTop = TOP_BAR.y + TOP_BAR.height + MESSAGE_STRIP.gap;
  it.each(
    CHANGE_LABEL_STYLES.map(({ lines, scale }) => ({
      lines: lines ?? 1,
      scale,
      width: MONEY_LABEL.room,
    })),
  )(
    "pops the widest $lines-line chip at $scale x under the cash, clear of the bar's wells and the strip",
    (text) => {
      const { chip } = cashChipPlace(BODY, text);
      expect(Math.abs(chip.x + chip.width / 2 - bank.x)).toBeLessThanOrEqual(1);
      expect(chip.y).toBeGreaterThan(WALK_BAR.cash.capsBottom);
      expect(chip.y + chip.height).toBeLessThanOrEqual(stripTop);
      expect(otherParts.filter((part) => rectsOverlap(part, chip))).toEqual([]);
    },
  );
});

describe("mergeTips", () => {
  const tip = (amount: number): ChangeLabel => ({
    amount,
    gain: amount > 0,
    target: { kind: "cash" },
    text: amountText("money", amount),
  });
  const zeroed: ChangeLabel = { ...tip(0), zeroedBy: "stinky" };
  const bump: ChangeLabel = {
    amount: -1000,
    gain: false,
    target: { from: { x: 0, y: 0 }, kind: "bank" },
    text: amountText("money", -1000),
  };
  it.each([
    ["two tips", tip(100), tip(100), { amount: 200, text: "+$2" }],
    ["two Big tipper tips", tip(200), tip(200), { amount: 400, text: "+$4" }],
    ["two Stinky tips", zeroed, zeroed, { amount: 0, text: "+$0", zeroedBy: "stinky" }],
  ])("adds up %s on one label by its amount alone", (_name, showing, next, merged) => {
    expect(mergeTips(showing, next)).toEqual({
      gain: merged.amount > 0,
      target: { kind: "cash" },
      ...merged,
    });
  });

  it.each([
    ["a Stinky tip into a paying one", tip(100), zeroed],
    ["a paying tip into a Stinky one", zeroed, tip(100)],
    ["a bump into a tip", tip(100), bump],
  ])("keeps %s apart", (_name, showing, next) => {
    expect(mergeTips(showing, next)).toBeUndefined();
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
    ["by the cash", cashChipPlace(BODY, ONE_LINE)],
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

// Every money label, at the largest amounts a change makes, fits the label's room.
describe("a money change's label", () => {
  // The widest amounts gained and lost.
  it.each([999, -999])("fits %i dollars", (dollars) => {
    const { room } = MONEY_LABEL;
    const text = amountText("money", dollars * 100);
    const fitted = fitInFont("font-body", CHANGE_LABEL_STYLES, room, plainMarks(text));
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.widest).toBeLessThanOrEqual(room);
  });
});
