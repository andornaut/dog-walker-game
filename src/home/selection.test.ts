import { describe, expect, it } from "vitest";

import { type RestFace, type SelectLook, selectLook } from "./selection";

describe("selectLook", () => {
  const selected: SelectLook = { box: "amber", face: "yellow", selected: true, text: "plum" };

  it.each<[string, RestFace, boolean, boolean, SelectLook]>([
    ["turns a selected cream face yellow with plum text", "cream", true, false, selected],
    ["turns a selected tan face yellow while the choice is full", "tan", true, true, selected],
    [
      "keeps an unselected cream face at rest while the choice has room",
      "cream",
      false,
      false,
      { box: "tan", face: "cream", selected: false, text: "plum" },
    ],
    [
      "keeps an unselected tan face at rest while the choice has room",
      "tan",
      false,
      false,
      { box: "brown", face: "tan", selected: false, text: "plum" },
    ],
    [
      "darkens an unselected cream face one ramp step once the choice is full",
      "cream",
      false,
      true,
      { box: "brown", face: "tan", selected: false, text: "plum" },
    ],
    [
      "darkens an unselected tan face to brown with ink text once the choice is full",
      "tan",
      false,
      true,
      { box: "darkBrown", face: "brown", selected: false, text: "ink" },
    ],
  ])("%s", (_name, rest, isSelected, full, expected) => {
    expect(selectLook(rest, isSelected, full)).toEqual(expected);
  });
});
