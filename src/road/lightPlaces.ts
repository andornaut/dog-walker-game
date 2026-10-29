import type { Rect } from "@andornaut/game-kit/rect";

import type { ZoneId } from "../data/types";
import { project, type RoadProjection } from "../layout/projection";
import {
  LIGHT_ATTACHMENTS,
  type LightAttachment,
  type LightDef,
  lightOriginY,
  LIGHTS,
} from "./lights";
import { type VergePool, VERGES } from "./roadside";
import { type RoadsideLightReach, type RoadsideSign, START_STRIP_LENGTH } from "./roadsideProps";

// Where the verges' lights are drawn each frame: every pool light from behind the walker's feet
// to the stage's reach, on the zone whose road lies there, projected like the roadside props,
// while any of its rect lies in the stage's view. Its z counts along its zone's road from the
// zone's start strip, as the props' slots do, so a light keeps its place beside the props it is
// set out to match. Past its start strip a zone shows its own lights; short of it, the previous
// zone's. Every light, a verge's or a sprite's, is culled by its own drawn rect, never by its
// sprite's. Drawing only.

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

// The projection, how far behind and ahead of the feet lights are placed, and the screen rect a
// light must reach into to be drawn.
export interface VergeLightStage {
  readonly behind: number;
  readonly projection: RoadProjection;
  readonly reach: number;
  readonly view: Rect;
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
  const from = frame.scroll - stage.behind;
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
  place.key = pool.light;
  place.scale = placed.scale;
  place.x = placed.x;
  place.y = placed.y;
  return lightOnScreen(stage.view, def, 0, place) ? count + 1 : count;
}

// A light's drawn rect about its anchor at full size, its texture's turned to its rotation, as
// the px from the anchor to each edge of the rect's bounds (left and top negative).
export interface LightBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function newLightBounds(): LightBounds {
  return { bottom: 0, left: 0, right: 0, top: 0 };
}

// Writes into out the bounds of def's rect turned by rotation radians about its anchor.
export function lightBounds(
  def: Pick<LightDef, "height" | "shape" | "width">,
  rotation: number,
  out: LightBounds,
): LightBounds {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const top = -lightOriginY(def.shape) * def.height;
  out.bottom = Number.NEGATIVE_INFINITY;
  out.left = Number.POSITIVE_INFINITY;
  out.right = Number.NEGATIVE_INFINITY;
  out.top = Number.POSITIVE_INFINITY;
  for (let corner = 0; corner < 4; corner++) {
    const x = ((corner & 1) === 0 ? -0.5 : 0.5) * def.width;
    const y = (corner & 2) === 0 ? top : top + def.height;
    const turnedX = x * cos - y * sin;
    const turnedY = x * sin + y * cos;
    out.left = Math.min(out.left, turnedX);
    out.right = Math.max(out.right, turnedX);
    out.top = Math.min(out.top, turnedY);
    out.bottom = Math.max(out.bottom, turnedY);
  }
  return out;
}

const scratchBounds = newLightBounds();

// Whether any of def's rect, drawn at place turned by rotation radians, lies inside view.
export function lightOnScreen(
  view: Rect,
  def: Pick<LightDef, "height" | "shape" | "width">,
  rotation: number,
  place: Pick<LightPlace, "scale" | "x" | "y">,
): boolean {
  const { bottom, left, right, top } = lightBounds(def, rotation, scratchBounds);
  const { scale, x, y } = place;
  return (
    x + right * scale > view.x &&
    x + left * scale < view.x + view.width &&
    y + bottom * scale > view.y &&
    y + top * scale < view.y + view.height
  );
}

// How far behind the walker's feet, in road px, a light reaching up px above its anchor at full
// size can still show above screen row bottom, drawn at its row's scale, which grows past 1
// behind the feet; a light drawn no larger than full size, as a sprite's is, shows no further.
export function distanceBehind(
  projection: Pick<RoadProjection, "focal" | "footY" | "horizonY">,
  bottom: number,
  up: number,
): number {
  const { focal, footY, horizonY } = projection;
  const scale = (bottom - horizonY) / (footY - horizonY - up);
  return Math.max(0, focal - focal / scale);
}

