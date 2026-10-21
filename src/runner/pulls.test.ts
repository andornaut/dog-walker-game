import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { NEED_CARDS, NEED_SPOTS, NEEDS } from "../data/needs";
import { QUIRKS } from "../data/quirks";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { Dog, DogId, Modifier } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WORLD } from "../data/world";
import { recordInput, replayInputs, startInputLog } from "../dev/inputLog";
import { idleGesture, pointerDown, pointerMove } from "../input/gestures";
import type { LaneDirection } from "../layout/lanes";
import { newRun, type PackDogs } from "../state/runState";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { isSteeringLocked, laneControlIn } from "./laneControl";
import { stillInLane } from "./laneMotion";
import type { MoverPath } from "./movers";
import {
  gestureAfterPulls,
  laneBlockedWithin,
  NO_PULLS,
  type PullEvent,
  pullPose,
  type Pulls,
  type PullStep,
  pullWalk,
  stepPulls,
} from "./pulls";
import { seededRandom } from "./random";
import {
  planZone,
  type RoadGeometry,
  startRoad,
  steerWalk,
  stepWalk,
  type Walk,
  type WalkItem,
} from "./walk";

// The quirks these tests rely on, pinned so a roster edit does not move them: Archie is a
// medium acrobatic chaser, and Penny a big nervous dog.
const dogs = {
  ...DOGS,
  archie: { ...DOGS.archie, quirk: "acrobatic", size: "medium", trait: "chaser" },
  penny: { ...DOGS.penny, quirk: "nervous", size: "big" },
} as const satisfies Record<DogId, Dog>;
const data = {
  debuffs: DEBUFFS,
  dogs,
  encounters: ENCOUNTERS,
  forcedStops: FORCED_STOPS,
  minorObstacles: MINOR_OBSTACLES,
  needCards: NEED_CARDS,
  needSpots: NEED_SPOTS,
  needs: NEEDS,
  quirks: QUIRKS,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  // An 80px/s, 30s zone with spawns sized for it, as in the walk tests.
  tuning: {
    ...TEST_TUNING,
    counts: {
      ...TEST_TUNING.counts,
      minorObstaclesFirstZone: 4,
      needSpotsPerZone: 4,
      obstaclesFirstZone: 6,
      tipsFirstZone: 8,
      treatsPerZone: 2,
    },
    pixels: { ...TEST_TUNING.pixels, roadScrollSpeed: 80, spawnRowSpacing: 160 },
    seconds: {
      ...TEST_TUNING.seconds,
      laneMove: 0.2,
      pullReactionWindow: 0.6,
      pullTell: 1,
      zoneAtBaseSpeed: 30,
    },
  },
  upgrades: UPGRADES,
  world: WORLD,
};
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
const FRAME = 1 / 60;
const GOOD_LEASH: Modifier & { source: { kind: "upgrade"; upgrade: "goodLeash" } } = {
  by: "goodLeashSquirrelPull",
  operation: "multiply",
  source: { kind: "upgrade", upgrade: "goodLeash" },
  stat: "chaserSquirrelPulls",
};

// The pack in the middle lane with items on the road.
const walkWith = (dogs: PackDogs, items: WalkItem[] = []): Walk => ({
  road: {
    ...startRoad(5),
    control: laneControlIn(stillInLane(2)),
    items,
    nextItemId: items.length,
  },
  run: newRun(data, 3, { dogs, gear: null, walker: "casey" }),
});
// A one-cell item up the road, wholly ahead of the pack.
const item = (kind: WalkItem["kind"], id: number, lane: number, y = 100): WalkItem => ({
  height: 12,
  id,
  kind,
  lane,
  laneSpan: 1,
  y,
});
const urgent = (walk: Walk, seconds = 1000): Walk => ({
  ...walk,
  run: { ...walk.run, needSeconds: { biscuit: seconds, koda: seconds } },
});

// Each frame steps the pulls, then the walk, as the run scene does.
function after(walk: Walk, seconds: number, pulls: Pulls = NO_PULLS) {
  let walked = walk;
  let state = pulls;
  const steps: PullStep[] = [];
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    const stepped = stepPulls(data, geometry, FRAME, state, walked);
    steps.push(stepped);
    state = stepped.pulls;
    walked = stepWalk(data, geometry, seededRandom(1), FRAME, stepped.walk).walk;
  }
  return {
    blocked: steps.flatMap((stepped) => stepped.blocked),
    failed: steps.flatMap((stepped) => stepped.failed),
    pulled: steps.flatMap((stepped) => stepped.pulled),
    pulls: state,
    tells: steps.flatMap((stepped) => stepped.tells),
    walk: walked,
  };
}

