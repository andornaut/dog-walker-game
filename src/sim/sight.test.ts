import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { MinorObstacleId, Movement } from "../data/types";
import { keysOf } from "../lib/records";
import type { MoverPath } from "../runner/movers";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { type WalkItem, type WalkItemKind, walkScrollSpeed } from "../runner/walk";
import { testState } from "../testing/runState";
import { sightPaths } from "./sight";

const run = testState({ biscuit: 3 });
const road = {
  data: gameData,
  geometry: screenRoadGeometry(run),
  speed: walkScrollSpeed(gameData, run),
};

// The first minor obstacle that moves as wanted has it.
function kindMoving(wanted: (movement: Movement) => boolean): WalkItemKind {
  const kind = keysOf(gameData.minorObstacles).find((id) => {
    const { movement } = gameData.minorObstacles[id];
    return movement !== undefined && wanted(movement);
  });
  if (kind === undefined) {
    throw new Error("No minor obstacle moves that way");
  }
  return kind as WalkItemKind;
}

const DART = kindMoving(
  (movement) => movement.kind === "dart" && movement.tilt.min < movement.tilt.max,
);
const RIDER = kindMoving((movement) => movement.kind === "inLane");
const STEPPER = kindMoving((movement) => movement.kind === "step");

const dart: MoverPath = {
  direction: 1,
  enterTravel: 100,
  idle: 0,
  lanesPerPixel: 0.01,
  motion: "cross",
  movement: "dart",
  stopAfter: null,
  tilt: 0.2,
  turnAfter: null,
  warning: 60,
};
const rider: MoverPath = {
  lane: 1,
  lanes: 1,
  motion: "ride",
  movement: "inLane",
  speedMultiplier: 2,
  warning: 60,
};
const stepper: MoverPath = {
  lane: 2,
  motion: "steps",
  movement: "step",
  steps: [{ at: 200, lanes: 1, length: 40, travel: 0 }],
  warning: 60,
};

// Two movers that differ only in what they have not shown yet are read the same: a dart's speed,
// tilt and outcome before it sets off, and its outcome as it crosses; a rider's speed before it
// enters; a stepper's step before its wander mark, the step's shape and length while the mark
// shows, and an uncued step until it starts.
describe("a sight reading", () => {
  it.each([
    {
      hidden: { ...dart, lanesPerPixel: 0.013, stopAfter: 2.5, tilt: 1.4 },
      kind: DART,
      name: "a dart's speed, tilt and stop before it sets off",
      path: dart,
      since: 59,
    },
    {
      hidden: { ...dart, enterTravel: 180, idle: 80, warning: 140 },
      kind: DART,
      name: "how long a dart waits at its edge before its cue",
      path: { ...dart, enterTravel: 140, idle: 40, warning: 100 },
      since: 30,
    },
    {
      hidden: { ...dart, turnAfter: 3 },
      kind: DART,
      name: "a dart's turn back as it crosses",
      path: dart,
      since: 100,
    },
    {
      hidden: { ...dart, stopAfter: 3.5 },
      kind: DART,
      name: "a dart's stop as it crosses",
      path: dart,
      since: 100,
    },
    {
      hidden: { ...rider, speedMultiplier: 2.4 },
      kind: RIDER,
      name: "a rider's speed before it enters",
      path: rider,
      since: 59,
    },
    {
      hidden: { ...stepper, steps: [{ at: 230, lanes: -1, length: 45, travel: 0 }] },
      kind: STEPPER,
      name: "a stepper's step before its wander mark",
      path: stepper,
      since: 100,
    },
    {
      hidden: { ...stepper, steps: [{ at: 200, lanes: 0, length: 45, travel: 30 }] },
      kind: STEPPER,
      name: "a stepper's step shape and length as its wander mark shows",
      path: stepper,
      since: 150,
    },
    {
      hidden: {
        ...stepper,
        steps: [...stepper.steps, { at: 260, lanes: 1, length: 40, travel: 0, uncued: true }],
      },
      kind: STEPPER,
      name: "a stepper's uncued step until it starts",
      path: stepper,
      since: 250,
    },
  ] as const)("hides $name", ({ hidden, kind, path, since }) => {
    const item = (moving: MoverPath): WalkItem => ({
      height: 40,
      id: 1,
      kind,
      lane: 0,
      laneSpan: 1,
      mover: { path: moving, since },
      y: 0,
    });

    expect(sightPaths(road, since, item(hidden))).toEqual(sightPaths(road, since, item(path)));
  });
});

