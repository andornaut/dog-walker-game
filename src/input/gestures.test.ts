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

// Dog column x 0-80 with slot bands at y 40-240, 240-440 and 440-640; road x 80-360, so
// five lanes are 56px wide.
const screen: ScreenConfig = {
  backdropHeight: 0,
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
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

describe("drags", () => {
  it("steps one lane per lane-width of horizontal travel from where the drag started", () => {
    const steps: Step[] = [
      ["down", 150, 300],
      ["move", 205, 300],
      ["move", 206, 300],
      ["move", 261, 300],
      ["move", 262, 300],
      ["up", 262, 300],
    ];
    expect(play(steps)).toEqual([[], [], [right], [], [right], []]);
  });

  it("emits one move per lane boundary crossed in a single move", () => {
    expect(
      play([
        ["down", 100, 300],
        ["move", 270, 300],
      ]),
    ).toEqual([[], [right, right, right]]);
  });

  it("steps left the same way", () => {
    expect(
      play([
        ["down", 300, 300],
        ["move", 245, 300],
        ["move", 187, 300],
      ]),
    ).toEqual([[], [], [left, left]]);
  });

  it("undoes a step for each lane-width travelled back", () => {
    const steps: Step[] = [
      ["down", 100, 300],
      ["move", 240, 300],
      ["move", 230, 300],
      ["move", 100, 300],
      ["move", 40, 300],
    ];
    expect(play(steps)).toEqual([[], [right, right], [], [left, left], [left]]);
  });

  it("ignores vertical travel", () => {
    expect(
      all([
        ["down", 150, 100],
        ["move", 150, 600],
        ["move", 160, 50],
        ["up", 160, 600],
      ]),
    ).toEqual([]);
  });

  it("steps by horizontal travel alone during a diagonal drag", () => {
    expect(
      all([
        ["down", 150, 100],
        ["move", 210, 500],
      ]),
    ).toEqual([right]);
  });

  it("derives the step from the road width, so a wider road needs a longer drag", () => {
    // Road x 80-440, so five lanes are 72px wide.
    const wide = { ...context, layout: screenLayout({ ...screen, width: 440 }) };
    const drag: Step[] = [
      ["down", 150, 300],
      ["move", 210, 300],
      ["move", 222, 300],
    ];
    expect(play(drag)).toEqual([[], [right], []]);
    expect(play(drag, wide)).toEqual([[], [], [right]]);
  });
});

describe("drag symmetry", () => {
  // Road centre is x 220; one lane-width is 56px.
  const anchors = [150, 290];
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

describe("taps", () => {
  it("splits the halves at the road's centre", () => {
    expect(all(tap(217, 300))).toEqual([left]);
    expect(all(tap(220, 300))).toEqual([right]);
  });

  it("acts on release, not on press", () => {
    expect(play(tap(150, 300))).toEqual([[], [left]]);
  });

  it("is a tap up to the tap distance, and nothing past it short of a lane step", () => {
    const within: Step[] = [
      ["down", 150, 300],
      ["move", 156, 308],
      ["up", 156, 308],
    ];
    const past: Step[] = [
      ["down", 150, 300],
      ["move", 156, 309],
      ["up", 156, 309],
    ];
    expect(all(within)).toEqual([left]);
    expect(all(past)).toEqual([]);
  });

  it("stays cancelled after drifting back within the tap distance", () => {
    expect(
      all([
        ["down", 150, 300],
        ["move", 190, 300],
        ["up", 150, 300],
      ]),
    ).toEqual([]);
  });

  it("does not also tap after a drag that came back to where it started", () => {
    expect(
      all([
        ["down", 150, 300],
        ["move", 210, 300],
        ["up", 150, 300],
      ]),
    ).toEqual([right, left]);
  });
});

describe("the dog column", () => {
  it("gives a treat to the dog slot under a tap, without moving", () => {
    expect(all(tap(40, 100))).toEqual([{ kind: "treat", slot: 0 }]);
    expect(all(tap(40, 300))).toEqual([{ kind: "treat", slot: 1 }]);
    expect(all(tap(40, 600))).toEqual([{ kind: "treat", slot: 2 }]);
  });

  it("counts the padding between slots as the slot whose band it is in", () => {
    expect(all(tap(2, 241))).toEqual([{ kind: "treat", slot: 1 }]);
    expect(all(tap(2, 237))).toEqual([{ kind: "treat", slot: 0 }]);
  });

  it("ends where the road begins, at x 80", () => {
    expect(all(tap(78, 300))).toEqual([{ kind: "treat", slot: 1 }]);
    expect(all(tap(80, 300))).toEqual([left]);
  });

  it("drags instead of giving a treat once a press there travels a lane-width", () => {
    expect(
      all([
        ["down", 40, 300],
        ["move", 96, 300],
        ["up", 96, 300],
      ]),
    ).toEqual([right]);
  });

  it("gives nothing for a press that leaves the tap distance short of a lane-width", () => {
    expect(
      all([
        ["down", 40, 300],
        ["move", 95, 300],
        ["up", 95, 300],
      ]),
    ).toEqual([]);
  });
});

describe("the top bar", () => {
  it("pauses on a tap anywhere across it, without moving", () => {
    expect(all(tap(40, 20))).toEqual([{ kind: "pause" }]);
    expect(all(tap(300, 5))).toEqual([{ kind: "pause" }]);
  });

  it("never drags, and a press that leaves the tap distance does not pause", () => {
    expect(
      play([
        ["down", 100, 20],
        ["move", 300, 25],
        ["up", 300, 25],
      ]),
    ).toEqual([[], [], []]);
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