describe("what a dog pulls toward", () => {
  it("strains toward a squirrel for its tell, then pulls the pack a lane toward it, once", () => {
    const walk = walkWith(["koda"], [item("squirrel", 0, 0)]);
    const straining = after(walk, 0.5);
    expect(straining.tells).toEqual([{ direction: -1, dog: "koda", kind: "squirrel" }]);
    expect(straining.walk.road.control.target).toBe(2);
    expect(pullPose(data, straining.pulls, "koda")).toEqual({ direction: -1, tag: "tell" });
    const pulled = after(walk, 1.1);
    expect(pulled.pulled).toEqual([{ direction: -1, dog: "koda", moved: true }]);
    expect(pullPose(data, pulled.pulls, "koda")).toEqual({ direction: -1, tag: "pull" });
    expect(isSteeringLocked(after(walk, 1.3).walk.road.control)).toBe(true);
    expect(after(walk, 3).walk.road.control.target).toBe(1);
  });

  it("pulls toward a darting squirrel from its cue, once it moves", () => {
    const darting: MoverPath = {
      direction: -1,
      enterTravel: 200,
      lanesPerPixel: 0.001,
      motion: "cross",
      movement: "dart",
      tilt: 0,
      warning: 80,
    };
    const walk = walkWith(
      ["koda"],
      [{ ...item("squirrel", 0, 4), mover: { path: darting, since: 0 } }],
    );
    expect(after(walk, 0.5).tells).toEqual([{ direction: 1, dog: "koda", kind: "squirrel" }]);
    // The tell runs out at 1s; the squirrel moves from 80px of scroll, at 1s.
    expect(after(walk, 1.2).walk.road.control.target).toBe(3);
  });

  it("strains toward a treat only for a food-driven dog", () => {
    const treat = [item("treat", 0, 4)];
    expect(after(walkWith(["biscuit"], treat), 0.5).tells).toEqual([
      { direction: 1, dog: "biscuit", kind: "treat" },
    ]);
    expect(after(walkWith(["duchess"], treat), 2).tells).toEqual([]);
  });

  it("strains toward a spot that meets its need only once the need is urgent", () => {
    const tree = [item("tree", 0, 0)];
    expect(after(walkWith(["biscuit"], tree), 2).tells).toEqual([]);
    expect(after(urgent(walkWith(["biscuit"], tree)), 0.5).tells).toEqual([
      { direction: -1, dog: "biscuit", kind: "need" },
    ]);
    const bowl = [item("waterBowl", 0, 0)];
    expect(after(urgent(walkWith(["biscuit"], bowl)), 2).tells).toEqual([]);
  });

  it("never pulls without a target: no random pulls", () => {
    expect(after(walkWith(["koda", "biscuit", "zippy"]), 30).tells).toEqual([]);
  });

  it("does not chase with Good leash, with no chaser, or toward a squirrel in the pack's lane", () => {
    const leashed = walkWith(["koda"], [item("squirrel", 0, 0)]);
    const withLeash = { ...leashed, run: { ...leashed.run, modifiers: [GOOD_LEASH] } };
    expect(after(withLeash, 2).tells).toEqual([]);
    expect(after(walkWith(["duchess"], [item("squirrel", 0, 0)]), 2).tells).toEqual([]);
    expect(after(walkWith(["koda"], [item("squirrel", 0, 2)]), 2).tells).toEqual([]);
  });

  it("ignores a target the pack has passed", () => {
    expect(after(walkWith(["koda"], [item("squirrel", 0, 0, 600)]), 1.5).tells).toEqual([]);
  });

  it("strains one dog at a time, the first in pack order, each target once", () => {
    const walk = walkWith(["biscuit", "koda"], [item("treat", 0, 0), item("squirrel", 1, 4, 60)]);
    const { pulled, tells } = after(walk, 4);
    expect(tells.map(({ dog }) => dog)).toEqual(["biscuit", "koda"]);
    expect(pulled.map(({ direction, dog }) => [dog, direction])).toEqual([
      ["biscuit", -1],
      ["koda", 1],
    ]);
  });
});

