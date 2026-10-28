import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, LiveTuning } from "../data/types";
import { scrollMax } from "../input/listScroll";
import { fillNames } from "../lib/lines";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { sizeHearts } from "../rules/dogs";
import { capitalize, SIZE_NAMES } from "../rules/effectText";
import { startingDogSlots, unlockPrice } from "../rules/shop";
import type { Owned } from "../save/schema";
import {
  fitInFont,
  fontFileMetrics,
  inkWidth,
  placedInk,
  TWO_X_FIT_STYLES,
} from "../testing/fontInk";
import { TEST_TUNING } from "../testing/tuning";
import { readBitmapFont } from "../tools/fontFile";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { GREYED, pictureBox, SELECT_OUTSET } from "../ui/selection";
import { TEXT_FIT_STYLES } from "../ui/textFit";
import { FEEDBACK } from "./feedback";
import { dollarText, gearByPrice, type Purchase } from "./home";
import { messageLine } from "./homeLines";
import {
  dogRows,
  gearRows,
  ownedCountNote,
  SHOP_ROW_VIEWS,
  shopAffordable,
  shopOpenTab,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  shopTabOf,
  slotRows,
} from "./shop";
import {
  rowRects,
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListBottom,
  shopListFrame,
  shopMessageCapTop,
  shopRowTextRoom,
  shopScrollbar,
  shopTabRects,
} from "./shopLayout";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const starters = keysOf(data.dogs).filter((dog) => data.dogs[dog].unlock === "start");
const starting = startingDogSlots(data);
const owned: Owned = { dogSlots: starting, dogs: starters, gear: [], walkers: [] };
// Every slot by number, counting from 1.
const allSlots = data.dogSlots.map((_, i) => i + 1);
// Every set of slots a player can own, named: the starting ones and any of the others.
const slotSets = allSlots
  .filter((slot) => !starting.includes(slot))
  .reduce<number[][]>((sets, slot) => [...sets, ...sets.map((set) => [...set, slot])], [starting])
  .map((set) => [set.join(" and "), set] as const);

describe("shopRowLook", () => {
  // Every row for sale (each slot, gear item and dog not owned), and the first of each kind of
  // purchase with the bank at its price and a cent short: the look reads only the price.
  const forSale: readonly ShopRow[] = [
    ...slotRows(data, owned),
    ...gearRows(data, owned),
    ...dogRows(data, owned),
  ].filter((row) => row.price !== null);
  const firstOfKind = forSale.filter(
    (row, i) => forSale.findIndex((other) => other.purchase.kind === row.purchase.kind) === i,
  );
  const banks = firstOfKind.flatMap((row) => {
    const price = row.price ?? cents(0);
    return [
      { art: "colour", bank: price, box: GREYED.affordBox, id: row.id, look: "affordable", row },
      { art: "grey", bank: cents(price - 1), box: GREYED.box, id: row.id, look: "short", row },
    ] as const;
  });

  it.each(banks)("shows $id $look, its art in $art on $box", ({ art, bank, box, look, row }) => {
    const shown = shopRowLook(data, owned, bank, row);
    const view = SHOP_ROW_VIEWS[shown];
    expect({ art: view.art, box: pictureBox(view), look: shown }).toEqual({ art, box, look });
  });

  it("sells every slot not owned, each with the looks dogs and gear for sale have", () => {
    const slotIds = forSale.flatMap(({ id, purchase }) =>
      purchase.kind === "dogSlot" ? [id] : [],
    );
    expect(slotIds).toEqual(
      allSlots.filter((slot) => !starting.includes(slot)).map((slot) => `slot:${slot}`),
    );
    expect(Object.keys(SHOP_ROW_VIEWS).sort()).toEqual(["affordable", "owned", "short"]);
  });
});

