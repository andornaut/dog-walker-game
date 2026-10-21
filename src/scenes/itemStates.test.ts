import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { type DetailCard, dogDetail, walkerDetail } from "../home/detail";
import { purchasePrice } from "../home/home";
import { HOME_LAYOUT } from "../home/homeLayout";
import { walkerTile } from "../home/walkers";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontInk } from "../testing/fontInk";
import { type ItemLook, itemTile, itemTileLook } from "../ui/interaction";
import { fittingText, type TextFitStyle, WRAPPING_TEXT_FIT_STYLES } from "../ui/textFit";

const OWNED: Owned = { dogSlots: 1, dogs: [], gear: [], walkers: [] };
const DOGS = Object.keys(gameData.dogs) as DogId[];
const SHOP_DOGS = DOGS.filter((dog) => gameData.dogs[dog].unlock === "shop");
const WALKERS = Object.keys(gameData.walkers) as WalkerId[];

type StateName = "affordable" | "locked" | "owned" | "short";

// What each state shows on the start screen, from the shop states' table.
const START_LOOKS: Readonly<Record<StateName, ItemLook>> = {
  affordable: { art: "full", padlock: "open", plate: "buy", state: "normal" },
  locked: { art: "grey", padlock: "closed", plate: "goal", state: "disabled" },
  owned: { art: "full", padlock: null, plate: null, state: "normal" },
  short: { art: "grey", padlock: "closed", plate: "short", state: "disabled" },
};

const dogPrice = (dog: DogId) => purchasePrice(gameData, OWNED, { dog, kind: "dog" }) ?? cents(0);

// A dog's tile with the bank at its price (affordable), a cent short, or the dog owned.
function dogTile(state: Exclude<StateName, "locked">, dog: DogId) {
  const owned = state === "owned" ? { ...OWNED, dogs: [dog] } : OWNED;
  const price = dogPrice(dog);
  return itemTile({
    bank: cents(state === "short" ? price - 1 : price),
    capacity: 3,
    goal: null,
    picked: false,
    pickedCount: 0,
    price: purchasePrice(gameData, owned, { dog, kind: "dog" }),
  });
}

describe("a start screen tile's state", () => {
  it("shows every dog, gear item and walker in each of its states as that state's look", () => {
    const shown: (readonly [string, StateName, ItemLook])[] = [
      ...DOGS.map((dog) => [dog, "owned", itemTileLook(dogTile("owned", dog))] as const),
      ...SHOP_DOGS.flatMap((dog) =>
        (["affordable", "short"] as const).map(
          (state) => [dog, state, itemTileLook(dogTile(state, dog))] as const,
        ),
      ),
      ...(Object.keys(gameData.shopGear) as GearId[]).flatMap((gear) =>
        (["affordable", "owned", "short"] as const).map((state) => {
          const owned = { ...OWNED, gear: state === "owned" ? [gear] : [] };
          const price = purchasePrice(gameData, OWNED, { gear, kind: "gear" }) ?? cents(0);
          const tile = itemTile({
            bank: cents(state === "short" ? price - 1 : price),
            capacity: 1,
            goal: null,
            picked: false,
            pickedCount: 0,
            price: purchasePrice(gameData, owned, { gear, kind: "gear" }),
          });
          return [gear, state, itemTileLook(tile)] as const;
        }),
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

const ZERO_STATS = { dogs: {} };

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

// A plate is its text's width at 2x and 3px of face either side.
const PLATE_PAD = 3;

describe("the text of an item not owned fits", () => {
  const { card, walkerTiles } = HOME_LAYOUT;
  const besideRoom = card.width - card.besideX - card.pad;
  const fitted = (status: string) =>
    fittingText(WRAPPING_TEXT_FIT_STYLES, inkWidth, besideRoom, status);

  it.each(WALKERS)("sets %s's name on its goal plate inside its tile", (walker) => {
    const { name } = gameData.walkers[walker];
    expect(bodyTextWidth(2, name) + 2 * PLATE_PAD).toBeLessThanOrEqual(walkerTiles.cellWidth);
  });

  it.each(forSale)("sets $dog's status on one line at 2x when $state", ({ bank, dog }) => {
    const shown: DetailCard = dogDetail(gameData, OWNED, bank, ZERO_STATS, dog);
    const { lines, style } = fitted(shown.status);
    expect({ lines: lines.length, scale: style.scale }).toEqual({ lines: 1, scale: 2 });
  });

  it.each(WALKERS)("sets %s's goal at 2x", (walker) => {
    expect(fitted(walkerDetail(gameData, OWNED, walker).status).style.scale).toBe(2);
  });
});