// What a player who knows a pattern mover's kind reads of its cued step: a bounce's or a sway's
// way back once it has stepped aside, either way before; a follower's either way; a stop-and-go's
// push down its lane at its speed. A dive's stop shows once it lands and slides, and a merge's
// way once its cue shows, not before.
describe("a pattern mover's sight reading", () => {
  const BOUNCE = kindMoving((movement) => movement.kind === "bounce");
  const DIVE = kindMoving((movement) => movement.kind === "dive");
  const FOLLOW = kindMoving((movement) => movement.kind === "follow");
  const STOP_AND_GO = kindMoving((movement) => movement.kind === "stopAndGo");
  const SWAY = kindMoving((movement) => movement.kind === "sway");
  const { cell } = road.geometry;
  const pushCells = (() => {
    const { movement } = gameData.minorObstacles[STOP_AND_GO as MinorObstacleId];
    return movement?.kind === "stopAndGo"
      ? ((movement.factor - 1) * movement.goSeconds * road.speed) / cell.length
      : NaN;
  })();
  const aside = { at: 100, lanes: 1, length: 40, travel: 0 } as const;
  const cued = { at: 200, lanes: -1, length: 40, travel: 0 } as const;
  const item = (kind: WalkItemKind, path: MoverPath, since: number): WalkItem => ({
    height: 40,
    id: 1,
    kind,
    lane: 2,
    laneSpan: 1,
    mover: { path, since },
    y: 0,
  });
  const SIDEWAYS = [
    { lanes: -1, travel: 0 },
    { lanes: 1, travel: 0 },
  ];
  it.each([
    { kind: BOUNCE, reads: [{ lanes: -1, travel: 0 }], started: [aside] },
    { kind: BOUNCE, reads: SIDEWAYS, started: [] },
    { kind: SWAY, reads: [{ lanes: -1, travel: 0 }], started: [aside] },
    { kind: FOLLOW, reads: SIDEWAYS, started: [aside] },
    { kind: STOP_AND_GO, reads: [{ lanes: 0, travel: pushCells }], started: [] },
  ])("reads $kind's cued step after $started.length steps", ({ kind, reads, started }) => {
    const path: MoverPath = {
      lane: 2,
      motion: "steps",
      movement: "step",
      steps: [...started, cued],
      warning: 60,
    };
    const read = sightPaths(road, 170, item(kind, path, 170)).map((seen) => {
      const last = seen.motion === "steps" ? seen.steps.at(-1) : undefined;
      return { lanes: last?.lanes, travel: (last?.travel ?? NaN) / cell.length };
    });
    expect(read.map(({ lanes }) => lanes)).toEqual(reads.map(({ lanes }) => lanes));
    read.forEach(({ travel }, i) => {
      expect(travel).toBeCloseTo(reads[i]?.travel ?? NaN);
    });
  });

  // A merge to the left at 300 px of scroll, its cue 60 px long.
  const MERGE = kindMoving((movement) => movement.kind === "merge");
  const merging: MoverPath = {
    ...rider,
    lane: 2,
    merge: { at: 300, cue: 60, lanes: -1, length: 40 },
    movement: "merge",
  };
  it.each([
    { name: "before its cue", shows: false, since: 239 },
    { name: "as its cue shows", shows: true, since: 241 },
  ])("reads a merge $name: $shows", ({ shows, since }) => {
    const read = sightPaths(road, since, item(MERGE, merging, since));
    expect(read.map((path) => path.motion === "ride" && path.merge !== undefined)).toEqual([shows]);
  });

  // A dive 2.5 lanes to its stop at 0.01 lanes a pixel, landing 1.5 lanes in.
  const dive: MoverPath = { ...dart, movement: "dive", slide: 0.5, stopAfter: 2.5, tilt: 0 };
  it.each([
    { name: "before it lands", since: dart.warning + 140, stops: false },
    { name: "as it slides", since: dart.warning + 160, stops: true },
  ])("reads a dive's stop $name: $stops", ({ since, stops }) => {
    const read = sightPaths(road, since, item(DIVE, dive, since));
    expect(read.map((path) => path.motion === "cross" && path.stopAfter !== null)).toEqual([stops]);
  });
});
