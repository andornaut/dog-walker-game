import { describe, expect, it } from "vitest";

import { type ScreenConfig, screenLayout } from "../layout/screenLayout";
import {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  pullLane,
  steerLane,
} from "../runner/laneControl";
import { destinationLane, stillInLane } from "../runner/laneMotion";
import {
  type GestureAction,
  type GestureContext,
  type GestureResult,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
  reanchorDrag,
} from "./gestures";

// Road y 40-470 with its lanes at x 40-320, so five lanes are 56px wide and the centre is
// x 180; doghouses x 0-120, 120-240 and 240-360 at y 470-560.
const screen: ScreenConfig = {
  backdropHeight: 0,
  dogRowHeight: 90,
  dogSlotCount: 3,
  height: 560,
  roadIntoBand: 0,
  roadWidth: 280,
  topBarHeight: 40,
  width: 360,
};
const context: GestureContext = {
  config: { laneCount: 5, tapMaxDistance: 10 },
  layout: screenLayout(screen),
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
const left: GestureAction = { direction: -1, kind: "move" };
const right: GestureAction = { direction: 1, kind: "move" };
const treat = (slot: number): GestureAction => ({ kind: "treat", slot });
const pause: GestureAction = { kind: "pause" };

describe("pointer sequences", () => {
  // The actions each step emits, from the press to the release.
  it.each<{ expected: GestureAction[][]; name: string; steps: Step[] }>([
    {
      expected: [[], [], [right], [], [right], []],
      name: "steps one lane per lane-width of horizontal travel from where the drag started",
      steps: [
        ["down", 150, 300],
        ["move", 205, 300],
        ["move", 206, 300],
        ["move", 261, 300],
        ["move", 262, 300],
        ["up", 262, 300],
      ],
    },
    {
      expected: [[], [right, right, right]],
      name: "emits one move per lane boundary crossed in a single move",
      steps: [
        ["down", 100, 300],
        ["move", 270, 300],
      ],
    },
    {
      expected: [[], [], [left, left]],
      name: "steps left the same way",
      steps: [
        ["down", 300, 300],
        ["move", 245, 300],
        ["move", 187, 300],
      ],
    },
    {
      expected: [[], [right, right], [], [left, left], [left]],
      name: "undoes a step for each lane-width travelled back",
      steps: [
        ["down", 100, 300],
        ["move", 240, 300],
        ["move", 230, 300],
        ["move", 100, 300],
        ["move", 40, 300],
      ],
    },
    { expected: [[], [left]], name: "taps on release, not on press", steps: tap(150, 300) },
    {
      expected: [[], [], []],
      name: "never drags from the top bar, nor pauses once past the tap distance",
      steps: [
        ["down", 100, 20],
        ["move", 300, 25],
        ["up", 300, 25],
      ],
    },
  ])("$name", ({ expected, steps }) => {
    expect(play(steps)).toEqual(expected);
  });

  // Every action the sequence emits, in order.
  it.each<{ expected: GestureAction[]; name: string; steps: Step[] }>([
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
        ["move", 210, 500],
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
      name: "is nothing past the tap distance short of a lane step",
      steps: [
        ["down", 150, 300],
        ["move", 156, 309],
        ["up", 156, 309],
      ],
    },
    {
      expected: [],
      name: "stays cancelled after drifting back within the tap distance",
      steps: [
        ["down", 150, 300],
        ["move", 190, 300],
        ["up", 150, 300],
      ],
    },
    {
      expected: [right, left],
      name: "does not also tap after a drag that came back to where it started",
      steps: [
        ["down", 150, 300],
        ["move", 210, 300],
        ["up", 150, 300],
      ],
    },
    {
      expected: [right],
      name: "drags instead of giving a treat once a doghouse press travels a lane-width",
      steps: [
        ["down", 40, 500],
        ["move", 96, 500],
        ["up", 96, 500],
      ],
    },
    {
      expected: [],
      name: "gives nothing for a doghouse press that leaves the tap distance short of a lane-width",
      steps: [
        ["down", 40, 500],
        ["move", 95, 500],
        ["up", 95, 500],
      ],
    },
    { expected: [pause], name: "pauses on a tap anywhere across the top bar", steps: tap(300, 5) },
  ])("$name", ({ expected, steps }) => {
    expect(all(steps)).toEqual(expected);
  });

  it("derives the step from the road width, so a wider road needs a longer drag", () => {
    // Lanes x 0-360, so five lanes are 72px wide.
    const wide = { ...context, layout: screenLayout({ ...screen, roadWidth: 360 }) };
    const drag: Step[] = [
      ["down", 150, 300],
      ["move", 210, 300],
      ["move", 222, 300],
    ];
    expect(play(drag)).toEqual([[], [right], []]);
    expect(play(drag, wide)).toEqual([[], [], [right]]);
  });
});

