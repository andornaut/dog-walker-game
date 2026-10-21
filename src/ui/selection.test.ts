import { describe, expect, it } from "vitest";

import type { TileState } from "./interaction";
import { type SelectLook, selectLook } from "./selection";

describe("selectLook", () => {
  it.each<[TileState, Omit<SelectLook, "state">]>([
    ["normal", { box: "tan", face: "cream", price: "forest", text: "plum" }],
    ["selected", { box: "amber", face: "yellow", price: "forest", text: "plum" }],
    ["disabled", { box: "slate", face: "grey", price: "navy", text: "darkSlate" }],
  ])("draws a %s tile as ui-tile does", (state, look) => {
    expect(selectLook(state)).toEqual({ ...look, state });
  });
});
