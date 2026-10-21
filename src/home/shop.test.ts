import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { TEXT_FIT_STYLES } from "../layout/textFit";
import { maxHearts } from "../rules/dogs";
import { capitalize, SIZE_NAMES } from "../rules/effectText";
import { unlockPrice } from "../rules/shop";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { fitInFont } from "../testing/fontInk";
import { TEST_TUNING } from "../testing/tuning";
import { fillNames } from "../text/lines";
import { readBitmapFont } from "../tools/fontFile";
import { plainMarks } from "../ui/pixelFont";
import { dollarText, type Purchase } from "./home";
import {
  dogRows,
  gearRows,
  shopAffordable,
  type ShopRow,
  shopRowId,
  type ShopRowLook,
  shopRowLook,
  type ShopTab,
  shopTabOf,
  slotRows,
} from "./shop";
import { SHOP_LAYOUT, shopRowTextRoom } from "./shopLayout";

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

  it.each<[string, ShopRow, number, ShopRowLook]>([
    ["an owned row", row(null, null), 0, "owned"],
    [
      "a row that needs another first, though the bank covers it",
      row(500, "first"),
      900,
      "blocked",
    ],
    ["a row the bank exactly covers", row(500, null), 500, "affordable"],
    ["a row past the bank", row(500, null), 499, "short"],
  ])("shows %s", (_, shown, bank, expected) => {
    expect(shopRowLook(dollars(bank), shown)).toBe(expected);
  });
});

describe("slotRows", () => {
  const view = (dogSlots: number) =>
    slotRows(data, { ...owned, dogSlots }).map(({ blocked, id, price }) => ({
      blocked: blocked !== null,
      id,
      owned: price === null,
    }));

  it.each<[number, { blocked: boolean; id: string; owned: boolean }[]]>([
    [
      1,
      [
        { blocked: false, id: "slot:2", owned: false },
        { blocked: true, id: "slot:3", owned: false },
      ],
    ],
    [
      2,
      [
        { blocked: false, id: "slot:2", owned: true },
        { blocked: false, id: "slot:3", owned: false },
      ],
    ],
    [
      3,
      [
        { blocked: false, id: "slot:2", owned: true },
        { blocked: false, id: "slot:3", owned: true },
      ],
    ],
  ])("with %i slots owned sells the next and blocks the one after it", (slots, expected) => {
    expect(view(slots)).toEqual(expected);
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

  it.each(forSale)("gives %s's row its size and hearts, and its price on the plate", (dog) => {
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
  it.each<[string, Owned, number, boolean]>([
    ["holds while the bank covers anything", owned, 600, true],
    ["fails while it covers nothing", owned, 0, false],
    [
      "fails once everything is owned",
      {
        dogSlots: data.dogSlots.length,
        dogs: Object.keys(data.dogs) as DogId[],
        gear: Object.keys(data.shopGear) as Owned["gear"],
        walkers: [],
      },
      100_000,
      false,
    ],
  ])("%s", (_, ownedNow, bank, expected) => {
    expect(shopAffordable(data, ownedNow, dollars(bank))).toBe(expected);
  });
});

describe("shopRowId and shopTabOf", () => {
  it.each<[Purchase, string, ShopTab]>([
    [{ dog: "nugget", kind: "dog" }, "dog:nugget", "dogs"],
    [{ kind: "dogSlot" }, "slot:2", "dogs"],
    [{ gear: "luckyCollar", kind: "gear" }, "gear:luckyCollar", "gear"],
  ])("opens %o on its row and tab", (purchase, id, tab) => {
    expect(shopRowId(owned, purchase)).toBe(id);
    expect(shopTabOf(purchase)).toBe(tab);
  });

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
  it.each(
    rows.flatMap((row) =>
      [row.name, row.line]
        .filter((text) => text !== "")
        .map((text) => [row.id, text, row] as const),
    ),
  )("sets %s's %j beside its price or OWNED", (_id, text, row) => {
    const room = shopRowTextRoom(rightWidth(row));
    expect(
      fitInFont("font-body", TEXT_FIT_STYLES, room, plainMarks(text)).widest,
    ).toBeLessThanOrEqual(room);
  });
});
