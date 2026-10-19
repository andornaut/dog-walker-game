import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { SHOP_GEAR } from "../data/shop";
import type { DogId } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WORLD } from "../data/world";
import { recordInput, replayInputs, startInputLog } from "../dev/inputLog";
import { randomStream } from "../dev/randomStreams";
import { idleGesture, pointerDown, pointerMove } from "../input/gestures";
import type { LaneDirection } from "../layout/lanes";
import { clampHearts } from "../rules/units";
import { mapPack } from "../state/pack";
import { newRun, type PackDogs } from "../state/runState";
import { TEST_TUNING } from "../testing/tuning";
import { advanceLaneControl, laneControlIn } from "./laneControl";
import { destinationLane, stillInLane } from "./laneMotion";
import {
  gestureAfterPulls,
  NO_PULLS,
  type PullEvent,
  pullPose,
  type Pulls,
  pullWalk,
  stepPulls,
} from "./pulls";
import { type Random, seededRandom } from "./random";
import {
  laneMotionConfig,
  planZone,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
} from "./walk";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  minorObstacles: MINOR_OBSTACLES,
  shopGear: SHOP_GEAR,
  // An 80px/s, 30s zone with spawns sized for it, as in the walk tests.
  tuning: {
    ...TEST_TUNING,
    counts: {
      ...TEST_TUNING.counts,
      minorObstaclesFirstZone: 4,
      obstaclesFirstZone: 6,
      tipsFirstZone: 8,
      treatsPerZone: 2,
    },
    pixels: { ...TEST_TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
    seconds: { ...TEST_TUNING.seconds, laneMove: 0.2, pullTell: 1, zoneAtBaseSpeed: 30 },
  },
  upgrades: UPGRADES,
  world: WORLD,
};
const geometry: RoadGeometry = {
  cell: { inset: 12, length: 56 },
  itemHeights: { forcedStop: 16, lucky: 20, tip: 12, treat: 12 },
  laneCount: 5,
  packBand: { bottom: 630, top: 554 },
  roadBottom: 640,
  roadTop: 40,
  sightLength: 514,
  tallestPackBand: 76,
};
const FRAME = 1 / 60;

const walkWith = (dogs: PackDogs, lane = 2): Walk => ({
  road: { ...startRoad(5), control: laneControlIn(stillInLane(lane)) },
  run: newRun(data, 3, { dogs, gear: null }),
});
// A stream that always draws the same value: below 0.5 picks the left side.
const fixed =
  (value: number): Random =>
  () =>
    value;
const pullsAt = (at: number, dog: DogId, clock = 0): Pulls => ({
  clock,
  dogs: [{ at, dog, lean: null, pulled: null }],
});
const step = (pulls: Pulls, walk: Walk, seconds = FRAME, random: Random = fixed(0.25)) =>
  stepPulls(data, geometry, random, seconds, pulls, walk);

