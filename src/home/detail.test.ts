import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId } from "../data/types";
import { fillNames } from "../lib/lines";
import { isLarge, sizeHearts } from "../rules/dogs";
import { capitalize, effectText, largeSpeedText, SIZE_NAMES } from "../rules/effectText";
import { cents } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import type { Owned } from "../save/schema";
import { STARTER_DOGS } from "../testing/saves";
import { TEST_TUNING } from "../testing/tuning";
import { dogDetail, gearDetail, walkerDetail } from "./detail";
import { dollarText, purchasePrice } from "./home";
import { homeLine } from "./homeText";
import { walkerDetailLines } from "./walkers";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = {
  dogSlots: [1],
  dogs: [...STARTER_DOGS, "duchess", "kilo"],
  gear: ["luckyCollar"],
  walkers: ["casey"],
};

describe("dogDetail", () => {
  const dogIds = Object.keys(data.dogs) as DogId[];
  const firstDog = (large: boolean): DogId => {
    const id = dogIds.find((dog) => isLarge(data.dogs[dog]) === large);
    if (id === undefined) {
      throw new Error(`no ${large ? "large" : "smaller"} dog`);
    }
    return id;
  };

  it.each([
    { id: firstDog(true), large: true },
    { id: firstDog(false), large: false },
  ])("gives $id's breed, size and hearts, the large row if large, and owner", ({ id, large }) => {
    const card = dogDetail(data, { ...owned, dogs: [id] }, dollars(0), id);
    const dog = data.dogs[id];
    const text = data.homeText.detail;
    expect(card.title).toBe(dog.name);
    expect(card.subtitle).toBe(dog.breed);
    expect(card.lines).toEqual([
      fillNames(text.dogKind, {
        hearts: String(sizeHearts(data.tuning, dog)),
        size: capitalize(SIZE_NAMES[dog.size]),
      }),
      ...(large ? [fillNames(text.dogLarge, { speed: largeSpeedText(data.tuning) })] : []),
      fillNames(text.dogOwner, { owner: dog.owner.name, role: dog.owner.role }),
    ]);
    expect(card.status).toBe(text.dogStatus);
  });

  const price = purchasePrice(data, owned, { dog: "biscuit", kind: "dog" }) ?? cents(0);
  it.each([
    { bank: cents(price - 1), key: "priceLocked", state: "a cent short" },
    { bank: price, key: "priceBuy", state: "affordable" },
  ] as const)("shows a dog not owned at its price, $state", ({ bank, key }) => {
    expect(dogDetail(data, owned, bank, "biscuit").status).toBe(
      fillNames(data.homeText.detail[key], { price: dollarText(price) }),
    );
  });
});

describe("gearDetail", () => {
  it("gives the effect, and whether it is equipped", () => {
    const card = gearDetail(data, owned, dollars(0), { gear: "luckyCollar" }, "luckyCollar");
    expect(card.title).toBe(data.shopGear.luckyCollar.name);
    expect(card.lines.join(" ").toLowerCase()).toContain(
      effectText(data, data.shopGear.luckyCollar.effects).toLowerCase(),
    );
    expect(card.status).toBe(data.homeText.detail.gearEquipped);
    expect(gearDetail(data, owned, dollars(0), { gear: null }, "luckyCollar").status).toBe(
      data.homeText.detail.gearOwned,
    );
  });

  it("shows a locked item's price", () => {
    const card = gearDetail(data, owned, dollars(0), { gear: null }, "hallPass");
    const price = data.homeText.detail.priceLocked.split("{price}");
    expect(card.status.startsWith(price[0] ?? "")).toBe(true);
    expect(card.status.endsWith(price[1] ?? "")).toBe(true);
  });
});

describe("walkerDetail", () => {
  const walkerIds = Object.keys(data.walkers) as WalkerId[];
  const walkerOwned = (ids: WalkerId[]) => ({ walkers: ids });

  it("gives every walker's name, description and owned status, or its unlock goal when locked", () => {
    for (const walker of walkerIds) {
      expect(walkerDetail(data, walkerOwned([walker]), walker)).toEqual({
        lines: walkerDetailLines(data, walker),
        locked: false,
        status: data.homeText.detail.walkerStatus,
        subtitle: data.homeText.detail.walkerSubtitle,
        title: data.walkers[walker].name,
      });
      const card = walkerDetail(data, walkerOwned([]), walker);
      expect(card.locked).toBe(true);
      expect(card.lines).toEqual(walkerDetailLines(data, walker));
      const goal = walkerGoal(data.walkers[walker]);
      expect(card.status).toBe(
        homeLine(data.homeText, "walkerLocked", {
          zone: data.world.zones.find(({ id }) => id === goal)?.name ?? "",
        }),
      );
    }
  });
});
