import * as v from "valibot";

import { LOADING_ART } from "../../layout/loadingScreen";
import { itemAt } from "../../lib/arrays";
import { getOrInsertComputed } from "../../lib/maps";
import type { Point, Rect } from "../../lib/rect";
import { splitDepthKey } from "../depthSteps";
import { isPlainObject, parseOrThrow, record } from "../jsonSchema";
import {
  ATLAS_DIR,
  type AtlasFrame,
  type AtlasTexture,
  BASE_FRAME,
  type FrameTrim,
} from "./atlasManifest";

// Mobile GPUs guarantee textures up to 2048 pixels a side.
export const ATLAS_MAX_SIZE = 2048;
// Each frame's edge pixels repeat this far outward, so a scaled or tiled frame that samples
// past its edge reads its own colour rather than a neighbour's.
export const EXTRUDE = 1;
const PAGE_WIDTHS = [256, 512, 1024, 2048] as const;

// Pages in load order: the loading screen's art first, so it shows while the rest loads.
const ATLAS_GROUPS = ["boot", "ui", "home", "run", "road", "cards"] as const;
type AtlasGroup = (typeof ATLAS_GROUPS)[number];
// The groups a key belongs to by its name alone. road is split out of run by pageGroupOf.
type KeyGroup = Exclude<AtlasGroup, "road">;

// The groups boot loads before the home screen shows. The rest load behind it, and a walk or
// help waits for them.
const FIRST_ATLAS_GROUPS: readonly AtlasGroup[] = ["boot", "ui", "home"];

// The groups whose pages draw with linear filtering. A page's filter covers every frame on it,
// so the road art drawn between its depth steps packs on pages of its own.
const LINEAR_GROUPS: ReadonlySet<AtlasGroup> = new Set(["road"]);

const LOADING_KEYS: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
const GROUP_PREFIXES: readonly (readonly [KeyGroup, readonly string[]])[] = [
  ["cards", ["card-"]],
  ["ui", ["badge-", "face-", "icon-", "item-", "logo", "portrait-", "screen-", "ui-"]],
];

// Road art the home screen and its menus draw too: each dog, owner and walker at full size
// (not their depth steps), the coin, and the effects of a tap, a dog's hop and a celebration.
const HOME_PREFIXES = ["dog-", "owner-", "walker-"];
const HOME_KEYS: ReadonlySet<string> = new Set([
  "fx-confetti",
  "fx-dust",
  "fx-new-best",
  "fx-tap",
  "tip",
]);

const isHomeArt = (key: string): boolean =>
  HOME_KEYS.has(key) ||
  (HOME_PREFIXES.some((prefix) => key.startsWith(prefix)) && splitDepthKey(key).base === key);