describe("stepPulls scheduling", () => {
  it("schedules each dog's first pull from the stream, a tell and a share of its interval in", () => {
    // Koda is steady (30s), Biscuit hyper (15s); the draws are 0.5 and 0.25.
    const draws = [0.5, 0.25];
    const random = () => draws.shift() ?? 0;
    const { pulls } = step(NO_PULLS, walkWith(["koda", "biscuit"]), FRAME, random);
    expect(pulls.dogs.map(({ at, dog }) => [dog, at])).toEqual([
      ["koda", 1 + 0.5 * 30],
      ["biscuit", 1 + 0.25 * 15],
    ]);
  });

  it("repeats the schedule and the sides for the same seed, and not for another", () => {
    const play = (seed: number) => {
      const random = randomStream(seed, "pulls");
      let pulls = NO_PULLS;
      let walk = walkWith(["biscuit", "zippy", "snowball"]);
      const events: PullEvent[] = [];
      for (let frame = 0; frame < 60 * 40; frame++) {
        const stepped = step(pulls, walk, FRAME, random);
        events.push(...stepped.pulled);
        pulls = stepped.pulls;
        walk = {
          ...stepped.walk,
          road: {
            ...stepped.walk.road,
            control: advanceLaneControl(
              laneMotionConfig(data, 5),
              FRAME,
              stepped.walk.road.control,
            ),
          },
        };
      }
      return { events, pulls };
    };
    const first = play(1);
    expect(first.events.length).toBeGreaterThanOrEqual(3);
    expect(play(1)).toEqual(first);
    expect(play(2).pulls).not.toEqual(first.pulls);
  });

  // Biscuit is hyper: 15s, varied by up to 25% either way.
  const pullTimes = (random: Random, seconds: number) => {
    let pulls = pullsAt(2, "biscuit");
    const walk = walkWith(["biscuit"]);
    const times: number[] = [];
    for (let frame = 0; frame < 60 * seconds; frame++) {
      const stepped = step(pulls, walk, FRAME, random);
      if (stepped.pulled.length > 0) {
        times.push(stepped.pulls.clock);
      }
      pulls = stepped.pulls;
    }
    return times;
  };
  const gaps = (times: number[]) =>
    times.slice(1).map((time, index) => time - itemAt(times, index));

  it("schedules each next pull one interval later, jittered by the drawn share", () => {
    expect(gaps(pullTimes(fixed(0), 40))[0]).toBeCloseTo(15 * 0.75, 1);
    expect(gaps(pullTimes(fixed(0.5), 40))[0]).toBeCloseTo(15, 1);
    expect(gaps(pullTimes(fixed(0.9999), 50))[0]).toBeCloseTo(15 * 1.25, 1);
  });

  it("keeps every jittered interval within a quarter of the energy's interval", () => {
    const intervals = gaps(pullTimes(randomStream(3, "pulls"), 600));
    expect(intervals.length).toBeGreaterThan(30);
    intervals.forEach((gap) => {
      expect(gap).toBeGreaterThanOrEqual(15 * 0.75 - FRAME);
      expect(gap).toBeLessThanOrEqual(15 * 1.25 + FRAME);
    });
    expect(Math.min(...intervals)).toBeLessThan(13);
    expect(Math.max(...intervals)).toBeGreaterThan(17);
  });

  it("drops a fired dog's pulls", () => {
    const walk = walkWith(["koda", "biscuit"]);
    const fired: Walk = {
      ...walk,
      run: {
        ...walk.run,
        pack: mapPack(
          (slot) => (slot.dog === "koda" ? { ...slot, hearts: clampHearts(10, 0) } : slot),
          walk.run.pack,
        ),
      },
    };
    const { pulls } = step(step(NO_PULLS, walk).pulls, fired);
    expect(pulls.dogs.map(({ dog }) => dog)).toEqual(["biscuit"]);
  });
});

describe("stepPulls tell window", () => {
  it("starts the tell pullTell before the pull, leaning to the side it then pulls", () => {
    const walk = walkWith(["koda"]);
    const before = step(pullsAt(2, "koda", 0.99 - FRAME), walk);
    expect(before.tells).toEqual([]);
    expect(pullPose(data, before.pulls, "koda")).toBeNull();

    const telling = step(before.pulls, walk);
    expect(telling.tells).toEqual([{ direction: -1, dog: "koda" }]);
    expect(telling.pulled).toEqual([]);
    expect(pullPose(data, telling.pulls, "koda")).toEqual({ direction: -1, tag: "tell" });

    const pulled = step(telling.pulls, walk, 1);
    expect(pulled.tells).toEqual([]);
    expect(pulled.pulled).toEqual([{ direction: -1, dog: "koda", moved: true }]);
    expect(pullPose(data, pulled.pulls, "koda")).toEqual({ direction: -1, tag: "pull" });
    expect(pullPose(data, step(pulled.pulls, walk, 0.25).pulls, "koda")).toBeNull();
  });

  it("keeps the side it leaned to even when the stream would now pick the other", () => {
    const walk = walkWith(["koda"]);
    const telling = step(pullsAt(1, "koda", 0), walk, FRAME, fixed(0.75));
    const pulled = step(telling.pulls, walk, 1, fixed(0.25));
    expect(pulled.pulled).toEqual([{ direction: 1, dog: "koda", moved: true }]);
  });
});

