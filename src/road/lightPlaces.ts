import type { ZoneId } from "../data/types";
import { project, type RoadProjection } from "../layout/projection";
import { LIGHT_ATTACHMENTS, type LightAttachment, LIGHTS } from "./lights";
import { type VergePool, VERGES } from "./roadside";
import { START_STRIP_LENGTH } from "./roadsideProps";

// Where the verges' lights are drawn each frame: every pool light from the walker's feet to the
// stage's reach, on the zone whose road lies there, projected like the roadside props. Its z
// counts along its zone's road from the zone's start strip, as the props' slots do, so a light
// keeps its place beside the props it is set out to match. Past its start strip a zone shows its
// own lights; short of it, the previous zone's. Drawing only.

// What a light is drawn as: its def's key, its anchor on screen and its projected scale.
export interface LightPlace {
  key: string;
  scale: number;
  x: number;
  y: number;
}

// At most this many verge lights are drawn at once.
export const VERGE_LIGHT_LIMIT = 24;

export function newLightPlaces(count: number): LightPlace[] {
  return Array.from({ length: count }, () => ({ key: "", scale: 1, x: 0, y: 0 }));
}

// The road in view: the zone being walked and the one before it, each with the road distance
// from the walk's start at which it began, and the road distance at the walker's feet.
export interface VergeLightFrame {
  current: ZoneId;
  currentStart: number;
  previous: ZoneId | null;
  previousStart: number;
  scroll: number;
}

// The projection, how far ahead of the feet lights are placed, and the view's width.
export interface VergeLightStage {
  readonly projection: RoadProjection;
  readonly reach: number;
  readonly width: number;
}

const SIDES = [
  { name: "left", sign: -1 },
  { name: "right", sign: 1 },
] as const;

// Writes the verge lights in view into out, at most out.length of them, and returns how many.
export function placeVergeLights(
  stage: VergeLightStage,
  frame: VergeLightFrame,
  out: LightPlace[],
): number {
  const from = frame.scroll;
  const to = frame.scroll + stage.reach + 1;
  let count = 0;
  const placeZone = (zone: ZoneId, start: number, zoneFrom: number, zoneTo: number) => {
    // A zone's z counts from its start strip's near edge, visibleDistance past where it began.
    const origin = start + stage.projection.visibleDistance;
    for (const pool of VERGES[zone].pools) {
      if (pool.zones !== null && !pool.zones.includes(zone)) {
        continue;
      }
      for (const { name, sign } of SIDES) {
        for (const z of poolZs(pool, pool.offset[name], zoneFrom - origin, zoneTo - origin)) {
          count = placeLight(stage, frame.scroll, pool, sign, origin + z, out, count);
        }
      }
    }
  };
  if (frame.previous === null) {
    placeZone(frame.current, frame.currentStart, from, to);
  } else {
    const strip = frame.currentStart + stage.projection.visibleDistance;
    placeZone(frame.previous, frame.previousStart, from, Math.min(to, strip));
    placeZone(frame.current, frame.currentStart, Math.max(from, strip + START_STRIP_LENGTH), to);
  }
  return count;
}

// The zs from from to to (excluded) that a side's lights stand at, every pool.every from offset.
export function poolZs(pool: VergePool, offset: number, from: number, to: number): number[] {
  const zs: number[] = [];
  for (let n = Math.ceil((from - offset) / pool.every); offset + n * pool.every < to; n++) {
    zs.push(offset + n * pool.every);
  }
  return zs;
}

function placeLight(
  stage: VergeLightStage,
  scroll: number,
  pool: VergePool,
  sign: -1 | 1,
  distance: number,
  out: LightPlace[],
  count: number,
): number {
  const place = out[count];
  const def = LIGHTS.get(pool.light);
  if (place === undefined || def === undefined) {
    return count;
  }
  const { projection } = stage;
  const placed = project(projection, {
    distance: distance - scroll,
    x: projection.centreX + sign * pool.across,
  });
  const half = (def.width * placed.scale) / 2;
  if (placed.x + half <= 0 || placed.x - half >= stage.width) {
    return count;
  }
  place.key = pool.light;
  place.scale = placed.scale;
  place.x = placed.x;
  place.y = placed.y;
  return count + 1;
}

// A sprite lights may attach to, as drawn this frame: its key, its anchor (its feet) on screen,
// its scale against its full size, whether it is flipped, whether it stands left of the road's
// centre line, and the frame of its sheet it shows.
export interface LightAnchor {
  flipX: boolean;
  frame: number;
  key: string;
  leftOfRoad: boolean;
  scale: number;
  x: number;
  y: number;
}

