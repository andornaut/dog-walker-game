import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { SHOP_GEAR } from "../data/shop";
import type { DogId, EncounterId, ForcedStopId, UpgradeId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { type CardSource, newRun, type RunState } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { cardFor, type Choice, chooseOption, offerUpgrades, openCard } from "./choices";
import { cents } from "./units";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  shopGear: SHOP_GEAR,
  tuning: TEST_TUNING,
  upgrades: UPGRADES,
};

const encounter = (id: EncounterId, affected: DogId[]): CardSource => ({
  affected,
  encounter: id,
  kind: "encounter",
});

function choose(state: RunState, source: CardSource, choice: Choice, random = () => 0) {
  const opened = openCard(source, state);
  return chooseOption(data, random, opened, cardFor(data, opened, source), choice);
}

describe("cardFor", () => {
  it("disables an option the player cannot afford, with the reason", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(900) });
    const card = cardFor(data, state, encounter("puddle", ["duchess", "koda"]));
    expect(card.title).toBe("Puddle");
    expect(card.options.map(({ availability }) => availability)).toEqual([
      { enabled: true },
      { enabled: false, reason: "not enough money" },
    ]);
    expect(card.options[1]?.cost).toBe(1000);
  });

  it("keeps every card's free option enabled with no money", () => {
    const state = testState({ duchess: 5, koda: 5, pierre: 5 });
    const sources: CardSource[] = [
      ...(Object.keys(ENCOUNTERS) as EncounterId[]).map((id) =>
        encounter(id, ["duchess", "koda", "pierre"]),
      ),
      ...(Object.keys(FORCED_STOPS) as ForcedStopId[]).map((stop): CardSource => ({
        kind: "forcedStop",
        stop,
      })),
    ];
    for (const source of sources) {
      const card = cardFor(data, state, source);
      const free = card.options.filter(({ cost }) => cost === 0);
      expect(free.length, card.title).toBeGreaterThan(0);
      expect(
        free.every(({ availability }) => availability.enabled),
        card.title,
      ).toBe(true);
    }
  });

  it("lists only the caught dogs still walking as affected", () => {
    const state = testState({ duchess: 5, koda: 5, pierre: "fired" });
    expect(cardFor(data, state, encounter("skunk", ["koda", "pierre"])).affected).toEqual(["koda"]);
  });
});

