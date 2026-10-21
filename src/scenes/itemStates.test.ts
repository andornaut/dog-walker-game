import { isDeepStrictEqual } from "node:util";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import { type DetailCard, lockedDogDetail, lockedWalkerDetail } from "../home/detail";
import { dogInfo, dogKindText, purchasePrice } from "../home/home";
import { DOG_TILE_TEXT_ROOM, HOME_LAYOUT } from "../home/homeLayout";
import { type ItemLook, itemTile, itemTileLook } from "../home/interaction";
import { walkerTile } from "../home/walkers";
import { fittingText, type TextFitStyle, WRAPPING_TEXT_FIT_STYLES } from "../layout/textFit";
import { cents } from "../rules/units";
import { agilityWord } from "../rules/walkers";
import type { Owned } from "../save/schema";
import { fontInk } from "../testing/fontInk";

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
  it("hides every locked dog and walker behind the locked name, and shows its own card once owned", () => {
    for (const { bank, dog, state } of lockedDogCards) {
      const card = lockedDogDetail(gameData, OWNED, bank, dog);
      expect(card, dog).toMatchObject({
        lines: [],
        locked: state === "short",
        padlock: state === "short" ? "closed" : "open",
        subtitle: TEXT.detail.dogSubtitle,
        title: TEXT.lockedName,
      });
      const shown = `${cardText(card as DetailCard)}\n${dogInfo(gameData, OWNED, bank, dog)}`;
      expect(
        dogWords(dog).filter((word) => shown.includes(word)),
        dog,
      ).toEqual([]);
    }
    for (const walker of WALKERS) {
      const card = lockedWalkerDetail(gameData, OWNED, walker);
      expect(card, walker).toMatchObject({
        lines: [],
        locked: true,
        padlock: "closed",
        subtitle: TEXT.detail.walkerSubtitle,
        title: TEXT.lockedName,
      });
      const shown = cardText(card as DetailCard);
      expect(
        walkerWords(walker).filter((word) => shown.includes(word)),
        walker,
      ).toEqual([]);
    }
    const ownedDogs = DOGS.filter((dog) =>
      lockedDogDetail(gameData, { ...OWNED, dogs: [dog] }, cents(0), dog),
    );
    const ownedWalkers = WALKERS.filter((walker) =>
      lockedWalkerDetail(gameData, { ...OWNED, walkers: [walker] }, walker),
    );
    expect([...ownedDogs, ...ownedWalkers]).toEqual([]);
  });
});

// The width text inks in font-body in a style.
const inkWidth = (style: TextFitStyle, text: string) => {
  const ink = fontInk("font-body", style, text);
  return ink.right - ink.left;
};
const AT_2X: TextFitStyle = { letterSpacing: 0, scale: 2 };

describe("the locked text fits", () => {
  it("sets the locked name, subtitles, price and unlock lines in their room", () => {
    const { card, walkerTiles } = HOME_LAYOUT;
    const besideRoom = card.width - card.besideX - card.pad;
    const status = (shown: DetailCard | null) =>
      fittingText(WRAPPING_TEXT_FIT_STYLES, inkWidth, besideRoom, shown?.status ?? "");
    const offenders = [
      ...(inkWidth(AT_2X, TEXT.lockedName) <= DOG_TILE_TEXT_ROOM ? [] : ["dog tile name"]),
      ...(inkWidth(AT_2X, TEXT.lockedName) + 6 <= walkerTiles.cellWidth ? [] : ["walker plate"]),
      ...[TEXT.detail.dogSubtitle, TEXT.detail.walkerSubtitle].filter(
        (subtitle) => inkWidth(AT_2X, subtitle) > besideRoom,
      ),
      ...lockedDogCards.flatMap(({ bank, dog, state }) => {
        const fitted = status(lockedDogDetail(gameData, OWNED, bank, dog));
        return fitted.style.scale === 2 && fitted.lines.length === 1 ? [] : [`${dog} ${state}`];
      }),
      ...WALKERS.filter(
        (walker) => status(lockedWalkerDetail(gameData, OWNED, walker)).style.scale !== 2,
      ),
    ];
    expect(offenders).toEqual([]);
  });
});
