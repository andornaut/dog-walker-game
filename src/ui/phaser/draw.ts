import { getOrInsertComputed } from "@andornaut/game-kit/maps";
import { insetRect, type Point, type Rect, ringRects } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene, Textures } from "phaser";

import { PALETTE } from "../palette";
import { pixelEllipseSpans, pixelLinePoints, shadowRadiusX } from "../pixelShapes";

export function addFilledRect(scene: Scene, colour: number, rect: Rect): GameObjects.Rectangle {
  return scene.add.rectangle(rect.x, rect.y, rect.width, rect.height, colour).setOrigin(0);
}

// The ink layer an overlay dims what is under it with.
const DIM_ALPHA = 0.6;

export function addDim(scene: Scene, rect: Rect): GameObjects.Rectangle {
  return scene.add
    .rectangle(rect.x, rect.y, rect.width, rect.height, PALETTE.ink, DIM_ALPHA)
    .setOrigin(0);
}

export function fillRect(graphics: GameObjects.Graphics, colour: number, rect: Rect): void {
  graphics.fillStyle(colour).fillRect(rect.x, rect.y, rect.width, rect.height);
}

// rect filled with a square cut pixels wide left out at each corner.
export function fillCutRect(
  graphics: GameObjects.Graphics,
  colour: number,
  rect: Rect,
  cut: number,
): void {
  fillRect(graphics, colour, { ...rect, width: rect.width - 2 * cut, x: rect.x + cut });
  fillRect(graphics, colour, { ...rect, height: rect.height - 2 * cut, y: rect.y + cut });
}

// A ring of the given thickness just inside rect's edge.
export function drawRing(
  g: GameObjects.Graphics,
  colour: number,
  rect: Rect,
  thickness: number,
): void {
  ringRects(thickness, rect).forEach((band) => fillRect(g, colour, band));
}

// The keyboard's focus ring: a 2px cyan frame outset pixels outside rect.
export function drawFocusRing(graphics: GameObjects.Graphics, outset: number, rect: Rect): void {
  drawRing(graphics, PALETTE.cyan, insetRect(-outset, rect), 2);
}

const SHADOW_RADIUS_Y = 2.5;

// A solid pixel ellipse under a sprite, centred on its x about a pixel above its feet.
export function drawShadow(
  graphics: GameObjects.Graphics,
  colour: number,
  x: number,
  footY: number,
  spriteWidth: number,
): void {
  graphics.fillStyle(colour);
  for (const span of pixelEllipseSpans(
    Math.round(x),
    Math.round(footY) - 1,
    shadowRadiusX(spriteWidth),
    SHADOW_RADIUS_Y,
  )) {
    graphics.fillRect(span.x, span.y, span.width, 1);
  }
}

// A shadow's frame: its radii, kept to half pixels, its name, and the frame pixel placed a pixel
// above the sprite's feet, at its x.
interface ShadowSize {
  anchor: Point;
  name: string;
  radii: Point;
}

function shadowSize(radiusX: number, radiusY: number): ShadowSize {
  return {
    anchor: { x: Math.ceil(radiusX) + 1, y: Math.ceil(radiusY) + 1 },
    name: `${radiusX}x${radiusY}`,
    radii: { x: radiusX, y: radiusY },
  };
}

// The shadow pages of a game: how many there are, each frame's page key by name, the pages
// drawn on since they were last uploaded, and where the next frame goes on the newest page (the
// left of the free part of the current row, the row's top, and the height of its tallest frame).
interface ShadowPages {
  count: number;
  dirty: Set<Textures.CanvasTexture>;
  frames: Map<string, string>;
  row: { height: number; x: number; y: number };
}

// Shadow frames are packed 1px apart onto canvas pages at least this large. A frame that does
// not fit on the newest page starts a new one.
const SHADOW_PAGE = { height: 512, width: 512 } as const;
const SHADOW_GAP = 1;
// Every size up to these radii is drawn when the first page is made, so the page uploads once:
// the shadows of the widest road sprites at full size. A larger shadow adds its frame when it
// is first placed.
const PRESET_RADII = { x: 56, y: SHADOW_RADIUS_Y } as const;

// The shadow pages of each game, by its texture manager.
const shadowPages = new WeakMap<object, ShadowPages>();

// Draws a white ellipse frame on the newest shadow page, starting a page when it does not fit,
// and records the page's key, or nothing when the page cannot be made.
function addShadowFrame(
  textures: Textures.TextureManager,
  pages: ShadowPages,
  { anchor, name, radii }: ShadowSize,
): void {
  const width = 2 * anchor.x + 1;
  const height = 2 * anchor.y + 1;
  let { row } = pages;
  if (row.x + width > SHADOW_PAGE.width) {
    row = { height: 0, x: 0, y: row.y + row.height };
  }
  let key = `shadows-${pages.count - 1}`;
  if (pages.count === 0 || row.y + height > SHADOW_PAGE.height) {
    key = `shadows-${pages.count}`;
    const size = {
      height: Math.max(SHADOW_PAGE.height, height),
      width: Math.max(SHADOW_PAGE.width, width),
    };
    if (textures.createCanvas(key, size.width, size.height) === null) {
      return;
    }
    pages.count += 1;
    row = { height: 0, x: 0, y: 0 };
  }
  const page = textures.get(key) as Textures.CanvasTexture;
  const context = page.getContext();
  context.fillStyle = "#ffffff";
  for (const span of pixelEllipseSpans(row.x + anchor.x, row.y + anchor.y, radii.x, radii.y)) {
    context.fillRect(span.x, span.y, span.width, 1);
  }
  page.add(name, 0, row.x, row.y, width, height);
  pages.dirty.add(page);
  pages.frames.set(name, key);
  pages.row = {
    height: Math.max(row.height, height + SHADOW_GAP),
    x: row.x + width + SHADOW_GAP,
    y: row.y,
  };
}

