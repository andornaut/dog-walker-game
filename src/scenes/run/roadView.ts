import { type Scene, type Textures, WEBGL } from "phaser";

import { backdropKey, roadStartKey, roadTileKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import type { Zone } from "../../data/types";
import {
  drawRoad,
  type PixelImage,
  type RoadLook,
  type RoadRaster,
  roadRaster,
  solidStrip,
  STRIP,
  stripLevels,
  stripLines,
} from "../../layout/roadRaster";
import type { Rect } from "../../lib/rect";
import { zoneAt } from "../../rules/route";
import type { Walk } from "../../runner/walk";
import { colorFromHex } from "../../ui/phaser/palette";
import { DEPTH, LAYOUT, PROJECTION } from "./stage";

const ROAD_TEXTURE = "road-projected";

// Each road strip's look and each backdrop's approach rows, read once from their textures and
// kept for the scene's life.
export class RoadArt {
  private readonly approaches = new Map<string, Uint32Array | null>();
  private readonly looks = new Map<string, RoadLook>();
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  look(zone: Zone, key: string): RoadLook {
    let look = this.looks.get(key);
    if (look === undefined) {
      const image = this.imagePixels(key);
      const fits = image?.width === STRIP.width && image.height === STRIP.height;
      const strip = fits ? image : solidStrip(colorFromHex(zone.roadColor));
      look = {
        lines: stripLines(strip),
        strip: stripLevels(strip),
        zone: zone.id as RoadLook["zone"],
      };
      this.looks.set(key, look);
    }
    return look;
  }

  // The backdrop's bottom rows, where the road's approach is drawn over it, across the road's
  // view.
  approach(zone: Zone): Uint32Array | null {
    const key = backdropKey(zone);
    let rows = this.approaches.get(key);
    if (rows === undefined) {
      rows = this.approachRows(key);
      this.approaches.set(key, rows);
    }
    return rows;
  }

  private approachRows(key: string): Uint32Array | null {
    const image = this.imagePixels(key);
    const { approach, rasterView } = LAYOUT;
    if (image === null || image.height < approach.height) {
      return null;
    }
    const rows = new Uint32Array(rasterView.width * approach.height);
    for (let y = 0; y < approach.height; y++) {
      const start = (image.height - approach.height + y) * image.width + rasterView.x;
      rows.set(image.pixels.subarray(start, start + rasterView.width), y * rasterView.width);
    }
    return rows;
  }

  // A loaded image's pixels, read once through a canvas from its frame, which in a build is a
  // rect of an atlas page.
  private imagePixels(key: string): PixelImage | null {
    const { textures } = this.scene;
    if (!textures.exists(key)) {
      return null;
    }
    const { cutHeight: height, cutWidth: width, cutX, cutY, source } = textures.getFrame(key);
    const { image } = source;
    if (!(image instanceof HTMLImageElement || image instanceof HTMLCanvasElement)) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) {
      return null;
    }
    context.drawImage(image, cutX, cutY, width, height, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return { height, pixels: new Uint32Array(data.buffer), width };
  }
}

// The projected road, drawn a row at a time into pixels, then uploaded to its texture.
interface RoadPixels {
  pixels: Uint32Array;
  raster: RoadRaster;
  upload: () => void;
}

export class RoadView {
  private readonly art: RoadArt;
  // What the road was last drawn for, so an unchanged frame skips it.
  private drawn = "";
  private readonly road: RoadPixels | undefined;
  private readonly scene: Scene;

  // One texture the size of the road, kept across runs, that the road is drawn into. Under
  // WebGL its pixel buffer uploads straight to the GPU; the Canvas renderer, which cannot draw
  // a buffer, gets a canvas texture instead. Its approach rows are a second image of it, over
  // the backdrop. Another view of the road names its own texture.
  constructor(scene: Scene, art: RoadArt, road: Rect, textureKey: string = ROAD_TEXTURE) {
    this.scene = scene;
    this.art = art;
    const raster = roadRaster(PROJECTION, road);
    this.road = roadPixels(scene, { key: textureKey, raster }, road);
    const near = road.height - raster.approachRows;
    const image = () => scene.add.image(road.x, road.y, textureKey).setOrigin(0);
    image().setCrop(0, raster.approachRows, road.width, near).setDepth(DEPTH.road);
    image().setCrop(0, 0, road.width, raster.approachRows).setDepth(DEPTH.approach);
  }

  // The zone's road strip and verge, projected row by row; at a zone's start, its start strip
  // rolls in from the far edge over the previous zone's road. Without the art, the zone's
  // colour.
  draw(walk: Walk, zone: Zone, zoneStart: number): void {
    const road = this.road;
    if (road === undefined) {
      return;
    }
    const { textures } = this.scene;
    const scroll = zoneStart + walk.run.zoneDistance;
    const drawn = `${scroll}|${zone.id}`;
    if (drawn === this.drawn) {
      return;
    }
    this.drawn = drawn;
    const previous =
      walk.run.zoneIndex === 0
        ? undefined
        : zoneAt(gameData, walk.run.route, walk.run.zoneIndex - 1);
    const startKey = roadStartKey(zone);
    const transition =
      previous !== undefined && textures.exists(startKey) && textures.exists(roadTileKey(previous))
        ? {
            previous: this.art.look(previous, roadTileKey(previous)),
            start: this.art.look(zone, startKey),
          }
        : null;
    drawRoad(
      road.raster,
      {
        approach: this.art.approach(zone),
        current: this.art.look(zone, roadTileKey(zone)),
        scroll,
        transition,
        zoneStart,
      },
      road.pixels,
    );
    road.upload();
  }
}

function roadPixels(
  scene: Scene,
  { key, raster }: { key: string; raster: RoadRaster },
  road: Rect,
): RoadPixels | undefined {
  const { textures } = scene;
  if (scene.renderer.type === WEBGL) {
    const texture = textures.exists(key)
      ? textures.get(key)
      : textures.addUint8Array(
          key,
          new Uint8Array(road.width * road.height * 4),
          road.width,
          road.height,
        );
    const source = texture?.source[0];
    if (source?.source instanceof Uint8Array) {
      const pixels = new Uint32Array(source.source.buffer);
      return { pixels, raster, upload: () => source.update() };
    }
    return undefined;
  }
  const canvas = textures.exists(key)
    ? (textures.get(key) as Textures.CanvasTexture)
    : textures.createCanvas(key, road.width, road.height);
  if (canvas === null) {
    return undefined;
  }
  const image = canvas.getContext().createImageData(road.width, road.height);
  const upload = () => {
    canvas.getContext().putImageData(image, 0, 0);
    canvas.refresh();
  };
  return { pixels: new Uint32Array(image.data.buffer), raster, upload };
}
