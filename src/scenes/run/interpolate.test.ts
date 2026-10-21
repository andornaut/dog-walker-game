import { describe, expect, it } from "vitest";

import { gameData } from "../../data";
import { pixels } from "../../rules/units";
import { STEP_SECONDS } from "../../runner/fixedStep";
import type { LaneMotion } from "../../runner/laneMotion";
import { startRoad, type Walk, type WalkItem } from "../../runner/walk";
import { newRun } from "../../state/runState";
import { blendWalk, stepAlpha } from "./interpolate";

const STEP_MS = STEP_SECONDS * 1000;
const RUN = newRun(gameData, 3, { dogs: ["koda"], gear: null, walker: "casey" });
const ROAD = startRoad(5);

function item(id: number, y: number): WalkItem {
  return { height: 10, id, kind: "cone", lane: 1, laneSpan: 1, y } as WalkItem;
}

function walk(zoneDistance: number, items: WalkItem[], motion: LaneMotion, zoneIndex = 0): Walk {
  return {
    road: { ...ROAD, control: { ...ROAD.control, motion }, items },
    run: { ...RUN, zoneDistance: pixels(zoneDistance), zoneIndex },
  };
}

const still: LaneMotion = { kind: "still", lane: 2 };
const moving = (elapsed: number): LaneMotion => ({
  duration: 1,
  elapsed,
  from: 2,
  kind: "moving",
  to: 3,
});

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

  it.each([0, 0.25, 0.5, 0.75])("blends scroll, items and the move at %d", (alpha) => {
    const blended = blendWalk(alpha, previous, current);
    expect(blended.run.zoneDistance).toBeCloseTo(100 + 4 * alpha);
    expect(blended.road.items.map(({ id, y }) => ({ id, y }))).toEqual([
      { id: 1, y: 20 + 4 * alpha },
      { id: 3, y: 0 },
    ]);
    const motion = blended.road.control.motion;
    expect(motion.kind === "moving" ? motion.elapsed : null).toBeCloseTo(0.2 + 0.1 * alpha);
  });

  it.each([
    { alpha: 0.5, name: "across a zone change", next: walk(4, [item(1, 24)], moving(0.3), 1) },
    { alpha: 1, name: "at the newer step", next: current },
  ])("draws the newer step as it is $name", ({ alpha, next }) => {
    expect(blendWalk(alpha, previous, next)).toBe(next);
  });

  it.each([
    { from: still, name: "a move that starts", to: moving(0) },
    { from: moving(0.9), name: "a move that ends", to: still },
  ])("draws the newer step's lane motion for $name", ({ from, to }) => {
    const next = walk(104, [], to);
    expect(blendWalk(0.5, walk(100, [], from), next).road.control.motion).toBe(to);
  });
});
