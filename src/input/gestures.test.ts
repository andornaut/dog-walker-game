import { describe, expect, it } from "vitest";

import { screenLayout } from "../layout/screenLayout";
import {
  advanceGesture,
  type GestureAction,
  type GestureContext,
  type GestureResult,
  type GestureState,
  idleGesture,
  pointerDown,
  pointerMove,
  pointerUp,
} from "./gestures";

// Dog column x 0-80 with slot bands at y 40-240, 240-440 and 440-640; road x 80-360.
const layout = screenLayout({
  dogColumnWidth: 80,
  dogSlotCount: 3,
  dogSlotPadding: 4,
  height: 640,
  topBarHeight: 40,
  width: 360,
});
const config = { holdDelayMs: 300, holdRepeatMs: 150, swipeMinDistance: 40, tapMaxDistance: 10 };
const context: GestureContext = { config, layout };

type Step = ["down" | "move" | "up", number, number, number] | ["tick", number];

// Feeds the steps in order and returns the actions each one emitted.
function play(steps: Step[], gestureContext = context): GestureAction[][] {
  let state: GestureState = idleGesture;
  return steps.map((step) => {
    let result: GestureResult;
    if (step[0] === "tick") {
      result = advanceGesture(gestureContext, step[1], state);
    } else {
      const [kind, x, y, timeMs] = step;
      const handler = { down: pointerDown, move: pointerMove, up: pointerUp }[kind];
      result = handler(gestureContext, { timeMs, x, y }, state);
    }
    state = result.state;
    return result.actions;
  });
}

const all = (steps: Step[], gestureContext = context) => play(steps, gestureContext).flat();
const tap = (x: number, y: number): Step[] => [
  ["down", x, y, 0],
  ["up", x + 2, y + 1, 100],
];
const left: GestureAction = { direction: -1, kind: "move" };
const right: GestureAction = { direction: 1, kind: "move" };

describe("taps", () => {
  it("moves one lane toward the half of the road that was tapped", () => {
    expect(all(tap(150, 300))).toEqual([left]);
    expect(all(tap(300, 300))).toEqual([right]);
  });

  it("splits the halves at the road's centre", () => {
    expect(all(tap(217, 300))).toEqual([left]);
    expect(all(tap(220, 300))).toEqual([right]);
  });

  it("acts on release, not on press", () => {
    expect(play(tap(150, 300))).toEqual([[], [left]]);
  });

  it("gives a treat to the dog slot under a tap in the dog column, without moving", () => {
    expect(all(tap(40, 100))).toEqual([{ kind: "treat", slot: 0 }]);
    expect(all(tap(40, 300))).toEqual([{ kind: "treat", slot: 1 }]);
    expect(all(tap(40, 600))).toEqual([{ kind: "treat", slot: 2 }]);
  });

  it("counts the padding between slots as the slot whose band it is in", () => {
    expect(all(tap(2, 241))).toEqual([{ kind: "treat", slot: 1 }]);
    expect(all(tap(2, 237))).toEqual([{ kind: "treat", slot: 0 }]);
  });

  it("gives a treat however long the dog column is held", () => {
    const steps: Step[] = [
      ["down", 40, 300, 0],
      ["tick", 2000],
      ["up", 40, 300, 2100],
    ];
    expect(all(steps)).toEqual([{ kind: "treat", slot: 1 }]);
  });
});

describe("swipes", () => {
  it("moves once as soon as a horizontal swipe passes the minimum distance", () => {
    const steps: Step[] = [
      ["down", 150, 300, 0],
      ["move", 189, 300, 20],
      ["move", 190, 305, 30],
      ["up", 190, 305, 40],
    ];
    expect(play(steps)).toEqual([[], [], [right], []]);
  });

  it("does not also count as a tap on the half where it started", () => {
    expect(
      all([
        ["down", 300, 300, 0],
        ["move", 250, 300, 30],
        ["up", 250, 300, 40],
      ]),
    ).toEqual([left]);
  });

  it("moves only one lane however far it goes", () => {
    const steps: Step[] = [
      ["down", 100, 300, 0],
      ["move", 150, 300, 10],
      ["move", 250, 300, 20],
      ["up", 340, 300, 30],
    ];
    expect(all(steps)).toEqual([right]);
  });

  it("is recognised on release when no move came in between", () => {
    expect(
      all([
        ["down", 150, 300, 0],
        ["up", 200, 300, 80],
      ]),
    ).toEqual([right]);
  });

  it("ignores a mostly vertical drag", () => {
    expect(
      all([
        ["down", 150, 300, 0],
        ["move", 190, 400, 30],
        ["up", 190, 400, 40],
      ]),
    ).toEqual([]);
  });

  it("cancels the tap when the finger drifts past the tap distance without swiping", () => {
    expect(
      all([
        ["down", 150, 300, 0],
        ["move", 170, 300, 30],
        ["up", 170, 300, 40],
      ]),
    ).toEqual([]);
  });

  it("still swipes after drifting past the tap distance", () => {
    expect(
      all([
        ["down", 150, 300, 0],
        ["move", 165, 300, 30],
        ["move", 110, 300, 60],
      ]),
    ).toEqual([left]);
  });
});

describe("holds", () => {
  it("moves after the hold delay, then again at each repeat interval", () => {
    const steps: Step[] = [
      ["down", 150, 300, 0],
      ["tick", 299],
      ["tick", 300],
      ["tick", 449],
      ["tick", 450],
      ["tick", 760],
      ["up", 150, 300, 800],
    ];
    expect(play(steps)).toEqual([[], [], [left], [], [left], [left, left], []]);
  });

  it("moves once in total when released at the hold delay", () => {
    expect(
      all([
        ["down", 300, 300, 0],
        ["up", 300, 300, 300],
      ]),
    ).toEqual([right]);
  });

  it("emits the hold moves due before a late release, and no tap", () => {
    expect(
      all([
        ["down", 300, 300, 0],
        ["up", 300, 300, 500],
      ]),
    ).toEqual([right, right]);
  });

  it("does not turn into a swipe once the hold has started", () => {
    const steps: Step[] = [
      ["down", 150, 300, 0],
      ["tick", 300],
      ["move", 250, 300, 320],
      ["up", 250, 300, 340],
    ];
    expect(all(steps)).toEqual([left]);
  });

  it("does not start once the finger has drifted past the tap distance", () => {
    expect(
      all([
        ["down", 150, 300, 0],
        ["move", 170, 300, 50],
        ["tick", 1000],
      ]),
    ).toEqual([]);
  });

  it("moves once and never repeats when the repeat interval is zero", () => {
    const noRepeat = { config: { ...config, holdRepeatMs: 0 }, layout };
    expect(
      all(
        [
          ["down", 150, 300, 0],
          ["tick", 5000],
        ],
        noRepeat,
      ),
    ).toEqual([left]);
  });
});
