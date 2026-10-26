import type { Textures } from "phaser";
import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { shopListFrame } from "../home/shopLayout";
import type { Rect } from "../lib/rect";
import { paintRectMask } from "./rectMask";

// A texture manager whose canvases record the rects painted white on them since their last
// clear, and how many canvases it made and refreshes they had.
function fakeTextures() {
  const made = new Map<string, { painted: Rect[]; refreshes: number }>();
  const canvas = (key: string) => {
    const record = { painted: [] as Rect[], refreshes: 0 };
    made.set(key, record);
    const context = {
      clearRect: () => {
        record.painted = [];
      },
      fillRect: (x: number, y: number, width: number, height: number) => {
        record.painted.push({ height, width, x, y });
      },
      fillStyle: "",
    };
    return {
      getContext: () => context,
      height: SCREEN_CONFIG.height,
      refresh: () => {
        record.refreshes += 1;
      },
      width: SCREEN_CONFIG.width,
    };
  };
  const textures = new Map<string, ReturnType<typeof canvas>>();
  const manager = {
    createCanvas: (key: string) => {
      const texture = canvas(key);
      textures.set(key, texture);
      return texture;
    },
    exists: (key: string) => textures.has(key),
    get: (key: string) => textures.get(key),
  };
  return {
    made,
    textures: manager as unknown as Pick<
      Textures.TextureManager,
      "createCanvas" | "exists" | "get"
    >,
  };
}

// The shop's list scrolls on a tab that holds more rows than fit (Dogs) and not on one that
// fits (Gear); each tab switch redraws the list masked to its frame.
describe("paintRectMask", () => {
  it.each<[string, boolean[], number]>([
    ["Dogs then Gear", [true, false], 2],
    ["Gear then Dogs", [false, true], 2],
    ["Dogs, Gear, then Dogs again", [true, false, true], 3],
    ["Gear twice", [false, false], 1],
  ])("masks the list to the open tab's frame across %s", (_case, scrolls, refreshes) => {
    const { made, textures } = fakeTextures();
    for (const scrolling of scrolls) {
      paintRectMask(textures, SCREEN_CONFIG, "list-mask", shopListFrame(scrolling).rect);
    }
    const last = scrolls.at(-1) ?? false;
    expect([...made.keys()]).toEqual(["list-mask"]);
    expect(made.get("list-mask")).toEqual({
      painted: [shopListFrame(last).rect],
      refreshes,
    });
  });
});
