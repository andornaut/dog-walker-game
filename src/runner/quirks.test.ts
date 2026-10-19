import { describe, expect, it } from "vitest";

import { quirkIconKey } from "../assets/iconKeys";
import { gameData } from "../data";
import type { Dog, DogId, QuirkId } from "../data/types";
import { applyInstantEncounter, cardFor, chooseOption, quirkActorsOf } from "../rules/choices";
import { zoneFeeParts } from "../rules/dogs";
import { applyEffects, quirkScaledDogs } from "../rules/effects";
import { payZoneFees } from "../rules/run";
import { giveTreat } from "../rules/treats";
import { cents, read } from "../rules/units";
import type { CardSource, RunState } from "../state/runState";
import { heartsByDog, testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WORLD } from "../testing/world";
import { meetNeedAt } from "./needs";
import { seededRandom } from "./random";
import {
  laneMoveSeconds,
  needSpotWeights,
  pickupReach,
  type RoadGeometry,
  sniffersOf,
  startRoad,
  stepWalk,
  type WalkItem,
} from "./walk";

// The quirks other than the nervous and acrobatic ones, whose pull rules pulls.test.ts and
// needs.test.ts cover. Each test gives the quirk it relies on to a dog itself, so a roster
// edit does not move it, and compares against the same dog with a quirk that changes nothing
// there.
const base = { ...gameData, tuning: TEST_TUNING, world: TEST_WORLD };

function withQuirks(quirks: Readonly<Partial<Record<DogId, QuirkId>>>) {
  const dogs: Record<DogId, Dog> = { ...base.dogs };
  for (const [dog, quirk] of Object.entries(quirks) as [DogId, QuirkId][]) {
    dogs[dog] = { ...dogs[dog], quirk };
  }
  return { ...base, dogs };
}

// Koda, a laid-back big chaser, as plain as a dog gets: nervous changes nothing below.
const plain = withQuirks({ koda: "nervous" });

const geometry: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { forcedStop: 16, lucky: 20, needSpot: 20, tip: 12, treat: 12 },
  laneCount: 5,
  packBand: { bottom: 630, top: 554 },
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
};

describe("a scent hound", () => {
  // A tip one lane beside the pack's middle lane, its bottom just inside the pack's band.
  const beside: WalkItem = { height: 12, id: 0, kind: "tip", lane: 3, laneSpan: 1, y: 560 };
  const collected = (data: typeof base) => {
    const run = testState({ koda: 5 });
    const road = { ...startRoad(5), items: [beside], nextItemId: 1 };
    return stepWalk(data, geometry, seededRandom(1), 0.01, { road, run }).tips.length;
  };

  it("picks up tips scentHoundLanes beside the pack", () => {
    const hound = withQuirks({ koda: "scentHound" });
    expect(pickupReach(hound, testState({ koda: 5 }), "tip")).toBe(1);
    expect(pickupReach(plain, testState({ koda: 5 }), "tip")).toBe(0);
    expect(collected(hound)).toBe(1);
    expect(collected(plain)).toBe(0);
  });

  it("leaves the treat reach alone", () => {
    const hound = withQuirks({ koda: "scentHound" });
    expect(pickupReach(hound, testState({ koda: 5 }), "treat")).toBe(0);
  });
});

describe("a pampered dog", () => {
  it("gives her owner pamperedTreatHearts for a treat, named as her quirk", () => {
    const pampered = withQuirks({ koda: "pampered" });
    const state = testState({ koda: 5 }, { treats: 1 });
    const given = giveTreat(pampered, "koda", state);
    expect(heartsByDog(given.state)).toEqual({ koda: 7 });
    expect(given.change?.causes).toEqual([
      { amount: 1, kind: "treat" },
      { amount: 1, kind: "quirk", quirk: "pampered" },
    ]);
    expect(heartsByDog(giveTreat(plain, "koda", state).state)).toEqual({ koda: 6 });
  });
});

describe("a sled dog", () => {
  it("makes the pack's lane moves sledDogLaneSpeed times faster while he walks", () => {
    const sled = withQuirks({ koda: "sledDog" });
    const move = read(TEST_TUNING, "seconds", "laneMove");
    expect(laneMoveSeconds(sled, testState({ duchess: 5, koda: 5 }))).toBeCloseTo(move / 1.25);
    expect(laneMoveSeconds(sled, testState({ duchess: 5, koda: "fired" }))).toBe(move);
    expect(laneMoveSeconds(plain, testState({ koda: 5 }))).toBe(move);
  });
});

