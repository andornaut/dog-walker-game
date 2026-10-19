import { describe, expect, it } from "vitest";

import { pressDown, pressUp, type TargetPressRule } from "./targetPress";

type Target = { kind: "close" } | { kind: "row"; row: number };

const CLOSE: Target = { kind: "close" };
const row = (n: number): Target => ({ kind: "row", row: n });
// Rows dip for 140ms; close acts at once.
const RULE: TargetPressRule<Target> = {
  dipMs: (target) => (target.kind === "row" ? 140 : 0),
  same: (a, b) =>
    a.kind === b.kind && (a.kind === "close" || (b.kind === "row" && a.row === b.row)),
};
const STARTED_MS = 1_000;

describe("a press on a target", () => {
  // delayMs: how long the tap waits before it acts, or undefined for no tap.
  it.each<[string, Target | undefined, Target | undefined, number, boolean, number | undefined]>([
    ["taps a target released over itself", CLOSE, CLOSE, 50, false, 0],
    ["waits out the rest of a quick tap's dip", row(1), row(1), 50, false, 90],
    ["acts at once on a tap held past its dip", row(1), row(1), 300, false, 0],
    ["taps nothing when released over another target", row(1), row(2), 50, false, undefined],
    ["taps nothing when released off every target", row(1), undefined, 50, false, undefined],
    ["taps nothing when it began off every target", undefined, row(1), 50, false, undefined],
    ["taps nothing when the browser cancels it", CLOSE, CLOSE, 50, true, undefined],
  ])("%s", (_, pressed, released, heldMs, cancelled, delayMs) => {
    const press = pressDown(STARTED_MS, pressed);
    expect(pressUp(RULE, STARTED_MS + heldMs, cancelled, press, released)).toEqual(
      delayMs === undefined ? { kind: "none" } : { delayMs, kind: "tap", target: pressed },
    );
  });
});
