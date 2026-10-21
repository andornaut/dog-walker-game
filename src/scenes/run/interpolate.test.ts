import { describe, expect, it } from "vitest";

import { gameData } from "../../data";
import { LANE_COUNT } from "../../data/screen";
import { pixels } from "../../rules/units";
import { STEP_SECONDS } from "../../runner/fixedStep";
import type { LaneMotion } from "../../runner/laneMotion";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import {
  runStreams,
  type Session,
  type SessionInput,
  startSession,
  stepSession,
} from "../../runner/session";
import { laneMoveSeconds, startRoad, type Walk, type WalkItem } from "../../runner/walk";
import { newRun } from "../../state/runState";
import { blendWalk, leadWalk, stepAlpha } from "./interpolate";

const STEP_MS = STEP_SECONDS * 1000;
const RUN = newRun(gameData, 3, { dogs: ["koda"], gear: null, walker: "casey" });
const ROAD = startRoad(5);
const MOVE = laneMoveSeconds(gameData, RUN);

function item(id: number, y: number): WalkItem {
  return { height: 10, id, kind: "cone", lane: 1, laneSpan: 1, y } as WalkItem;
}

function walk(zoneDistance: number, items: WalkItem[], motion: LaneMotion, zoneIndex = 0): Walk {
  return {
    road: { ...ROAD, control: { ...ROAD.control, motion, target: target(motion) }, items },
    run: { ...RUN, zoneDistance: pixels(zoneDistance), zoneIndex },
  };
}

const target = (motion: LaneMotion): number => (motion.kind === "still" ? motion.lane : motion.to);
const still: LaneMotion = { kind: "still", lane: 2 };
const moving = (elapsed: number, from = 2, to = 3, duration = 1): LaneMotion => ({
  duration,
  elapsed,
  from,
  kind: "moving",
  to,
});
const right: SessionInput = { direction: 1, kind: "lane" };
const left: SessionInput = { direction: -1, kind: "lane" };

describe("stepAlpha", () => {
  it.each([
    { alpha: 0, banked: 0 },
    { alpha: 0.25, banked: STEP_MS / 4 },
    { alpha: 0.5, banked: STEP_MS / 2 },
    { alpha: 1, banked: STEP_MS },
    { alpha: 0, banked: -1 },
    { alpha: 1, banked: 2 * STEP_MS },
  ])("is $alpha with $banked ms banked", ({ alpha, banked }) => {
    expect(stepAlpha(banked, STEP_MS)).toBeCloseTo(alpha);
  });
});

describe("blendWalk", () => {
  const previous = walk(100, [item(1, 20), item(2, 50)], moving(0.2));
  const current = walk(104, [item(1, 24), item(3, 0)], moving(0.3));

  it.each([0, 0.25, 0.5, 0.75])("blends scroll and items at %d", (alpha) => {
    const blended = blendWalk(alpha, previous, current);
    expect(blended.run.zoneDistance).toBeCloseTo(100 + 4 * alpha);
    expect(blended.road.items.map(({ id, y }) => ({ id, y }))).toEqual([
      { id: 1, y: 20 + 4 * alpha },
      { id: 3, y: 0 },
    ]);
  });

  it.each([
    { from: moving(0.2), name: "a move under way", to: moving(0.3) },
    { from: still, name: "a move that starts", to: moving(0) },
    { from: moving(0.9), name: "a move that ends", to: still },
  ])("draws the newer step's lane control for $name", ({ from, to }) => {
    const next = walk(104, [], to);
    expect(blendWalk(0.5, walk(100, [], from), next).road.control).toBe(next.road.control);
  });

  it.each([
    { alpha: 0.5, name: "across a zone change", next: walk(4, [item(1, 24)], moving(0.3), 1) },
    { alpha: 1, name: "at the newer step", next: current },
  ])("draws the newer step as it is $name", ({ alpha, next }) => {
    expect(blendWalk(alpha, previous, next)).toBe(next);
  });
});

