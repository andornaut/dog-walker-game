import { seededRandom } from "@andornaut/game-kit/random";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { MOVEMENT_ASSIGNMENTS, MOVEMENT_PROFILES } from "../data/movementProfiles";
import { RUN_TEXT } from "../data/runText";
import { SHOP_GEAR } from "../data/shop";
import type { Modifier } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WORLD } from "../data/world";
import { recordInput, replayInputs, startInputLog } from "../dev/inputLog";
import type { LaneDirection } from "../layout/lanes";
import { mapPack } from "../state/pack";
import { newRun, type PackDogs } from "../state/runState";
import { plannerStreams } from "../testing/movers";
import { TEST_ROAD_GEOMETRY } from "../testing/packGeometry";
import { TEST_TUNING } from "../testing/tuning";
import { TEST_WALKER_DATA } from "../testing/walkers";
import { laneControlIn } from "./laneControl";
import { stillInLane } from "./laneMotion";
import type { MoverPath } from "./movers";
import {
  laneBlockedWithin,
  NO_PULLS,
  type PullEvent,
  pullPose,
  type Pulls,
  type PullStep,
  pullWalk,
  stepPulls,
} from "./pulls";
import { startRoad, steerWalk, stepWalk, type Walk } from "./walk";
import { type WalkItem } from "./walkItems";
import { planZone } from "./zonePlan";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  minorObstacles: MINOR_OBSTACLES,
  movementAssignments: MOVEMENT_ASSIGNMENTS,
  movementProfiles: MOVEMENT_PROFILES,
  runText: RUN_TEXT,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
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
const geometry = TEST_ROAD_GEOMETRY;
const FRAME = 1 / 60;
const GOOD_LEASH: Modifier & { source: { kind: "upgrade"; upgrade: "goodLeash" } } = {
  by: "goodLeashSquirrelPull",
  operation: "multiply",
  source: { kind: "upgrade", upgrade: "goodLeash" },
  stat: "squirrelPulls",
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

// A squirrel darting left across the road, moving from 80px of scroll.
const DARTING: MoverPath = {
  direction: -1,
  enterTravel: 200,
  idle: 0,
  lanesPerPixel: 0.001,
  motion: "cross",
  movement: "dart",
  stopAfter: null,
  tilt: 0,
  turnAfter: null,
  warning: 80,
};

// Each frame steps the pulls, then the walk, as the run scene does.
function after(walk: Walk, seconds: number, pulls: Pulls = NO_PULLS) {
  let walked = walk;
  let state = pulls;
  const steps: PullStep[] = [];
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    const stepped = stepPulls(data, geometry, FRAME, [], state, walked);
    steps.push(stepped);
    state = stepped.pulls;
    walked = stepWalk(data, geometry, seededRandom(1), FRAME, stepped.walk).walk;
  }
  return {
    failed: steps.flatMap((stepped) => stepped.failed),
    leashed: steps.flatMap((stepped) => stepped.leashed),
    pulled: steps.flatMap((stepped) => stepped.pulled),
    pulls: state,
    tells: steps.flatMap((stepped) => stepped.tells),
    walk: walked,
  };
}

