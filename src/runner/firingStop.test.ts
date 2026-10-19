import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId } from "../data/types";
import { cardFor, chooseOption, openCard } from "../rules/choices";
import { clampHearts, read } from "../rules/units";
import { mapPack } from "../state/pack";
import { type CardSource, newRun } from "../state/runState";
import { type FiringHold, holdForFiring } from "./firingStop";
import type { HitStop } from "./hitStop";
import { seededRandom } from "./random";
import { type RoadGeometry, startRoad, stepWalk, type Walk } from "./walk";

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
  const RUNNING: HitStop = { cards: [SKUNK], seconds: 0.4, zoneEnded: true };

  it.each<{
    expected: FiringHold;
    fired: DogId[];
    name: string;
    running: HitStop | null;
    seconds: number;
  }>([
    {
      expected: { queued: { cards: [STOP], zoneEnded: true }, stop: null },
      fired: [],
      name: "changes nothing when nobody was fired",
      running: null,
      seconds: 1,
    },
    {
      expected: { queued: { cards: [STOP], zoneEnded: true }, stop: null },
      fired: ["koda"],
      name: "changes nothing for a hold of no length",
      running: null,
      seconds: 0,
    },
    {
      expected: { queued: NOTHING, stop: { cards: [STOP], seconds: 1, zoneEnded: true } },
      fired: ["koda"],
      name: "holds the queued cards and the zone end for the firing's length",
      running: null,
      seconds: 1,
    },
    {
      expected: { queued: NOTHING, stop: { cards: [SKUNK, STOP], seconds: 1, zoneEnded: true } },
      fired: ["koda"],
      name: "keeps a longer firing over a running stop, holding what both hold",
      running: RUNNING,
      seconds: 1,
    },
    {
      expected: { queued: NOTHING, stop: { cards: [SKUNK, STOP], seconds: 1.5, zoneEnded: true } },
      fired: ["koda"],
      name: "keeps a longer running stop over the firing",
      running: { ...RUNNING, seconds: 1.5 },
      seconds: 1,
    },
  ])("$name", ({ expected, fired, running, seconds }) => {
    const queued = { cards: [STOP], zoneEnded: running === null };
    expect(holdForFiring(seconds, fired, queued, running)).toEqual(expected);
  });
});

describe("a firing in the walk", () => {
  it("fires the owner at 0 hearts and holds the road and the cards for firingHoldSeconds of steps", () => {
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
    expect(outcome.fired).toEqual(["koda"]);
    expect(outcome.state.phase.kind).toBe("walking");

    const hold = holdForFiring(SECONDS, outcome.fired, { cards: [STOP], zoneEnded: true }, null);
    const held: Walk = { road: { ...startRoad(5), hitStop: hold.stop }, run: outcome.state };
    const step = (walk: Walk) => stepWalk(gameData, geometry, seededRandom(1), FRAME, walk);
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
});