describe("a nervous dog", () => {
  it("strains toward another dog in view, lunging, then pulls a lane toward it, once", () => {
    const walk = walkWith(["penny"], [item("otherDog", 0, 0)]);
    const straining = after(walk, 0.5);
    expect(straining.tells).toEqual([{ direction: -1, dog: "penny", kind: "otherDog" }]);
    expect(pullPose(data, straining.pulls, "penny")).toEqual({
      direction: -1,
      quirkTag: "lunge",
      tag: "tell",
    });
    const pulled = after(walk, 4);
    expect(pulled.pulled).toEqual([{ direction: -1, dog: "penny", moved: true }]);
    expect(pullPose(data, after(walk, 1.1).pulls, "penny")).toEqual({ direction: -1, tag: "pull" });
  });

  it("takes a playmate spot and a loose dog for other dogs; other dogs ignore them", () => {
    expect(after(walkWith(["penny"], [item("playmate", 0, 4)]), 0.5).tells).toEqual([
      { direction: 1, dog: "penny", kind: "otherDog" },
    ]);
    const loose: MoverPath = {
      direction: -1,
      enterTravel: 200,
      lanesPerPixel: 0.001,
      motion: "cross",
      movement: "dart",
      tilt: 0,
      warning: 80,
    };
    const looseDog = { ...item("otherDog", 0, 4), mover: { path: loose, since: 0 } };
    expect(after(walkWith(["penny"], [looseDog]), 0.5).tells).toEqual([
      { direction: 1, dog: "penny", kind: "otherDog" },
    ]);
    expect(after(walkWith(["koda"], [item("otherDog", 0, 0), looseDog]), 3).tells).toEqual([]);
  });

  it("strains in pack order with the other strainers, each target once", () => {
    const walk = walkWith(["koda", "penny"], [item("squirrel", 0, 0), item("otherDog", 1, 4, 60)]);
    const { pulled, tells } = after(walk, 4);
    expect(tells.map(({ dog, kind }) => [dog, kind])).toEqual([
      ["koda", "squirrel"],
      ["penny", "otherDog"],
    ]);
    expect(pulled.map(({ direction, dog }) => [dog, direction])).toEqual([
      ["koda", -1],
      ["penny", 1],
    ]);
  });

  it("is held by the fairness rule like every pull", () => {
    // As in the fairness tests below: the cone in lane 1 is too close to react to at 1s.
    const walk = walkWith(["penny"], [item("otherDog", 0, 0), item("cone", 1, 1, 402)]);
    const held = after(walk, 2);
    expect(held.blocked).toEqual([{ direction: -1, dog: "penny", kind: "otherDog" }]);
    expect(held.pulled).toEqual([]);
  });
});

describe("an acrobatic dog", () => {
  it("leaves no lane-input lock after its pull, whatever its size, and flourishes", () => {
    const walk = walkWith(["archie"], [item("squirrel", 0, 0)]);
    const pulled = after(walk, 1.1);
    expect(pulled.pulled).toEqual([{ direction: -1, dog: "archie", moved: true }]);
    expect(pullPose(data, pulled.pulls, "archie")).toEqual({
      direction: -1,
      quirkTag: "flourish",
      tag: "pull",
    });
    expect(pullWalk(data, 5, "archie", 1, walkWith(["archie"])).walk.road.control).toMatchObject({
      lockOnArrival: 0,
    });
    for (const seconds of [1.2, 1.3, 1.4, 1.6]) {
      expect(isSteeringLocked(after(walk, seconds).walk.road.control), `${seconds}s`).toBe(false);
    }
    // Biscuit, also medium, locks a quarter second.
    expect(pullWalk(data, 5, "biscuit", 1, walkWith(["biscuit"])).walk.road.control).toMatchObject({
      lockOnArrival: 0.25,
    });
  });
});