describe("what a dog pulls toward", () => {
  it("strains toward a squirrel for its tell, then pulls the pack a lane toward it, once", () => {
    const walk = walkWith(["kilo"], [item("squirrel", 0, 0)]);
    const straining = after(walk, 0.5);
    expect(straining.tells).toEqual([{ direction: -1, dog: "kilo", kind: "squirrel" }]);
    expect(straining.walk.road.control.target).toBe(2);
    expect(pullPose(data, straining.walk.run, straining.pulls, "kilo")).toEqual({
      direction: -1,
      tag: "tell",
    });
    const pulled = after(walk, 1.1);
    expect(pulled.pulled).toEqual([{ direction: -1, dog: "kilo", moved: true }]);
    expect(pullPose(data, pulled.walk.run, pulled.pulls, "kilo")).toEqual({
      direction: -1,
      tag: "pull",
    });
    expect(after(walk, 3).walk.road.control.target).toBe(1);
  });

  it("pulls toward a darting squirrel from its cue, once it moves", () => {
    const walk = walkWith(
      ["kilo"],
      [{ ...item("squirrel", 0, 4), mover: { path: DARTING, since: 0 } }],
    );
    expect(after(walk, 0.5).tells).toEqual([{ direction: 1, dog: "kilo", kind: "squirrel" }]);
    // The tell runs out at 1s; the squirrel moves from 80px of scroll, at 1s.
    expect(after(walk, 1.2).walk.road.control.target).toBe(3);
  });

  // A darting squirrel waits idle at the road's edge for 60px of scroll, then shows its cue for
  // 80px before it sets off: a dog strains toward it from its cue on, never while it waits.
  it.each([
    { since: 59, state: "about to show its cue", strains: false },
    { since: 60, state: "showing its cue", strains: true },
  ])("strains toward a darting squirrel $state: $strains", ({ since, strains }) => {
    const path: MoverPath = {
      direction: -1,
      enterTravel: 260,
      idle: 60,
      lanesPerPixel: 0.001,
      motion: "cross",
      movement: "dart",
      stopAfter: null,
      tilt: 0,
      turnAfter: null,
      warning: 140,
    };
    const walk = walkWith(["kilo"], [{ ...item("squirrel", 0, 4), mover: { path, since } }]);
    const pulls = stepPulls(data, geometry, FRAME, [], NO_PULLS, walk);
    expect(pulls.tells).toEqual(strains ? [{ direction: 1, dog: "kilo", kind: "squirrel" }] : []);
  });

  it("has every dog strain toward a squirrel", () => {
    for (const dog of keysOf(DOGS)) {
      expect(after(walkWith([dog], [item("squirrel", 0, 4)]), 0.5).tells).toEqual([
        { direction: 1, dog, kind: "squirrel" },
      ]);
    }
  });

  it("does not strain toward encounters without a pull resolution", () => {
    for (const kind of ["treat", "otherDog", "tip"] as const) {
      expect(after(walkWith(["lady"], [item(kind, 0, 4)]), 2).tells).toEqual([]);
    }
  });

  it("selects pull targets from encounter data rather than their identity", () => {
    const configured = {
      ...data,
      encounters: {
        ...data.encounters,
        otherDog: { ...data.encounters.otherDog, resolution: { kind: "pull" as const } },
        squirrel: { ...data.encounters.squirrel, resolution: data.encounters.puddle.resolution },
      },
    };
    const walk = walkWith(["kilo"], [item("squirrel", 0, 0), item("otherDog", 1, 4)]);
    const started = stepPulls(configured, geometry, FRAME, [], NO_PULLS, walk);
    expect(started.tells).toEqual([{ direction: 1, dog: "kilo", kind: "otherDog" }]);
    const pulled = stepPulls(configured, geometry, 1, [], started.pulls, started.walk);
    expect(pulled.pulled).toEqual([{ direction: 1, dog: "kilo", moved: true }]);
    expect(pulled.walk.road.control.target).toBe(3);
  });

  it("never pulls without a target: no random pulls", () => {
    expect(after(walkWith(["kilo", "lady", "buddy"]), 30).tells).toEqual([]);
  });

  it("does not chase with Good leash, or toward a squirrel in the pack's lane", () => {
    const leashed = walkWith(["kilo"], [item("squirrel", 0, 0)]);
    const withLeash = { ...leashed, run: { ...leashed.run, modifiers: [GOOD_LEASH] } };
    const held = after(withLeash, 2);
    expect(held.tells).toEqual([]);
    expect(held.leashed).toEqual(["kilo"]);
    expect(after(walkWith(["kilo"], [item("squirrel", 0, 2)]), 2).tells).toEqual([]);
  });

  it.each([
    { squirrel: item("squirrel", 0, 0, 600), standing: "standing" },
    {
      squirrel: { ...item("squirrel", 0, 0, 600), mover: { path: DARTING, since: 600 } },
      standing: "darting",
    },
  ])("ignores a $standing squirrel the pack has passed", ({ squirrel }) => {
    expect(after(walkWith(["kilo"], [squirrel]), 1.5).tells).toEqual([]);
  });

  // Of three dogs, the biggest leads, the next walks front-left and the smallest front-right.
  it("strains one dog at a time, the one nearest the squirrel, each squirrel once", () => {
    const walk = walkWith(
      ["buddy", "lady", "kilo"],
      [item("squirrel", 0, 0), item("squirrel", 1, 4, 60)],
    );
    const { pulled, tells } = after(walk, 4);
    expect(tells.map(({ dog }) => dog)).toEqual(["lady", "buddy"]);
    expect(pulled.map(({ direction, dog }) => [dog, direction])).toEqual([
      ["lady", -1],
      ["buddy", 1],
    ]);
  });

  it("ends the strain without a pull once the straining dog's owner fires you", () => {
    const straining = after(walkWith(["kilo", "lady"], [item("squirrel", 0, 0)]), 0.3);
    const dog = straining.pulls.strain?.dog;
    const { run } = straining.walk;
    const fired = {
      ...straining.walk,
      run: {
        ...run,
        pack: mapPack(
          (slot) => (slot.dog === dog ? { dog: slot.dog, status: "fired", zoneIndex: 0 } : slot),
          run.pack,
        ),
      },
    };
    const rest = after(fired, 2, straining.pulls);
    expect(dog).toBeDefined();
    expect(rest.pulled).toEqual([]);
    expect(rest.walk.road.control.target).toBe(2);
  });

  it("cancels the pull when the pack steers away from the squirrel during the strain", () => {
    const straining = after(walkWith(["kilo"], [item("squirrel", 0, 0)]), 0.3);
    const steered = steerWalk(data, 5, 1, straining.walk);
    const rest = after(steered, 2, straining.pulls);
    expect(rest.failed).toEqual(["kilo"]);
    expect(rest.pulled).toEqual([]);
    expect(rest.walk.road.control.target).toBe(3);
    expect(rest.pulls.strain).toBeNull();
  });
});

