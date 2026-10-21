import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { scrollMax } from "../input/listScroll";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { maxHearts } from "../rules/dogs";
import { capitalize, SIZE_NAMES } from "../rules/effectText";
import { unlockPrice } from "../rules/shop";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { TEST_TUNING } from "../testing/tuning";
import { fillNames } from "../text/lines";
import { readBitmapFont } from "../tools/fontFile";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { dollarText, type Purchase } from "./home";
import { messageLine } from "./homeLines";
import {
  dogRows,
  gearRows,
  shopAffordable,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  shopTabOf,
  slotRows,
} from "./shop";
import {
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListBottom,
  shopMessageCapTop,
  shopRowTextRoom,
  shopScrollbar,
  shopTabRects,
} from "./shopLayout";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const starters = (Object.keys(data.dogs) as DogId[]).filter(
  (dog) => data.dogs[dog].unlock === "start",
);
const owned: Owned = { dogSlots: 1, dogs: starters, gear: [], walkers: [] };

describe("shopRowLook", () => {
  const row = (price: number | null, blocked: string | null): ShopRow => ({
    blocked,
    id: "x",
    line: "",
    name: "X",
    price: price === null ? null : dollars(price),
    purchase: { kind: "dogSlot" },
  });

  it("shows a row owned, blocked though the bank covers it, affordable at exactly its price, or short", () => {
    expect(shopRowLook(dollars(0), row(null, null))).toBe("owned");
    expect(shopRowLook(dollars(900), row(500, "first"))).toBe("blocked");
    expect(shopRowLook(dollars(500), row(500, null))).toBe("affordable");
    expect(shopRowLook(dollars(499), row(500, null))).toBe("short");
  });
});

describe("slotRows", () => {
  const view = (dogSlots: number) =>
    slotRows(data, { ...owned, dogSlots }).map(({ blocked, id, price }) => ({
      blocked: blocked !== null,
      id,
      owned: price === null,
    }));

  it("sells the next slot and blocks the one after it", () => {
    expect(view(1)).toEqual([
      { blocked: false, id: "slot:2", owned: false },
      { blocked: true, id: "slot:3", owned: false },
    ]);
    expect(view(2)).toEqual([
      { blocked: false, id: "slot:2", owned: true },
      { blocked: false, id: "slot:3", owned: false },
    ]);
  });

  it("says which slot a blocked one needs first", () => {
    const text = { ...data.homeText, shop: { ...data.homeText.shop, slotFirst: "after {slot}" } };
    const [, third] = slotRows({ ...data, homeText: text }, owned);
    expect(third?.blocked).toBe("after 2");
  });
});

describe("gearRows and dogRows", () => {
  it("list every gear item in shop order, an owned one in place without a price", () => {
    const rows = gearRows(data, { ...owned, gear: ["fannyPack"] });
    expect(rows.map(({ id }) => id)).toEqual(
      Object.keys(data.shopGear).map((gear) => `gear:${gear}`),
    );
    expect(rows.find(({ id }) => id === "gear:fannyPack")?.price).toBeNull();
  });

  it("list only the dogs still for sale: a bought one leaves the list", () => {
    const [bought, ...rest] = (Object.keys(data.dogs) as DogId[]).filter(
      (dog) => !starters.includes(dog),
    );
    const rows = dogRows(data, { ...owned, dogs: [...starters, bought ?? "koda"] });
    expect(rows.map(({ id }) => id)).toEqual(rest.map((dog) => `dog:${dog}`));
  });

  const forSale = (Object.keys(data.dogs) as DogId[]).filter((dog) => !starters.includes(dog));

  it("gives a dog's row its size and hearts, and its price on the plate", () => {
    const dog = forSale[0] ?? "koda";
    const row = dogRows(data, owned).find(({ id }) => id === `dog:${dog}`);
    const { size } = data.dogs[dog];
    const kind = fillNames(data.homeText.focus.kind, {
      hearts: String(maxHearts(data.tuning, [], data.dogs[dog])),
      size: SIZE_NAMES[size],
    });
    expect(row?.line).toBe(capitalize(kind));
    expect(row?.price).toBe(unlockPrice(data.tuning, data.dogs[dog]));
  });
});

