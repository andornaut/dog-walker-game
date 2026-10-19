import type { EncounterId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { type Random, randomPick } from "./random";
import type { RoadItem } from "./roadItems";

// Moving hazards. Everything here is measured in road scroll rather than time, so a mover
// keeps step with the road: it freezes when the road does, and a replay of the same scroll
// puts it in the same place. A lane position is fractional: lane i spans i - 0.5 to i + 0.5.

export type MoverKind = "ball" | "cyclist" | "looseDog" | "squirrel";
// The movers that are minor obstacles; the others open their encounter on contact.
export type MoverObstacleId = "ball" | "cyclist";

const MOVER_OBSTACLES: readonly string[] = ["ball", "cyclist"] satisfies MoverObstacleId[];

export function isMoverObstacle(kind: string): kind is MoverObstacleId {
  return MOVER_OBSTACLES.includes(kind);
}

// What the pack meets on contact with each mover: its walk item kind.
export const MOVER_CONTACTS = {
  ball: "ball",
  cyclist: "cyclist",
  looseDog: "otherDog",
  squirrel: "squirrel",
} as const satisfies Readonly<Record<MoverKind, EncounterId | MoverObstacleId>>;

// A crosser runs across every lane from one edge of the road and off the other, keeping
// pace with the road. A rider comes down one lane from the top of the road, faster than it.
export type MoverMotion =
  | { readonly kind: "cross"; readonly lanesPerSecond: number }
  | { readonly kind: "ride"; readonly speedMultiplier: number };

export interface MoverSpec {
  readonly mover: MoverKind;
  readonly motion: MoverMotion;
  readonly warningSeconds: number;
}

// A planned mover. warning is the scroll its cue shows for before it moves. A crosser's cue
// is at its row on the edge it enters from, and it sets off when its row has travelled
// enterTravel down the road; a rider's cue is at the top of its lane, and it enters there.
export type MoverPath = { readonly mover: MoverKind; readonly warning: number } & (
  | {
      readonly direction: LaneDirection;
      readonly enterTravel: number;
      readonly lanesPerPixel: number;
      readonly motion: "cross";
    }
  | { readonly lane: number; readonly motion: "ride"; readonly speedMultiplier: number }
);

// since is the scroll since its cue appeared.
export interface MoverOnRoad {
  readonly path: MoverPath;
  readonly since: number;
}

// travel is how far the bottom of its hit box is below the top of the road.
export interface MoverPlace {
  readonly lanePosition: number;
  readonly moving: boolean;
  readonly travel: number;
}

export function laneAt(lanePosition: number): number {
  return Math.floor(lanePosition + 0.5);
}

// A crosser enters on the road's edge.
function crossStart(laneCount: number, direction: LaneDirection): number {
  return direction === 1 ? -0.5 : laneCount - 0.5;
}

export function moverPlace(laneCount: number, path: MoverPath, since: number): MoverPlace {
  const moved = since - path.warning;
  if (path.motion === "ride") {
    return {
      lanePosition: path.lane,
      moving: moved >= 0,
      travel: Math.max(0, moved) * path.speedMultiplier,
    };
  }
  const start = crossStart(laneCount, path.direction);
  return {
    lanePosition: start + path.direction * path.lanesPerPixel * Math.max(0, moved),
    moving: moved >= 0,
    travel: path.enterTravel + moved,
  };
}

// A crosser has left once it is half a lane past the far edge, out of sight.
export function hasLeftRoad(laneCount: number, place: MoverPlace): boolean {
  return place.lanePosition < -1 || place.lanePosition > laneCount;
}

export type MoverItem<Kind extends string = string> = RoadItem<Kind> & {
  readonly mover?: MoverOnRoad;
};

export function isWarning(laneCount: number, item: MoverItem): boolean {
  return (
    item.mover !== undefined && !moverPlace(laneCount, item.mover.path, item.mover.since).moving
  );
}

// Moves every mover on by distance of scroll and drops the crossers that have left the road;
// other items are returned as they are. A mover's lane is the one it is in, which is off the
// road while it is entering or leaving.
export function moveMovers<Item extends MoverItem>(
  road: { readonly laneCount: number; readonly roadTop: number },
  distance: number,
  items: readonly Item[],
): Item[] {
  return items.flatMap((item) => {
    if (item.mover === undefined) {
      return [item];
    }
    const mover = { ...item.mover, since: item.mover.since + distance };
    const place = moverPlace(road.laneCount, mover.path, mover.since);
    if (hasLeftRoad(road.laneCount, place)) {
      return [];
    }
    return [
      {
        ...item,
        lane: laneAt(place.lanePosition),
        mover,
        y: road.roadTop - item.height + place.travel,
      },
    ];
  });
}

// Planning works in road distance. sightLength is how far a row travels down the road before
// its window, the stretch of road over which it overlaps the pack, which is window long.
// rowSpacing is the distance between rows.
export interface MoverGeometry {
  readonly cellLength: number;
  readonly laneCount: number;
  readonly roadLength: number;
  readonly rowSpacing: number;
  readonly scrollSpeed: number;
  readonly sightLength: number;
  readonly window: number;
}

// Lanes first to first + count - 1.
export interface LaneSpan {
  readonly count: number;
  readonly first: number;
}

// One way a mover can meet a row. Distances are relative to the row's distance. lanes is
// every lane the mover touches while it overlaps the pack, which is within the row's window;
// cells are the row offsets and lanes kept clear of other spawns: those it passes through on
// the road, and with leadIn, the whole row before its own, so the pack has two rows of road
// to steer around a sweep of several lanes. screen is from its cue appearing until it is out
// of sight.
export interface MoverPlacement {
  readonly appears: number;
  readonly cells: readonly { readonly lane: number; readonly row: number }[];
  readonly lanes: LaneSpan;
  readonly leadIn: boolean;
  readonly path: MoverPath;
  readonly screen: readonly [number, number];
}

function laneSpan(laneCount: number, a: number, b: number): LaneSpan {
  const first = Math.max(0, Math.min(laneAt(a), laneAt(b)));
  const last = Math.min(laneCount - 1, Math.max(laneAt(a), laneAt(b)));
  return { count: Math.max(0, last - first + 1), first };
}

// The lanes a mover touches while its travel is from to to: a crosser's lane position only
// moves one way, so its ends bound it.
export function sweptLanes(laneCount: number, path: MoverPath, from: number, to: number): LaneSpan {
  if (path.motion === "ride") {
    return { count: 1, first: path.lane };
  }
  const moving = Math.max(from, path.enterTravel);
  if (moving >= to) {
    return { count: 0, first: 0 };
  }
  // Travel and scroll are the same for a crosser once it moves.
  const at = (travel: number) =>
    moverPlace(laneCount, path, path.warning + travel - path.enterTravel).lanePosition;
  return laneSpan(laneCount, at(moving), at(to));
}

const HALF_LANE_STEPS = 2;

// Crossers meet the pack partway across: one placement per side and per half lane crossed
// by the middle of the window. Each cue appears on the road, a cell down from its top.
function crossPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  lanesPerSecond: number,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, scrollSpeed, sightLength, window } = geometry;
  const lanesPerPixel = lanesPerSecond / scrollSpeed;
  const warning = spec.warningSeconds * scrollSpeed;
  const placements: MoverPlacement[] = [];
  for (const direction of [1, -1] as const) {
    for (let step = 0; step <= laneCount * HALF_LANE_STEPS; step++) {
      const enterTravel = sightLength + window / 2 - step / HALF_LANE_STEPS / lanesPerPixel;
      const appears = enterTravel - warning;
      if (appears < cellLength) {
        continue;
      }
      const path: MoverPath = {
        direction,
        enterTravel,
        lanesPerPixel,
        motion: "cross",
        mover: spec.mover,
        warning,
      };
      const lanes = sweptLanes(laneCount, path, sightLength, sightLength + window);
      if (lanes.count === 0) {
        continue;
      }
      const leaves = enterTravel + (laneCount + 0.5) / lanesPerPixel;
      placements.push({
        appears,
        cells: [-1, 0].flatMap((row) =>
          Array.from({ length: laneCount }, (_, lane) => ({ lane, row })),
        ),
        lanes,
        leadIn: true,
        path,
        screen: [appears, Math.min(leaves, roadLength + cellLength)],
      });
    }
  }
  return placements;
}