describe("stepPulls lane change", () => {
  it("moves the pack one lane toward the side, then locks lane input for the dog's size", () => {
    const telling = step(pullsAt(1, "koda"), walkWith(["koda"]));
    const { walk } = step(telling.pulls, telling.walk, 1);
    expect(walk.road.control.target).toBe(1);
    const config = laneMotionConfig(data, 5);
    const arrived = advanceLaneControl(config, 0.2, walk.road.control);
    expect(destinationLane(arrived.motion)).toBe(1);
    expect(arrived.lockSeconds).toBeCloseTo(0.5);
    expect(steerWalk(data, 5, 1, { ...walk, road: { ...walk.road, control: arrived } })).toEqual({
      ...walk,
      road: { ...walk.road, control: arrived },
    });
  });

  it("turns a random side off the road edge inward, for the lean and the pull", () => {
    const left = walkWith(["koda"], 0);
    const telling = step(pullsAt(1, "koda"), left);
    expect(telling.tells).toEqual([{ direction: 1, dog: "koda" }]);
    const pulled = step(telling.pulls, telling.walk, 1);
    expect(pulled.pulled).toEqual([{ direction: 1, dog: "koda", moved: true }]);
    expect(pulled.walk.road.control.target).toBe(1);

    const right = walkWith(["koda"], 4);
    expect(step(pullsAt(1, "koda"), right, FRAME, fixed(0.75)).tells).toEqual([
      { direction: -1, dog: "koda" },
    ]);
  });

  it("pulls inward when the pack reached the leaned-to edge during the tell", () => {
    const telling = step(pullsAt(1, "koda"), walkWith(["koda"], 1));
    expect(telling.tells).toEqual([{ direction: -1, dog: "koda" }]);
    const pulled = step(telling.pulls, walkWith(["koda"], 0), 1);
    expect(pulled.pulled).toEqual([{ direction: 1, dog: "koda", moved: true }]);
    expect(pulled.walk.road.control.target).toBe(1);
    expect(pullPose(data, pulled.pulls, "koda")).toEqual({ direction: 1, tag: "pull" });
  });

  it("locks nothing for a small dog, or with running shoes", () => {
    const small = step(
      step(pullsAt(1, "zippy"), walkWith(["zippy"])).pulls,
      walkWith(["zippy"]),
      1,
    );
    const config = laneMotionConfig(data, 5);
    expect(advanceLaneControl(config, 0.2, small.walk.road.control).lockSeconds).toBe(0);

    const shod: Walk = {
      ...walkWith(["koda"]),
      run: newRun(data, 3, { dogs: ["koda"], gear: "runningShoes" }),
    };
    const pulled = step(step(pullsAt(1, "koda"), shod).pulls, shod, 1);
    expect(advanceLaneControl(config, 0.2, pulled.walk.road.control).lockSeconds).toBe(0);
  });

  it("leans a food-driven dog toward the nearest treat ahead, whatever the stream says", () => {
    const walk = walkWith(["biscuit"]);
    const treat = (id: number, lane: number, y: number) => ({
      height: 12,
      id,
      kind: "treat" as const,
      lane,
      laneSpan: 1,
      y,
    });
    const withTreats: Walk = {
      ...walk,
      // Lane 0 is nearer but already level with the pack; lane 4 is the nearest ahead.
      road: { ...walk.road, items: [treat(0, 0, 600), treat(1, 4, 300), treat(2, 1, 100)] },
    };
    expect(step(pullsAt(1, "biscuit"), withTreats).tells).toEqual([
      { direction: 1, dog: "biscuit" },
    ]);
    expect(step(pullsAt(1, "biscuit"), walk).tells).toEqual([{ direction: -1, dog: "biscuit" }]);
  });

  it("gives a chaser or fancy dog no treat target", () => {
    const walk = walkWith(["koda"]);
    const withTreat: Walk = {
      ...walk,
      road: {
        ...walk.road,
        items: [{ height: 12, id: 0, kind: "treat", lane: 4, laneSpan: 1, y: 300 }],
      },
    };
    expect(step(pullsAt(1, "koda"), withTreat).tells).toEqual([{ direction: -1, dog: "koda" }]);
  });
});

describe("stepPulls holds", () => {
  it("stands the clock still through a hit stop, then tells and pulls after it", () => {
    const walk = walkWith(["koda"]);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, hitStop: { cards: [], seconds: 1, zoneEnded: false } },
    };
    const pulls = pullsAt(1, "koda", 0.5);
    const held = step(pulls, stopped, 2);
    expect(held).toEqual({ pulled: [], pulls, tells: [], walk: stopped });

    const telling = step(pulls, walk);
    expect(telling.tells).toHaveLength(1);
    const heldTell = step(telling.pulls, { ...telling.walk, road: stopped.road }, 2);
    expect(heldTell.pulled).toEqual([]);
    expect(heldTell.pulls).toBe(telling.pulls);
  });

  it("does nothing once the walk has ended", () => {
    const walk = walkWith(["koda"]);
    const ended: Walk = {
      ...walk,
      run: { ...walk.run, phase: { kind: "ended", reason: "wentHome" } },
    };
    const pulls = pullsAt(0.5, "koda", 0.4);
    expect(step(pulls, ended, 1)).toEqual({ pulled: [], pulls, tells: [], walk: ended });
  });
});

