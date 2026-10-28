import type { ZoneId } from "../data/types";
import { project, type RoadProjection } from "../layout/projection";
import { LIGHTS } from "./lights";
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