describe("chooseOption", () => {
  it("applies an option only to the caught dogs, and reports each heart change", () => {
    const outcome = choose(testState({ duchess: 5, koda: 5 }), encounter("skunk", ["koda"]), 2);
    expect(heartsByDog(outcome.state)).toEqual({ duchess: 5, koda: 3 });
    expect(outcome.heartChanges).toEqual([{ after: 3, before: 5, dog: "koda" }]);
    expect(outcome.quips).toEqual([{ dog: "koda", moment: "upset" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("doubles a dramatic owner's change and clamps every owner at their dog's max", () => {
    const offer: CardSource = {
      kind: "upgradeOffer",
      offered: ["bellyRubs", "bigTipper", "raincoats"],
    };
    const outcome = choose(testState({ koda: 9, nugget: 3, pierre: 8 }), offer, 0);
    expect(heartsByDog(outcome.state)).toEqual({ koda: 10, nugget: 5, pierre: 8 });
  });

  it("charges the option's cost and reports the money change", () => {
    const state = testState({ duchess: 5, koda: 5 }, { money: cents(4000) });
    const outcome = choose(state, encounter("skunk", ["duchess", "koda"]), 0);
    expect(outcome.state.money).toBe(1000);
    expect(outcome.moneyDelta).toBe(-1500 * 2);
  });

  it("rejects a disabled option", () => {
    const state = testState({ duchess: 5, koda: 5 });
    expect(() => choose(state, encounter("puddle", ["duchess", "koda"]), 1)).toThrow(
      "not enough money",
    );
  });

  it("refreshes Stinky rather than stacking it", () => {
    const state = testState({ koda: 5 }, { money: cents(5000) });
    const once = choose(state, encounter("skunk", ["koda"]), 1).state;
    const twice = choose(once, encounter("skunk", ["koda"]), 1).state;
    expect(twice.debuffs).toEqual(["stinky"]);
  });

  it("fires an owner at 0 hearts, who takes back their dog's fees", () => {
    const state = testState(
      { duchess: 5, pierre: 2 },
      {
        feesEarned: { duchess: cents(2000), pierre: cents(2600) },
        money: cents(5000),
        zoneIndex: 2,
      },
    );
    const outcome = choose(state, encounter("skunk", ["pierre"]), 2);
    expect(outcome.fired).toEqual(["pierre"]);
    expect(outcome.state.money).toBe(5000 - 2600);
    expect(outcome.moneyDelta).toBe(-2600);
    expect(outcome.state.pack[1]).toEqual({ dog: "pierre", status: "fired", zoneIndex: 2 });
    expect(outcome.quips).toEqual([{ dog: "pierre", moment: "fired" }]);
    expect(outcome.state.phase).toEqual({ kind: "walking" });
  });

  it("ends the run when the last owner fires you", () => {
    const outcome = choose(testState({ koda: 2 }), encounter("skunk", ["koda"]), 2);
    expect(outcome.state.phase).toEqual({ kind: "ended", reason: "noDogs" });
    const source = encounter("skunk", ["koda"]);
    const card = cardFor(data, outcome.state, source);
    expect(() => chooseOption(data, () => 0, outcome.state, card, 2)).toThrow("ended");
  });
});

describe("upgrades", () => {
  it("records a picked upgrade, which then leaves the pool", () => {
    const offered = offerUpgrades(data, () => 0, testState({ koda: 5 }));
    const picked = choose(testState({ koda: 5 }), { kind: "upgradeOffer", offered }, 1).state;
    expect(picked.upgradesPicked).toEqual([offered[1]]);
    for (let draw = 0; draw < 1; draw += 0.1) {
      expect(offerUpgrades(data, () => draw, picked)).not.toContain(offered[1]);
    }
  });

  it("offers the only three left when the rest are picked, and fails with fewer", () => {
    const all = Object.keys(UPGRADES) as UpgradeId[];
    const sixPicked = testState({ koda: 5 }, { upgradesPicked: all.slice(0, 6) });
    expect([...offerUpgrades(data, () => 0.5, sixPicked)].sort()).toEqual(all.slice(6).sort());
    const sevenPicked = testState({ koda: 5 }, { upgradesPicked: all.slice(0, 7) });
    expect(() => offerUpgrades(data, () => 0, sevenPicked)).toThrow("Fewer than 3");
  });
});

describe("skip option", () => {
  it("is offered on an obstacle card with poop bags, and only once per run", () => {
    const state = newRun(data, { dogs: ["koda"], gear: "poopBags" });
    const source = encounter("skunk", ["koda"]);
    expect(cardFor(data, state, source).skip).toBe(true);
    expect(cardFor(data, state, encounter("lostWallet", ["koda"])).skip).toBe(false);
    const skipped = choose(state, source, "skip");
    expect(heartsByDog(skipped.state)).toEqual(heartsByDog(state));
    expect(skipped.state.skipsLeft).toBe(0);
    expect(cardFor(data, skipped.state, source).skip).toBe(false);
    expect(() => choose(skipped.state, source, "skip")).toThrow("no Skip option");
  });
});

describe("Lucky collar", () => {
  it("starts every owner one heart higher and raises the max by one", () => {
    const state = newRun(data, { dogs: ["duchess", "pierre"], gear: "luckyCollar" });
    expect(heartsByDog(state)).toEqual({ duchess: 7, pierre: 5 });
    const offer: CardSource = {
      kind: "upgradeOffer",
      offered: ["bellyRubs", "bigTipper", "raincoats"],
    };
    expect(heartsByDog(choose(state, offer, 0).state)).toEqual({ duchess: 7, pierre: 6 });
  });
});
