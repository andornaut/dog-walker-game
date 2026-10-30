import { inkRowsFromCapTop } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { fontFileMetrics } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { confirmLeftCapTop, PURCHASE_CONFIRM_LAYOUT } from "./purchaseConfirmLayout";

const LAYOUT = PURCHASE_CONFIRM_LAYOUT;

describe("the purchase confirm's layout", () => {
  it("centres the card on the screen", () => {
    const { card } = LAYOUT;
    expect(card.x * 2 + card.width).toBe(SCREEN_CONFIG.width);
    expect(card.y * 2 + card.height).toBe(SCREEN_CONFIG.height);
  });

  it.each(["buy", "cancel"] as const)(
    "taps %s in a button at least 44 each way on the card",
    (choice) => {
      const button = LAYOUT.buttons[choice];
      expect(button.width).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(button.height).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      expect(inside(button, LAYOUT.card)).toBe(true);
    },
  );

  it("puts Cancel left of Buy with a gap between", () => {
    const { buy, cancel } = LAYOUT.buttons;
    expect(cancel.x + cancel.width).toBeLessThan(buy.x);
  });

  it.each(["titleRow", "well"] as const)("keeps the %s on the card", (part) => {
    expect(inside(LAYOUT[part], LAYOUT.card)).toBe(true);
  });

  // Each line's font, its capitals' top and the lowest ink of its every text, as drawn at 2x.
  const texts = [
    { font: "font-title", key: "title", place: LAYOUT.title },
    { font: "font-title", key: "price", place: LAYOUT.price },
    {
      font: "font-body",
      key: "left",
      place: { capTop: confirmLeftCapTop(fontFileMetrics("font-title")) },
    },
  ] as const;

  it("keeps the title's capitals in its row", () => {
    const capHeight = fontFileMetrics("font-title").capHeight * 2;
    const row = LAYOUT.titleRow;
    expect(LAYOUT.title.capTop).toBeGreaterThanOrEqual(row.y);
    expect(LAYOUT.title.capTop + capHeight).toBeLessThanOrEqual(row.y + row.height);
    expect(LAYOUT.title.room).toBeLessThanOrEqual(row.width);
  });

  // Top to bottom: the title row, the well, the price, the bank after and the buttons, each starting
  // below the one before it ends.
  const inkBottom = ({ font, place }: (typeof texts)[number]) =>
    place.capTop + inkRowsFromCapTop(fontFileMetrics(font)) * 2;
  const [, price, left] = texts;
  const stack = [
    {
      bottom: LAYOUT.titleRow.y + LAYOUT.titleRow.height,
      name: "title row",
      top: LAYOUT.titleRow.y,
    },
    { bottom: LAYOUT.well.y + LAYOUT.well.height, name: "well", top: LAYOUT.well.y },
    { bottom: inkBottom(price), name: "price", top: LAYOUT.price.capTop },
    { bottom: inkBottom(left), name: "bank after", top: left.place.capTop },
    {
      bottom: LAYOUT.buttons.buy.y + LAYOUT.buttons.buy.height,
      name: "buttons",
      top: LAYOUT.buttons.buy.y,
    },
  ];

  const pairs = stack.flatMap((above, i) => {
    const below = stack[i + 1];
    return below === undefined ? [] : [{ above, below, name: `${below.name} under ${above.name}` }];
  });

  it.each(pairs)("starts the $name", ({ above, below }) => {
    expect(below.top).toBeGreaterThan(above.bottom);
  });
});