describe("the fairness rule", () => {
  // At the pull, 1s in, the sandwich board in lane 1 is 60px from the pack: a large dog's pull needs
  // 0.2 + 0.5 + 0.6 + 0.2 = 1.5s, 120px at 80px/s.
  const sandwichBoard = item("sandwichBoard", 1, 1, 402);

  it("strains without pulling while the lane has an obstacle too close, then pulls once clear", () => {
    const walk = walkWith(["kilo"], [item("squirrel", 0, 0), sandwichBoard]);
    const held = after(walk, 2);
    expect(held.pulled).toEqual([]);
    expect(held.walk.road.control.target).toBe(2);
    expect(held.pulls.strain?.blocked).toBe(true);
    expect(pullPose(data, held.walk.run, held.pulls, "kilo")).toEqual({
      direction: -1,
      tag: "tell",
    });
    // The sandwich board passes the pack's band at about 2.85s.
    const cleared = after(walk, 3.5);
    expect(cleared.pulled).toEqual([{ direction: -1, dog: "kilo", moved: true }]);
    expect(cleared.failed).toEqual([]);
  });

  it("pulls into a lane whose obstacle is far enough away to react to", () => {
    const far = { ...sandwichBoard, y: 300 };
    const walk = walkWith(["buddy"], [item("squirrel", 0, 0), far]);
    expect(after(walk, 1.1).pulled).toEqual([{ direction: -1, dog: "buddy", moved: true }]);
  });

  it("ends a blocked strain without a pull once its target passes", () => {
    const walk = walkWith(["kilo"], [item("squirrel", 0, 0, 380), sandwichBoard]);
    const passed = after(walk, 2.5);
    expect(passed.pulled).toEqual([]);
    expect(passed.failed).toEqual(["kilo"]);
    expect(passed.pulls.strain).toBeNull();
  });

  describe("laneBlockedWithin", () => {
    // Its cue over, entering the road from the left as it is 14px from the pack's band,
    // crossing 2.5 lanes every 32px.
    const crosser: MoverPath = {
      direction: 1,
      enterTravel: 500,
      idle: 0,
      lanesPerPixel: 2.5 / 32,
      motion: "cross",
      movement: "dart",
      stopAfter: null,
      tilt: 0,
      turnAfter: null,
      warning: 50,
    };
    const walk = walkWith(
      ["kilo"],
      [{ ...item("ball", 0, 0, 0), mover: { path: crosser, since: 50 } }],
    );
    // The pack's band from 554 to 630.
    const banded = { ...geometry, packBand: { bottom: 630, top: 554 } };
    const blocked = (lane: number, horizon: number) =>
      laneBlockedWithin(data, banded, 80, horizon, lane, walk);

    // Over 1s it travels 80px, overlapping the band from 14px on, in lanes 1 to 4; over 0.15s it
    // travels 12px, short of the band.
    it.each([
      { horizon: 1, lanes: [false, true, true, true, true], name: "the lanes it sweeps" },
      { horizon: 0.15, lanes: [false, false, false, false, false], name: "no lane" },
    ])("blocks $name for a mover over a $horizon s horizon", ({ horizon, lanes }) => {
      expect([0, 1, 2, 3, 4].map((lane) => blocked(lane, horizon))).toEqual(lanes);
    });

    // A stalker in lane 2 overlapping the band, its step a lane either way or straight on due 5px
    // of scroll on and taking 100px: still to choose, it may step into lane 1 or 3 while it
    // overlaps the band, as it chooses toward wherever the pack has gone; chosen, it blocks only
    // the lanes its step takes it through.
    const stalker = (chosen: boolean): MoverPath => ({
      burst: 56,
      lane: 2,
      lengths: [100],
      motion: "approach",
      movement: "approach",
      pending: chosen ? [] : [{ at: 545, kind: "after" }],
      reach: { count: 3, first: 1 },
      rows: 1,
      steps: chosen ? [{ at: 545, lanes: 0, length: 100, travel: 0 }] : [],
      stopTravel: 900,
      warning: 0,
    });
    it.each([
      { chosen: false, lanes: [false, true, true, true, false] },
      { chosen: true, lanes: [false, false, true, false, false] },
    ])("blocks the lanes a stalker may step into, its step chosen: $chosen", (row) => {
      const stalking = walkWith(
        ["kilo"],
        [{ ...item("coyote", 0, 2, 568), mover: { path: stalker(row.chosen), since: 540 } }],
      );
      const lanes = [0, 1, 2, 3, 4].map((lane) =>
        laneBlockedWithin(data, banded, 80, 1, lane, stalking),
      );
      expect(lanes).toEqual(row.lanes);
    });
  });
});