// An attached light as drawn: its place, its rotation in radians, its strength this frame, the
// screen row of its sprite's feet, which it fades in and is cut off by, and the index of the
// anchor it follows.
export interface AttachedLightPlace extends LightPlace {
  anchor: number;
  groundY: number;
  rotation: number;
  strength: number;
}

// At most this many attached lights are drawn at once.
export const ATTACHED_LIGHT_LIMIT = 48;

export function newAttachedLightPlaces(): AttachedLightPlace[] {
  return Array.from({ length: ATTACHED_LIGHT_LIMIT }, () => ({
    anchor: 0,
    groundY: 0,
    key: "",
    rotation: 0,
    scale: 1,
    strength: 1,
    x: 0,
    y: 0,
  }));
}

// Writes the lights the anchors carry in zone into out, at most out.length of them, and returns
// how many: each offset from its anchor by its dx and dy at the anchor's scale, a cone turned to
// its angle, both mirrored with a flipped sprite, or for a light that faces the road on a sprite
// left of the road, and at its pulse's strength, on the anchor's frame; none on a frame whose
// offset is null.
export function placeAttachedLights(
  zone: ZoneId,
  anchors: readonly LightAnchor[],
  out: AttachedLightPlace[],
): number {
  let count = 0;
  for (const [index, anchor] of anchors.entries()) {
    for (const attachment of LIGHT_ATTACHMENTS.get(anchor.key) ?? NO_ATTACHMENTS) {
      const place = out[count];
      const def = LIGHTS.get(attachment.light);
      if (place === undefined || def === undefined) {
        return count;
      }
      if (attachment.zones !== null && !attachment.zones.includes(zone)) {
        continue;
      }
      const { offsets, pulse } = attachment;
      const offset = offsets[mod(anchor.frame, offsets.length)];
      if (offset === null || offset === undefined) {
        continue;
      }
      const mirrored = anchor.flipX !== (attachment.facesRoad && anchor.leftOfRoad);
      const mirror = mirrored ? -1 : 1;
      const angle = mirrored ? 180 - attachment.angle : attachment.angle;
      place.anchor = index;
      place.groundY = anchor.y;
      place.key = attachment.light;
      place.rotation = def.shape === "cone" ? ((angle - CONE_DOWN) * Math.PI) / 180 : 0;
      place.scale = anchor.scale;
      place.strength = pulse === null ? 1 : (pulse[mod(anchor.frame, pulse.length)] ?? 1);
      place.x = anchor.x + mirror * offset.dx * anchor.scale;
      place.y = anchor.y + offset.dy * anchor.scale;
      count += 1;
    }
  }
  return count;
}

// A cone is baked pointing down.
const CONE_DOWN = 90;
const NO_ATTACHMENTS: readonly LightAttachment[] = [];

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

// A sprite as a view has drawn it: its position, origin, scale and flip.
export interface DrawnSprite {
  readonly flipX: boolean;
  readonly originX: number;
  readonly originY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly x: number;
  readonly y: number;
}

// The art a sprite is drawn from (one of its key's depth steps): its frame's size and its feet's
// row in it; fullHeight is the frame height of the key's full-size art.
export interface DrawnFrame {
  readonly feetY: number;
  readonly fullHeight: number;
  readonly height: number;
  readonly width: number;
}

// Sets anchor to a sprite of key as drawn: its feet on screen (the middle of its frame across,
// its feet's row down), its scale against its full-size art, and whether it stands left of the
// road's centre line, centreX.
export function anchorSprite(
  centreX: number,
  key: string,
  drawn: DrawnSprite,
  frame: DrawnFrame,
  sheetFrame: number,
  anchor: LightAnchor,
): void {
  const scaleX = Math.abs(drawn.scaleX);
  const scaleY = Math.abs(drawn.scaleY);
  anchor.flipX = drawn.flipX;
  anchor.frame = sheetFrame;
  anchor.key = key;
  anchor.scale = (frame.height * scaleY) / frame.fullHeight;
  anchor.x = drawn.x + (0.5 - drawn.originX) * frame.width * scaleX;
  anchor.y = drawn.y + (frame.feetY - drawn.originY * frame.height) * scaleY;
  anchor.leftOfRoad = anchor.x < centreX;
}
