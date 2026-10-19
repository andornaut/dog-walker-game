import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { effectText } from "../rules/effectText";
import { cents } from "../rules/units";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { dogDetail, gearDetail } from "./detail";

const data = { ...gameData, tuning: TEST_TUNING };
const dollars = (amount: number) => cents(amount * 100);
const owned: Owned = {
  dogSlots: 1,
  dogs: ["biscuit", "duchess", "koda"],
  gear: ["whistle"],
  walkers: ["casey"],
};
const noStats = { dogs: {} };

describe("dogDetail", () => {
  it("gives the breed, traits, need and quirk in words, owner and temperament, fee and stats", () => {
    const stats = { dogs: { koda: { timesFired: 1, walks: 5, zonesFinished: 12 } } };
    const card = dogDetail(data, owned, dollars(0), stats, "koda");
    const { breed, name, need, owner, quirk } = data.dogs.koda;
    const { description, name: quirkName } = data.quirks[quirk];
    expect(card.title).toBe(name);
    expect(card.subtitle).toBe(breed);
    expect(card.lines).toEqual([
      "Big · Chaser · Steady energy",
      `${data.needs[need].name} · ${quirkName}: ${description}`,
      `Owner ${owner.name}, ${owner.role}`,
      "Laid-back owner",
      expect.stringMatching(/^Fee \$\d+\/zone$/),
      "Walks 5 · Zones 12 · Fired 1",
    ]);
    expect(card.status).toBe("Your client");
  });

  it("counts zeros for a dog never walked, and shows a locked dog's price", () => {
    const card = dogDetail(data, owned, dollars(100), noStats, "archie");
    expect(card.lines).toContain("Walks 0 · Zones 0 · Fired 0");
    expect(card.status).toBe("Price $600, locked");
    expect(dogDetail(data, owned, dollars(600), noStats, "archie").status).toBe(
      "Price $600, tap to buy",
    );
  });
});

describe("gearDetail", () => {
  it("gives the effect, and whether it is equipped", () => {
    const card = gearDetail(data, owned, dollars(0), { dogs: [], gear: "whistle" }, "whistle");
    expect(card.title).toBe(data.shopGear.whistle.name);
    expect(card.lines.join(" ").toLowerCase()).toContain(
      effectText(data, data.shopGear.whistle.effects).toLowerCase(),
    );
    expect(card.status).toBe(data.homeText.detail.gearEquipped);
    expect(gearDetail(data, owned, dollars(0), { dogs: [], gear: null }, "whistle").status).toBe(
      data.homeText.detail.gearOwned,
    );
  });

  it("shows a locked item's price", () => {
    const card = gearDetail(data, owned, dollars(0), { dogs: [], gear: null }, "poopBags");
    expect(card.status).toMatch(/^Price \$[\d,]+, locked$/);
  });
});
