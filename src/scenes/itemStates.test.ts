import { isDeepStrictEqual } from "node:util";

import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { dollarText, isAffordable, type Purchase, purchasePrice } from "../home/home";
import { HOME_LAYOUT } from "../home/homeLayout";
import { walkerTile } from "../home/walkers";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics } from "../testing/fontInk";
import { type ItemLook, itemTile, itemTileLook } from "../ui/interaction";
import { cents } from "../units";
import { PLATE_PAD } from "./itemArt";

const OWNED: Owned = { dogSlots: [1], dogs: [], gear: [], walkers: [] };
const DOGS = keysOf(gameData.dogs);
const GEAR = keysOf(gameData.shopGear);
const SHOP_DOGS = DOGS.filter((dog) => gameData.dogs[dog].unlock === "shop");
const WALKERS = keysOf(gameData.walkers);

type StateName = "affordable" | "locked" | "owned" | "short";

// What each state shows on the start screen, from the shop states' table: the portrait or
// icon in colour once the bank reaches the price, and grey a cent short.
const START_LOOKS: Readonly<Record<StateName, ItemLook>> = {
  affordable: { art: "colour", badge: "bill", plate: "buy", state: "disabled" },
  locked: { art: "grey", badge: "lock", plate: "goal", state: "disabled" },
  owned: { art: "colour", badge: null, plate: null, state: "normal" },
  short: { art: "grey", badge: "lock", plate: "short", state: "disabled" },
};

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

// Every walker's name, owned or not, shows on the goal plate at 2x: the widest name fits
// wherever it does.
describe("a walker tile's name plate", () => {
  const nameWidth = (walker: (typeof WALKERS)[number]) =>
    bodyTextWidth(2, gameData.walkers[walker].name);
  const widest = WALKERS.reduce((a, b) => (nameWidth(b) > nameWidth(a) ? b : a));
  it.each([widest])("sets %s's name inside its tile", (walker) => {
    const { name } = gameData.walkers[walker];
    const { walkerTile: tile, walkerTiles } = HOME_LAYOUT;
    expect(bodyTextWidth(2, name) + 2 * PLATE_PAD).toBeLessThanOrEqual(walkerTiles.cellWidth);
    const capHeight = fontFileMetrics("font-body").capHeight * 2;
    expect(tile.plateY + capHeight + PLATE_PAD).toBeLessThanOrEqual(walkerTiles.cellHeight);
  });
});

describe("the text of an item not owned fits", () => {
  // The gear item whose price is widest on its plate.
  const priceWidth = (gear: (typeof GEAR)[number]) =>
    bodyTextWidth(
      2,
      dollarText(purchasePrice(gameData, OWNED, { gear, kind: "gear" }) ?? cents(0)),
    );
  const dearest = GEAR.reduce((a, b) => (priceWidth(b) > priceWidth(a) ? b : a));
  it.each([dearest])("sets %s's price on its plate inside its Pocket tile", (gear) => {
    const { cells, tileInset } = HOME_LAYOUT.pocket;
    const plate = priceWidth(gear) + 2 * PLATE_PAD;
    expect(plate).toBeLessThanOrEqual(cells.cellWidth - 2 * tileInset);
  });
});
