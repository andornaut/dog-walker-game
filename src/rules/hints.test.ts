import { describe, expect, it } from "vitest";

import { HINTS } from "../data/hints";
import type { HintId } from "../data/types";
import { hintFor } from "./hints";

const data = { hints: HINTS };

describe("hintFor", () => {
  it.each<[string, HintId[], Parameters<typeof hintFor>[2], HintId | null]>([
    ["the hint for a matching event", [], { kind: "tip" }, "tip"],
    ["the hint for a matching encounter", [], { encounter: "puddle", kind: "encounter" }, "puddle"],
    ["nothing for a hint already shown", ["tip"], { kind: "tip" }, null],
    ["nothing for an event no hint waits for", [], { encounter: "thief", kind: "encounter" }, null],
  ])("returns %s", (_, shown, event, id) => {
    expect(hintFor(data, shown, event)).toEqual(id === null ? null : { id, text: HINTS[id].text });
  });
});
