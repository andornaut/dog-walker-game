import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { type DetailCard, lockedDogDetail, lockedWalkerDetail } from "../home/detail";
import { dogInfo, dogKindText, purchasePrice } from "../home/home";
import { DOG_TILE_TEXT_ROOM, HOME_LAYOUT } from "../home/homeLayout";
import { type ItemLook, itemTile, itemTileLook } from "../home/interaction";
import { GREYED, PLATE_LOOKS, type PlateKind } from "../home/selection";
import {
  dogRows,
  gearRows,
  SHOP_ROW_VIEWS,
  type ShopRowLook,
  shopRowLook,
  slotRows,
} from "../home/shop";
import { walkerTile } from "../home/walkers";
import { fittingText, type TextFitStyle, WRAPPING_TEXT_FIT_STYLES } from "../layout/textFit";
import { cents } from "../rules/units";
import { agilityWord } from "../rules/walkers";
import type { Owned } from "../save/schema";
import { fontInk } from "../testing/fontInk";
import { PADLOCK_KEYS } from "./itemArt";

const OWNED: Owned = { dogSlots: 1, dogs: [], gear: [], walkers: [] };
const DOGS = Object.keys(gameData.dogs) as DogId[];
const SHOP_DOGS = DOGS.filter((dog) => gameData.dogs[dog].unlock === "shop");
const WALKERS = Object.keys(gameData.walkers) as WalkerId[];
const TEXT = gameData.homeText;

type StateName = "affordable" | "locked" | "owned" | "short";

// What each state shows on the start screen, from the shop states' table.
const START_LOOKS: Readonly<Record<StateName, ItemLook>> = {
  affordable: { art: "silhouette", padlock: "open", plate: "buy", state: "normal" },
  locked: { art: "silhouette", padlock: "closed", plate: "goal", state: "disabled" },
  owned: { art: "full", padlock: null, plate: null, state: "normal" },
  short: { art: "silhouette", padlock: "closed", plate: "short", state: "disabled" },
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
  it.each([
    ...DOGS.map((dog) => ["owned", dog] as const),
    ...SHOP_DOGS.flatMap((dog) => [["affordable", dog] as const, ["short", dog] as const]),
  ])("shows a %s dog, %s, as its state's look", (state, dog) => {
    expect(itemTileLook(dogTile(state, dog))).toEqual(START_LOOKS[state]);
  });

  it.each(
    (Object.keys(gameData.shopGear) as GearId[]).flatMap((gear) =>
      (["affordable", "owned", "short"] as const).map((state) => [state, gear] as const),
    ),
  )("shows %s gear, %s, as its state's look", (state, gear) => {
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
    expect(itemTileLook(tile)).toEqual(START_LOOKS[state]);
  });

  it.each(WALKERS.flatMap((walker) => [["owned", walker] as const, ["locked", walker] as const]))(
    "shows a %s walker, %s, as its state's look",
    (state, walker) => {
      const owned = { ...OWNED, walkers: state === "owned" ? [walker] : [] };
      const tile = walkerTile(gameData, { owned, walker: null }, walker);
      expect(itemTileLook(tile)).toEqual(START_LOOKS[state]);
      if (tile.kind === "goal") {
        expect(tile.goal).toBe(TEXT.lockedName);
      }
    },
  );
});

// What each row look shows in the Pet shop, from the shop states' table.
const SHOP_LOOKS: Readonly<Record<ShopRowLook, ItemLook>> = {
  affordable: { art: "full", padlock: "open", plate: "buy", state: "normal" },
  blocked: { art: "silhouette", padlock: "closed", plate: "goal", state: "disabled" },
  owned: { art: "full", padlock: null, plate: null, state: "normal" },
  short: { art: "grey", padlock: "closed", plate: "short", state: "disabled" },
};

describe("a Pet shop row's state", () => {
  const rows = (bank: number, owned: Owned) =>
    [...slotRows(gameData, owned), ...dogRows(gameData, owned), ...gearRows(gameData, owned)].map(
      (row) => [row.id, shopRowLook(cents(bank), row)] as const,
    );
  const everyGear = Object.keys(gameData.shopGear) as Owned["gear"];

  it.each([
    ...rows(0, OWNED),
    ...rows(1_000_000_000, OWNED),
    ...rows(0, { ...OWNED, gear: everyGear }),
  ])("draws %s, %s, as its look's view", (_id, look) => {
    expect(SHOP_ROW_VIEWS[look]).toEqual(SHOP_LOOKS[look]);
  });
});

describe("a padlock", () => {
  it.each<[string, ItemLook, string | null]>([
    ...Object.entries(START_LOOKS).map(([state, look]): [string, ItemLook, string | null] => [
      `a ${state} tile`,
      look,
      { affordable: "icon-lock-open", locked: "icon-lock", owned: null, short: "icon-lock" }[
        state as StateName
      ],
    ]),
    ...Object.entries(SHOP_LOOKS).map(([state, look]): [string, ItemLook, string | null] => [
      `a ${state} row`,
      look,
      { affordable: "icon-lock-open", blocked: "icon-lock", owned: null, short: "icon-lock" }[
        state as ShopRowLook
      ],
    ]),
  ])("over %s draws %o as %s", (_, look, key) => {
    expect(look.padlock === null ? null : PADLOCK_KEYS[look.padlock]).toBe(key);
  });
});