// The game's shadow pages, the first made with every size up to PRESET_RADII on it.
function shadowPagesOf(textures: Textures.TextureManager): ShadowPages {
  return getOrInsertComputed(
    textures,
    () => {
      const pages: ShadowPages = {
        count: 0,
        dirty: new Set(),
        frames: new Map(),
        row: { height: 0, x: 0, y: 0 },
      };
      for (let radiusY = 1; radiusY <= PRESET_RADII.y; radiusY += 0.5) {
        for (let radiusX = 3; radiusX <= PRESET_RADII.x; radiusX += 0.5) {
          addShadowFrame(textures, pages, shadowSize(radiusX, radiusY));
        }
      }
      return pages;
    },
    shadowPages,
  );
}

// Uploads the shadow pages drawn on since their last upload. Call once a frame's shadows are
// placed, so a page uploads at most once a frame.
export function uploadShadowFrames(scene: Scene): void {
  const pages = shadowPages.get(scene.textures);
  pages?.dirty.forEach((page) => page.refresh());
  pages?.dirty.clear();
}

// The shadow drawShadow draws, as a white frame to tint to its colour, for a sprite drawn
// spriteWidth wide at depth scale: scale flattens it as the sprite shrinks with distance. Radii
// are kept to half pixels, so a sprite scaled continuously reuses a few frames, and every frame
// is on the shared shadow pages, so the shadows draw from one texture. anchor is the frame
// pixel to place a pixel above the sprite's feet, at its x. Undefined when no page can be made.
export function shadowFrame(
  scene: Scene,
  spriteWidth: number,
  scale = 1,
): { anchor: Point; frame: string; key: string } | undefined {
  const size = shadowSize(
    Math.round(shadowRadiusX(spriteWidth) * 2) / 2,
    Math.max(1, Math.round(SHADOW_RADIUS_Y * scale * 2) / 2),
  );
  const pages = shadowPagesOf(scene.textures);
  if (!pages.frames.has(size.name)) {
    addShadowFrame(scene.textures, pages, size);
  }
  const key = pages.frames.get(size.name);
  return key === undefined ? undefined : { anchor: size.anchor, frame: size.name, key };
}

// A 1px line with no smoothing, so it stays on the palette.
export function drawPixelLine(
  graphics: GameObjects.Graphics,
  colour: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  graphics.fillStyle(colour);
  for (const [x, y] of pixelLinePoints(from.x, from.y, to.x, to.y)) {
    graphics.fillRect(x, y, 1, 1);
  }
}

// A picture drawn from rows of text, each "#" a square pixel wide from at, row by row.
export function drawPixelRows(
  graphics: GameObjects.Graphics,
  colour: number,
  rows: readonly string[],
  at: Point,
  pixel: number,
): void {
  graphics.fillStyle(colour);
  rows.forEach((row, dy) => {
    [...row].forEach((cell, dx) => {
      if (cell === "#") {
        graphics.fillRect(at.x + dx * pixel, at.y + dy * pixel, pixel, pixel);
      }
    });
  });
}

const HEART_ROWS = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

// A 7x6 heart.
export function drawHeart(
  graphics: GameObjects.Graphics,
  x: number,
  y: number,
  colour: number,
): void {
  drawPixelRows(graphics, colour, HEART_ROWS, { x, y }, 1);
}

// A 1px border of 2-on, 2-off dashes, for an empty slot, the last dash on a side cut at its end.
export function drawDashedRect(graphics: GameObjects.Graphics, colour: number, rect: Rect): void {
  graphics.fillStyle(colour);
  const right = rect.x + rect.width - 1;
  const bottom = rect.y + rect.height - 1;
  for (let i = 0; i < rect.width; i += 4) {
    const dash = Math.min(2, rect.width - i);
    graphics.fillRect(rect.x + i, rect.y, dash, 1).fillRect(rect.x + i, bottom, dash, 1);
  }
  for (let i = 0; i < rect.height; i += 4) {
    const dash = Math.min(2, rect.height - i);
    graphics.fillRect(rect.x, rect.y + i, 1, dash).fillRect(right, rect.y + i, 1, dash);
  }
}

// A cream box framed in plum: a panel, bubble or chip drawn in code.
export const CREAM_PANEL_COLOURS = { border: PALETTE.plum, fill: PALETTE.cream };

// A box with a 1px border drawn inside it, not straddling its edge as a Phaser stroke would.
export function drawFramedRect(
  graphics: GameObjects.Graphics,
  colours: { border: number; fill: number },
  rect: Rect,
): void {
  fillRect(graphics, colours.border, rect);
  fillRect(graphics, colours.fill, insetRect(1, rect));
}