describe("the fairness rule", () => {
  // At the pull, 1s in, the cone in lane 1 is 60px from the pack: a big dog's pull needs
  // 0.2 + 0.5 + 0.6 + 0.2 = 1.5s, 120px at 80px/s.
  const cone = item("cone", 1, 1, 402);

  it("strains without pulling while the lane has an obstacle too close, then pulls once clear", () => {
    const walk = walkWith(["koda"], [item("squirrel", 0, 0), cone]);
    const held = after(walk, 2);
    expect(held.blocked).toEqual([{ direction: -1, dog: "koda", kind: "squirrel" }]);
    expect(held.pulled).toEqual([]);
    expect(held.walk.road.control.target).toBe(2);
    expect(held.pulls.strain?.blocked).toBe(true);
    expect(pullPose(data, held.pulls, "koda")).toEqual({ direction: -1, tag: "tell" });
    // The cone passes the pack's band at about 2.85s.
    const cleared = after(walk, 3.5);
    expect(cleared.pulled).toEqual([{ direction: -1, dog: "koda", moved: true }]);
    expect(cleared.failed).toEqual([]);
  });

  it("pulls into a lane whose obstacle is far enough away to react to", () => {
    const far = { ...cone, y: 300 };
    const walk = walkWith(["zippy"], [item("squirrel", 0, 0), far]);
    expect(after(walk, 1.1).pulled).toEqual([{ direction: -1, dog: "zippy", moved: true }]);
  });

  it("ends a blocked strain without a pull once its target passes", () => {
    const walk = walkWith(["koda"], [item("squirrel", 0, 0, 380), cone]);
    const passed = after(walk, 2.5);
    expect(passed.pulled).toEqual([]);
    expect(passed.failed).toEqual(["koda"]);
    expect(passed.pulls.strain).toBeNull();
  });

  describe("laneBlockedWithin", () => {
    // Its cue over, entering the road from the left as it is 14px from the pack's band,
    // crossing 2.5 lanes every 32px.
    const crosser: MoverPath = {
      direction: 1,
      enterTravel: 500,
      lanesPerPixel: 2.5 / 32,
      motion: "cross",
      movement: "dart",
      tilt: 0,
      warning: 50,
    };
    const walk = walkWith(
      ["koda"],
      [{ ...item("ball", 0, 0, 0), mover: { path: crosser, since: 50 } }],
    );
    const blocked = (lane: number, horizon: number) =>
      laneBlockedWithin(data, geometry, 80, horizon, lane, walk);

    it("blocks the lanes a mover sweeps while it overlaps the pack within the horizon", () => {
      // Over 1s it travels 80px, overlapping the band from 14px on, in lanes 1 to 4.
      expect([0, 1, 2, 3, 4].map((lane) => blocked(lane, 1))).toEqual([
        false,
        true,
        true,
        true,
        true,
      ]);
    });

    it("leaves a lane open when the mover reaches the pack only after the horizon", () => {
      expect([0, 1, 2, 3, 4].map((lane) => blocked(lane, 0.15))).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
    });
  });
});

describe("stepPulls holds", () => {
  it("stands still through a hit stop and once the walk has ended", () => {
    const walk = walkWith(["koda"], [item("squirrel", 0, 0)]);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, hitStop: { cards: [], seconds: 1, zoneEnded: false } },
    };
    const straining = after(walk, 0.5).pulls;
    const held = stepPulls(data, geometry, 2, straining, stopped);
    expect(held.pulls).toBe(straining);
    expect(held.pulled).toEqual([]);
    const ended: Walk = {
      ...walk,
      run: { ...walk.run, phase: { kind: "ended", reason: "wentHome" } },
    };
    expect(stepPulls(data, geometry, 2, straining, ended).pulls).toBe(straining);
  });
});

describe("pullWalk", () => {
  it("is the lane change any dog-caused pull goes through, dropped during a hit stop", () => {
    const walk = walkWith(["archie"]);
    expect(pullWalk(data, 5, "archie", 1, walk).walk.road.control.target).toBe(3);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, hitStop: { cards: [], seconds: 1, zoneEnded: false } },
    };
    expect(pullWalk(data, 5, "archie", 1, stopped)).toEqual({ moved: false, walk: stopped });
  });
});

describe("gestureAfterPulls", () => {
  const context = {
    config: { laneCount: 5, swipeStartDistance: 20, tapMaxDistance: 10 },
    layout: {
      dogRow: { height: 90, width: 360, x: 0, y: 470 },
      dogSlots: [],
      road: { height: 320, width: 280, x: 40, y: 150 },
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
    expect(reanchored).toMatchObject({ kind: "dragging", leg: { anchorX: 230, steps: 0 } });
    // Dragging back one lane now takes the swipe start distance, 20px, from 230.
    expect(pointerMove(context, { x: 211, y: 400 }, reanchored).actions).toEqual([]);
    expect(pointerMove(context, { x: 210, y: 400 }, reanchored).actions).toEqual([
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
    const start = urgent(planZone(data, geometry, seededRandom(5), walkWith(["biscuit", "koda"])));
    // As RunScene steps: the moves due now, each logged, then the pulls, then the walk.
    const play = (movesAt: (frame: number, timeMs: number) => LaneDirection[]) => {
      const rolls = seededRandom(9);
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
        const pullStep = stepPulls(data, geometry, FRAME, pulls, walk);
        pulls = pullStep.pulls;
        pulled.push(...pullStep.pulled);
        const stepped = stepWalk(data, geometry, rolls, FRAME, pullStep.walk);
        cards.push(...stepped.cards);
        walk = stepped.walk;
      }
      return { cards, log, pulled, walk };
    };
    const recorded = play((frame) => (frame % 47 === 0 ? [frame % 94 === 0 ? -1 : 1] : []));
    expect(recorded.pulled.filter((pull) => pull.moved).length).toBeGreaterThanOrEqual(1);

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