describe("slotRows", () => {
  // Every slot listed in order with the one slot line, the owned ones owned whichever they are,
  // each one for sale at its own price and opening the shop on its own row, and the heading's
  // count the slots owned out of all of them.
  it.each(slotSets)("lists every slot, owned ones marked, with slots %s owned", (_, dogSlots) => {
    const have = { ...owned, dogSlots };
    const rows = slotRows(data, have);
    expect(rows.map(({ id }) => id)).toEqual(allSlots.map((slot) => `slot:${slot}`));
    rows.forEach((row, i) => {
      const slot = allSlots[i] ?? 0;
      expect(row.line).toBe(data.homeText.shop.slotLine);
      expect(row.purchase).toEqual({ kind: "dogSlot", slot });
      expect(shopRowId(row.purchase)).toBe(row.id);
      expect(row.price).toBe(
        dogSlots.includes(slot)
          ? null
          : unlockPrice(data.tuning, data.dogSlots[i] ?? data.dogSlots[0]),
      );
    });
    expect(ownedCountNote(data, have, "slots")).toBe(
      fillNames(data.homeText.shop.ownedCount, {
        max: String(rows.length),
        owned: String(dogSlots.length),
      }),
    );
  });

  it("puts the dog heading under the last slot row", () => {
    const { dogHeadingY, slotRows: spec } = SHOP_LAYOUT.dogs;
    const last = rowRects(SHOP_LAYOUT.row.width, spec, slotRows(data, owned).length).at(-1);
    expect(last && last.y + last.height).toBeLessThan(dogHeadingY);
  });
});

describe("gearRows and dogRows", () => {
  it("list every gear item cheapest first, an owned one in place without a price", () => {
    const rows = gearRows(data, { ...owned, gear: ["fannyPack"] });
    expect(rows.map(({ id }) => id)).toEqual(gearByPrice(data).map((gear) => `gear:${gear}`));
    expect(rows.find(({ id }) => id === "gear:fannyPack")?.price).toBeNull();
  });

  const allDogs = keysOf(data.dogs);
  const forSale = allDogs.filter((dog) => !starters.includes(dog));
  const dogOf = (row: ShopRow): DogId => (row.purchase.kind === "dog" ? row.purchase.dog : "kilo");

  // Owning a dog keeps its row in place, marked owned as gear is: no price, the owned look.
  it.each<[string, readonly DogId[]]>([
    ["nothing bought", starters],
    ["one dog bought", [...starters, forSale[0] ?? "kilo"]],
    ["every dog bought", allDogs],
  ])("list every dog in one order, owned ones marked owned, with %s", (_, dogs) => {
    const holding = { ...owned, dogs: [...dogs] };
    const rows = dogRows(data, holding);
    expect(rows.map(({ id }) => id)).toEqual(dogRows(data, owned).map(({ id }) => id));
    expect(rows.map(dogOf).sort()).toEqual([...allDogs].sort());
    rows.forEach((row) => {
      const have = dogs.includes(dogOf(row));
      expect(row.price === null).toBe(have);
      expect(shopRowLook(data, holding, dollars(100_000), row) === "owned").toBe(have);
    });
  });

  const dogPrice = (tuning: LiveTuning, dog: DogId) => unlockPrice(tuning, data.dogs[dog]);
  const withDogPrices = (pick: (dog: DogId) => number): LiveTuning => ({
    ...TEST_TUNING,
    money: {
      ...TEST_TUNING.money,
      prices: {
        ...TEST_TUNING.money.prices,
        ...Object.fromEntries(
          forSale.flatMap((dog) => {
            const item = data.dogs[dog];
            return item.unlock === "shop" ? [[item.price, pick(dog)]] : [];
          }),
        ),
      },
    },
  });
  const dollarPrices = forSale.map((dog) => dogPrice(TEST_TUNING, dog) / 100);
  const cheapestDog = forSale.reduce((a, b) =>
    dogPrice(TEST_TUNING, b) < dogPrice(TEST_TUNING, a) ? b : a,
  );
  const dogTunings: readonly [string, LiveTuning][] = [
    ["today's prices", TEST_TUNING],
    ["every dog at one price", withDogPrices(() => Math.max(...dollarPrices))],
    [
      "the cheapest dog retuned above the dearest",
      withDogPrices((dog) =>
        dog === cheapestDog ? Math.max(...dollarPrices) + 1 : dogPrice(TEST_TUNING, dog) / 100,
      ),
    ],
  ];

  it.each(dogTunings)(
    "list every dog cheapest first by list price, ties in data order, at %s",
    (_, tuning) => {
      const order = dogRows({ ...data, tuning }, owned).map(dogOf);
      expect(order.slice(0, starters.length)).toEqual(starters);
      order.slice(1).forEach((dog, i) => {
        const before = order[i] as DogId;
        const step = dogPrice(tuning, dog) - dogPrice(tuning, before);
        expect(step).toBeGreaterThanOrEqual(0);
        if (step === 0) {
          expect(allDogs.indexOf(dog)).toBeGreaterThan(allDogs.indexOf(before));
        }
      });
    },
  );

  it("gives a dog's row its size and hearts, and its price on the plate", () => {
    const dog = forSale[0] ?? "kilo";
    const row = dogRows(data, owned).find(({ id }) => id === `dog:${dog}`);
    const { size } = data.dogs[dog];
    const kind = fillNames(data.homeText.focus.kind, {
      hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
      size: SIZE_NAMES[size],
    });
    expect(row?.line).toBe(capitalize(kind));
    expect(row?.price).toBe(unlockPrice(data.tuning, data.dogs[dog]));
  });
});

