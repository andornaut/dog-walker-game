import { describe, expect, it } from "vitest";

import { itemAt } from "../lib/arrays";
import { animationSpecs } from "./asepriteAnimations";

function sheet(durations: number[], frameTags: unknown[] | undefined) {
  return {
    frames: Object.fromEntries(durations.map((duration, i) => [`dog ${i}.aseprite`, { duration }])),
    meta: frameTags === undefined ? {} : { frameTags },
  };
}

function tag(direction: string, from: number, to: number) {
  return { direction, from, name: "walk", to };
}

describe("animationSpecs", () => {
  it("builds one animation per tag, keyed by texture and tag", () => {
    const specs = animationSpecs(
      "dog-kilo",
      sheet(
        [150, 150, 120, 120],
        [
          { direction: "forward", from: 0, name: "walk", to: 1 },
          { direction: "forward", from: 2, name: "react", to: 3 },
        ],
      ),
    );
    expect(specs.map(({ key }) => key)).toEqual(["dog-kilo:walk", "dog-kilo:react"]);
    expect(itemAt(specs, 1).frames).toEqual([
      { duration: 120, frame: "dog 2.aseprite" },
      { duration: 120, frame: "dog 3.aseprite" },
    ]);
  });

  it("plays each direction in Aseprite's order, and no animation for a sheet without tags", () => {
    const orders: [string, number[]][] = [
      ["forward", [1, 2, 3]],
      ["reverse", [3, 2, 1]],
      ["pingpong", [1, 2, 3, 2]],
      ["pingpong_reverse", [3, 2, 1, 2]],
    ];
    for (const [direction, order] of orders) {
      const [spec] = animationSpecs("dog", sheet([1, 2, 3], [tag(direction, 0, 2)]));
      expect(
        spec?.frames.map(({ duration }) => duration),
        direction,
      ).toEqual(order);
    }
    expect(animationSpecs("face", sheet([100], undefined))).toEqual([]);
  });

  it("rejects a malformed sheet, naming the tag or frame", () => {
    const cases: { error: string; json: unknown; name: string }[] = [
      {
        error: 'dog-kilo tag "walk" refers to missing frame 1',
        json: sheet([150], [tag("forward", 0, 4)]),
        name: "a tag that points past the last frame, naming it",
      },
      {
        error: "dog-kilo sheet.meta.frameTags[0] from must not be after to",
        json: sheet([150, 150, 150], [tag("forward", 2, 1)]),
        name: "a tag whose from is after its to",
      },
      {
        error: "dog-kilo sheet.meta.frameTags[0].direction must be one of",
        json: sheet([150], [tag("sideways", 0, 0)]),
        name: "a tag with an unknown direction",
      },
      {
        error: "dog-kilo sheet.meta.frameTags[0].from must be a whole number",
        json: sheet([150, 150], [tag("forward", 0.5, 1)]),
        name: "a tag whose frames are not whole numbers",
      },
      {
        error: "dog-kilo sheet.frames.dog 0.aseprite.duration must be positive",
        json: sheet([0], []),
        name: "a frame without a positive duration",
      },
      { error: "dog-kilo sheet.meta is required", json: { frames: {} }, name: "a missing meta" },
      {
        error: 'dog-kilo sheet.frames must be an object: export with the "hash" JSON format',
        json: { frames: [{ duration: 150, filename: "dog 0.aseprite" }], meta: {} },
        name: "Aseprite's array export",
      },
    ];
    for (const { error, json, name } of cases) {
      expect(() => animationSpecs("dog-kilo", json), name).toThrow(error);
    }
  });
});

describe("the shipped art", () => {
  const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
    eager: true,
    import: "default",
  });

  it("parses every sprite sheet under public/art/sprites/", () => {
    const entries = Object.entries(sheets);
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, json] of entries) {
      expect(() => animationSpecs(path, json)).not.toThrow();
    }
  });
});
