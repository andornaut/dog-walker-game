import { describe, expect, it } from "vitest";

import { itemAt } from "../arrays";
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

  it("plays each direction in Aseprite's order", () => {
    const frameOrder = (direction: string) =>
      itemAt(animationSpecs("dog", sheet([1, 2, 3], [tag(direction, 0, 2)])), 0).frames.map(
        ({ duration }) => duration,
      );
    expect(frameOrder("forward")).toEqual([1, 2, 3]);
    expect(frameOrder("reverse")).toEqual([3, 2, 1]);
    expect(frameOrder("pingpong")).toEqual([1, 2, 3, 2]);
    expect(frameOrder("pingpong_reverse")).toEqual([3, 2, 1, 2]);
  });

  it("returns no animations for a sheet without tags", () => {
    expect(animationSpecs("face", sheet([100], undefined))).toEqual([]);
  });

  it("names the tag that points past the last frame", () => {
    expect(() => animationSpecs("dog-koda", sheet([150], [tag("forward", 0, 4)]))).toThrow(
      'dog-koda tag "walk" refers to missing frame 1',
    );
  });

  it("rejects a tag whose from is after its to", () => {
    const tags = [tag("forward", 2, 1)];
    expect(() => animationSpecs("dog-koda", sheet([150, 150, 150], tags))).toThrow(
      "dog-koda sheet.meta.frameTags[0] from must not be after to",
    );
  });

  it("rejects a tag with an unknown direction", () => {
    expect(() => animationSpecs("dog-koda", sheet([150], [tag("sideways", 0, 0)]))).toThrow(
      "dog-koda sheet.meta.frameTags[0].direction must be one of",
    );
  });

  it("rejects a tag whose frames are not whole numbers", () => {
    expect(() => animationSpecs("dog-koda", sheet([150, 150], [tag("forward", 0.5, 1)]))).toThrow(
      "dog-koda sheet.meta.frameTags[0].from must be a whole number",
    );
  });

  it("rejects a frame without a positive duration", () => {
    expect(() => animationSpecs("dog-koda", sheet([0], []))).toThrow(
      "dog-koda sheet.frames.dog 0.aseprite.duration must be positive",
    );
  });

  it("names the texture when meta is missing", () => {
    expect(() => animationSpecs("dog-koda", { frames: {} })).toThrow(
      "dog-koda sheet.meta is required",
    );
  });

  it("rejects Aseprite's array export", () => {
    const frames = [{ duration: 150, filename: "dog 0.aseprite" }];
    expect(() => animationSpecs("dog-koda", { frames, meta: {} })).toThrow(
      'dog-koda sheet.frames must be an object: export with the "hash" JSON format',
    );
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