describe("shopAffordable", () => {
  it("holds while the bank covers anything, and fails once everything is owned", () => {
    const everything: Owned = {
      dogSlots: allSlots,
      dogs: keysOf(data.dogs),
      gear: keysOf(data.shopGear),
      walkers: [],
    };
    expect(shopAffordable(data, owned, dollars(600))).toBe(true);
    expect(shopAffordable(data, owned, dollars(0))).toBe(false);
    expect(shopAffordable(data, everything, dollars(100_000))).toBe(false);
  });
});

// Each list's heading note counts what the list sells that is owned, out of all of it, and
// sits right of the heading's ink with a gap, beside a scrollbar too.
describe("ownedCountNote", () => {
  const everything: Owned = {
    dogSlots: allSlots,
    dogs: keysOf(data.dogs),
    gear: keysOf(data.shopGear),
    walkers: [],
  };
  const titles = {
    dogs: data.homeText.shop.dogs,
    gear: data.homeText.shop.tabs.gear,
    slots: data.homeText.shop.slots,
  };
  const note = (have: number, max: number) =>
    data.homeText.shop.ownedCount.replace("{owned}", String(have)).replace("{max}", String(max));
  const cases = [owned, everything].flatMap((have) => [
    ["dogs", have, have.dogs.length, Object.keys(data.dogs).length] as const,
    ["gear", have, have.gear.length, Object.keys(data.shopGear).length] as const,
    ["slots", have, have.dogSlots.length, data.dogSlots.length] as const,
  ]);
  const style = { letterSpacing: 0, scale: 2 };

  // slotRows checks the slots' count with every set of slots owned.
  it.each(cases.filter(([list]) => list !== "slots"))(
    "%s: counts the owned ones out of all of them",
    (list, have, count, max) => {
      expect(ownedCountNote(data, have, list)).toBe(note(count, max));
    },
  );

  it.each(cases)("%s: keeps the note clear of the heading", (list, have) => {
    const text = ownedCountNote(data, have, list);
    const titleRight =
      SHOP_LAYOUT.headingX + placedInk("font-title", style, titles[list].toUpperCase()).right;
    const noteLeft = shopListFrame(true).headingRight - inkWidth("font-body", style, text);
    expect(titleRight + 8).toBeLessThanOrEqual(noteLeft);
  });
});

describe("shopRowId and shopTabOf", () => {
  it("puts each purchase's row on the tab that lists it", () => {
    const rows: Record<ShopTab, ShopRow[]> = {
      dogs: [...slotRows(data, owned), ...dogRows(data, owned)],
      gear: gearRows(data, owned),
    };
    const purchases: Purchase[] = [
      { dog: "reggie", kind: "dog" },
      ...allSlots.map((slot): Purchase => ({ kind: "dogSlot", slot })),
      { gear: "luckyCollar", kind: "gear" },
    ];
    for (const purchase of purchases) {
      const ids = rows[shopTabOf(purchase)].map(({ id }) => id);
      expect(ids).toContain(shopRowId(purchase));
    }
  });
});