describe("tap regions", () => {
  // A tap on each side of a boundary between the screen's regions.
  it.each<[string, [number, number], GestureAction, [number, number], GestureAction]>([
    ["the road's halves at x 180", [177, 300], left, [180, 300], right],
    ["doghouse slots 0 and 1 at x 120", [117, 480], treat(0), [120, 480], treat(1)],
    ["doghouse slots 1 and 2 at x 240", [237, 480], treat(1), [240, 480], treat(2)],
    ["the road and the doghouses at y 470", [60, 468], left, [60, 470], treat(0)],
    ["the top bar and the road at y 40", [60, 38], pause, [60, 40], left],
  ])("splits %s", (_name, [beforeX, beforeY], beforeAction, [afterX, afterY], afterAction) => {
    expect([all(tap(beforeX, beforeY)), all(tap(afterX, afterY))]).toEqual([
      [beforeAction],
      [afterAction],
    ]);
  });
});

describe("drag symmetry", () => {
  // Road centre is x 180; one lane-width is 56px.
  const anchors = [110, 250];
  const cases: [number, number][] = [
    [0.9, 0],
    [1.0, 1],
    [1.9, 1],
    [2.0, 2],
    [3.0, 3],
  ];

  it.each(anchors)("steps the same number of lanes left and right from x %i", (anchorX) => {
    for (const [widths, lanes] of cases) {
      const drag = (sign: number) =>
        all([
          ["down", anchorX, 300],
          ["move", anchorX + sign * widths * 56, 300],
          ["up", anchorX + sign * widths * 56, 300],
        ]);
      expect(drag(1)).toEqual(Array<GestureAction>(lanes).fill(right));
      expect(drag(-1)).toEqual(Array<GestureAction>(lanes).fill(left));
    }
  });

  // Positions from a headless 390px-wide touch drag of exactly 56px each way: float32 touch
  // coordinates put the anchor 1e-5px low, so the left drag reads as 55.99999px.
  it("steps a whole lane-width either way despite float error in the pointer position", () => {
    const anchorX = 289.99999060997595;
    const drag = (x: number) =>
      all([
        ["down", anchorX, 300],
        ["move", x, 300],
        ["up", x, 300],
      ]);
    expect(drag(234)).toEqual([left]);
    expect(drag(346.00000939002405)).toEqual([right]);
  });
});

describe("reanchorDrag", () => {
  it("counts lane steps again from the pointer's position when the pull came", () => {
    const { state } = run([
      ["down", 150, 300],
      ["move", 200, 300],
    ]);
    const reanchored = reanchorDrag(state);
    expect(pointerMove(context, { x: 210, y: 300 }, state).actions).toEqual([right]);
    expect(pointerMove(context, { x: 210, y: 300 }, reanchored).actions).toEqual([]);
    expect(pointerMove(context, { x: 256, y: 300 }, reanchored).actions).toEqual([right]);
  });

  it("counts travel back from the new anchor, not the old one", () => {
    const { state } = run([
      ["down", 150, 300],
      ["move", 270, 300],
    ]);
    expect(pointerMove(context, { x: 150, y: 300 }, reanchorDrag(state)).actions).toEqual([
      left,
      left,
    ]);
  });

  it("leaves a press that is not a drag as it was", () => {
    const { state } = run([["down", 100, 20]]);
    expect(reanchorDrag(state)).toBe(state);
    expect(reanchorDrag(idleGesture)).toBe(idleGesture);
  });
});

describe("drags during a pull's input lock", () => {
  const laneConfig = { laneCount: 5, moveDuration: 0.2 };
  const steer = (actions: GestureAction[], control: LaneControl) =>
    actions.reduce(
      (current, action) =>
        action.kind === "move" ? steerLane(laneConfig, action.direction, current) : current,
      control,
    );

  it("drops steps taken while locked instead of applying them once the lock ends", () => {
    let { state: gesture } = run([
      ["down", 200, 300],
      ["move", 230, 300],
    ]);
    let control = pullLane(laneConfig, 0.5, 1, laneControlIn(stillInLane(2)));
    gesture = reanchorDrag(gesture);
    control = advanceLaneControl(laneConfig, 0.2, control);

    const locked = pointerMove(context, { x: 170, y: 300 }, gesture);
    expect(locked.actions).toEqual([left]);
    control = advanceLaneControl(laneConfig, 0.6, steer(locked.actions, control));
    expect(destinationLane(control.motion)).toBe(3);

    const unlocked = pointerMove(context, { x: 110, y: 300 }, locked.state);
    control = steer(unlocked.actions, control);
    expect(destinationLane(control.motion)).toBe(2);
  });
});
