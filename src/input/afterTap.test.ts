import { describe, expect, it } from "vitest";

import { type TapBurstWatch, tapGate, type TapGateOutcome } from "./afterTap";

// A scene whose tap burst runs while running is true; end() ends it.
function fakeScene(running: boolean, stays: boolean) {
  let playing = running;
  let ended: (() => void) | undefined;
  const watch: TapBurstWatch = {
    awaitBurst: (then) => {
      if (playing) {
        ended = then;
      }
      return playing;
    },
    stayed: () => stays,
  };
  return {
    end: () => {
      playing = false;
      ended?.();
      ended = undefined;
    },
    watch,
  };
}

describe("an open asked for by a tap", () => {
  // running: a tap burst plays as the opens are asked for (none with reduced motion skipping
  // it, or for a key or a hold that outlasts it). stays: the scene keeps running until the
  // burst ends. opens: how many opens are asked for before it ends.
  it.each([
    ["opens at once with no burst running", false, true, 1, ["opened"], 1, 1],
    ["waits for the running burst to end", true, true, 1, ["waiting"], 0, 1],
    ["drops a second open asked for during the wait", true, true, 2, ["waiting", "dropped"], 0, 1],
    ["is dropped when the scene stops running during the wait", true, false, 1, ["waiting"], 0, 0],
  ] satisfies readonly [string, boolean, boolean, number, TapGateOutcome[], number, number][])(
    "%s",
    (_, running, stays, opens, outcomes, openedDuring, openedAfter) => {
      const gate = tapGate();
      const scene = fakeScene(running, stays);
      let opened = 0;
      const asked = Array.from({ length: opens }, () => gate(scene.watch, () => (opened += 1)));
      expect(asked).toEqual(outcomes);
      expect(opened).toBe(openedDuring);
      scene.end();
      expect(opened).toBe(openedAfter);
      // Once the burst has ended, opened or dropped, the next open goes through at once.
      expect(gate(scene.watch, () => (opened += 1))).toBe("opened");
    },
  );
});