describe("shopOpenTab", () => {
  it.each<[string, ShopTab, Purchase | undefined]>([
    ["no item", "dogs", undefined],
    ["a dog", "dogs", { dog: "reggie", kind: "dog" }],
    ["a dog slot", "dogs", { kind: "dogSlot", slot: 2 }],
    ["gear", "gear", { gear: "luckyCollar", kind: "gear" }],
  ])("with %s, opens on the %s tab", (_, tab, focus) => {
    expect(shopOpenTab(focus)).toBe(tab);
  });
});

// Every row's name and line, with nothing bought and with every item owned, fit the room the
// price plate or OWNED leaves them in a row beside a scrollbar, the narrower, both measured on
// the fonts at 2x.
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
    dogSlots: allSlots,
    dogs: keysOf(gameData.dogs),
    gear: keysOf(gameData.shopGear),
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
          const room = shopRowTextRoom(SHOP_LAYOUT.row.scrollWidth, rightWidth(row));
          return (
            text !== "" &&
            fitInFont("font-body", TEXT_FIT_STYLES, room, plainMarks(text)).widest > room
          );
        })
        .map((text) => `${row.id}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });

  // A tab's names share one size, so each name, a dog's, a gear item's or a slot's, fits at 2x:
  // each row for sale or owned, whichever leaves its name the least room.
  const tightest = rows.filter((row) =>
    rows.every(
      (other) =>
        other.id !== row.id ||
        rightWidth(other) < rightWidth(row) ||
        (rightWidth(other) === rightWidth(row) && rows.indexOf(other) >= rows.indexOf(row)),
    ),
  );
  it.each(tightest.map((row) => [row.name, row.id, row] as const))(
    "sets %j (%s) at 2x",
    (_name, _id, row) => {
      const room = shopRowTextRoom(SHOP_LAYOUT.row.scrollWidth, rightWidth(row));
      const fitted = fitInFont("font-body", TWO_X_FIT_STYLES, room, plainMarks(row.name));
      expect(fitted.widest).toBeLessThanOrEqual(room);
    },
  );
});

// Every message a tap in the shop leaves fits on one line on its plate, its ink inside the
// plate's frame: each priced row's "can't afford" with its whole
// price short, and each purchase's thanks.
describe("the shop's message", () => {
  const everyRow = [
    ...gearRows(gameData, owned),
    ...slotRows(gameData, owned),
    ...dogRows(gameData, owned),
  ];
  const messages = everyRow.flatMap((row) => [
    ...(row.price === null
      ? []
      : [
          messageLine(gameData.homeText, { amount: row.price, kind: "cantAfford", name: row.name }),
        ]),
    messageLine(gameData.homeText, { kind: "bought", name: row.name, purchase: row.purchase }),
  ]);
  const body = fontFileMetrics("font-body");
  const { frame, plate, textDx } = SHOP_LAYOUT.message;
  // Of the messages set on one line in each style, the widest, and any set on more: the plate's
  // rows read only the style, and a narrower message in the same style fits where the widest does.
  const { room, styles } = SHOP_MESSAGE_FIT;
  const fit = (text: string) => fitInFont("font-body", styles, room, plainMarks(text));
  const unique = [...new Set(messages)].flatMap((text) => (text === null ? [] : [text]));
  const widestOfStyle = unique.filter(
    (text) =>
      fit(text).lines.length !== 1 ||
      unique.every(
        (other) =>
          JSON.stringify(fit(other).style) !== JSON.stringify(fit(text).style) ||
          fit(other).widest < fit(text).widest ||
          (fit(other).widest === fit(text).widest && unique.indexOf(other) >= unique.indexOf(text)),
      ),
  );

  it.each(widestOfStyle)("sets %j on one line inside its plate's frame", (text) => {
    const fitted = fitInFont("font-body", styles, room, plainMarks(text));
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

// A selected tab, lifted and framed, keeps 6px of card clear under the title band.
describe("the shop's tabs", () => {
  it("clear the title band by 6px when selected", () => {
    const { band, panel, tab } = SHOP_LAYOUT;
    const bandBottom = panel.y + band.inset + band.height;
    expect(tab.drawY - FEEDBACK.liftPx - SELECT_OUTSET - bandBottom).toBeGreaterThanOrEqual(6);
  });
});

// Each tab's list, with nothing bought and with everything bought, scrolls far enough to bring
// its last row inside the list area, and no further than its padding below it.
describe("the shop's list", () => {
  const { padBottom, rect } = SHOP_LAYOUT.list;
  const listBottom = rect.y + rect.height;
  const everything: Owned = {
    dogSlots: allSlots,
    dogs: keysOf(data.dogs),
    gear: keysOf(data.shopGear),
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

  // max: how far the list moves; y: its scroll. The track runs the list area's height, the
  // thumb thumbInset inside it.
  it.each<[string, number, number, "bottom" | "top"]>([
    ["sits at the top scrolled to the top", 200, 0, "top"],
    ["sits at the bottom scrolled to the bottom", 200, 200, "bottom"],
    ["sits at the bottom of a long list scrolled to the bottom", 5000, 5000, "bottom"],
  ])("the scrollbar's thumb %s", (_, max, y, end) => {
    const bar = shopScrollbar(max, y);
    expect(bar).not.toBeNull();
    const { thumb, track } = bar ?? { thumb: rect, track: rect };
    expect(track).toMatchObject({ height: rect.height, y: rect.y });
    const { thumbInset, thumbMin } = SHOP_LAYOUT.scrollbar;
    expect(thumb.height).toBeGreaterThanOrEqual(thumbMin);
    if (end === "top") {
      expect(thumb.y).toBe(track.y + thumbInset);
    } else {
      expect(thumb.y + thumb.height).toBe(track.y + track.height - thumbInset);
    }
  });

  it("shows no scrollbar for a list that fits", () => {
    expect(shopScrollbar(0, 0)).toBeNull();
  });

  // Each list's rows and heading note end where its scrollbar allows: at the tabs' right edge
  // with no scrollbar, else short of the track. A selected row's frame stays inside the list
  // area, which stays inside the card's 8px frame.
  it.each(lists)("%s: runs its rows to the right edge it is allowed", (_, spec, count) => {
    const scrolls = scrollMax(rect, shopListBottom(spec, count)) > 0;
    const frame = shopListFrame(scrolls);
    const tabsRight = Math.max(...shopTabRects().map(({ width, x }) => x + width));
    const track = shopScrollbar(scrolls ? 1 : 0, 0)?.track;
    const { panel } = SHOP_LAYOUT;
    for (const row of rowRects(frame.rowWidth, spec, count)) {
      const right = row.x + row.width;
      expect(frame.headingRight).toBe(right);
      if (track === undefined) {
        expect(right).toBe(tabsRight);
      } else {
        expect(right).toBeLessThan(track.x);
      }
      const outer = { left: row.x - SELECT_OUTSET, right: right + SELECT_OUTSET };
      expect(outer.left).toBeGreaterThanOrEqual(frame.rect.x);
      expect(outer.right).toBeLessThanOrEqual(frame.rect.x + frame.rect.width);
      expect(frame.rect.x + frame.rect.width).toBeLessThanOrEqual(panel.x + panel.width - 8);
    }
  });

  // The scrollbar stays clear of the list area, where the rows and their frames are clipped,
  // inside the card's 8px frame, with the thumb thumbInset inside the track.
  it("puts the scrollbar between the list area and the card's frame", () => {
    const bar = shopScrollbar(100, 0);
    const { panel, scrollbar } = SHOP_LAYOUT;
    const { thumb, track } = bar ?? { thumb: rect, track: rect };
    expect(track.x).toBeGreaterThanOrEqual(rect.x + rect.width);
    expect(track.x + track.width).toBeLessThanOrEqual(panel.x + panel.width - 8);
    expect(thumb.x - track.x).toBe(scrollbar.thumbInset);
    expect(track.x + track.width - (thumb.x + thumb.width)).toBe(scrollbar.thumbInset);
  });
});
