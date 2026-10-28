import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import { MIN_TAP_SIZE } from "../layout/screenLayout";
import { cents } from "../lib/units";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { inside } from "../testing/rects";
import { newPlayerSave } from "../testing/saves";
import { TEST_TUNING } from "../testing/tuning";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { confirmLines } from "./purchaseConfirm";
import { PURCHASE_CONFIRM_LAYOUT } from "./purchaseConfirmLayout";
import { dogRows, gearRows, slotRows } from "./shop";

const LAYOUT = PURCHASE_CONFIRM_LAYOUT;
const data = { ...gameData, tuning: TEST_TUNING };
const owned = { ...newPlayerSave.owned, dogs: [], gear: [] };
const rows = [...gearRows(data, owned), ...slotRows(data, owned), ...dogRows(data, owned)].flatMap(
  ({ name, price, purchase }) => (price === null ? [] : [{ name, price, purchase }]),
);
// A bank that covers everything at once, so its bank after is the widest one.
const everything = cents(rows.reduce((sum, row) => sum + row.price, 0));
const lines = rows.map((row) =>
  confirmLines(data, {
    bankAfter: everything,
    name: row.name,
    price: row.price,
    purchase: row.purchase,
  }),
);

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

  it.each(["band", "well"] as const)("keeps the %s on the card", (part) => {
    expect(inside(LAYOUT[part], LAYOUT.card)).toBe(true);
  });

  // Each line's font, its capitals' top and the lowest ink of its every text, as drawn at 2x.
  const texts = [
    { font: "font-title", key: "title", place: LAYOUT.title },
    { font: "font-title", key: "price", place: LAYOUT.price },
    { font: "font-body", key: "left", place: LAYOUT.left },
  ] as const;

  it.each(texts)("sets every $key on one line at 2x within its room", ({ font, key, place }) => {
    for (const text of new Set(lines.map((line) => line[key]))) {
      const fitted = fitInFont(font, TEXT_FIT_STYLES, place.room, plainMarks(text));
      expect(fitted.lines, text).toHaveLength(1);
      expect(fitted.style.scale, text).toBe(2);
      expect(fitted.widest, text).toBeLessThanOrEqual(place.room);
    }
  });

  it("keeps the title's capitals in its band", () => {
    const capHeight = fontFileMetrics("font-title").capHeight * 2;
    expect(LAYOUT.title.capTop).toBeGreaterThanOrEqual(LAYOUT.band.y);
    expect(LAYOUT.title.capTop + capHeight).toBeLessThanOrEqual(LAYOUT.band.y + LAYOUT.band.height);
    expect(LAYOUT.title.room).toBeLessThanOrEqual(LAYOUT.band.width);
  });

  // Top to bottom: the band, the well, the price, the bank after and the buttons, each starting
  // below the one before it ends.
  const inkBottom = ({ font, place }: (typeof texts)[number]) =>
    place.capTop + inkRowsFromCapTop(fontFileMetrics(font)) * 2;
  const [, price, left] = texts;
  const stack = [
    { bottom: LAYOUT.band.y + LAYOUT.band.height, name: "band", top: LAYOUT.band.y },
    { bottom: LAYOUT.well.y + LAYOUT.well.height, name: "well", top: LAYOUT.well.y },
    { bottom: inkBottom(price), name: "price", top: LAYOUT.price.capTop },
    { bottom: inkBottom(left), name: "bank after", top: LAYOUT.left.capTop },
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