describe("stepPulls holds", () => {
  it("stands still through a hit stop and once the walk has ended", () => {
    const walk = walkWith(["kilo"], [item("squirrel", 0, 0)]);
    const stopped: Walk = {
      ...walk,
      road: { ...walk.road, hitStop: { cards: [], firing: false, seconds: 1, zoneEnded: false } },
    };
    const straining = after(walk, 0.5).pulls;
    const held = stepPulls(data, geometry, 2, [], straining, stopped);
    expect(held.pulls).toBe(straining);
    expect(held.pulled).toEqual([]);
    const ended: Walk = {
      ...walk,
      run: { ...walk.run, phase: { kind: "ended", reason: "wentHome" } },
    };
    expect(stepPulls(data, geometry, 2, [], straining, ended).pulls).toBe(straining);
  });
});

// A squirrel darting left past the road's edge, 0.7 lanes past lane 0's middle, as the strain of
// the dog beside it in lane 0 ends its tell.
it("fails a strain toward a squirrel leaving past the road's edge beside the pack", () => {
  const path = { ...DARTING, enterTravel: 0, lanesPerPixel: 0.05 };
  const leaving = { ...item("squirrel", 0, 0), mover: { path, since: path.warning + 104 } };
  const walk = walkWith(["kilo"], [leaving]);
  const edge = { ...walk, road: { ...walk.road, control: laneControlIn(stillInLane(0)) } };
  const strain = {
    blocked: false,
    direction: -1,
    dog: "kilo",
    fromLane: 0,
    itemId: leaving.id,
    kind: "squirrel",
    pullsLeft: 1,
    tellSeconds: 0,
  } as const;
  const stepped = stepPulls(data, geometry, FRAME, [], { ...NO_PULLS, strain }, edge);
  expect(stepped.failed).toEqual(["kilo"]);
  expect(stepped.pulled).toEqual([]);
  expect(stepped.pulls).toMatchObject({ spent: [leaving.id], strain: null });
});

describe("pullWalk", () => {
  it("is the lane change any dog-caused pull goes through, none past the road's edge", () => {
    expect(pullWalk(data, 5, 1, walkWith(["archie"])).walk.road.control.target).toBe(3);
    const edge = steerWalk(data, 5, -1, steerWalk(data, 5, -1, walkWith(["archie"])));
    expect(pullWalk(data, 5, -1, edge).moved).toBe(false);
  });
});

describe("replay with pulls", () => {
  it("reproduces a run with pulls from the seed and the input log alone", () => {
    // As RunScene steps: the moves due now, each logged, then the pulls, then the walk.
    const play = (seed: number, movesAt: (frame: number, timeMs: number) => LaneDirection[]) => {
      const setup = { dev: true, seed, speed: 1, zone: 1 };
      const start = planZone(data, geometry, plannerStreams(seed), walkWith(["lady", "kilo"]));
      const rolls = seededRandom(seed + 4);
      let log = startInputLog(setup);
      let walk = start;
      let pulls = NO_PULLS;
      const pulled: PullEvent[] = [];
      const cards: unknown[] = [];
      for (let frame = 0; frame < 60 * 30; frame++) {
        const timeMs = frame * FRAME * 1000;
        const moves = movesAt(frame, timeMs);
        for (const direction of moves) {
          walk = steerWalk(data, 5, direction, walk);
          log = recordInput({ direction, kind: "lane", timeMs }, log);
        }
        const pullStep = stepPulls(data, geometry, FRAME, moves, pulls, walk);
        pulls = pullStep.pulls;
        pulled.push(...pullStep.pulled);
        const stepped = stepWalk(data, geometry, rolls, FRAME, pullStep.walk);
        cards.push(...stepped.cards);
        walk = stepped.walk;
      }
      return { cards, log, pulled, walk };
    };
    const weave = (frame: number): LaneDirection[] =>
      frame % 151 === 0 ? [Math.floor(frame / 151) % 2 === 0 ? -1 : 1] : [];
    // The first seed whose walk has a dog pull the pack, however the road is tuned.
    let seed = 5;
    let recorded = play(seed, weave);
    while (!recorded.pulled.some((pull) => pull.moved) && seed < 40) {
      seed += 1;
      recorded = play(seed, weave);
    }
    expect(recorded.pulled.filter((pull) => pull.moved).length).toBeGreaterThanOrEqual(1);

    const events = [...replayInputs(recorded.log)];
    let next = 0;
    const replayed = play(seed, (_, timeMs) => {
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
