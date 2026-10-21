import { describe, expect, it } from "vitest";

import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
import { advanceLaneControl, laneControlIn, steerLane } from "../runner/laneControl";
import { type LaneMotion, stillInLane } from "../runner/laneMotion";
import {
  type GestureAction,
  type GestureContext,
  type GestureResult,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "./gestures";

// Road y 40-470 with its lanes at x 40-320, so five lanes are 56px wide and the centre is
// x 180; dog cards x 0-120, 120-240 and 240-360 at y 470-560. A drag's first step is at 20px.
// A quiet rect, as a debuff bar is, at y 40-56.
const screen: ScreenConfig = {
  backdropHeight: 0,
  dogCardHeight: 90,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 0,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
};
const layout = screenLayout(screen);
const QUIET = { height: 16, width: 360, x: 0, y: 40 };
const context: GestureContext = {
  config: { laneCount: 5, swipeStartDistance: 20, tapMaxDistance: 10 },
  layout,
  quietTaps: [QUIET],
};

type Step = ["down" | "move" | "up", number, number];

// Feeds the steps in order from idle; returns the actions each emitted and the last state.
function run(
  steps: Step[],
  gestureContext = context,
): { actions: GestureAction[][]; state: GestureState } {
  let state: GestureState = idleGesture;
  const actions = steps.map(([kind, x, y]) => {
    const point = { x, y };
    const result: GestureResult =
      kind === "down"
        ? pointerDown(gestureContext, point)
        : { move: pointerMove, up: pointerUp }[kind](gestureContext, point, state);
    state = result.state;
    return result.actions;
  });
  return { actions, state };
}

const play = (steps: Step[], gestureContext = context) => run(steps, gestureContext).actions;
const all = (steps: Step[], gestureContext = context) => play(steps, gestureContext).flat();
const tap = (x: number, y: number): Step[] => [
  ["down", x, y],
  ["up", x + 2, y + 1],
];
// A press at fromX, moved to each x in turn on the same row.
const drag = (fromX: number, ...xs: number[]): Step[] => [
  ["down", fromX, 300],
  ...xs.map((x): Step => ["move", x, 300]),
];
const left: GestureAction = { direction: -1, kind: "move" };
const right: GestureAction = { direction: 1, kind: "move" };

describe("pointer sequences", () => {
  // The actions each step emits, from the press to the release.
  const perStep: { expected: GestureAction[][]; name: string; steps: Step[] }[] = [
    {
      expected: [[], [], [right], [], [], [right], []],
      name: "steps at the swipe start distance during the drag, then at two lane-widths",
      steps: [...drag(150, 169, 170, 205, 261, 262), ["up", 262, 300]],
    },
    {
      expected: [[], [right, right, right]],
      name: "emits every step a single move reaches",
      steps: drag(100, 270),
    },
    {
      expected: [[], [], [left], [left]],
      name: "steps left the same way",
      steps: drag(300, 281, 280, 187),
    },
    {
      expected: [[], [right, right], [], [left], [left], [left]],
      name: "turns around after travelling back the swipe start distance from the furthest point",
      steps: drag(100, 240, 230, 220, 100, 40),
    },
    {
      expected: [[], [right], [], [], [right]],
      name: "keeps stepping the same way after a wobble back short of the swipe start distance",
      steps: drag(100, 130, 115, 160, 212),
    },
    {
      expected: [[], [right], [left], [right]],
      name: "chains turns within one press",
      steps: drag(150, 175, 150, 175),
    },
    { expected: [[], [left]], name: "taps on release, not on press", steps: tap(150, 300) },
    {
      expected: [[], [], []],
      name: "never drags from the walk bar",
      steps: [
        ["down", 100, 20],
        ["move", 300, 25],
        ["up", 300, 25],
      ],
    },
  ];

  it("emits each step's moves as the drag reaches them, from the press to the release", () => {
    for (const { expected, name, steps } of perStep) {
      expect(play(steps), name).toEqual(expected);
    }
  });

  // Every action the sequence emits, in order.
  const sequences: { expected: GestureAction[]; name: string; steps: Step[] }[] = [
    {
      expected: [],
      name: "ignores vertical travel",
      steps: [
        ["down", 150, 100],
        ["move", 150, 600],
        ["move", 160, 50],
        ["up", 160, 600],
      ],
    },
    {
      expected: [right],
      name: "steps by horizontal travel alone during a diagonal drag",
      steps: [
        ["down", 150, 100],
        ["move", 175, 500],
      ],
    },
    {
      expected: [left],
      name: "is a tap up to the tap distance",
      steps: [
        ["down", 150, 300],
        ["move", 156, 308],
        ["up", 156, 308],
      ],
    },
    {
      expected: [],
      name: "is nothing past the tap distance short of the swipe start distance",
      steps: [
        ["down", 150, 300],
        ["move", 156, 309],
        ["up", 156, 309],
      ],
    },
    {
      expected: [],
      name: "stays cancelled after drifting back within the tap distance",
      steps: [...drag(150, 165), ["up", 150, 300]],
    },
    {
      expected: [right, left],
      name: "does not also tap after a drag that came back to where it started",
      steps: [...drag(150, 210), ["up", 150, 300]],
    },
    {
      expected: [right],
      name: "drags from a card press once it reaches the swipe start distance",
      steps: [
        ["down", 40, 500],
        ["move", 60, 500],
        ["up", 60, 500],
      ],
    },
    {
      expected: [],
      name: "does nothing for a card press that leaves the tap distance short of a step",
      steps: [
        ["down", 40, 500],
        ["move", 59, 500],
        ["up", 59, 500],
      ],
    },
    {
      expected: [],
      name: "does nothing on a tap anywhere across the walk bar",
      steps: tap(300, 5),
    },
    { expected: [], name: "does nothing on a tap on a quiet rect", steps: tap(100, 48) },
    {
      expected: [right],
      name: "steers on a drag that starts on a quiet rect",
      steps: [
        ["down", 100, 48],
        ["move", 120, 48],
        ["up", 120, 48],
      ],
    },
    { expected: [left], name: "steers on a tap on the cards' left half", steps: tap(100, 500) },
    {
      expected: [right],
      name: "steers on a tap on the cards' right half",
      steps: tap(260, 500),
    },
  ];

  it("taps, drags or does nothing by the press's place and travel", () => {
    for (const { expected, name, steps } of sequences) {
      expect(all(steps), name).toEqual(expected);
    }
  });

  it("derives the later steps from the road width, so a wider road needs a longer drag", () => {
    // Lanes x 0-360, so five lanes are 72px wide.
    const wide = { ...context, layout: screenLayout({ ...screen, roadWidth: 360 }) };
    const steps = drag(150, 170, 262, 294);
    expect(play(steps)).toEqual([[], [right], [right], []]);
    expect(play(steps, wide)).toEqual([[], [right], [], [right]]);
  });
});

describe("swipe start distance", () => {
  const startingAt = (swipeStartDistance: number): GestureContext => ({
    ...context,
    config: { ...context.config, swipeStartDistance },
  });

  // The steps a press emits after travelling right from x 100, by the configured distance.
  const rows = [
    { distance: 12, steps: 0, travel: 11 },
    { distance: 12, steps: 1, travel: 12 },
    { distance: 20, steps: 0, travel: 19.99 },
    { distance: 20, steps: 1, travel: 20 },
    { distance: 40, steps: 0, travel: 39 },
    { distance: 40, steps: 1, travel: 40 },
    { distance: 40, steps: 1, travel: 111 },
    { distance: 40, steps: 2, travel: 112 },
    // A start past a lane-width still steps once there, and on at whole lane-widths.
    { distance: 70, steps: 0, travel: 69 },
    { distance: 70, steps: 1, travel: 70 },
    { distance: 70, steps: 2, travel: 112 },
  ];

  it("steps first at the configured distance, then at whole lane-widths", () => {
    for (const row of rows) {
      const steps = all(drag(100, 100 + row.travel), startingAt(row.distance));
      expect(steps, JSON.stringify(row)).toEqual(Array<GestureAction>(row.steps).fill(right));
    }
  });

  it("turns a drag around at the configured distance back from its furthest point", () => {
    const distance = 40;
    const turned = play(drag(100, 160, 160 - distance + 1, 160 - distance), startingAt(distance));
    expect(turned).toEqual([[], [right], [], [left]]);
  });
});

describe("tap regions", () => {
  // A tap on each side of a boundary between the screen's regions.
  const boundaries: [
    string,
    [number, number],
    GestureAction[],
    [number, number],
    GestureAction[],
  ][] = [
    ["the road's halves at x 180", [177, 300], [left], [180, 300], [right]],
    ["nothing between the road and the cards at y 470", [60, 468], [left], [60, 470], [left]],
    ["the walk bar and a quiet rect at y 40", [60, 38], [], [60, 40], []],
    ["a quiet rect and the road at y 56", [60, 55], [], [60, 56], [left]],
  ];

  it("splits the screen's regions at their boundaries", () => {
    for (const [name, [beforeX, beforeY], before, [afterX, afterY], after] of boundaries) {
      expect([all(tap(beforeX, beforeY)), all(tap(afterX, afterY))], name).toEqual([before, after]);
    }
  });
});

describe("drag symmetry", () => {
  // Road centre is x 180; one lane-width is 56px.
  const anchors = [110, 250];
  const cases: [number, number][] = [
    [0.3, 0],
    [0.4, 1],
    [1.0, 1],
    [1.9, 1],
    [2.0, 2],
    [3.0, 3],
  ];

  it("steps the same number of lanes left and right", () => {
    for (const anchorX of anchors) {
      for (const [widths, lanes] of cases) {
        const lanesBy = (sign: number) =>
          all([
            ...drag(anchorX, anchorX + sign * widths * 56),
            ["up", anchorX + sign * widths * 56, 300],
          ]);
        expect(lanesBy(1)).toEqual(Array<GestureAction>(lanes).fill(right));
        expect(lanesBy(-1)).toEqual(Array<GestureAction>(lanes).fill(left));
      }
    }
  });

  // Positions from a headless 390px-wide touch drag: float32 touch coordinates put the anchor
  // 1e-5px low, so a drag of exactly two lane-widths left reads as 111.99999px.
  it("steps whole lane-widths either way despite float error in the pointer position", () => {
    const anchorX = 289.99999060997595;
    const lanesTo = (x: number) => all([...drag(anchorX, x), ["up", x, 300]]);
    expect(lanesTo(178)).toEqual([left, left]);
    expect(lanesTo(402.00000939002405)).toEqual([right, right]);
  });
});

describe("drags over time", () => {
  // A drag's samples, each at a time in seconds, steering a still pack in lane 2 as the walk
  // does: the moves each sample emits steer, then the lane control runs to the next sample.
  const laneConfig = { laneCount: 5, moveDuration: 0.18 };
  type Sample = [seconds: number, x: number];

  function steerBy(samples: readonly Sample[]): LaneMotion[] {
    let gesture = pointerDown(context, { x: 150, y: 300 }).state;
    let control = laneControlIn(stillInLane(2));
    let time = 0;
    const motions: LaneMotion[] = [];
    for (const [seconds, x] of samples) {
      control = advanceLaneControl(laneConfig, seconds - time, control);
      time = seconds;
      const result = pointerMove(context, { x, y: 300 }, gesture);
      gesture = result.state;
      control = result.actions.reduce(
        (current, action) =>
          action.kind === "move" ? steerLane(laneConfig, action.direction, current) : current,
        control,
      );
      motions.push(control.motion);
    }
    return motions;
  }

  const drags: { motions: LaneMotion[]; name: string; samples: Sample[] }[] = [
    {
      motions: [stillInLane(2), { duration: 0.18, elapsed: 0, from: 2, kind: "moving", to: 3 }],
      name: "sets the pack moving on the sample that passes the swipe start distance",
      samples: [
        [0.016, 160],
        [0.033, 170],
      ],
    },
    {
      motions: [
        { duration: 0.18, elapsed: 0, from: 2, kind: "moving", to: 3 },
        { duration: 0.18, elapsed: 0.05, from: 2, kind: "moving", to: 3 },
        { duration: 0.18, elapsed: 0.02, from: 3, kind: "moving", to: 4 },
      ],
      name: "buffers a step taken mid-move and sets off for it on arrival",
      samples: [
        [0, 175],
        [0.05, 262],
        [0.2, 262],
      ],
    },
    {
      motions: [
        { duration: 0.18, elapsed: 0, from: 2, kind: "moving", to: 3 },
        { duration: 0.18, elapsed: 0.13, from: 3, kind: "moving", to: 2 },
      ],
      name: "turns the pack around mid-move when the drag turns back",
      samples: [
        [0, 175],
        [0.05, 150],
      ],
    },
  ];

  it("moves the pack as the drag's samples step, buffering and turning mid-move", () => {
    // Elapsed seconds to a microsecond, as the samples add float seconds.
    const near = (motion: LaneMotion) =>
      motion.kind === "moving" ? { ...motion, elapsed: expect.closeTo(motion.elapsed, 6) } : motion;
    for (const { motions, name, samples } of drags) {
      expect(steerBy(samples), name).toEqual(motions.map(near));
    }
  });
});
