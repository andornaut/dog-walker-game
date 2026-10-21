import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, WalkerId } from "../data/types";
import { fillNames } from "../lib/lines";
import { sizeHearts } from "../rules/dogs";
import { capitalize, effectText, SIZE_NAMES } from "../rules/effectText";
import { cents } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dogDetail, gearDetail, walkerDetail } from "./detail";
import { dogFeeText } from "./home";
import { homeLine } from "./homeText";
import { walkerDetailLines } from "./walkers";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = {
  dogSlots: 1,
  dogs: ["biscuit", "duchess", "koda"],
  gear: ["luckyCollar"],
  walkers: ["casey"],
};
const noStats = { dogs: {} };

describe("dogDetail", () => {
  it("gives a dog's breed, size and hearts, the heavy row, owner, pay and stats", () => {
    const id = (Object.keys(data.dogs) as DogId[]).find((dog) => data.dogs[dog].size === "big");
    if (id === undefined) {
      throw new Error("no big dog");
    }
    const stats = { dogs: { [id]: { timesFired: 1, walks: 5, zonesFinished: 12 } } };
    const card = dogDetail(data, { ...owned, dogs: [id] }, dollars(0), stats, id);
    const dog = data.dogs[id];
    const text = data.homeText.detail;
    expect(card.title).toBe(dog.name);
    expect(card.subtitle).toBe(dog.breed);
    expect(card.lines).toEqual([
      fillNames(text.dogKind, {
        hearts: String(sizeHearts(data.tuning, dog)),
        size: capitalize(SIZE_NAMES[dog.size]),
      }),
      text.dogHeavy,
      fillNames(text.dogOwner, { owner: dog.owner.name, role: dog.owner.role }),
      fillNames(text.dogFee, { fee: dogFeeText(data) }),
      fillNames(text.dogTotals, { fired: "1", walks: "5", zones: "12" }),
    ]);
    expect(card.status).toBe(text.dogStatus);
  });

  it("counts zeros for a dog never walked, and shows a locked dog's price", () => {
    const card = dogDetail(data, owned, dollars(100), noStats, "archie");
    expect(card.lines).toContain(
      fillNames(data.homeText.detail.dogTotals, { fired: "0", walks: "0", zones: "0" }),
    );
    expect(card.status).toBe(fillNames(data.homeText.detail.priceLocked, { price: "$600" }));
    expect(dogDetail(data, owned, dollars(600), noStats, "archie").status).toBe(
      "Price $600, tap to buy",
    );
  });
});

describe("gearDetail", () => {
  it("gives the effect, and whether it is equipped", () => {
    const card = gearDetail(
      data,
      owned,
      dollars(0),
      { dogs: [], gear: "luckyCollar" },
      "luckyCollar",
    );
    expect(card.title).toBe(data.shopGear.luckyCollar.name);
    expect(card.lines.join(" ").toLowerCase()).toContain(
      effectText(data, data.shopGear.luckyCollar.effects).toLowerCase(),
    );
    expect(card.status).toBe(data.homeText.detail.gearEquipped);
    expect(
      gearDetail(data, owned, dollars(0), { dogs: [], gear: null }, "luckyCollar").status,
    ).toBe(data.homeText.detail.gearOwned);
  });

  it("shows a locked item's price", () => {
    const card = gearDetail(data, owned, dollars(0), { dogs: [], gear: null }, "hallPass");
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