// A rider enters as its row reaches the point where riding faster brings it to the pack
// just as the row's window starts, so it overlaps the pack within that window. On the way it
// overtakes what is in its lane, from the rows above its own to those below the pack.
function ridePlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  speedMultiplier: number,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength } = geometry;
  if (speedMultiplier <= 1) {
    throw new Error("A rider must be faster than the road");
  }
  const warning = spec.warningSeconds * scrollSpeed;
  const enters = sightLength - sightLength / speedMultiplier;
  const leaves = enters + (roadLength + cellLength) / speedMultiplier;
  // The row offset, in distance, that the rider is level with at a scroll.
  const level = (scroll: number) => scroll - speedMultiplier * (scroll - enters);
  const firstRow = Math.floor(level(leaves) / rowSpacing);
  const lastRow = Math.ceil(level(enters) / rowSpacing);
  return Array.from({ length: laneCount }, (_, lane) => ({
    appears: enters - warning,
    cells: Array.from({ length: lastRow - firstRow + 1 }, (_, i) => ({ lane, row: firstRow + i })),
    lanes: { count: 1, first: lane },
    leadIn: false,
    path: { lane, motion: "ride", mover: spec.mover, speedMultiplier, warning },
    screen: [enters - warning, leaves],
  }));
}

export function moverPlacements(geometry: MoverGeometry, spec: MoverSpec): MoverPlacement[] {
  const { motion } = spec;
  return motion.kind === "cross"
    ? crossPlacements(geometry, spec, motion.lanesPerSecond)
    : ridePlacements(geometry, spec, motion.speedMultiplier);
}