// How far above its anchor, in px at full size, the tallest verge light reaches.
export const POOL_LIGHT_UP = Math.max(
  0,
  ...Object.values(VERGES).flatMap(({ pools }) =>
    pools.map(({ light }) => {
      const def = LIGHTS.get(light);
      return def === undefined ? 0 : -lightBounds(def, 0, newLightBounds()).top;
    }),
  ),
);

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
// offset is null, and none whose rect lies wholly outside view, wherever its sprite lies.
export function placeAttachedLights(
  view: Rect,
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
      place.anchor = index;
      place.groundY = anchor.y;
      place.key = attachment.light;
      place.rotation = lightRotation(def, attachment.angle, mirrored);
      place.scale = anchor.scale;
      place.strength = pulse === null ? 1 : (pulse[mod(anchor.frame, pulse.length)] ?? 1);
      place.x = anchor.x + (mirrored ? -1 : 1) * offset.dx * anchor.scale;
      place.y = anchor.y + offset.dy * anchor.scale;
      if (lightOnScreen(view, def, place.rotation, place)) {
        count += 1;
      }
    }
  }
  return count;
}

// A cone is baked pointing down.
const CONE_DOWN = 90;
const NO_ATTACHMENTS: readonly LightAttachment[] = [];

// The rotation in radians a light is drawn at: a cone's from pointing down to its angle in
// degrees, mirrored across the vertical; any other shape's none.
function lightRotation(def: LightDef, angle: number, mirrored: boolean): number {
  const turned = mirrored ? 180 - angle : angle;
  return def.shape === "cone" ? ((turned - CONE_DOWN) * Math.PI) / 180 : 0;
}

// The bounds from its sprite's feet at full size of each light a sprite of key carries, on every
// frame and in every zone, unflipped, standing on the side of the road's centre line sign gives
// (-1 left), where a light that faces the road is mirrored.
function carriedBounds(key: string, sign: RoadsideSign): LightBounds[] {
  return (LIGHT_ATTACHMENTS.get(key) ?? NO_ATTACHMENTS).flatMap((attachment) => {
    const def = LIGHTS.get(attachment.light);
    if (def === undefined) {
      return [];
    }
    const mirrored = attachment.facesRoad && sign === -1;
    const rotation = lightRotation(def, attachment.angle, mirrored);
    const bounds = lightBounds(def, rotation, newLightBounds());
    return attachment.offsets.flatMap((offset) => {
      if (offset === null) {
        return [];
      }
      const dx = (mirrored ? -1 : 1) * offset.dx;
      return [
        {
          bottom: offset.dy + bounds.bottom,
          left: dx + bounds.left,
          right: dx + bounds.right,
          top: offset.dy + bounds.top,
        },
      ];
    });
  });
}

const SIGNS = [-1, 1] as const;
// Each key's carried lights' reach across on the road's left and right.
const CARRIED_REACH = new Map(
  [...LIGHT_ATTACHMENTS.keys()].map((key) => [
    key,
    SIGNS.map((sign) => {
      const all = carriedBounds(key, sign);
      return {
        left: Math.min(...all.map(({ left }) => left)),
        right: Math.max(...all.map(({ right }) => right)),
      };
    }),
  ]),
);

// How far above its sprite's feet, in px at full size, any carried light reaches.
export const CARRIED_LIGHT_UP = Math.max(
  0,
  ...[...LIGHT_ATTACHMENTS.keys()].flatMap((key) =>
    SIGNS.flatMap((sign) => carriedBounds(key, sign).map(({ top }) => -top)),
  ),
);

// How far across, in px at full size from its feet, the lights a sprite of key carries reach on
// every frame and in every zone, unflipped, on the side of the road's centre line sign gives
// (-1 left); undefined for a key that carries none.
export function carriedLightReach(key: string, sign: RoadsideSign): RoadsideLightReach | undefined {
  return CARRIED_REACH.get(key)?.[sign === -1 ? 0 : 1];
}

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
