import { describe, expect, it } from "vitest";

import { LOADING_ART } from "../layout/loadingScreen";
import {
  ATLAS_MAX_SIZE,
  atlasGroupOf,
  EXTRUDE,
  imageSource,
  layoutAtlases,
  type SourceTexture,
  spriteSource,
} from "./atlasLayout";

function sprite(key: string, count: number, width: number, height: number): SourceTexture {
  const frames = Array.from({ length: count }, (_, i) => ({
    duration: 100,
    from: { height, width, x: i * width, y: 0 },
    name: `${key} ${i}`,
  }));
  return { frames, key, png: `sprites/${key}.png`, tags: [] };
}

describe("atlasGroupOf", () => {
  // The loading screen's art is boot; the rest goes by key prefix, with the road as the rest.
  it.each<[string, string]>([
    ...Object.values(LOADING_ART).map((key): [string, string] => [key, "boot"]),
    ["card-skip", "cards"],
    ["help-lanes", "cards"],
    ["screen-home", "ui"],
    ["icon-lock", "ui"],
    ["logo", "ui"],
    ["dog-koda", "run"],
    ["fx-hit-skunk", "run"],
  ])("puts %s in %s", (key, group) => {
    expect(atlasGroupOf(key)).toBe(group);
  });
});

describe("spriteSource", () => {
  const frame = (x: number, duration: number) => ({
    duration,
    frame: { h: 32, w: 32, x, y: 0 },
    rotated: false,
    trimmed: false,
  });
  const tags = [{ direction: "forward", from: 0, name: "walk", to: 1 }];

  it("reads each frame's rect and duration in export order, and the tags", () => {
    const json = {
      // Built from entries: a literal's keys would have to be sorted.
      frames: Object.fromEntries([
        ["b 1", frame(32, 120)],
        ["a 0", frame(0, 80)],
      ]),
      meta: { frameTags: tags },
    };
    expect(spriteSource("dog-koda", "sprites/dog-koda.png", json)).toEqual({
      frames: [
        { duration: 120, from: { height: 32, width: 32, x: 32, y: 0 }, name: "b 1" },
        { duration: 80, from: { height: 32, width: 32, x: 0, y: 0 }, name: "a 0" },
      ],
      key: "dog-koda",
      png: "sprites/dog-koda.png",
      tags,
    });
  });

  it.each([
    {
      error: 'dog-koda frame "a 0" is rotated or trimmed',
      json: { frames: { "a 0": { ...frame(0, 80), trimmed: true } }, meta: {} },
      name: "a trimmed frame, whose offset the atlas would lose",
    },
    {
      error: 'dog-koda sheet.frames must be an object: export with the "hash" JSON format',
      json: { frames: [], meta: {} },
      name: "the array export",
    },
  ])("rejects $name", ({ error, json }) => {
    expect(() => spriteSource("dog-koda", "dog-koda.png", json)).toThrow(error);
  });
});

describe("layoutAtlases", () => {
  const textures = [
    imageSource("images/screen-home.png", 360, 640, "screen-home"),
    imageSource("images/card-skip.png", 120, 90, "card-skip"),
    sprite("dog-koda", 6, 32, 32),
    sprite("ui-loading", 4, 32, 32),
    sprite("fx-confetti", 10, 64, 64),
  ];

  it("maps every frame of every texture, keeping names, sizes and durations", () => {
    const { textures: mapped } = layoutAtlases(textures);
    expect(mapped.map(({ key }) => key).sort()).toEqual(textures.map(({ key }) => key).sort());
    for (const source of textures) {
      const texture = mapped.find(({ key }) => key === source.key);
      expect(texture?.frames.map(({ duration, h, name, w }) => ({ duration, h, name, w }))).toEqual(
        source.frames.map(({ duration, from, name }) => ({
          duration,
          h: from.height,
          name,
          w: from.width,
        })),
      );
      expect(texture?.tags).toEqual(source.tags);
    }
  });

  it("orders pages boot, ui, run, cards, each named for its group", () => {
    expect(layoutAtlases(textures).pages.map(({ group, png }) => [group, png])).toEqual([
      ["boot", "atlas/boot-0.png"],
      ["ui", "atlas/ui-0.png"],
      ["run", "atlas/run-0.png"],
      ["cards", "atlas/cards-0.png"],
    ]);
  });

  it("keeps each frame and its extruded border inside its page and apart from the others", () => {
    const { pages, textures: mapped } = layoutAtlases(textures);
    const cells = mapped.flatMap(({ frames, page }) =>
      frames.map(({ h, w, x, y }) => ({
        bottom: y + h + EXTRUDE,
        left: x - EXTRUDE,
        page,
        right: x + w + EXTRUDE,
        top: y - EXTRUDE,
      })),
    );
    for (const cell of cells) {
      const page = pages[cell.page];
      expect(cell.left).toBeGreaterThanOrEqual(0);
      expect(cell.top).toBeGreaterThanOrEqual(0);
      expect(cell.right).toBeLessThanOrEqual(page?.width ?? 0);
      expect(cell.bottom).toBeLessThanOrEqual(page?.height ?? 0);
      const overlapping = cells.filter(
        (other) =>
          other !== cell &&
          other.page === cell.page &&
          other.left < cell.right &&
          cell.left < other.right &&
          other.top < cell.bottom &&
          cell.top < other.bottom,
      );
      expect(overlapping).toEqual([]);
    }
  });

  it("blits each frame from its source rect to its mapped rect", () => {
    const { pages, textures: mapped } = layoutAtlases(textures);
    for (const { frames, key, page } of mapped) {
      const source = textures.find((texture) => texture.key === key);
      frames.forEach(({ x, y }, i) => {
        expect(pages[page]?.blits).toContainEqual({
          at: { x, y },
          from: source?.frames[i]?.from,
          png: source?.png,
        });
      });
    }
  });

  it("starts a new page when one is full, keeping each texture's frames on one page", () => {
    const many = Array.from({ length: 12 }, (_, i) => sprite(`dog-${i}`, 4, 30, 30));
    const { pages, textures: mapped } = layoutAtlases(many, 128);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(({ height, width }) => width <= 128 && height <= 128)).toBe(true);
    expect(mapped).toHaveLength(12);
  });

  it("leaves out a texture with a frame larger than a page", () => {
    const huge = imageSource("images/huge.png", ATLAS_MAX_SIZE, 10, "huge");
    const layout = layoutAtlases([huge, ...textures]);
    expect(layout.skipped).toEqual(["huge"]);
    expect(layout.textures.map(({ key }) => key)).not.toContain("huge");
  });
});