describe("pullWalk", () => {
  it("is the lane change any dog-caused pull goes through, dropped during a hit stop", () => {
    const walk = walkWith(["dash"]);
    expect(pullWalk(data, 5, "dash", 1, walk).walk.road.control.target).toBe(3);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, hitStop: { cards: [], seconds: 1, zoneEnded: false } },
    };
    expect(pullWalk(data, 5, "dash", 1, stopped)).toEqual({ moved: false, walk: stopped });
  });
});

describe("gestureAfterPulls", () => {
  const context = {
    config: { laneCount: 5, tapMaxDistance: 10 },
    layout: {
      dogColumn: { height: 450, width: 80, x: 0, y: 190 },
      dogSlots: [],
      road: { height: 450, width: 280, x: 80, y: 190 },
      topBar: { height: 40, width: 360, x: 0, y: 0 },
    },
  };
  const dragged = pointerMove(
    context,
    { x: 230, y: 400 },
    pointerDown(context, { x: 200, y: 400 }).state,
  ).state;
  const moved: PullEvent = { direction: 1, dog: "koda", moved: true };

  it("re-anchors a drag at the pointer when a pull moved the pack", () => {
    const reanchored = gestureAfterPulls([moved], dragged);
    expect(reanchored).toMatchObject({ anchorX: 230, kind: "dragging", steps: 0 });
    // A lane-width is 56px: dragging back one lane now takes a whole lane-width from 230.
    expect(pointerMove(context, { x: 200, y: 400 }, reanchored).actions).toEqual([]);
    expect(pointerMove(context, { x: 174, y: 400 }, reanchored).actions).toEqual([
      { direction: -1, kind: "move" },
    ]);
  });

  it("leaves the drag alone when no pull moved the pack", () => {
    expect(gestureAfterPulls([], dragged)).toBe(dragged);
    expect(gestureAfterPulls([{ ...moved, moved: false }], dragged)).toBe(dragged);
    expect(gestureAfterPulls([moved], idleGesture)).toBe(idleGesture);
  });
});

describe("replay with pulls", () => {
  it("reproduces a run with pulls from the seed and the input log alone", () => {
    const setup = { dev: true, seed: 5, speed: 1, zone: 1 };
    const start = planZone(data, geometry, seededRandom(5), walkWith(["biscuit", "zippy"]));
    // As RunScene steps: the moves due now, each logged, then the pulls, then the walk.
    const play = (movesAt: (frame: number, timeMs: number) => LaneDirection[]) => {
      const rolls = seededRandom(9);
      const pullStream = randomStream(setup.seed, "pulls");
      let log = startInputLog(setup);
      let walk = start;
      let pulls = NO_PULLS;
      const pulled: PullEvent[] = [];
      const cards: unknown[] = [];
      for (let frame = 0; frame < 60 * 30; frame++) {
        const timeMs = frame * FRAME * 1000;
        for (const direction of movesAt(frame, timeMs)) {
          walk = steerWalk(data, 5, direction, walk);
          log = recordInput({ direction, kind: "lane", timeMs }, log);
        }
        const pullStep = stepPulls(data, geometry, pullStream, FRAME, pulls, walk);
        pulls = pullStep.pulls;
        pulled.push(...pullStep.pulled);
        const stepped = stepWalk(data, geometry, rolls, FRAME, pullStep.walk);
        cards.push(...stepped.cards);
        walk = stepped.walk;
      }
      return { cards, log, pulled, walk };
    };
    const recorded = play((frame) => (frame % 47 === 0 ? [frame % 94 === 0 ? -1 : 1] : []));
    expect(recorded.pulled.filter((pull) => pull.moved).length).toBeGreaterThanOrEqual(2);

    const events = [...replayInputs(recorded.log)];
    let next = 0;
    const replayed = play((_, timeMs) => {
      const due: LaneDirection[] = [];
      for (let event = events[next]; event?.kind === "lane" && event.timeMs <= timeMs;) {
        due.push(event.direction);
        next += 1;
        event = events[next];
      }
      return due;
    });
    expect(replayed.pulled).toEqual(recorded.pulled);
    expect(replayed.walk).toEqual(recorded.walk);
    expect(replayed.cards).toEqual(recorded.cards);
  });
});
