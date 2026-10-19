import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs";
import { HINTS } from "../data/hints";
import type { DebuffId, HintId } from "../data/types";
import { hintFor } from "./hints";

const data = { hints: HINTS };

describe("hintFor", () => {
  it.each<[string, HintId[], Parameters<typeof hintFor>[2], HintId | null]>([
    ["the hint for a matching event", [], { kind: "tip" }, "tip"],
    ["the hint for a matching encounter", [], { encounter: "puddle", kind: "encounter" }, "puddle"],
    ["the hint for a matching debuff", [], { debuff: "stinky", kind: "debuff" }, "stinky"],
    ["nothing for a hint already shown", ["tip"], { kind: "tip" }, null],
    ["nothing for an event no hint waits for", [], { encounter: "thief", kind: "encounter" }, null],
  ])("returns %s", (_, shown, event, id) => {
    expect(hintFor(data, shown, event)).toEqual(id === null ? null : { id, text: HINTS[id].text });
  });

  it.each(Object.keys(DEBUFFS) as DebuffId[])("has a first-time hint for %s", (debuff) => {
    expect(hintFor(data, [], { debuff, kind: "debuff" })).not.toBeNull();
  });
});
