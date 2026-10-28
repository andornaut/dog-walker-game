import { describe, expect, it } from "vitest";

import { HINTS } from "../data/hints";
import type { HintId } from "../data/types";
import { keysOf } from "../lib/records";
import { hintFor, hintJumpsQueue } from "./hints";

const data = { hints: HINTS };

describe("hintJumpsQueue", () => {
  const lowHearts = hintFor(data, [], { kind: "firedOwner" })?.id;

  it("jumps the queue only as the low-hearts hint", () => {
    for (const id of keysOf(HINTS)) {
      expect(hintJumpsQueue(data, id)).toBe(id === lowHearts);
    }
  });
});

describe("hintFor", () => {
  it("returns the next hint", () => {
    for (const [, shown, event, id] of [
      ["the hint for a matching event", [], { kind: "tip" }, "tip"],
      [
        "the hint for a matching encounter",
        [],
        { encounter: "puddle", kind: "encounter" },
        "puddle",
      ],
      ["nothing for a hint already shown", ["tip"], { kind: "tip" }, null],
      [
        "nothing for an event no hint waits for",
        [],
        { encounter: "thief", kind: "encounter" },
        null,
      ],
    ] satisfies readonly [string, HintId[], Parameters<typeof hintFor>[2], HintId | null][]) {
      expect(hintFor(data, shown, event)).toEqual(
        id === null ? null : { id, text: HINTS[id].text },
      );
    }
  });
});
