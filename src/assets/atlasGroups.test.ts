import { describe, expect, it } from "vitest";

import { atlasGroupOf, filtersLinear, pageGroupOf, steppedBases } from "./atlasGroups";
import { LOADING_ART } from "./spriteKeys";

describe("atlasGroupOf", () => {
  // The loading screen's art is boot; the home screen's road art is home; the rest goes by key
  // prefix, with the road as the rest.
  it("puts each key in its group", () => {
    const cases: [string, string][] = [
      ...Object.values(LOADING_ART).map((key): [string, string] => [key, "boot"]),
      ["card-skip", "run"],
      ["screen-home", "ui"],
      ["icon-lock", "ui"],
      ["logo", "ui"],
      ["dog-kilo", "home"],
      ["owner-kilo", "home"],
      ["walker-ada", "home"],
      ["fx-tap", "home"],
      ["dog-kilo@50", "run"],
      ["other-dog-owner", "run"],
      ["fx-hit-skunk", "run"],
    ];
    expect(cases.filter(([key, group]) => atlasGroupOf(key) !== group)).toEqual([]);
  });
});

describe("pageGroupOf", () => {
  // cone and dog-kilo have depth step variants; fx-hit-skunk and ui-heart do not.
  const stepped = steppedBases(["cone", "cone@94", "dog-kilo", "dog-kilo@50", "fx-hit-skunk"]);

  // Road art drawn between its depth steps packs on its own linear pages; the home screen's 1x
  // art, the UI and the rest of the road stay nearest.
  it.each([
    ["cone", "road", true],
    ["cone@50", "road", true],
    ["dog-kilo@50", "road", true],
    ["dog-kilo", "home", false],
    ["fx-hit-skunk", "run", false],
    ["ambient-kite", "run", false],
    ["ui-heart", "ui", false],
    ["card-skip", "run", false],
    [LOADING_ART.walker, "boot", false],
  ] as const)("packs %s on a %s page, filtered linearly: %s", (key, group, linear) => {
    expect(pageGroupOf(stepped, key)).toBe(group);
    expect(filtersLinear(stepped, key)).toBe(linear);
  });
});
