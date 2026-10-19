import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
import { animationKey, animationSpecs, type AsepriteSheet } from "./asepriteAnimations";

function sheet(durations: number[], frameTags: AsepriteSheet["meta"]["frameTags"]): AsepriteSheet {
  return {
    frames: Object.fromEntries(durations.map((duration, i) => [`dog ${i}.aseprite`, { duration }])),
    meta: frameTags === undefined ? {} : { frameTags },
  };
}

describe("animationSpecs", () => {
  it("builds one animation per tag, keyed by texture and tag", () => {
    const specs = animationSpecs(
      "dog-koda",
      sheet(
        [150, 150, 120, 120],
        [
          { direction: "forward", from: 0, name: "walk", to: 1 },
          { direction: "forward", from: 2, name: "react", to: 3 },
        ],
      ),
    );
    expect(specs.map(({ key }) => key)).toEqual(["dog-koda:walk", "dog-koda:react"]);
    expect(itemAt(specs, 1).frames).toEqual([
      { duration: 120, frame: "dog 2.aseprite" },
      { duration: 120, frame: "dog 3.aseprite" },
    ]);
  });

  it("keeps two sprites' identical tag names apart", () => {
    const tags = [{ direction: "forward", from: 0, name: "walk", to: 0 }];
    const keys = ["dog-koda", "dog-duchess"].flatMap((texture) =>
      animationSpecs(texture, sheet([150], tags)).map(({ key }) => key),
    );
    expect(new Set(keys).size).toBe(2);
  });

  it("plays reverse and pingpong tags in Aseprite's order", () => {
    const frameOrder = (direction: string) =>
      animationSpecs(
        "dog",
        sheet([1, 2, 3], [{ direction, from: 0, name: "t", to: 2 }]),
      )[0]?.frames.map(({ duration }) => duration);
    expect(frameOrder("reverse")).toEqual([3, 2, 1]);
    expect(frameOrder("pingpong")).toEqual([1, 2, 3, 2]);
  });

  it("returns no animations for a sheet without tags", () => {
    expect(animationSpecs("face", sheet([100], undefined))).toEqual([]);
  });

  it("names the tag that points past the last frame", () => {
    const tags = [{ direction: "forward", from: 0, name: "walk", to: 4 }];
    expect(() => animationSpecs("dog-koda", sheet([150], tags))).toThrow('"walk"');
  });
});

describe("animationKey", () => {
  it("joins texture and tag", () => {
    expect(animationKey("face-dog-koda", "happy")).toBe("face-dog-koda:happy");
  });
});
