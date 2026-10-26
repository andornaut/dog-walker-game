import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { type DetailCard, dogDetail, walkerDetail } from "../home/detail";
import { dollarText, isAffordable, type Purchase, purchasePrice } from "../home/home";
import { HOME_LAYOUT } from "../home/homeLayout";
import { walkerTile } from "../home/walkers";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk } from "../testing/fontInk";
import { type ItemLook, itemTile, itemTileLook } from "../ui/interaction";
import { fittingText, type TextFitStyle, WRAPPING_TEXT_FIT_STYLES } from "../ui/textFit";
import { PLATE_PAD } from "./itemArt";

const OWNED: Owned = { dogSlots: [1], dogs: [], gear: [], walkers: [] };
const DOGS = Object.keys(gameData.dogs) as DogId[];
const GEAR = Object.keys(gameData.shopGear) as GearId[];
const SHOP_DOGS = DOGS.filter((dog) => gameData.dogs[dog].unlock === "shop");
const WALKERS = Object.keys(gameData.walkers) as WalkerId[];

type StateName = "affordable" | "locked" | "owned" | "short";

// What each state shows on the start screen, from the shop states' table: the portrait or
// icon in color once the bank reaches the price, and grey a cent short.
const START_LOOKS: Readonly<Record<StateName, ItemLook>> = {
  affordable: { art: "color", badge: "bill", plate: "buy", state: "disabled" },
  locked: { art: "grey", badge: "lock", plate: "goal", state: "disabled" },
  owned: { art: "color", badge: null, plate: null, state: "normal" },
  short: { art: "grey", badge: "lock", plate: "short", state: "disabled" },
};

const dogPrice = (dog: DogId) => purchasePrice(gameData, OWNED, { dog, kind: "dog" }) ?? cents(0);

// A dog's or gear item's tile as the start screen builds it, with the bank at its price
// (affordable), a cent short, or the item owned.
function shopItemTile(
  state: Exclude<StateName, "locked">,
  purchase: Purchase & { kind: "dog" | "gear" },
) {
  const owned =
    state !== "owned"
      ? OWNED
      : purchase.kind === "dog"
        ? { ...OWNED, dogs: [purchase.dog] }
        : { ...OWNED, gear: [purchase.gear] };
  const price = purchasePrice(gameData, OWNED, purchase) ?? cents(0);
  const bank = cents(state === "short" ? price - 1 : price);
  return itemTile({
    affordable: isAffordable(gameData, owned, bank, purchase),
    capacity: purchase.kind === "dog" ? 3 : 1,
    goal: null,
    picked: false,
    pickedCount: 0,
    price: purchasePrice(gameData, owned, purchase),
  });
}

const dogTile = (state: Exclude<StateName, "locked">, dog: DogId) =>
  shopItemTile(state, { dog, kind: "dog" });

describe("a start screen tile's state", () => {
  it("shows every dog, gear item and walker in each of its states as that state's look", () => {
    const shown: (readonly [string, StateName, ItemLook])[] = [
      ...DOGS.map((dog) => [dog, "owned", itemTileLook(dogTile("owned", dog))] as const),
      ...SHOP_DOGS.flatMap((dog) =>
        (["affordable", "short"] as const).map(
          (state) => [dog, state, itemTileLook(dogTile(state, dog))] as const,
        ),
      ),
      ...GEAR.flatMap((gear) =>
        (["affordable", "owned", "short"] as const).map(
          (state) =>
            [gear, state, itemTileLook(shopItemTile(state, { gear, kind: "gear" }))] as const,
        ),
      ),
      ...WALKERS.flatMap((walker) =>
        (["owned", "locked"] as const).map((state) => {
          const owned = { ...OWNED, walkers: state === "owned" ? [walker] : [] };
          const tile = walkerTile(gameData, { owned, walker: null }, walker);
          return [walker, state, itemTileLook(tile)] as const;
        }),
      ),
    ];
    const wrong = shown.filter(([, state, look]) => !isDeepStrictEqual(look, START_LOOKS[state]));
    expect(wrong).toEqual([]);
  });
});

// Every dog for sale with the bank at its price (affordable) or a cent short.
const forSale = SHOP_DOGS.flatMap((dog) =>
  (["affordable", "short"] as const).map((state) => {
    const price = dogPrice(dog);
    return { bank: cents(state === "short" ? price - 1 : price), dog, state };
  }),
);

// The width text inks in font-body in a style.
const inkWidth = (style: TextFitStyle, text: string) => {
  const ink = fontInk("font-body", style, text);
  return ink.right - ink.left;
};

// Every walker's name, owned or not, shows on the goal plate at 2x.
describe("a walker tile's name plate", () => {
  it.each(WALKERS)("sets %s's name inside its tile", (walker) => {
    const { name } = gameData.walkers[walker];
    const { walkerTile: tile, walkerTiles } = HOME_LAYOUT;
    expect(bodyTextWidth(2, name) + 2 * PLATE_PAD).toBeLessThanOrEqual(walkerTiles.cellWidth);
    const capHeight = fontFileMetrics("font-body").capHeight * 2;
    expect(tile.plateY + capHeight + PLATE_PAD).toBeLessThanOrEqual(walkerTiles.cellHeight);
  });
});

describe("the text of an item not owned fits", () => {
  const { card } = HOME_LAYOUT;
  const besideRoom = card.width - card.besideX - card.pad;
  const fitted = (status: string) =>
    fittingText(WRAPPING_TEXT_FIT_STYLES, inkWidth, besideRoom, status);

  it.each(GEAR)("sets %s's price on its plate inside its Pocket tile", (gear) => {
    const { cells, tileInset } = HOME_LAYOUT.pocket;
    const cost = purchasePrice(gameData, OWNED, { gear, kind: "gear" }) ?? cents(0);
    const plate = bodyTextWidth(2, dollarText(cost)) + 2 * PLATE_PAD;
    expect(plate).toBeLessThanOrEqual(cells.cellWidth - 2 * tileInset);
  });

  it.each(forSale)("sets $dog's status on one line at 2x when $state", ({ bank, dog }) => {
    const shown: DetailCard = dogDetail(gameData, OWNED, bank, dog);
    const { lines, style } = fitted(shown.status);
    expect({ lines: lines.length, scale: style.scale }).toEqual({ lines: 1, scale: 2 });
  });

  it.each(WALKERS)("sets %s's goal at 2x", (walker) => {
    expect(fitted(walkerDetail(gameData, OWNED, walker).status).style.scale).toBe(2);
  });
});
