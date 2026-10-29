import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { openGuard } from "./openGuard";

describe("an open guard", () => {
  // Each character of the script in order: an open asked of owner a or b, or a game step's
  // prestep (<) or poststep (>). Phaser applies queued scene operations between the two.
  it.each([
    ["opens at once", "a", [true]],
    ["drops a second open of one owner before the next step", "aa", [true, false]],
    ["guards each owner apart", "ab", [true, true]],
    ["opens again once a whole step has applied the queue", "a<>a", [true, true]],
    ["drops an open asked during the step that applies the queue", "a<a>", [true, false]],
    ["waits a whole step after an open asked mid-step", "<a>a<>a", [true, false, true]],
  ] satisfies readonly [string, string, boolean[]][])("%s", (_, script, outcomes) => {
    const guard = openGuard();
    const events = new EventEmitter();
    const owners = { a: {}, b: {} };
    const opened: boolean[] = [];
    let runs = 0;
    for (const step of script) {
      if (step === "<") {
        events.emit("prestep");
      } else if (step === ">") {
        events.emit("poststep");
      } else {
        const owner = step === "a" ? owners.a : owners.b;
        const before = runs;
        opened.push(guard(events, owner, () => (runs += 1)));
        // An open the guard lets through has run by the time it returns.
        expect(runs - before).toBe(opened.at(-1) === true ? 1 : 0);
      }
    }
    expect(opened).toEqual(outcomes);
  });
});