describe("a camera-ready dog", () => {
  it("doubles a photo op's tip while among the affected dogs, named as its quirk", () => {
    const ready = withQuirks({ koda: "cameraReady" });
    const tip = TEST_TUNING.money.photoOpTip * 100;
    const photo = (data: typeof base) => {
      const outcome = applyInstantEncounter(data, () => 0, testState({ koda: 5 }), "photoOp", [
        "koda",
      ]);
      return { causes: outcome.moneyChanges[0]?.causes, delta: outcome.moneyDelta };
    };
    expect(photo(ready)).toEqual({
      causes: [
        { amount: tip, kind: "effect", source: { encounter: "photoOp", kind: "instant" } },
        { amount: tip, kind: "quirk", quirk: "cameraReady" },
      ],
      delta: 2 * tip,
    });
    expect(photo(plain).delta).toBe(tip);
  });
});

describe("a show dog", () => {
  it("adds showDogFee to his fee each zone, before fee modifiers, named as his quirk", () => {
    const show = withQuirks({ koda: "showDog" });
    expect(zoneFeeParts(TEST_TUNING, [], show.dogs.koda)).toMatchObject({
      base: 1000,
      quirk: 500,
      value: 1500,
    });
    expect(payZoneFees(show, testState({ koda: 5 })).changes[0]?.causes).toEqual([
      { amount: 1000, kind: "fee" },
      { amount: 500, kind: "quirk", quirk: "showDog" },
    ]);
    expect(zoneFeeParts(TEST_TUNING, [], plain.dogs.koda).value).toBe(1000);
  });

  it("costs his owner showDogMessyHearts more wherever a messy card costs them hearts", () => {
    const show = withQuirks({ koda: "showDog" });
    // Splash through costs each caught owner a heart; the puddle is messy, the skunk not.
    const puddle: CardSource = { affected: ["koda"], encounter: "puddle", kind: "encounter" };
    const skunk: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
    const state = testState({ koda: 6 }, { money: cents(5000) });
    const card = cardFor(show, state, puddle);
    expect(heartsByDog(chooseOption(show, () => 0, state, card, 0).state)).toEqual({ koda: 4 });
    expect(card.options[0]?.text).toBe("−2 ♥ Koda");
    expect(card.options[0]?.breakdown).toContainEqual({
      dog: "koda",
      name: show.quirks.showDog.name,
      text: "−1 ♥",
    });
    // Towel off costs money only.
    expect(heartsByDog(chooseOption(show, () => 0, state, card, 1).state)).toEqual({ koda: 6 });
    const ignore = cardFor(show, state, skunk);
    expect(heartsByDog(chooseOption(show, () => 0, state, ignore, 2).state)).toEqual({ koda: 4 });
    const plainCard = cardFor(plain, state, puddle);
    expect(heartsByDog(chooseOption(plain, () => 0, state, plainCard, 0).state)).toEqual({
      koda: 5,
    });
  });
});

describe("a crowd pleaser", () => {
  it("draws stranger spots crowdPleaserStrangerWeight times as often while she walks", () => {
    const pleaser = withQuirks({ duchess: "crowdPleaser" });
    const weightOf = (data: typeof base) =>
      new Map(needSpotWeights(data, testState({ duchess: 5 }))).get("stranger");
    const weight = weightOf(withQuirks({ duchess: "nervous" }));
    expect(weight).toBeGreaterThan(0);
    expect(weightOf(pleaser)).toBe((weight ?? 0) * 2);
  });

  it("tips crowdPleaserTip when her need is met, plainly or with the payoff card", () => {
    const pleaser = withQuirks({ duchess: "crowdPleaser" });
    const tip = TEST_TUNING.money.crowdPleaserTip * 100;
    const urgent = testState({ duchess: 3 }, { needSeconds: { duchess: 1000 } });
    const tipped = (data: typeof base, draw: number) =>
      meetNeedAt(data, () => draw, "stranger", urgent).moment?.outcome?.moneyDelta ?? 0;
    // A draw of 0.9 meets the need plainly; 0.1 opens the payoff card.
    expect(tipped(pleaser, 0.9)).toBe(tip);
    expect(tipped(pleaser, 0.1)).toBe(tip);
    expect(tipped(withQuirks({ duchess: "nervous" }), 0.9)).toBe(0);
    const outcome = meetNeedAt(pleaser, () => 0.9, "stranger", urgent).moment?.outcome;
    expect(outcome?.moneyChanges[0]?.causes).toEqual([
      { amount: tip, kind: "effect", source: { kind: "quirk", quirk: "crowdPleaser" } },
    ]);
  });
});

