// npm run art:depth-preview -- <key> [zone]
// Draws a road sprite as the game draws it at a sweep of distances on each zone's road (or one
// zone's, by id or art id): the walk's projection, depthDraw's choice of art step and scale,
// the road raster and the backdrop band over the far road. Writes one PNG per zone and
// distance to out/depth-preview/<key>/<zone>/, and contact-sheet.png beside them, with the step
// and scale the game picks at each distance, which it also prints.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { decodePng, encodePng } from "../assets/atlas/atlasBuild";
import { spriteSource } from "../assets/atlas/atlasLayout";
import { blankImage, type RgbaImage } from "../assets/atlas/atlasPixels";
import type { AssetManifest } from "../assets/manifest";
import { backdropKey, depthVariantKey, roadTileKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import type { Zone } from "../data/types";
import { laneCenterXs } from "../layout/lanes";
import { SCALE_STEPS } from "../layout/projection";
import {
  drawRoad,
  type PixelImage,
  type RoadLook,
  roadRaster,
  solidStrip,
  STRIP,
  stripLevels,
} from "../layout/roadRaster";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import { walkProjection } from "../runner/walkGeometry";
import { GLYPH_HEIGHT } from "../ui/pixelFont";
import { ART_DIR, ART_MANIFEST, generateArtManifest, measureAnchor } from "./artManifest";
import {
  cloneImage,
  crop,
  drawScaled,
  drawText,
  fill,
  paste,
  type PreviewArt,
  sweepDistances,
  sweepRow,
  upscale,
} from "./depthPreview";
import { nodeArtFiles } from "./files";

const PUBLIC_ART = `public/${ART_DIR}`;
const OUT_DIR = "out/depth-preview";
const SWEEP_COUNT = 12;
const CELL = { height: 96, width: 112 };
const LABEL_HEIGHT = 2 * (GLYPH_HEIGHT + 3) + 2;
const SHEET_SCALE = 2;
const BACKGROUND = [0x18, 0x14, 0x25, 0xff];
const DOG_ROW = [0x26, 0x2b, 0x44, 0xff];
const INK = [0xff, 0xff, 0xff, 0xff];
const DIM = [0x8b, 0x9b, 0xb4, 0xff];

const USAGE = "npm run art:depth-preview -- <key> [zone]";

const [key, zoneArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (key === undefined) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(1);
}

const root = process.cwd();
const artFiles = nodeArtFiles(join(root, PUBLIC_ART));
const manifest: AssetManifest = await generateArtManifest(artFiles);
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const images = new Map(manifest.images.map((entry) => [entry.key, entry]));

async function readImage(path: string): Promise<RgbaImage> {
  return decodePng(await artFiles.read(path));
}

// An art step's frame 0 and feet line: a sprite's from its sheet, an image's whole.
async function previewArt(artKey: string): Promise<PreviewArt | null> {
  const sprite = sprites.get(artKey);
  if (sprite !== undefined) {
    const [image, sheet] = await Promise.all([
      readImage(sprite.png),
      artFiles.read(sprite.json).then((bytes) => JSON.parse(new TextDecoder().decode(bytes))),
    ]);
    const frame = itemAt(spriteSource(artKey, sprite.png, sheet).frames, 0).from;
    const { feetY } = sprite.anchor ?? measureAnchor(image, sheet, artKey);
    return {
      feetY,
      height: frame.height,
      image: crop(image, frame),
      key: artKey,
      width: frame.width,
    };
  }
  const entry = images.get(artKey);
  if (entry === undefined) {
    return null;
  }
  const image = await readImage(entry.png);
  return { feetY: image.height, height: image.height, image, key: artKey, width: image.width };
}

const arts = (
  await Promise.all(SCALE_STEPS.map(async (step) => previewArt(depthVariantKey(key, step) ?? key)))
).filter((art) => art !== null);
if (arts[0]?.key !== key) {
  process.stderr.write(`${key} is not a sprite or image in ${PUBLIC_ART}/${ART_MANIFEST}\n`);
  process.exit(1);
}

const zones = gameData.world.zones.filter(
  (zone) => zoneArg === undefined || zone.id === zoneArg || zone.art === zoneArg,
);
if (zones.length === 0) {
  const known = gameData.world.zones.map((zone) => `${zone.id} (${zone.art})`);
  process.stderr.write(`no zone ${zoneArg}: one of ${known.join(", ")}\n`);
  process.exit(1);
}

const layout = screenLayout(SCREEN_CONFIG);
const { backdrop, dogRow, rasterView, road } = layout;
const projection = walkProjection(ROAD_CAMERA, road);
const laneX = itemAt(laneCenterXs(LANE_COUNT, road), Math.floor(LANE_COUNT / 2));
const distances = sweepDistances(arts, projection, SWEEP_COUNT);
const rows = distances.map((distance) => sweepRow(arts, projection, laneX, distance));
// The view runs from the band's top to the screen's bottom, full width.
const viewTop = backdrop.y;
const viewHeight = SCREEN_CONFIG.height - viewTop;

function pixelImage(image: RgbaImage): PixelImage {
  const copy = new Uint8Array(image.data);
  return { height: image.height, pixels: new Uint32Array(copy.buffer), width: image.width };
}

function hexColor(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}

// The zone's road as the run screen draws it, in the two layers road sprites go between:
// under them the road, and over them the backdrop band, the road's approach rows over the
// band, and the card row.
async function zoneLayers(zone: Zone): Promise<{ over: RgbaImage; under: RgbaImage }> {
  const under = blankImage(SCREEN_CONFIG.width, viewHeight);
  fill(DOG_ROW, { height: viewHeight, width: SCREEN_CONFIG.width, x: 0, y: 0 }, under);
  const tile = images.get(roadTileKey(zone));
  const tileImage = tile === undefined ? null : await readImage(tile.png);
  const strip =
    tileImage?.width === STRIP.width && tileImage.height === STRIP.height
      ? pixelImage(tileImage)
      : solidStrip(hexColor(zone.roadColor));
  const look: RoadLook = { strip: stripLevels(strip), zone: zone.id as RoadLook["zone"] };
  const raster = roadRaster(projection, rasterView);
  const pixels = new Uint32Array(rasterView.width * rasterView.height);
  const frame = { current: look, scroll: 0, transition: null, zoneStart: 0 };
  drawRoad(raster, frame, pixels);
  const drawn: RgbaImage = {
    data: new Uint8Array(pixels.buffer),
    height: rasterView.height,
    width: rasterView.width,
  };
  paste(drawn, rasterView.x, rasterView.y - viewTop, under);

  const over = blankImage(SCREEN_CONFIG.width, viewHeight);
  const band = images.get(backdropKey(zone));
  if (band !== undefined) {
    paste(await readImage(band.png), backdrop.x, 0, over);
  }
  const approach = crop(drawn, { height: raster.approachRows, width: drawn.width, x: 0, y: 0 });
  paste(approach, rasterView.x, rasterView.y - viewTop, over);
  fill(DOG_ROW, { ...dogRow, y: dogRow.y - viewTop }, over);
  return { over, under };
}

function format(value: number): string {
  return value.toFixed(2).replace(/^0/, "");
}

const keyDir = join(root, OUT_DIR, key);
const sheetWidth = zones.length * CELL.width + (zones.length + 1) * 4;
const headerHeight = GLYPH_HEIGHT + 6;
const sheetHeight = headerHeight + rows.length * (CELL.height + LABEL_HEIGHT + 4) + 4;
const sheet = blankImage(sheetWidth, sheetHeight);
fill(BACKGROUND, { height: sheetHeight, width: sheetWidth, x: 0, y: 0 }, sheet);

process.stdout.write(`${key}: steps ${arts.map((art) => art.key).join(", ")}\n`);
process.stdout.write("distance  projected  art            scale  drawn   feet y\n");
for (const { distance, drawn, feetY, projected, rect } of rows) {
  process.stdout.write(
    `${String(distance).padStart(8)}  ${projected.toFixed(3).padStart(9)}  ${drawn.key.padEnd(13)}  ` +
      `${drawn.scale.toFixed(3)}  ${`${rect.width}x${rect.height}`.padEnd(6)}  ${feetY}\n`,
  );
}

await Promise.all(
  zones.map(async (zone, column) => {
    const { over, under } = await zoneLayers(zone);
    const zoneDir = join(keyDir, zone.art);
    await mkdir(zoneDir, { recursive: true });
    const x = 4 + column * (CELL.width + 4);
    drawText(INK, zone.art, { x, y: 3 }, sheet);
    await Promise.all(
      rows.map(async ({ distance, drawn, projected, rect }, i) => {
        const view = cloneImage(under);
        const art = arts.find((candidate) => candidate.key === drawn.key) ?? itemAt(arts, 0);
        drawScaled(art.image, { ...rect, y: rect.y - viewTop }, view);
        paste(over, 0, 0, view);
        await writeFile(
          join(zoneDir, `d${String(distance).padStart(4, "0")}.png`),
          encodePng(view),
        );
        const cell = crop(view, {
          ...CELL,
          x: Math.round(rect.x + rect.width / 2 - CELL.width / 2),
          y: rect.y + rect.height - viewTop + 12 - CELL.height,
        });
        const y = headerHeight + i * (CELL.height + LABEL_HEIGHT + 4);
        paste(cell, x, y, sheet);
        const step = drawn.key === key ? "1X" : drawn.key.slice(key.length + 1);
        drawText(
          INK,
          `D ${distance}  P ${format(projected)}`,
          { x, y: y + CELL.height + 2 },
          sheet,
        );
        drawText(
          DIM,
          `ART ${step}  S ${format(drawn.scale)}  ${rect.width}X${rect.height}`,
          { x, y: y + CELL.height + GLYPH_HEIGHT + 5 },
          sheet,
        );
      }),
    );
  }),
);

await writeFile(join(keyDir, "contact-sheet.png"), encodePng(upscale(SHEET_SCALE, sheet)));
process.stdout.write(`wrote ${join(OUT_DIR, key)}/\n`);