// At most this many movers are on screen at once.
export const MOVERS_ON_SCREEN_MAX = 1;

// True when a mover on screen over [start, end) keeps within the limit alongside the
// intervals of the movers already planned.
export function screenHasRoom(
  planned: readonly (readonly [number, number])[],
  interval: readonly [number, number],
): boolean {
  const [start, end] = interval;
  const overlapping = planned.filter(([from, to]) => from < end && start < to).length;
  return overlapping < MOVERS_ON_SCREEN_MAX;
}

// The spawn planner's grid of rows and lanes. block blocks lanes in a row's window, with the
// row before it as a lead-in if asked, if every lane-blocking spawn stays avoidable, and
// undoes it unless keep is set.
export interface MoverGrid {
  block(row: number, lanes: LaneSpan, leadIn: boolean, keep: boolean): boolean;
  isFree(lane: number, row: number): boolean;
  take(lane: number, row: number): void;
}

export interface MoverQuota<Kind extends string> {
  readonly count: number;
  readonly kind: Kind;
  readonly spec: MoverSpec;
}

export interface MoverSpawn<Kind extends string> {
  readonly distance: number;
  readonly kind: Kind;
  readonly lane: number;
  readonly mover: MoverPath;
}

interface Spot {
  readonly distance: number;
  readonly placement: MoverPlacement;
  readonly row: number;
}

function screenOf(spot: Spot): readonly [number, number] {
  const [start, end] = spot.placement.screen;
  return [spot.distance + start, spot.distance + end];
}

// Places every mover on rows at the distances given, each quota spread one per equal
// stretch of the zone as the planner spreads other spawns, each mover wholly on screen
// within the zone. A mover the earlier ones left no room for anywhere is skipped, which
// uses no random draw, as the planner skips an obstacle it has no room for.
export function placeMovers<Kind extends string>(
  random: Random,
  geometry: MoverGeometry & { readonly zoneLength: number },
  grid: MoverGrid,
  rows: readonly number[],
  quotas: readonly MoverQuota<Kind>[],
): MoverSpawn<Kind>[] {
  const onScreen: (readonly [number, number])[] = [];
  const fits = (spot: Spot) => {
    const [start, end] = screenOf(spot);
    return (
      start >= 0 &&
      end <= geometry.zoneLength &&
      screenHasRoom(onScreen, [start, end]) &&
      spot.placement.cells.every(({ lane, row }) => grid.isFree(lane, spot.row + row)) &&
      grid.block(spot.row, spot.placement.lanes, spot.placement.leadIn, false)
    );
  };
  const spotsIn = (placements: readonly MoverPlacement[], first: number, end: number) =>
    placements.flatMap((placement) =>
      rows
        .slice(first, end)
        .map((distance, i) => ({ distance, placement, row: first + i }))
        .filter(fits),
    );

  const spawns: MoverSpawn<Kind>[] = [];
  for (const { count, kind, spec } of quotas) {
    const placements = moverPlacements(geometry, spec);
    for (let i = 0; i < count; i++) {
      const stretch = spotsIn(
        placements,
        Math.floor((i * rows.length) / count),
        Math.floor(((i + 1) * rows.length) / count),
      );
      const spots = stretch.length > 0 ? stretch : spotsIn(placements, 0, rows.length);
      if (spots.length === 0) {
        continue;
      }
      const spot = randomPick(random, spots);
      const { path } = spot.placement;
      spot.placement.cells.forEach(({ lane, row }) => grid.take(lane, spot.row + row));
      grid.block(spot.row, spot.placement.lanes, spot.placement.leadIn, true);
      onScreen.push(screenOf(spot));
      spawns.push({
        distance: spot.distance + spot.placement.appears,
        kind,
        lane: path.motion === "ride" ? path.lane : startLane(geometry.laneCount, path.direction),
        mover: path,
      });
    }
  }
  return spawns;
}

// The lane a crosser enters first.
function startLane(laneCount: number, direction: LaneDirection): number {
  return direction === 1 ? 0 : laneCount - 1;
}