describe("a ratter", () => {
  const chase = (data: typeof base, affected: readonly DogId[]) => {
    const source: CardSource = { affected, encounter: "squirrel", kind: "encounter" };
    const state: RunState = testState({ koda: 5, zippy: 5 }, { money: cents(5000) });
    const card = cardFor(data, state, source);
    const option = card.options[1];
    const outcome = chooseOption(data, () => 0, state, card, 1);
    return { cost: option?.cost, delta: outcome.moneyDelta, text: option?.text };
  };

  it("drops no tips on a squirrel chase he joins, and the card says why", () => {
    const ratter = withQuirks({ koda: "nervous", zippy: "ratter" });
    const noLoss = ratter.runText.card.quirkNoLoss.replace("{quirk}", ratter.quirks.ratter.name);
    expect(chase(ratter, ["koda", "zippy"])).toEqual({ cost: 0, delta: 0, text: noLoss });
    expect(chase(ratter, ["koda"])).toEqual({ cost: 1000, delta: -1000, text: "−$10" });
  });
});

describe("a quirk's own hearts amount", () => {
  // As gameplay gives Let them play: a playmate does nothing for a nervous dog.
  const play = (quirk: QuirkId) => {
    const data = withQuirks({ duchess: quirk });
    const effect = {
      amount: 1,
      kind: "hearts",
      quirkAmounts: { nervous: 0 },
      target: { kind: "all" },
    } as const;
    const state = testState({ duchess: 3, koda: 3 });
    const applied = applyEffects(
      data,
      { affected: [], random: () => 0, source: SOURCE },
      [effect],
      state,
    );
    return heartsByDog(applied);
  };
  const SOURCE = { card: "playDate", kind: "needCard", option: 0 } as const;

  it("replaces the effect's amount, so 0 leaves a nervous dog's owner as they were", () => {
    expect(play("nervous")).toEqual({ duchess: 3, koda: 4 });
    expect(play("pampered")).toEqual({ duchess: 4, koda: 4 });
  });
});

describe("when a quirk acts", () => {
  it("names the dogs whose quirk scales a card option's money: a ratter's chase", () => {
    const ratter = withQuirks({ koda: "nervous", zippy: "ratter" });
    const source: CardSource = {
      affected: ["koda", "zippy"],
      encounter: "squirrel",
      kind: "encounter",
    };
    const state = testState({ koda: 5, zippy: 5 }, { money: cents(5000) });
    const card = cardFor(ratter, state, source);
    expect(quirkActorsOf(ratter, card, 1)).toEqual(["zippy"]);
    expect(quirkActorsOf(ratter, card, 0)).toEqual([]);
    expect(quirkActorsOf(ratter, card, "skip")).toEqual([]);
  });

  it("names the camera-ready dogs at a photo op", () => {
    const ready = withQuirks({ koda: "cameraReady" });
    const { resolution } = ready.encounters.photoOp;
    const effects = resolution.kind === "instant" ? resolution.effects : [];
    expect(quirkScaledDogs(ready, effects, ["duchess", "koda"])).toEqual(["koda"]);
  });

  it("names the scent hounds when a tip comes from beside the pack, not from its lane", () => {
    const hound = withQuirks({ koda: "scentHound" });
    const walk = { road: startRoad(5), run: testState({ duchess: 5, koda: 5 }) };
    const tip = (lane: number): WalkItem => ({
      height: 12,
      id: 0,
      kind: "tip",
      lane,
      laneSpan: 1,
      y: 560,
    });
    expect(sniffersOf(hound, walk, [tip(3)])).toEqual(["koda"]);
    expect(sniffersOf(hound, walk, [tip(2)])).toEqual([]);
  });

  it("keys each dog's quirk icon by its art name", () => {
    expect(quirkIconKey(base, "koda")).toBe(`icon-quirk-${base.dogs.koda.art}`);
  });
});