describe("a plate's colours", () => {
  it.each<[PlateKind, string]>([
    ["goal", GREYED.plateText],
    ["short", GREYED.shortPrice],
  ])("draws a %s plate in the greyed face and line, its text %s", (kind, text) => {
    expect(PLATE_LOOKS[kind]).toEqual({
      edge: GREYED.edge,
      face: GREYED.plateFace,
      lit: null,
      shade: null,
      text,
    });
  });

  it("lights the buy plate's top row and shades its bottom one", () => {
    const { face, lit, shade } = PLATE_LOOKS.buy;
    expect([lit, shade]).not.toContain(face);
    expect([lit, shade]).not.toContain(null);
  });
});

// Every word that names or describes a dog, from the data.
function dogWords(dog: DogId): string[] {
  const { breed, name, owner } = gameData.dogs[dog];
  return [name, breed, owner.name, owner.role, dogKindText(gameData, dog), "♥"];
}

// Every word that names or describes a walker, from the data.
function walkerWords(walker: WalkerId): string[] {
  const { agility, name, perk } = gameData.walkers[walker];
  const perkData = gameData.walkerPerks[perk];
  return [name, perkData.name, perkData.effect, agilityWord(TEXT, agility)];
}

const cardText = (card: DetailCard) =>
  [card.title, card.subtitle, card.status, ...card.lines].join("\n");

const lockedDogCards = SHOP_DOGS.flatMap((dog) =>
  (["affordable", "short"] as const).map((state) => {
    const price = dogPrice(dog);
    const bank = cents(state === "short" ? price - 1 : price);
    return { bank, dog, state };
  }),
);

describe("a locked hold card", () => {
  it.each(lockedDogCards)("hides $dog, $state, behind the locked name", ({ bank, dog, state }) => {
    const card = lockedDogDetail(gameData, OWNED, bank, dog);
    expect(card).toMatchObject({
      lines: [],
      locked: state === "short",
      padlock: state === "short" ? "closed" : "open",
      subtitle: TEXT.detail.dogSubtitle,
      title: TEXT.lockedName,
    });
    for (const word of dogWords(dog)) {
      expect(cardText(card as DetailCard)).not.toContain(word);
      expect(dogInfo(gameData, OWNED, bank, dog)).not.toContain(word);
    }
  });

  it.each(WALKERS)("hides %s behind the locked name", (walker) => {
    const card = lockedWalkerDetail(gameData, OWNED, walker);
    expect(card).toMatchObject({
      lines: [],
      locked: true,
      padlock: "closed",
      subtitle: TEXT.detail.walkerSubtitle,
      title: TEXT.lockedName,
    });
    for (const word of walkerWords(walker)) {
      expect(cardText(card as DetailCard)).not.toContain(word);
    }
  });

  it.each(DOGS)("shows %s's own card once owned", (dog) => {
    expect(lockedDogDetail(gameData, { ...OWNED, dogs: [dog] }, cents(0), dog)).toBeNull();
  });

  it.each(WALKERS)("shows %s's own card once owned", (walker) => {
    expect(lockedWalkerDetail(gameData, { ...OWNED, walkers: [walker] }, walker)).toBeNull();
  });
});

// The width text inks in font-body in a style.
const inkWidth = (style: TextFitStyle, text: string) => {
  const ink = fontInk("font-body", style, text);
  return ink.right - ink.left;
};
const AT_2X: TextFitStyle = { letterSpacing: 0, scale: 2 };

describe("the locked text fits", () => {
  const { card, walkerTiles } = HOME_LAYOUT;
  const besideRoom = card.width - card.besideX - card.pad;
  const status = (shown: DetailCard | null) =>
    fittingText(WRAPPING_TEXT_FIT_STYLES, inkWidth, besideRoom, shown?.status ?? "");

  it("sets the locked name on a dog tile at 2x", () => {
    expect(inkWidth(AT_2X, TEXT.lockedName)).toBeLessThanOrEqual(DOG_TILE_TEXT_ROOM);
  });

  it("sets the locked name on a walker plate inside its tile", () => {
    expect(inkWidth(AT_2X, TEXT.lockedName) + 6).toBeLessThanOrEqual(walkerTiles.cellWidth);
  });

  it.each([TEXT.detail.dogSubtitle, TEXT.detail.walkerSubtitle])(
    "sets %s on one line at 2x beside the well",
    (subtitle) => {
      expect(inkWidth(AT_2X, subtitle)).toBeLessThanOrEqual(besideRoom);
    },
  );

  it.each(lockedDogCards)("sets $dog's $state price line on one line at 2x", ({ bank, dog }) => {
    const fitted = status(lockedDogDetail(gameData, OWNED, bank, dog));
    expect(fitted.style.scale).toBe(2);
    expect(fitted.lines).toHaveLength(1);
  });

  it.each(WALKERS)("sets %s's unlock line at 2x beside the well", (walker) => {
    expect(status(lockedWalkerDetail(gameData, OWNED, walker)).style.scale).toBe(2);
  });
});
