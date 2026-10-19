import type { Rect } from "./rect";

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

export interface RoadPoint {
  readonly distance: number;
  readonly x: number;
}

export interface ScreenPlacement {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

// farY is the screen row where the road meets the backdrop band, and visibleDistance how far
// ahead of the feet that is: the road in view.
export interface RoadProjection {
  readonly centerX: number;
  readonly farY: number;
  readonly focal: number;
  readonly footY: number;
  readonly horizonY: number;
  readonly visibleDistance: number;
}

// A run of screen columns, both ends included.
export interface ColumnSpan {
  readonly first: number;
  readonly last: number;
}

export const SCALE_STEPS = [1, 0.75, 0.5] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

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
    centerX: road.x + road.width / 2,
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
  projection: Pick<RoadProjection, "centerX" | keyof Camera>,
  point: RoadPoint,
): ScreenPlacement {
  const scale = scaleAt(projection, point.distance);
  return {
    scale,
    x: projection.centerX + (point.x - projection.centerX) * scale,
    y: screenYAt(projection, point.distance),
  };
}

// The inverse of project's x: the road x drawn at screenX on a row of this scale.
export function roadXAt(
  projection: Pick<RoadProjection, "centerX">,
  scale: number,
  screenX: number,
): number {
  return projection.centerX + (screenX - projection.centerX) / scale;
}

// The road distance, from the start of the walk, at the far edge of the road in view, when
// the walk has scrolled scroll pixels.
export function farEdgeAt(projection: Pick<RoadProjection, "visibleDistance">, scroll: number) {
  return scroll + projection.visibleDistance;
}

// Screen rows are sampled at their centres.
export function rowScale(projection: Pick<Camera, "footY" | "horizonY">, row: number): number {
  return scaleAtY(projection, row + 0.5);
}

// The screen columns on a row whose centres fall inside road x0..x1 (x1 excluded), or null
// when none does.
export function columnSpan(
  projection: Pick<RoadProjection, "centerX" | "footY" | "horizonY">,
  row: number,
  x0: number,
  x1: number,
): ColumnSpan | null {
  const scale = rowScale(projection, row);
  const { centerX } = projection;
  const first = Math.ceil(centerX + (x0 - centerX) * scale - 0.5);
  const last = Math.ceil(centerX + (x1 - centerX) * scale - 0.5) - 1;
  return last >= first ? { first, last } : null;
}

// The screen column a line along the road at road x lands on, on a row.
export function lineColumn(
  projection: Pick<RoadProjection, "centerX" | "footY" | "horizonY">,
  row: number,
  x: number,
): number {
  const { centerX } = projection;
  return Math.floor(centerX + (x - centerX) * rowScale(projection, row));
}

// The depth step nearest a scale, judged by ratio, so 0.866 is the 1 / 0.75 boundary.
export function snapScale(scale: number): ScaleStep {
  let best: ScaleStep = SCALE_STEPS[0];
  for (const step of SCALE_STEPS) {
    if (Math.abs(Math.log(scale / step)) < Math.abs(Math.log(scale / best))) {
      best = step;
    }
  }
  return best;
}
