import type { Rect } from "@andornaut/game-kit/rect";

import { DEPTH_STEPS } from "../assets/depthSteps";

// The pseudo-3D road. Game logic keeps the flat road: x is a point's screen x at the pack
// (a lane's centre), and distance is how far ahead of the walker's feet it is, in road
// pixels. Only drawing goes through this projection, which shrinks the road toward a
// vanishing point above its centre, with scale 1 at the walker's feet.
//
// A point distance d ahead has scale s = f / (f + d) and screen row y = horizonY + k s, where
// k = footY - horizonY puts s = 1 on the feet and f = k / ratio.

export interface RoadCamera {
  readonly horizonY: number;
  readonly ratio: number;
}

// A place on the road: its distance up the road and its x across it, in road pixels.
interface RoadSpot {
  readonly distance: number;
  readonly x: number;
}

interface ScreenPlacement {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

// farY is the screen row where the road meets the backdrop band, and visibleDistance how far
// ahead of the feet that is: the road in view.
export interface RoadProjection {
  readonly centreX: number;
  readonly farY: number;
  readonly focal: number;
  readonly footY: number;
  readonly horizonY: number;
  readonly visibleDistance: number;
}

// A run of screen columns, both ends included.
interface ColumnSpan {
  readonly first: number;
  readonly last: number;
}

// The scales road art is drawn at, 1 first, from the depth step table.
export const SCALE_STEPS: readonly number[] = DEPTH_STEPS.map(({ scale }) => scale);

type Camera = Pick<RoadProjection, "focal" | "footY" | "horizonY">;

// The camera that draws the road's far edge, on row farY, at farScale, visibleDistance ahead
// of the feet on row footY.
export function roadCameraFor(view: {
  farScale: number;
  farY: number;
  footY: number;
  visibleDistance: number;
}): RoadCamera {
  const { farScale, farY, footY, visibleDistance } = view;
  const horizonY = (farY - farScale * footY) / (1 - farScale);
  const focal = (visibleDistance * farScale) / (1 - farScale);
  return { horizonY, ratio: (footY - horizonY) / focal };
}

export function roadProjection(camera: RoadCamera, footY: number, road: Rect): RoadProjection {
  const focal = (footY - camera.horizonY) / camera.ratio;
  const lens = { focal, footY, horizonY: camera.horizonY };
  return {
    ...lens,
    centreX: road.x + road.width / 2,
    farY: road.y,
    visibleDistance: distanceAtY(lens, road.y),
  };
}

export function scaleAt(projection: Pick<Camera, "focal">, distance: number): number {
  return projection.focal / (projection.focal + distance);
}

export function screenYAt(projection: Camera, distance: number): number {
  const { footY, horizonY } = projection;
  return horizonY + (footY - horizonY) * scaleAt(projection, distance);
}

// The inverse of screenYAt.
export function distanceAtY(projection: Camera, y: number): number {
  const scale = scaleAtY(projection, y);
  return projection.focal / scale - projection.focal;
}

export function scaleAtY(projection: Pick<Camera, "footY" | "horizonY">, y: number): number {
  return (y - projection.horizonY) / (projection.footY - projection.horizonY);
}

export function project(
  projection: Pick<RoadProjection, "centreX" | keyof Camera>,
  point: RoadSpot,
): ScreenPlacement {
  const scale = scaleAt(projection, point.distance);
  return {
    scale,
    x: screenXAt(projection, scale, point.x),
    y: screenYAt(projection, point.distance),
  };
}

// The screen x road x is drawn at on a row of this scale: the road spreads from its centre line.
export function screenXAt(
  projection: Pick<RoadProjection, "centreX">,
  scale: number,
  x: number,
): number {
  return projection.centreX + (x - projection.centreX) * scale;
}

// The inverse of screenXAt: the road x drawn at screenX on a row of this scale.
export function roadXAt(
  projection: Pick<RoadProjection, "centreX">,
  scale: number,
  screenX: number,
): number {
  return projection.centreX + (screenX - projection.centreX) / scale;
}

// Screen rows are sampled at their centres.
export function rowScale(projection: Pick<Camera, "footY" | "horizonY">, row: number): number {
  return scaleAtY(projection, row + 0.5);
}

// The screen columns on a row whose centres fall inside road x0..x1 (x1 excluded), or null
// when none does.
export function columnSpan(
  projection: Pick<RoadProjection, "centreX" | "footY" | "horizonY">,
  row: number,
  x0: number,
  x1: number,
): ColumnSpan | null {
  const scale = rowScale(projection, row);
  const first = Math.ceil(screenXAt(projection, scale, x0) - 0.5);
  const last = Math.ceil(screenXAt(projection, scale, x1) - 0.5) - 1;
  return last >= first ? { first, last } : null;
}

// The screen column a line along the road at road x lands on, on a row.
export function lineColumn(
  projection: Pick<RoadProjection, "centreX" | "footY" | "horizonY">,
  row: number,
  x: number,
): number {
  return Math.floor(screenXAt(projection, rowScale(projection, row), x));
}