// boot is the loading screen; ui the home screen, menus, HUD and icons; home the road art the
// home screen draws too; cards the choice cards; run everything else on the road.
export function atlasGroupOf(key: string): KeyGroup {
  if (LOADING_KEYS.has(key)) {
    return "boot";
  }
  if (isHomeArt(key)) {
    return "home";
  }
  const match = GROUP_PREFIXES.find(([, prefixes]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );
  return match?.[0] ?? "run";
}

// Whether boot loads key before the home screen shows.
export const loadsFirst = (key: string): boolean => FIRST_ATLAS_GROUPS.includes(atlasGroupOf(key));

// The sprites among keys that have a depth step variant: the road sprites drawn through their
// depth steps.
export function steppedBases(keys: Iterable<string>): Set<string> {
  const bases = new Set<string>();
  for (const key of keys) {
    const { base } = splitDepthKey(key);
    if (base !== key) {
      bases.add(base);
    }
  }
  return bases;
}

// The page group a key packs into, given steppedBases of the keys packed: atlasGroupOf's, except
// that the road art drawn between its depth steps (each depth step variant, and the full size of
// a sprite with one) is road, whose pages filter linearly so it shrinks smoothly. Home art keeps
// its group and stays nearest: the home screen draws it at 1x, and the pack stands at full size.
export function pageGroupOf(stepped: ReadonlySet<string>, key: string): AtlasGroup {
  const group = atlasGroupOf(key);
  return group === "run" && stepped.has(splitDepthKey(key).base) ? "road" : group;
}

// Whether a key's texture draws with linear filtering, given steppedBases of the keys loaded.
// At 1x on a whole pixel, as Phaser places unscaled sprites, linear filtering samples each
// texel's centre and draws the same pixels as nearest.
export function filtersLinear(stepped: ReadonlySet<string>, key: string): boolean {
  return LINEAR_GROUPS.has(pageGroupOf(stepped, key));
}

// A frame of a source PNG, by the rect of it that is packed. A trimmed frame's rect holds only
// its opaque pixels: bounds is then the whole frame it was cut from, and trim where it sits in
// it. Frames of a texture with the same from rect share one rect on the page.
export interface SourceFrame {
  bounds?: Rect;
  duration?: number;
  from: Rect;
  name: string;
  trim?: FrameTrim;
}

// A manifest image or sprite, read from its source PNG. Only a sprite has tags.
export interface SourceTexture {
  frames: SourceFrame[];
  key: string;
  png: string;
  tags?: unknown[];
}

// A frame copied from a source PNG to the top-left corner at on a page, its extruded border
// read inside bounds.
interface Blit {
  at: Point;
  bounds: Rect;
  from: Rect;
  png: string;
}

export interface PageLayout {
  blits: Blit[];
  group: AtlasGroup;
  height: number;
  png: string;
  width: number;
}

interface AtlasLayout {
  pages: PageLayout[];
  // Keys with a frame too large for a page, left to load from their own files.
  skipped: string[];
  textures: AtlasTexture[];
}

// An image, as one frame covering its whole PNG.
export function imageSource(
  png: string,
  width: number,
  height: number,
  key: string,
): SourceTexture {
  return { frames: [{ from: { height, width, x: 0, y: 0 }, name: BASE_FRAME }], key, png };
}

const pixels = v.pipe(v.number("must be a number"), v.integer("must be a whole number"));

const asepriteFrame = record({
  duration: v.number("must be a number"),
  frame: record({ h: pixels, w: pixels, x: pixels, y: pixels }),
  rotated: v.exactOptional(v.boolean()),
  trimmed: v.exactOptional(v.boolean()),
});

const asepriteSheet = record({
  frames: v.pipe(
    v.unknown(),
    v.check(isPlainObject, 'must be an object: export with the "hash" JSON format'),
    v.record(v.string(), asepriteFrame),
  ),
  meta: record({ frameTags: v.optional(v.array(v.unknown(), "must be an array"), []) }),
});

// A sprite's frames from its Aseprite "hash" export, in export order. Throws on a frame the
// export rotated or trimmed, whose placement the packer does not read: it trims frames itself.
export function spriteSource(key: string, png: string, json: unknown): SourceTexture {
  const { frames, meta } = parseOrThrow(`${key} sheet`, asepriteSheet, json);
  return {
    frames: Object.entries(frames).map(([name, { duration, frame, rotated, trimmed }]) => {
      if (rotated === true || trimmed === true) {
        throw new Error(`${key} frame "${name}" is rotated or trimmed`);
      }
      return { duration, from: { height: frame.h, width: frame.w, x: frame.x, y: frame.y }, name };
    }),
    key,
    png,
    tags: meta.frameTags,
  };
}

interface Shelf {
  height: number;
  x: number;
  y: number;
}

// A texture as packed: the first of its frames with each distinct from rect, which get a rect
// on the page each, and for every frame the index of its rect among them.
interface Packable {
  firsts: SourceFrame[];
  slots: number[];
  texture: SourceTexture;
}

function packable(texture: SourceTexture): Packable {
  const index = new Map<string, number>();
  const firsts: SourceFrame[] = [];
  const slots = texture.frames.map((frame) => {
    const { height, width, x, y } = frame.from;
    const id = `${x},${y},${width},${height}`;
    return getOrInsertComputed(id, () => firsts.push(frame) - 1, index);
  });
  return { firsts, slots, texture };
}

interface PackedPage {
  height: number;
  placed: { at: Point[]; item: Packable }[];
}

// Each frame's top-left on a shelf of rows width wide, or undefined when they overflow
// maxSize. Each frame's cell adds EXTRUDE on every side, so frames sit 2 * EXTRUDE apart and
// EXTRUDE from the page's top and left edges.
function placeOnShelf(
  shelf: Shelf,
  frames: readonly SourceFrame[],
  width: number,
  maxSize: number,
): { at: Point[]; shelf: Shelf } | undefined {
  let { height, x, y } = shelf;
  const at: Point[] = [];
  for (const { from } of frames) {
    const cellWidth = from.width + 2 * EXTRUDE;
    const cellHeight = from.height + 2 * EXTRUDE;
    if (x + cellWidth > width) {
      y += height;
      x = 0;
      height = 0;
    }
    if (x + cellWidth > width || y + cellHeight > maxSize) {
      return undefined;
    }
    at.push({ x: x + EXTRUDE, y: y + EXTRUDE });
    x += cellWidth;
    height = Math.max(height, cellHeight);
  }
  return { at, shelf: { height, x, y } };
}

// Shelf packs the textures, tallest first, onto pages width wide, keeping each texture's
// frames on one page. Undefined when a texture does not fit on an empty page.
function packShelves(
  items: readonly Packable[],
  width: number,
  maxSize: number,
): PackedPage[] | undefined {
  const pages: PackedPage[] = [];
  let page: PackedPage = { height: 0, placed: [] };
  let shelf: Shelf = { height: 0, x: 0, y: 0 };
  for (const item of items) {
    let placed = placeOnShelf(shelf, item.firsts, width, maxSize);
    if (placed === undefined && page.placed.length > 0) {
      pages.push(page);
      page = { height: 0, placed: [] };
      shelf = { height: 0, x: 0, y: 0 };
      placed = placeOnShelf(shelf, item.firsts, width, maxSize);
    }
    if (placed === undefined) {
      return undefined;
    }
    ({ shelf } = placed);
    page.placed.push({ at: placed.at, item });
    page.height = Math.max(page.height, shelf.y + shelf.height);
  }
  if (page.placed.length > 0) {
    pages.push(page);
  }
  return pages;
}

const tallestFrame = (texture: SourceTexture) =>
  Math.max(...texture.frames.map(({ from }) => from.height));

// The page width that packs the group onto the fewest pages, each one a request, then into the
// least area, preferring the narrower on a tie.
function packGroup(
  textures: readonly SourceTexture[],
  maxSize: number,
): { pages: PackedPage[]; width: number } {
  const sorted = [...textures]
    .sort((a, b) => tallestFrame(b) - tallestFrame(a) || (a.key < b.key ? -1 : 1))
    .map(packable);
  let best: { area: number; pages: PackedPage[]; width: number } | undefined;
  const widths = [...PAGE_WIDTHS.filter((candidate) => candidate < maxSize), maxSize];
  for (const width of widths) {
    const pages = packShelves(sorted, width, maxSize);
    if (pages === undefined) {
      continue;
    }
    const area = pages.reduce((sum, page) => sum + width * page.height, 0);
    const fewer = best === undefined || pages.length < best.pages.length;
    if (fewer || (pages.length === best?.pages.length && area < best.area)) {
      best = { area, pages, width };
    }
  }
  return best ?? { pages: [], width: 0 };
}

function fits(texture: SourceTexture, maxSize: number): boolean {
  return texture.frames.every(
    ({ from }) => from.width + 2 * EXTRUDE <= maxSize && from.height + 2 * EXTRUDE <= maxSize,
  );
}

// Packs the textures into pages of at most maxSize a side, by group in ATLAS_GROUPS order, and
// maps every frame to its rect on its page. A trimmed frame keeps its trim, which places its
// rect in the whole frame, so anchors measured in frame pixels still hold.
export function layoutAtlases(
  textures: readonly SourceTexture[],
  maxSize: number = ATLAS_MAX_SIZE,
): AtlasLayout {
  const layout: AtlasLayout = { pages: [], skipped: [], textures: [] };
  const stepped = steppedBases(textures.map(({ key }) => key));
  for (const group of ATLAS_GROUPS) {
    const members = textures.filter((texture) => pageGroupOf(stepped, texture.key) === group);
    layout.skipped.push(...members.filter((t) => !fits(t, maxSize)).map(({ key }) => key));
    const packed = members.filter((texture) => fits(texture, maxSize));
    const { pages, width } = packGroup(packed, maxSize);
    // A group no page width can hold is skipped whole.
    if (pages.length === 0) {
      layout.skipped.push(...packed.map(({ key }) => key));
    }
    pages.forEach(({ height, placed }, index) => {
      const page = layout.pages.length;
      const blits: Blit[] = [];
      for (const { at, item } of placed) {
        const { firsts, slots, texture } = item;
        firsts.forEach(({ bounds, from }, i) => {
          blits.push({ at: itemAt(at, i), bounds: bounds ?? from, from, png: texture.png });
        });
        const frames = texture.frames.map(({ duration, from, name, trim }, i): AtlasFrame => {
          const to = itemAt(at, itemAt(slots, i));
          return {
            ...(duration === undefined ? {} : { duration }),
            h: from.height,
            name,
            ...(trim === undefined ? {} : { trim }),
            w: from.width,
            x: to.x,
            y: to.y,
          };
        });
        const { key, tags } = texture;
        layout.textures.push(
          tags === undefined ? { frames, key, page } : { frames, key, page, tags },
        );
      }
      layout.pages.push({ blits, group, height, png: `${ATLAS_DIR}/${group}-${index}.png`, width });
    });
  }
  return layout;
}