describe("leadWalk", () => {
  // The pack's lane motion drawn for a walk, the inputs queued for its next step and the
  // seconds banked toward that step.
  it.each<{
    expected: LaneMotion;
    motion: LaneMotion;
    name: string;
    queued: SessionInput[];
    seconds: number;
  }>([
    {
      expected: still,
      motion: still,
      name: "a still pack with nothing queued",
      queued: [],
      seconds: 0.01,
    },
    {
      expected: moving(0, 2, 3, MOVE),
      motion: still,
      name: "a queued move, before any time is banked",
      queued: [right],
      seconds: 0,
    },
    {
      expected: moving(0.01, 2, 3, MOVE),
      motion: still,
      name: "a queued move, advanced by the banked time",
      queued: [right],
      seconds: 0.01,
    },
    {
      expected: moving(0.01, 2, 1, MOVE),
      motion: still,
      name: "two queued moves that cancel out, the second turning the first around",
      queued: [left, right, left],
      seconds: 0.01,
    },
    {
      expected: moving(0.11, 2, 3, MOVE),
      motion: moving(0.1, 2, 3, MOVE),
      name: "a move under way, advanced by the banked time",
      queued: [],
      seconds: 0.01,
    },
    {
      expected: moving(MOVE - 0.09, 3, 2, MOVE),
      motion: moving(0.1, 2, 3, MOVE),
      name: "a move turned around by a queued move back",
      queued: [left],
      seconds: 0.01,
    },
  ])("leads $name", ({ expected, motion, queued, seconds }) => {
    const drawn = leadWalk(gameData, 5, seconds, queued, walk(0, [], motion)).road.control.motion;
    const near = (lane: LaneMotion) =>
      lane.kind === "moving" ? { ...lane, elapsed: expect.closeTo(lane.elapsed, 6) } : lane;
    expect(drawn).toEqual(near(expected));
  });

  it("holds the pack and drops the queue through a hit stop, as the step does", () => {
    const stopped = walk(0, [], still);
    const held = {
      ...stopped,
      road: {
        ...stopped.road,
        hitStop: { cards: [], firing: false, seconds: 1, zoneEnded: false },
      },
    };
    expect(leadWalk(gameData, 5, 0.01, [right], held)).toBe(held);
  });

  // A started walk stepped `steps` times with a move right on the first step, so a lane move
  // may be under way.
  function steppedSession(steps: number): Session {
    const streams = runStreams(3);
    let session = startSession(gameData, streams, screenRoadGeometry, {
      road: startRoad(LANE_COUNT),
      run: RUN,
    });
    for (let step = 0; step < steps; step++) {
      const inputs = step === 0 ? [right] : [];
      session = stepSession(
        gameData,
        streams,
        screenRoadGeometry,
        STEP_SECONDS,
        inputs,
        session,
      ).session;
    }
    return session;
  }

  // A full step's lead is the control the step itself reaches, for the same queued inputs.
  it.each<{ queued: SessionInput[]; steps: number }>([
    { queued: [], steps: 0 },
    { queued: [right], steps: 0 },
    { queued: [right, right], steps: 0 },
    { queued: [left, right], steps: 0 },
    { queued: [], steps: 5 },
    { queued: [left], steps: 5 },
    { queued: [right], steps: 5 },
    { queued: [], steps: 11 },
  ])(
    "leads to the control the step reaches for $queued after $steps steps",
    ({ queued, steps }) => {
      const session = steppedSession(steps);
      const stepped = stepSession(
        gameData,
        runStreams(3),
        screenRoadGeometry,
        STEP_SECONDS,
        queued,
        session,
      );
      const lead = leadWalk(gameData, LANE_COUNT, STEP_SECONDS, queued, session.walk);
      expect(lead.road.control).toEqual(stepped.session.walk.road.control);
    },
  );
});
