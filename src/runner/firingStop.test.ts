import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { cardFor, chooseOption, openCard } from "../rules/choices";
import { clampHearts, read } from "../rules/units";
import { mapPack } from "../state/pack";
import { type CardSource, newRun } from "../state/runState";
import { holdForFiring } from "./firingStop";
import type { HitStop } from "./hitStop";
import { seededRandom } from "./random";
import { type RoadGeometry, startRoad, steerWalk, stepWalk, type Walk } from "./walk";

const FRAME = 1 / 60;
const SKUNK: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { kind: "forcedStop", stop: "stopSign" };
const NOTHING = { cards: [], zoneEnded: false };
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
const SECONDS = read(gameData.tuning, "seconds", "firingHoldSeconds");

describe("holdForFiring", () => {
  it("changes nothing when nobody was fired", () => {
    expect(holdForFiring(1, [], { cards: [STOP], zoneEnded: true }, null)).toEqual({
      queued: { cards: [STOP], zoneEnded: true },
      stop: null,
    });
  });

  it("changes nothing for a hold of no length", () => {
    expect(holdForFiring(0, ["koda"], { cards: [STOP], zoneEnded: false }, null)).toEqual({
      queued: { cards: [STOP], zoneEnded: false },
      stop: null,
    });
  });

  it("holds the queued cards and the zone end for the firing's length", () => {
    expect(holdForFiring(1, ["koda"], { cards: [STOP], zoneEnded: true }, null)).toEqual({
      queued: NOTHING,
      stop: { cards: [STOP], seconds: 1, zoneEnded: true },
    });
  });

  it("keeps the longer of a running stop and the firing, holding what both hold", () => {
    const running: HitStop = { cards: [SKUNK], seconds: 0.4, zoneEnded: true };
    expect(holdForFiring(1, ["koda"], { cards: [STOP], zoneEnded: false }, running)).toEqual({
      queued: NOTHING,
      stop: { cards: [SKUNK, STOP], seconds: 1, zoneEnded: true },
    });
    const longer: HitStop = { ...running, seconds: 1.5 };
    expect(holdForFiring(1, ["koda"], NOTHING, longer).stop?.seconds).toBe(1.5);
  });
});

describe("a firing in the walk", () => {
  // Koda's owner down to 1 heart, a skunk card open on Koda, and a forced stop waiting.
  const lastHeart = newRun(gameData, 3, { dogs: ["koda", "biscuit"], gear: null });
  const run = {
    ...lastHeart,
    pack: mapPack(
      (slot) => (slot.dog === "koda" ? { ...slot, hearts: clampHearts(10, 1) } : slot),
      lastHeart.pack,
    ),
  };
  const opened = openCard(SKUNK, run);
  const view = cardFor(gameData, opened, SKUNK);
  const { resolution } = gameData.encounters.skunk;
  const holdNose =
    resolution.kind === "card"
      ? resolution.options.findIndex((option) =>
          option.effects.some((effect) => effect.kind === "hearts"),
        )
      : -1;
  const outcome = chooseOption(gameData, seededRandom(1), opened, view, holdNose);
  const hold = holdForFiring(SECONDS, outcome.fired, { cards: [STOP], zoneEnded: true }, null);
  const held: Walk = { road: { ...startRoad(5), hitStop: hold.stop }, run: outcome.state };
  const step = (walk: Walk) => stepWalk(gameData, geometry, seededRandom(1), FRAME, walk);

  it("fires the owner at 0 hearts and keeps walking the rest", () => {
    expect(outcome.fired).toEqual(["koda"]);
    expect(outcome.state.phase.kind).toBe("walking");
  });

  it("holds the road still and the cards back for firingHoldSeconds of steps, then lets go", () => {
    let walk = held;
    const frames = Math.round(SECONDS / FRAME);
    for (let frame = 1; frame < frames; frame++) {
      const still = step(walk);
      expect(still.cards).toEqual([]);
      expect(still.zoneEnded).toBe(false);
      expect(still.walk.run.zoneDistance).toBe(held.run.zoneDistance);
      walk = still.walk;
    }
    const released = step(walk);
    expect(released.cards).toEqual([STOP]);
    expect(released.zoneEnded).toBe(true);
    expect(released.walk.road.hitStop).toBeNull();
  });

  it("drops steering during the hold, like a hit stop", () => {
    expect(steerWalk(gameData, 5, 1, held)).toBe(held);
  });

  it("waits out a pause: the hold only counts down in simulation steps", () => {
    // A paused or card-covered walk takes no steps, so the hold left is unchanged however
    // long the pause lasts, and replays the same.
    const once = step(held).walk.road.hitStop?.seconds;
    expect(step(held).walk.road.hitStop?.seconds).toBe(once);
    expect(once).toBeCloseTo(SECONDS - FRAME);
  });
});
