import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { QUIRKS } from "../data/quirks";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { Dog, DogId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import type { RunState } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import {
  flourishesAt,
  isNeedUrgent,
  isNervousAlone,
  isOtherDog,
  meetNeedAt,
  nextNeedMoment,
  stepNeeds,
} from "./needs";

// The attributes these tests rely on, pinned so a roster edit does not move them: Biscuit is
// a hyper Regular, Koda a steady Nosy, Duchess a calm Friendly, Snowball a hyper Friendly with
// a dramatic owner, and Penny a calm, nervous Friendly with a fussy owner.
const dogs = {
  ...DOGS,
  biscuit: { ...DOGS.biscuit, energy: "hyper", need: "regular" },
  duchess: { ...DOGS.duchess, energy: "calm", need: "friendly" },
  koda: { ...DOGS.koda, energy: "steady", need: "nosy" },
  penny: { ...DOGS.penny, energy: "calm", need: "friendly", quirk: "nervous" },
  snowball: { ...DOGS.snowball, energy: "hyper", need: "friendly" },
} as const satisfies Record<DogId, Dog>;

// Urgent after 100s for a calm dog, 70s steady and 45s hyper; wrong 20s after that.
const data = {
  debuffs: DEBUFFS,
  dogs,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  quirks: QUIRKS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  tuning: {
    ...TEST_TUNING,
    probability: { ...TEST_TUNING.probability, needPayoffCard: 0.25 },
    seconds: {
      ...TEST_TUNING.seconds,
      needGoneWrong: 20,
      needUrgentByEnergy: { calm: 100, hyper: 45, steady: 70 },
    },
  },
  upgrades: UPGRADES,
  world: TEST_WORLD,
};
// A draw above the payoff chance meets the need plainly; one below opens its card.
const plain = () => 0.9;
const payoff = () => 0.1;

describe("urgency", () => {
  it("fills while the walk moves, faster for higher energy, and turns urgent", () => {
    // Biscuit is hyper and Koda steady.
    let run: RunState = testState({ biscuit: 5, koda: 5 });
    const urgent: string[] = [];
    for (let second = 0; second < 60; second++) {
      const step = stepNeeds(data, plain, 1, true, [], run);
      urgent.push(...step.urgent);
      run = step.run;
    }
    expect(urgent).toEqual(["biscuit"]);
    expect(isNeedUrgent(data, run, "biscuit")).toBe(true);
    expect(isNeedUrgent(data, run, "koda")).toBe(false);
    expect(nextNeedMoment(data, run)).toBe(5);
  });

  it("stands still while the walk does not move", () => {
    const run = testState({ biscuit: 5 }, { needSeconds: { biscuit: 10 } });
    expect(stepNeeds(data, plain, 5, false, [], run).run).toBe(run);
  });

  it("costs the owner a heart when a need goes wrong, and starts it again", () => {
    // Koda is Nosy; his laid-back owner loses 1.
    const run = testState({ koda: 5 }, { needSeconds: { koda: 89.5 } });
    const step = stepNeeds(data, plain, 1, true, [], run);
    expect(step.moments).toMatchObject([{ dog: "koda", kind: "goneWrong", need: "nosy" }]);
    expect(heartsByDog(step.run)).toEqual({ koda: 4 });
    expect(step.run.needSeconds).toEqual({ koda: 0 });
    expect(step.cards).toEqual([]);
  });

  it("opens the accident card when a Regular dog's need goes wrong", () => {
    const run = testState({ biscuit: 5 }, { needSeconds: { biscuit: 64.5 } });
    const step = stepNeeds(data, plain, 1, true, [], run);
    expect(step.cards).toEqual([{ affected: ["biscuit"], card: "accident", kind: "need" }]);
    expect(heartsByDog(step.run)).toEqual({ biscuit: 5 });
    expect(step.run.needSeconds).toEqual({ biscuit: 0 });
  });
});

describe("meetNeedAt", () => {
  it("meets the need of every dog that has it: a heart each, and starts it again", () => {
    // Duchess and Snowball are Friendly, and both urgent; Snowball's dramatic owner
    // doubles the heart.
    const run = testState(
      { duchess: 3, koda: 3, snowball: 3 },
      { needSeconds: { duchess: 100, koda: 50, snowball: 100 } },
    );
    const met = meetNeedAt(data, plain, "stranger", run);
    expect(met.card).toBeNull();
    expect(heartsByDog(met.run)).toEqual({ duchess: 4, koda: 3, snowball: 5 });
    expect(met.run.needSeconds).toEqual({ duchess: 0, koda: 50, snowball: 0 });
    expect(met.moment).toMatchObject({
      dogs: ["duchess", "snowball"],
      kind: "met",
      need: "friendly",
    });
  });

  it("opens the need's payoff card instead, at the payoff chance", () => {
    const run = testState({ biscuit: 3 }, { needSeconds: { biscuit: 45 } });
    const met = meetNeedAt(data, payoff, "tree", run);
    expect(met.card).toEqual({ affected: ["biscuit"], card: "goodSpot", kind: "need" });
    expect(heartsByDog(met.run)).toEqual({ biscuit: 3 });
    expect(met.run.needSeconds).toEqual({ biscuit: 0 });
  });

  it("starts a need that is not urgent again, with no heart and no draw", () => {
    // Duchess is urgent at 100s, Snowball at 45s: only Snowball's owner gains.
    const never = () => {
      throw new Error("drew");
    };
    const calm = testState({ duchess: 3 }, { needSeconds: { duchess: 50 } });
    expect(meetNeedAt(data, never, "stranger", calm)).toEqual({
      card: null,
      moment: null,
      run: { ...calm, needSeconds: { duchess: 0 } },
    });
    const mixed = testState(
      { duchess: 3, snowball: 3 },
      { needSeconds: { duchess: 50, snowball: 45 } },
    );
    const met = meetNeedAt(data, plain, "stranger", mixed);
    expect(heartsByDog(met.run)).toEqual({ duchess: 3, snowball: 5 });
    expect(met.run.needSeconds).toEqual({ duchess: 0, snowball: 0 });
    expect(met.moment).toMatchObject({ dogs: ["snowball"], kind: "met" });
  });

  it("does nothing, and draws nothing, at a spot no dog needs", () => {
    const run = testState({ biscuit: 3 });
    const never = () => {
      throw new Error("drew");
    };
    expect(meetNeedAt(data, never, "waterBowl", run)).toEqual({ card: null, moment: null, run });
  });
});

describe("other dogs", () => {
  it("are the Other dog encounter and the need spots marked otherDog", () => {
    expect(
      ["otherDog", "playmate", "squirrel", "stranger"].map((kind) => isOtherDog(data, kind)),
    ).toEqual([true, true, false, false]);
  });

  it("meet nothing for a nervous dog: her need runs on and her owner gains nothing", () => {
    // Penny and Zippy both Playful here, both urgent.
    const playful = {
      ...data,
      dogs: {
        ...dogs,
        penny: { ...dogs.penny, need: "playful" },
        zippy: { ...dogs.zippy, need: "playful" },
      },
    } as const;
    const run = testState({ penny: 3, zippy: 3 }, { needSeconds: { penny: 150, zippy: 150 } });
    const met = meetNeedAt(playful, plain, "playmate", run);
    expect(met.moment).toMatchObject({ dogs: ["zippy"], kind: "met" });
    expect(met.run.needSeconds).toEqual({ penny: 150, zippy: 0 });
    expect(heartsByDog(met.run).penny).toBe(3);
  });

  it("make an acrobatic dog whose need a playmate met flourish", () => {
    const acrobat = {
      ...data,
      dogs: { ...dogs, archie: { ...dogs.archie, quirk: "acrobatic" } },
    } as const;
    const met = { kind: "met", need: "playful", outcome: null } as const;
    expect(flourishesAt(acrobat, { ...met, dogs: ["archie", "zippy"], spot: "playmate" })).toEqual([
      "archie",
    ]);
    expect(flourishesAt(acrobat, { ...met, dogs: ["archie"], spot: "stranger" })).toEqual([]);
  });
});

describe("a nervous dog left alone", () => {
  // Penny is calm: urgent after 100s, nervousAloneUrgency (2) times as fast when clingy.
  it.each<[string, Parameters<typeof testState>[0], DogId, boolean, number]>([
    ["left alone after the others were fired", { duchess: "fired", penny: 4 }, "penny", true, 20],
    [
      "left alone after both others were fired",
      { duchess: "fired", koda: "fired", penny: 4 },
      "penny",
      true,
      20,
    ],
    ["walked alone from the start", { penny: 4 }, "penny", false, 10],
    ["walking with another dog", { duchess: 4, penny: 4 }, "penny", false, 10],
    ["not nervous, though left alone", { duchess: 4, koda: "fired" }, "duchess", false, 10],
  ])("is clingy only when %s", (_, slots, dog, clingy, filled) => {
    const run = testState(slots);
    expect(isNervousAlone(data, run, dog)).toBe(clingy);
    expect(stepNeeds(data, plain, 10, true, [], run).run.needSeconds[dog]).toBe(filled);
  });

  it("brings the next need moment forward while clingy", () => {
    expect(nextNeedMoment(data, testState({ duchess: "fired", penny: 4 }))).toBe(50);
    expect(nextNeedMoment(data, testState({ penny: 4 }))).toBe(100);
  });
});
