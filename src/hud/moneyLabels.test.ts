import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import { rectsOverlap } from "../lib/rect";
import { amountText, causeLabel } from "../rules/causes";
import { payFor } from "../rules/run";
import { cents } from "../rules/units";
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
  tipLabelText,
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

describe("tipLabelText", () => {
  const { stinky } = gameData.debuffs;
  const tipper = gameData.upgrades.bigTipper.name;
  it.each([
    [
      "one tip",
      [{ amount: 100, kind: "tip" }],
      { amount: 100, count: 1, others: [], zeroed: false },
    ],
    [
      "one Big tipper tip",
      [
        { amount: 100, kind: "tip" },
        { amount: 100, kind: "modifier", source: { kind: "upgrade", upgrade: "bigTipper" } },
      ],
      { amount: 200, count: 1, others: [tipper], zeroed: false },
    ],
    [
      "one tip Stinky zeroed",
      [
        { amount: 100, kind: "tip" },
        { amount: -100, kind: "modifier", source: { debuff: "stinky", kind: "debuff" } },
      ],
      { amount: 0, count: 1, others: [stinky.name], zeroed: true },
    ],
  ] as const)("reads %s as its change's label", (_name, causes, tips) => {
    const change = { amount: cents(tips.amount), causes, dog: null, kind: "money" } as const;
    expect(tipLabelText(gameData, tips)).toBe(causeLabel(gameData, change));
  });

  const { tips } = gameData.runText.causes;
  it.each([
    ["two tips", { amount: 200, count: 2, others: [], zeroed: false }, `+$2 ${tips}`],
    [
      "three Big tipper tips",
      { amount: 600, count: 3, others: [tipper], zeroed: false },
      `+$6 ${tips}, ${tipper}`,
    ],
    [
      "two tips Stinky zeroed",
      { amount: 0, count: 2, others: [stinky.name], zeroed: true },
      `+$0 ${stinky.name}`,
    ],
  ])("reads %s as one label", (_name, tally, text) => {
    expect(tipLabelText(gameData, tally)).toBe(text);
  });
});

describe("mergeTips", () => {
  const tipper = gameData.upgrades.bigTipper.name;
  const { stinky } = gameData.debuffs;
  const { tips } = gameData.runText.causes;
  const tip = (amount: number, others: string[] = []): ChangeLabel => ({
    amount,
    gain: amount > 0,
    target: { kind: "cash", others },
    text: tipLabelText(gameData, { amount, count: 1, others, zeroed: false }),
  });
  const zeroed: ChangeLabel = {
    amount: 0,
    gain: false,
    target: { kind: "cash", others: [stinky.name] },
    text: `+$0 ${stinky.name}`,
    zeroedBy: "stinky",
  };
  const bump: ChangeLabel = {
    amount: -1000,
    gain: false,
    target: { from: { x: 0, y: 0 }, kind: "bank" },
    text: "−$10 bump",
  };
  it.each([
    [
      "two tips",
      { count: 1, label: tip(100) },
      tip(100),
      { amount: 200, count: 2, others: [], text: `+$2 ${tips}` },
    ],
    [
      "a third tip, one Big tipper changed",
      { count: 2, label: { ...tip(200), text: `+$2 ${tips}` } },
      tip(200, [tipper]),
      { amount: 400, count: 3, others: [tipper], text: `+$4 ${tips}, ${tipper}` },
    ],
    [
      "two Stinky tips",
      { count: 1, label: zeroed },
      zeroed,
      { amount: 0, count: 2, others: [stinky.name], text: `+$0 ${stinky.name}` },
    ],
  ])("adds up %s on one label", (_name, showing, next, merged) => {
    const result = mergeTips(gameData, showing, next);
    expect(result?.count).toBe(merged.count);
    expect(result?.label).toMatchObject({
      amount: merged.amount,
      target: { kind: "cash", others: merged.others },
      text: merged.text,
    });
  });

  it.each([
    ["a Stinky tip into a paying one", { count: 1, label: tip(100) }, zeroed],
    ["a paying tip into a Stinky one", { count: 1, label: zeroed }, tip(100)],
    ["a bump into a tip", { count: 1, label: tip(100) }, bump],
  ])("keeps %s apart", (_name, showing, next) => {
    expect(mergeTips(gameData, showing, next)).toBeUndefined();
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
    ...modifiers.map((name) => `+$99 ${gameData.runText.causes.tip}, ${name}`),
    ...modifiers.map((name) => `+$99 ${gameData.runText.causes.tips}, ${name}`),
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