describe("shopAffordable", () => {
  it("holds while the bank covers anything, and fails once everything is owned", () => {
    const everything: Owned = {
      dogSlots: data.dogSlots.length,
      dogs: Object.keys(data.dogs) as DogId[],
      gear: Object.keys(data.shopGear) as Owned["gear"],
      walkers: [],
    };
    expect(shopAffordable(data, owned, dollars(600))).toBe(true);
    expect(shopAffordable(data, owned, dollars(0))).toBe(false);
    expect(shopAffordable(data, everything, dollars(100_000))).toBe(false);
  });
});

describe("shopRowId and shopTabOf", () => {
  it("puts each purchase's row on the tab that lists it", () => {
    const rows: Record<ShopTab, ShopRow[]> = {
      dogs: [...slotRows(data, owned), ...dogRows(data, owned)],
      gear: gearRows(data, owned),
    };
    const purchases: Purchase[] = [
      { dog: "nugget", kind: "dog" },
      { kind: "dogSlot" },
      { gear: "luckyCollar", kind: "gear" },
    ];
    for (const purchase of purchases) {
      const ids = rows[shopTabOf(purchase)].map(({ id }) => id);
      expect(ids).toContain(shopRowId(owned, purchase));
    }
  });
});

// Every row's name and line, with nothing bought and with every item owned, fit the room the
// price plate or OWNED leaves them, both measured on the fonts at 2x.
describe("a shop row's text", () => {
  // A label's width as Phaser gives it: its glyphs' advances at 2x.
  const advances = (font: string, text: string) => {
    const { glyphs } = readBitmapFont(font);
    return 2 * [...text].reduce((sum, char) => sum + (glyphs.get(char)?.advance ?? 0), 0);
  };
  const rightWidth = (row: ShopRow) =>
    row.price === null
      ? SHOP_LAYOUT.row.ownedDx + advances("font-title", gameData.homeText.shop.owned.toUpperCase())
      : advances("font-body", dollarText(row.price)) + 6;
  const everything: Owned = {
    dogSlots: gameData.dogSlots.length,
    dogs: Object.keys(gameData.dogs) as DogId[],
    gear: Object.keys(gameData.shopGear) as Owned["gear"],
    walkers: [],
  };
  const rows = [owned, everything].flatMap((have) => [
    ...gearRows(gameData, have),
    ...slotRows(gameData, have),
    ...dogRows(gameData, have),
  ]);
  it("sets every row's name and line beside its price or OWNED", () => {
    const offenders = rows.flatMap((row) =>
      [row.name, row.line]
        .filter((text) => {
          const room = shopRowTextRoom(rightWidth(row));
          return (
            text !== "" &&
            fitInFont("font-body", TEXT_FIT_STYLES, room, plainMarks(text)).widest > room
          );
        })
        .map((text) => `${row.id}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });
});

// Every message a tap in the shop leaves fits on one line on its plate, its ink inside the
// plate's frame: each blocked row's reason, each priced row's "can't afford" with its whole
// price short, and each purchase's thanks.
describe("the shop's message", () => {
  const everyRow = [
    ...gearRows(gameData, owned),
    ...slotRows(gameData, owned),
    ...dogRows(gameData, owned),
  ];
  const messages = everyRow.flatMap((row) => [
    ...(row.blocked === null ? [] : [row.blocked]),
    ...(row.price === null
      ? []
      : [
          messageLine(gameData.homeText, { amount: row.price, kind: "cantAfford", name: row.name }),
        ]),
    messageLine(gameData.homeText, { kind: "bought", name: row.name, purchase: row.purchase }),
  ]);
  const body = fontFileMetrics("font-body");
  const { frame, plate, textDx } = SHOP_LAYOUT.message;

  it.each([...new Set(messages)])("sets %j on one line inside its plate's frame", (text) => {
    const { room, styles } = SHOP_MESSAGE_FIT;
    const fitted = fitInFont("font-body", styles, room, plainMarks(text ?? ""));
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.widest).toBeLessThanOrEqual(plate.width - 2 * textDx);
    const capTop = shopMessageCapTop(body, fitted.style.scale);
    expect(capTop).toBeGreaterThanOrEqual(plate.y + frame);
    expect(capTop + inkRowsFromCapTop(body) * fitted.style.scale).toBeLessThanOrEqual(
      plate.y + plate.height - frame,
    );
  });

  // The plate sits at the top of the list area, under the tabs, across the list's width.
  it("lies across the list's top, under the tabs", () => {
    const { rect } = SHOP_LAYOUT.list;
    const tabsBottom = Math.max(...shopTabRects().map(({ height, y }) => y + height));
    expect(plate).toMatchObject({ width: rect.width, x: rect.x, y: rect.y });
    expect(plate.y + plate.height).toBeGreaterThan(tabsBottom);
    expect(SHOP_LAYOUT.tab.drawY + SHOP_LAYOUT.tab.drawHeight).toBeLessThanOrEqual(plate.y);
  });
});

// Each tab's list, with nothing bought and with everything bought, scrolls far enough to bring
// its last row inside the list area, and no further than its padding below it.
describe("the shop's list", () => {
  const { padBottom, rect } = SHOP_LAYOUT.list;
  const listBottom = rect.y + rect.height;
  const everything: Owned = {
    dogSlots: data.dogSlots.length,
    dogs: Object.keys(data.dogs) as DogId[],
    gear: Object.keys(data.shopGear) as Owned["gear"],
    walkers: [],
  };
  const lists = [
    ["gear, nothing bought", SHOP_LAYOUT.gear.rows, gearRows(data, owned).length],
    ["gear, everything bought", SHOP_LAYOUT.gear.rows, gearRows(data, everything).length],
    ["dogs, nothing bought", SHOP_LAYOUT.dogs.dogRows, dogRows(data, owned).length],
    ["dogs, everything bought", SHOP_LAYOUT.dogs.dogRows, dogRows(data, everything).length],
  ] as const;

  it.each(lists)("%s: scrolls its last row into view", (_, spec, count) => {
    const bottom = shopListBottom(spec, count);
    const max = scrollMax(rect, bottom);
    const lastRowBottom = spec.y + (Math.max(1, count) - 1) * spec.pitch + spec.height;
    expect(lastRowBottom - max).toBeLessThanOrEqual(listBottom - padBottom);
    expect(bottom - max).toBeLessThanOrEqual(listBottom);
  });

  // max: how far the list moves; y: its scroll. The track runs the list area's height.
  it.each<[string, number, number, "bottom" | "top"]>([
    ["sits at the top scrolled to the top", 200, 0, "top"],
    ["sits at the bottom scrolled to the bottom", 200, 200, "bottom"],
    ["sits at the bottom of a long list scrolled to the bottom", 5000, 5000, "bottom"],
  ])("the scrollbar's thumb %s", (_, max, y, end) => {
    const bar = shopScrollbar(max, y);
    expect(bar).not.toBeNull();
    const { thumb, track } = bar ?? { thumb: rect, track: rect };
    expect(track).toMatchObject({ height: rect.height, y: rect.y });
    expect(thumb.height).toBeGreaterThanOrEqual(SHOP_LAYOUT.scrollbar.thumbMin);
    if (end === "top") {
      expect(thumb.y).toBe(track.y);
    } else {
      expect(thumb.y + thumb.height).toBe(track.y + track.height);
    }
  });

  it("shows no scrollbar for a list that fits", () => {
    expect(shopScrollbar(0, 0)).toBeNull();
  });

  // The scrollbar stays clear of the list area, where the rows and their frames are clipped,
  // and inside the card.
  it("puts the scrollbar between the list area and the card's edge", () => {
    const bar = shopScrollbar(100, 0);
    const { panel } = SHOP_LAYOUT;
    const thumb = bar?.thumb ?? rect;
    expect(thumb.x).toBeGreaterThanOrEqual(rect.x + rect.width);
    expect(thumb.x + thumb.width).toBeLessThanOrEqual(
      panel.x + panel.width - SHOP_LAYOUT.scrollbar.inset,
    );
  });
});
