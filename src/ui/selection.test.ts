import { describe, expect, it } from "vitest";

import type { TileState } from "./interaction";
import { GREYED, type SelectLook, selectLook } from "./selection";

describe("selectLook", () => {
  it.each<[TileState, Omit<SelectLook, "state">]>([
    ["normal", { box: "tan", face: "cream", text: "plum" }],
    ["selected", { box: "amber", face: "yellow", text: "plum" }],
    ["disabled", { box: GREYED.box, face: GREYED.face, text: GREYED.text }],
  ])("draws a %s tile as ui-tile does", (state, look) => {
    expect(selectLook(state)).toEqual({ ...look, state });
  });
});
