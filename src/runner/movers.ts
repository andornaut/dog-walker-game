import type { MoveCount, MovementKind } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { itemAt } from "../lib/arrays";
import { type Random, randomInt, randomPick, seededRandom, weightedPick } from "../lib/random";
import type { RoadItem } from "./roadItems";
import { nthStretch, rowsWithin, WHOLE_ZONE } from "./stretches";

// Moving hazards. Everything here is measured in road scroll rather than time, so a mover
// keeps step with the road: it freezes when the road does, and a replay of the same scroll
// puts it in the same place. A lane position is fractional: lane i spans i - 0.5 to i + 0.5.
// A mover is an obstacle of a kind that moves: it meets the pack as its kind does.

// One step of a stepping mover. at is the scroll since it spawned when the step starts, and
// its cue shows for the path's warning before that, unless uncued; the step lasts length of
// scroll, moves lanes across, and travel down the road on top of the road's scroll (toward the
// pack when positive).
export interface MoverStep {
  readonly at: number;
  readonly lanes: number;
  readonly length: number;
  readonly travel: number;
  readonly uncued?: true;
}

// A planned mover. warning is the scroll each cue shows for before its move.
// cross (dart): it waits idle at the edge it enters from, at its row, for idle of its warning, then
// shows its cue there for the rest, and it sets off when its row has travelled enterTravel down
// the road, coming down the road at 1 + tilt of the road's speed as it crosses. With turnAfter,
// once it has crossed that many lanes it turns back, with no cue, and crosses the whole road back
// the other way. With stopAfter, once it has crossed that many lanes it stops, with no cue, and
// stands there, coming down the road with it. With both null it crosses once. With slide (a dive),
// it crosses its last lane before its stop at slide of its speed, sliding to its stop. With span,
// it is that many lanes wide, its lane position its leftmost lane's. With pause (a stop-and-go
// across), once it has crossed after lanes it stands for length of scroll, coming down the road
// with it, its cue showing again for cue before it sets off once more; a paused crosser keeps a
// tilt of 0.
// ride (inLane, merge): its cue is at the top of its lanes, where it enters once the cue ends,
// coming down them at speedMultiplier of the road's speed. With merge, it moves lanes across over
// length of scroll from at, its cue showing for cue before that.
// steps (step, hop): it stands on the road from its spawn and takes each step in turn.
// approach: it stands on the road from its spawn and takes the steps it has chosen, each
// toward the pack as the pack stood when its cue began (approach.ts), and has pending steps
// still to choose: within its reach of lanes and rows down, burst a row's travel, each as long as
// its entry in lengths, one per move in order; none starts once its travel reaches stopTravel,
// the pack's rows. reach and lane are its leftmost lane's, so one several lanes wide keeps every
// lane on the road.
// shy (a shy hop): it stands on the road from its spawn and takes the hops it has chosen, each
// away from the pack as the pack stood when its cue began (shy.ts), and has pending hops still to
// choose, each starting at a scroll since it spawned: one of shapes, within its reach of lanes
// and rise of rows up, burst a row's travel, each as long as its entry in lengths; none starts
// once its travel reaches stopTravel, the pack's rows.
export type MoverPath = {
  readonly movement: MovementKind;
  readonly warning: number;
} & (
  | {
      readonly direction: LaneDirection;
      readonly enterTravel: number;
      readonly idle: number;
      readonly lanesPerPixel: number;
      readonly motion: "cross";
      readonly pause?: CrossPause;
      readonly slide?: number;
      readonly span?: number;
      readonly stopAfter: number | null;
      readonly tilt: number;
      readonly turnAfter: number | null;
    }
  | {
      readonly lane: number;
      readonly lanes: number;
      readonly merge?: RideMerge;
      readonly motion: "ride";
      readonly speedMultiplier: number;
    }
  | { readonly lane: number; readonly motion: "steps"; readonly steps: readonly MoverStep[] }
  | {
      readonly burst: number;
      readonly lane: number;
      readonly lengths: readonly number[];
      readonly motion: "approach";
      readonly pending: readonly ApproachTiming[];
      readonly reach: LaneSpan;
      readonly rows: number;
      readonly steps: readonly MoverStep[];
      readonly stopTravel: number;
    }
  | {
      readonly burst: number;
      readonly lane: number;
      readonly lengths: readonly number[];
      readonly motion: "shy";
      readonly pending: readonly number[];
      readonly reach: LaneSpan;
      readonly rise: number;
      readonly shapes: readonly StepShape[];
      readonly steps: readonly MoverStep[];
      readonly stopTravel: number;
    }
);

// A merging rider's lane change: lanes across, over length of scroll from at, a scroll since its
// cue appeared, after its own cue, cue long.
export interface RideMerge {
  readonly at: number;
  readonly cue: number;
  readonly lanes: LaneDirection;
  readonly length: number;
}

// How far across a rider has merged since scroll after its cue appeared: none before its merge,
// and all of it after.
function mergedLanes(path: Extract<MoverPath, { motion: "ride" }>, since: number): number {
  const { merge } = path;
  return merge === undefined
    ? 0
    : merge.lanes * Math.min(1, Math.max(0, (since - merge.at) / merge.length));
}

// Whether a rider is moving across into its merge lane, since scroll after its cue appeared.
export function isMerging(path: MoverPath, since: number): boolean {
  return (
    path.motion === "ride" &&
    path.merge !== undefined &&
    since >= path.merge.at &&
    since < path.merge.at + path.merge.length
  );
}

// When a stalker's pending step starts: after, at a scroll since it spawned, after its cue;
// near, with no cue of its own, once its travel reaches travel and the step before has ended.
type ApproachTiming =
  | { readonly at: number; readonly kind: "after" }
  | { readonly kind: "near"; readonly travel: number };

// since is the scroll since its cue appeared, or since it spawned for a stepping mover.
export interface MoverOnRoad {
  readonly path: MoverPath;
  readonly since: number;
}

// travel is how far the bottom of its hit box is below the top of the road. A solid mover can
// be hit; one that is only its cue cannot.
interface MoverPlace {
  readonly lanePosition: number;
  readonly solid: boolean;
  readonly span?: number;
  readonly travel: number;
}

// The y of the top of a mover height tall at place on a road whose far edge is at roadTop.
export function moverY(roadTop: number, height: number, place: Pick<MoverPlace, "travel">): number {
  return roadTop - height + place.travel;
}

export function laneAt(lanePosition: number): number {
  return Math.floor(lanePosition + 0.5);
}

// The lanes a mover is drawn across, from its leftmost lane: a crosser one, as it crosses them; a
// rider its own lanes; a stepper or stalker every lane of its footprint, laneSpan, as it stands.
export function drawnLanes(laneSpan: number, path: MoverPath): number {
  if (path.motion === "cross") {
    return crossSpan(path);
  }
  return path.motion === "ride" ? path.lanes : laneSpan;
}

type CrossPath = Extract<MoverPath, { motion: "cross" }>;

// A crosser's stop partway across: after lanes crossed, length of scroll standing, the last cue of
// it showing its cue.
export interface CrossPause {
  readonly after: number;
  readonly cue: number;
  readonly length: number;
}

// The scroll since setting off at which a crosser's pause starts, or Infinity with none.
function pauseStart(path: CrossPath): number {
  return path.pause === undefined ? Infinity : path.pause.after / path.lanesPerPixel;
}

// The scroll a crosser has spent crossing, moved scroll after setting off: less the time it has
// stood in its pause.
function crossingMoved(path: CrossPath, moved: number): number {
  const start = pauseStart(path);
  const length = path.pause?.length ?? 0;
  return moved <= start ? moved : Math.max(start, moved - length);
}

// Whether a crosser is standing in its pause, since scroll after its cue appeared.
export function isPausing(path: MoverPath, since: number): boolean {
  if (path.motion !== "cross" || path.pause === undefined) {
    return false;
  }
  const moved = since - path.warning - pauseStart(path);
  return moved >= 0 && moved < path.pause.length;
}

// How many lanes wide a crosser is.
function crossSpan(path: CrossPath): number {
  return path.span ?? 1;
}

// The lanes a diving crosser crosses at its full speed: up to a lane short of its stop, where it
// lands and slides the rest; null for a crosser that does not slide.
function landingLanes(path: CrossPath): number | null {
  return path.slide === undefined || path.stopAfter === null
    ? null
    : Math.max(0, path.stopAfter - 1);
}

// How far across the road a crosser is, in lanes from the edge it entered from, moved scroll after
// setting off: out to its turn, if it has one, and back from there; a diver at its full speed to
// where it lands, and at its slide's from there.
function crossedLanes(path: CrossPath, moved: number): number {
  const across = path.lanesPerPixel * crossingMoved(path, Math.max(0, moved));
  const landing = landingLanes(path);
  if (landing !== null && across > landing) {
    return landing + (across - landing) * (path.slide ?? 1);
  }
  const { turnAfter } = path;
  return turnAfter === null || across <= turnAfter ? across : 2 * turnAfter - across;
}

// The scroll from a crosser setting off until it stops, or Infinity for one that never stops: a
// diver's slide takes 1 / slide as long as its speed would.
export function crossingScroll(path: CrossPath): number {
  if (path.stopAfter === null) {
    return Infinity;
  }
  const landing = landingLanes(path);
  return landing === null
    ? path.stopAfter / path.lanesPerPixel
    : (landing + (path.stopAfter - landing) / (path.slide ?? 1)) / path.lanesPerPixel;
}

// Whether a diving crosser is sliding, since scroll after its cue appeared: from landing until it
// stops.
export function isSliding(path: MoverPath, since: number): boolean {
  if (path.motion !== "cross") {
    return false;
  }
  const landing = landingLanes(path);
  const moved = since - path.warning;
  return landing !== null && moved >= landing / path.lanesPerPixel && moved < crossingScroll(path);
}

// The scroll from a crosser setting off until its travel reaches travel: at 1 + tilt of the
// road's speed while it crosses, and at the road's once it has stopped.
function crossScrollTo(path: CrossPath, travel: number): number {
  const crossing = crossingScroll(path);
  const rise = travel - path.enterTravel;
  return rise <= (1 + path.tilt) * crossing ? rise / (1 + path.tilt) : rise - path.tilt * crossing;
}

// Whether a crosser that stops has stopped, since scroll after its cue appeared.
export function hasStopped(path: MoverPath, since: number): boolean {
  return path.motion === "cross" && since - path.warning >= crossingScroll(path);
}

// Whether a crosser has turned back, since scroll after its cue appeared.
export function turnedBack(path: CrossPath, since: number): boolean {
  return (
    path.turnAfter !== null &&
    path.lanesPerPixel * Math.max(0, since - path.warning) > path.turnAfter
  );
}

// A crosser enters on the road's edge: its leftmost lane's position, span lanes wide.
function crossStart(laneCount: number, direction: LaneDirection, span: number): number {
  return direction === 1 ? 0.5 - span : laneCount - 0.5;
}

// The lanes a crosser span lanes wide crosses from setting off to being half a lane past the far
// edge, out of sight.
function crossLength(laneCount: number, span: number): number {
  return laneCount + span - 0.5;
}

// Where a stalker's or shy hopper's steps taken leave it: lanes across from its start, and rows
// down the road, up when negative.
export function stepsTaken(path: {
  readonly burst: number;
  readonly steps: readonly MoverStep[];
}): { readonly lanes: number; readonly rows: number } {
  return {
    lanes: path.steps.reduce((sum, step) => sum + step.lanes, 0),
    rows: path.steps.reduce((sum, step) => sum + step.travel, 0) / path.burst,
  };
}

// How long a stalker's or shy hopper's next move lasts: its entry in lengths, by the moves taken.
function nextLength(path: {
  readonly lengths: readonly number[];
  readonly steps: readonly MoverStep[];
}): number {
  const length = path.lengths[path.steps.length];
  if (length === undefined) {
    throw new Error("A stalker or shy hopper has a length for each of its moves");
  }
  return length;
}

// Whether a stalker or shy hopper in lane, making a move of shape, stays within its reach.
export function staysInReach(reach: LaneSpan, lane: number, shape: StepShape): boolean {
  return lane + shape.lanes >= reach.first && lane + shape.lanes < reach.first + reach.count;
}

// A stalker's or shy hopper's path with its next pending move taken as shape, at a scroll of at
// since it spawned, uncued when it has no cue of its own: a cell per lane across and burst per row.
export function takeMove<
  Path extends {
    readonly burst: number;
    readonly lengths: readonly number[];
    readonly pending: readonly unknown[];
    readonly steps: readonly MoverStep[];
  },
>(at: number, uncued: boolean, shape: StepShape, path: Path): Path {
  const step: MoverStep = {
    at,
    lanes: shape.lanes,
    length: nextLength(path),
    travel: shape.travel * path.burst,
    ...(uncued ? { uncued: true } : {}),
  };
  return { ...path, pending: path.pending.slice(1), steps: [...path.steps, step] };
}

// A point on the road, in road pixels: x across from the road's left edge, y down the screen.
export interface RoadPoint {
  readonly x: number;
  readonly y: number;
}

// How far through a step a mover is, from 0 before it to 1 after it.
function stepDone(step: MoverStep, since: number): number {
  return Math.min(1, Math.max(0, (since - step.at) / step.length));
}

export function moverPlace(laneCount: number, path: MoverPath, since: number): MoverPlace {
  const moved = since - path.warning;
  if (path.motion === "ride") {
    return {
      lanePosition: path.lane + mergedLanes(path, since),
      solid: moved >= 0,
      travel: Math.max(0, moved) * path.speedMultiplier,
    };
  }
  if (path.motion === "steps" || path.motion === "approach" || path.motion === "shy") {
    let lanePosition = path.lane;
    let travel = since;
    for (const step of path.steps) {
      const done = stepDone(step, since);
      lanePosition += step.lanes * done;
      travel += step.travel * done;
    }
    return { lanePosition, solid: true, travel };
  }
  const start = crossStart(laneCount, path.direction, crossSpan(path));
  const crossing = Math.min(Math.max(0, moved), crossingScroll(path));
  return {
    lanePosition: start + path.direction * crossedLanes(path, crossing),
    solid: moved >= 0,
    ...(path.span === undefined ? {} : { span: path.span }),
    travel:
      path.enterTravel + (moved < 0 ? moved : crossing * (1 + path.tilt) + (moved - crossing)),
  };
}

// The cue a mover shows, about a second before each move: an arrow across the road for a dart,
// down or up its lane for an in-lane move faster or slower than the road, or the wander mark
// before a step or a rider's merge.
export type MoverTell =
  | { readonly direction: LaneDirection; readonly kind: "across" }
  | { readonly kind: "down" }
  | { readonly kind: "up" }
  | { readonly kind: "wander" };

export function moverTell(path: MoverPath, since: number): MoverTell | null {
  if (path.motion === "cross") {
    const restart = path.warning + pauseStart(path) + (path.pause?.length ?? 0);
    const cued =
      (since >= path.idle && since < path.warning) ||
      (since >= restart - (path.pause?.cue ?? 0) && since < restart);
    return cued ? { direction: path.direction, kind: "across" } : null;
  }
  if (path.motion === "ride") {
    if (since < path.warning) {
      return { kind: path.speedMultiplier > 1 ? "down" : "up" };
    }
    const { merge } = path;
    return merge !== undefined && since >= merge.at - merge.cue && since < merge.at
      ? { kind: "wander" }
      : null;
  }
  return cuedStep(path, since) === undefined ? null : { kind: "wander" };
}

// Whether a dart is still waiting idle at its edge, since scroll after it appeared: before its cue.
export function isWaiting(path: MoverPath, since: number): boolean {
  return path.motion === "cross" && since < path.idle;
}

// The step of a stepping mover whose cue shows since scroll after it spawned, if any.
export function cuedStep(
  path: { readonly steps: readonly MoverStep[]; readonly warning: number },
  since: number,
): MoverStep | undefined {
  return path.steps.find(
    (step) => step.uncued !== true && since >= step.at - path.warning && since < step.at,
  );
}

// Whether a mover is moving rather than standing or showing its cue: a crosser that stops stands
// from its stop on.
export function inMotion(path: MoverPath, since: number): boolean {
  if (path.motion === "cross") {
    return since >= path.warning && !hasStopped(path, since) && !isPausing(path, since);
  }
  if (path.motion === "ride") {
    return since >= path.warning;
  }
  return path.steps.some((step) => since >= step.at && since < step.at + step.length);
}

// Whether a mover faces left. Side-view art faces right, so it is mirrored while this holds: a
// crosser running left, the way it set off or back after turning, and a stepper or hopper from the
// start of a step to the left until a step to the right. A rider merging left faces left from its
// merge's cue on; any other rider and a stepper yet to move sideways face right.
export function facesLeft(path: MoverPath, since: number): boolean {
  if (path.motion === "cross") {
    return (turnedBack(path, since) ? -path.direction : path.direction) === -1;
  }
  if (path.motion === "ride") {
    const { merge } = path;
    return merge !== undefined && merge.lanes < 0 && since >= merge.at - merge.cue;
  }
  const sideways = path.steps.filter((step) => step.lanes !== 0 && since >= step.at);
  return (sideways.at(-1)?.lanes ?? 0) < 0;
}

// A crosser has left once it is half a lane past the far edge, out of sight, its far lane for one
// several lanes wide. One that stops never leaves sideways: it scrolls off the road's bottom.
export function hasLeftRoad(laneCount: number, place: MoverPlace): boolean {
  return place.lanePosition + (place.span ?? 1) - 1 < -1 || place.lanePosition > laneCount;
}

export type MoverItem<Kind extends string = string> = RoadItem<Kind> & {
  readonly mover?: MoverOnRoad;
};

export function isWarning(laneCount: number, item: MoverItem): boolean {
  return (
    item.mover !== undefined && !moverPlace(laneCount, item.mover.path, item.mover.since).solid
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
  const moved: Item[] = [];
  for (const item of items) {
    if (item.mover === undefined) {
      moved.push(item);
      continue;
    }
    const mover = { ...item.mover, since: item.mover.since + distance };
    const place = moverPlace(road.laneCount, mover.path, mover.since);
    if (!hasLeftRoad(road.laneCount, place)) {
      moved.push({
        ...item,
        lane: laneAt(place.lanePosition),
        mover,
        y: moverY(road.roadTop, item.height, place),
      });
    }
  }
  return moved;
}

// Planning works in road distance. sightLength is how far a row travels down the road before
// its window, the stretch of road over which a one-row spawn on it overlaps the pack, which is
// window long. rowSpacing is the distance between rows, and cellLength a row of a footprint and a
// lane's width. laneInset is how far inside its lane a mover's hit box is at each side.
// packHitLength is the length of the pack's hit boxes, by which a mover's stands are measured.
export interface MoverGeometry {
  readonly cellLength: number;
  readonly laneCount: number;
  readonly laneInset: number;
  readonly packHitLength: number;
  readonly packLength: number;
  readonly roadLength: number;
  readonly rowSpacing: number;
  readonly scrollSpeed: number;
  readonly sightLength: number;
  readonly window: number;
}

// How strongly a placement is drawn toward the lanes left unblocked longest, from the longest run
// of rows its lanes are clear through: the square of it.
export function laneBalanceWeight(clearRows: number): number {
  return clearRows * clearRows;
}

// The planned hit length of a mover rows long: the window less the pack's length, which is a
// one-row hit box, and a cell for each row after the first.
function bodyLength(geometry: MoverGeometry, rows: number): number {
  return geometry.window - geometry.packLength + (rows - 1) * geometry.cellLength;
}

// A mover's hit length for its stands: its kind's drawn one, or the planned hit length of its
// footprint (bodyLength).
function drawnHitLength(geometry: MoverGeometry, spec: MoverSpec): number {
  return spec.hitLength ?? bodyLength(geometry, spec.footprint.rows);
}

// Lanes first to first + count - 1.
export interface LaneSpan {
  readonly count: number;
  readonly first: number;
}

// Where a mover stands as an obstacle, for the pack-fit gap: the distance at which its hit box
// meets the pack, its leftmost lane, the lanes it covers, and its contact with the pack less the
// pack's length: the road behind it the pack cannot step into while it passes.
export interface MoverStand {
  readonly distance: number;
  readonly lane: number;
  readonly lanes: number;
  readonly length: number;
}

// A cell a mover keeps clear: a row offset from its own row, and a lane.
interface BlockCell {
  readonly lane: number;
  readonly row: number;
}

// The road a mover's hit box covers, in its lanes, from its near end's nearest distance to its
// far end's farthest. Each distance is where the near edge of a standing spawn's hit box would
// be level with it, so a standing spawn whose hit box runs from its own distance up the road for
// its hit length shares no road with the mover when the two spans do not overlap.
export interface MoverBody {
  readonly from: number;
  readonly lanes: LaneSpan;
  readonly to: number;
}

// Every cell of rowCount rows from firstRow by laneCount lanes from firstLane, row by row.
function blockCells(
  firstRow: number,
  rowCount: number,
  firstLane: number,
  laneCount: number,
): BlockCell[] {
  return Array.from({ length: rowCount }, (_, i) =>
    Array.from({ length: laneCount }, (_unused, j) => ({ lane: firstLane + j, row: firstRow + i })),
  ).flat();
}

// One way a mover can meet a row. Distances are relative to the row's distance; appears is
// its spawn. lanes and rows are what it blocks from its row on, as a standing obstacle that
// size would: every lane it touches while it overlaps the pack, for as long as it can. cells
// are the row offsets and lanes kept clear of other spawns, but a lane-blocking standing spawn
// clear of its body: those it passes through on the road. stands are each place it stands as an
// obstacle, by distance from its row. screen is from its cue appearing until it is out of sight.
// body is the road its hit box covers at any moment while it is on the road, by distance from its
// row; a dart has none, as a standing spawn may stand where a dart passes. Of the placements that
// fit in a start lane and row, the planner takes one of the highest rank, 0 when unset.
interface MoverPlacement {
  readonly appears: number;
  readonly body?: MoverBody;
  readonly cells: readonly BlockCell[];
  readonly lane: number;
  readonly lanes: LaneSpan;
  readonly path: MoverPath;
  readonly rank?: number;
  readonly rows: number;
  readonly screen: readonly [number, number];
  readonly stands: readonly MoverStand[];
}

// The lanes on the road a box overlaps anywhere from lane position low to high: as collision cuts
// a mover's box to its lanes, it spans half a lane either side of its position, less inset lanes
// at each side. A box wholly off the road overlaps none: no lanes from lane 0.
function laneSpan(laneCount: number, low: number, high: number, inset: number): LaneSpan {
  const first = Math.max(0, Math.floor(low - 1 + inset + 1e-9) + 1);
  const last = Math.min(laneCount - 1, Math.ceil(high + 1 - inset - 1e-9) - 1);
  return last < first ? { count: 0, first: 0 } : { count: last - first + 1, first };
}

// The lanes a crosser touches while its travel is from to to: its travel only moves one way and its
// lane position one way to its turn and the other way after, or to its stop and then not at all,
// so its ends and its turn bound it. Its box is inset lanes inside a lane at each side, none
// unless given, so a box between lanes touches both. A rider or stepping mover's are its own.
export function sweptLanes(
  laneCount: number,
  path: MoverPath,
  from: number,
  to: number,
  inset = 0,
): LaneSpan {
  if (path.motion === "ride") {
    const merged = path.lane + (path.merge?.lanes ?? 0);
    return {
      count: path.lanes + Math.abs(merged - path.lane),
      first: Math.min(path.lane, merged),
    };
  }
  if (path.motion === "steps" || path.motion === "approach" || path.motion === "shy") {
    return { count: 1, first: path.lane };
  }
  const moving = Math.max(from, path.enterTravel);
  if (moving >= to) {
    return { count: 0, first: 0 };
  }
  // The lane position once the crosser's travel has reached travel.
  const at = (travel: number) =>
    moverPlace(laneCount, path, path.warning + crossScrollTo(path, travel)).lanePosition;
  const turn =
    path.turnAfter === null
      ? null
      : path.enterTravel + ((1 + path.tilt) * path.turnAfter) / path.lanesPerPixel;
  const places = [moving, to, ...(turn !== null && turn > moving && turn < to ? [turn] : [])].map(
    at,
  );
  const low = Math.min(...places);
  return laneSpan(laneCount, low, Math.max(...places) + crossSpan(path) - 1, inset);
}

// The footprint a mover keeps: lanes across and rows along the road.
export interface MoverFootprint {
  readonly lanes: number;
  readonly rows: number;
}

// One step of a stepping mover: lanes to either side, rows toward the pack (travel above 0) or
// away (below 0), or both, diagonally. A step is a spot; a hop is one step of 1 or more spots one
// way, a diagonal spot a lane across and a row along at once.
export interface StepShape {
  readonly lanes: number;
  readonly travel: number;
}

// Every hop of 1 to most spots one way: lanes to either side or, unless sideways, a row up the
// road, away from the pack, or diagonally up. A hop never goes down toward the pack. The planner
// picks among those that keep the road passable.
export function hopShapes(most: number, sideways: boolean): StepShape[] {
  const ways: readonly StepShape[] = sideways
    ? [
        { lanes: -1, travel: 0 },
        { lanes: 1, travel: 0 },
      ]
    : [
        { lanes: -1, travel: 0 },
        { lanes: 1, travel: 0 },
        { lanes: 0, travel: -1 },
        { lanes: -1, travel: -1 },
        { lanes: 1, travel: -1 },
      ];
  return Array.from({ length: most }, (_, i) => i + 1).flatMap((spots) =>
    ways.map(({ lanes, travel }) => ({ lanes: lanes * spots, travel: travel * spots })),
  );
}

// How many spots a step covers.
export function stepSpots(shape: StepShape): number {
  return Math.max(Math.abs(shape.lanes), Math.abs(shape.travel));
}

// The most hop sequences of one count a hopper takes. There are as many as its hop shapes to the
// power of the count, and the planner tries each one of a mover's drawn count at every start lane
// and row, so this bounds the planner's work.
export const HOP_SEQUENCES_MOST = 1000;

// The sequences of times hops, each hop one of hopShapes(most, sideways), in order as numbers in
// base shapes.length, the first hop the most significant digit: every one when there are at most
// HOP_SEQUENCES_MOST, and otherwise that many distinct ones, drawn from a stream seeded with one
// draw from random, the only draw it makes.
export function hopSequences(
  random: Random,
  most: number,
  sideways: boolean,
  times: number,
): StepShape[][] {
  const shapes = hopShapes(most, sideways);
  const total = shapes.length ** times;
  const indices =
    total <= HOP_SEQUENCES_MOST
      ? Array.from({ length: total }, (_, i) => i)
      : drawnIndices(random, total);
  return indices.map((index) =>
    Array.from({ length: times }, (_, hop) =>
      itemAt(shapes, Math.floor(index / shapes.length ** (times - 1 - hop)) % shapes.length),
    ),
  );
}

// HOP_SEQUENCES_MOST distinct indices below total, ascending, each set of them as likely (Floyd's
// sampling, one draw per index).
function drawnIndices(random: Random, total: number): number[] {
  const drawn = seededRandom(Math.floor(random() * 2 ** 32));
  const picked = new Set<number>();
  for (let top = total - HOP_SEQUENCES_MOST; top < total; top++) {
    const index = randomInt(drawn, 0, top + 1);
    picked.add(picked.has(index) ? top : index);
  }
  return [...picked].sort((a, b) => a - b);
}

// How a shy hopper hops, at a share of the movers of its kind drawn per mover: as the road between
// it and the pack's rows comes down to nearSeconds of the road's travel, each of its hops one of
// shapes chosen away from the pack (shy.ts), ending at most rise rows up the road.
interface ShyHops {
  readonly nearSeconds: number;
  readonly rise: number;
  readonly shapes: readonly StepShape[];
  readonly share: number;
}

// cross: across the road at lanesPerSecond, tilted down the road by a tilt of the road's speed
// drawn per mover from tilt, setting off a share of the road ahead of the pack drawn per mover
// from startRoadShare, never so low that the pack has less than reactionSeconds after its cue to
// meet it at its drawn tilt, raised past startRoadShare where a steep tilt needs. At turnBackShare
// of them, drawn per mover, it turns back once it has crossed a share of the road drawn per mover
// from turnAtShare, and crosses the whole road back. At stopShare of them, drawn with the same
// draw (dartOutcome), it stops: at vergeShare of those on the far verge, DART_VERGE_LANES past the
// road's far edge, out of play, and at the rest in the lane stopLanes lanes from the edge it
// enters from, drawn per mover, standing there. With slide (a dive), it crosses its last lane
// before that stop at slide of its speed. With pauseSeconds (a stop-and-go across), it stands that
// long once in the middle of the road, cued again before it sets off once more.
// ride: down its lane at speedMultiplier of the road's speed, above 1 toward the pack, below 1
// away. With merge, once its travel down the road is at of the way to the pack's rows it moves a
// lane to one side over seconds, after a cue. steps: one of the sequences as long as its count,
// drawn per mover from count, each step stepSeconds long however many spots it covers; the
// planner picks whichever keeps the road passable. The count is drawn from the lengths of the
// sequences within count, each as likely. Each step after the first comes pauseSeconds after the
// one before ends, none without it; with cueEach, each step has a cue of its own, and the pause
// is at least the cue. With drift, each step also travels drift of its length down the road, up
// when below 0: a push at a speed. With shy, a share of them hop shy instead, as many times as
// their count. approach: steps steps toward the pack, drawn per mover, each stepSeconds long, the
// first's cue firstDelaySeconds after the mover is wholly on the road and each later one, with no
// cue, once the step before has ended and the road between it and the pack is secondRoadShare of
// the road's length, each range drawn from per mover.
export type MoverMotion =
  | {
      readonly firstDelaySeconds: readonly [number, number];
      readonly kind: "approach";
      readonly secondRoadShare: readonly [number, number];
      readonly stepSeconds: number;
      readonly steps: MoveCount;
    }
  | {
      readonly kind: "cross";
      readonly lanesPerSecond: number;
      readonly pauseSeconds?: number;
      readonly reactionSeconds: number;
      readonly startRoadShare: readonly [number, number];
      readonly stopLanes: MoveCount;
      readonly slide?: number;
      readonly stopShare: number;
      readonly tilt: readonly [number, number];
      readonly turnAtShare: readonly [number, number];
      readonly turnBackShare: number;
      readonly vergeShare: number;
    }
  | {
      readonly kind: "ride";
      readonly merge?: { readonly at: number; readonly seconds: number };
      readonly speedMultiplier: number;
    }
  | {
      readonly count: MoveCount;
      readonly cueEach?: true;
      readonly drift?: number;
      readonly kind: "steps";
      readonly pauseSeconds?: number;
      readonly sequences: readonly (readonly StepShape[])[];
      readonly shy?: ShyHops;
      readonly stepSeconds: number;
    };

// How much movers of a kind differ: each one's speed by up to speedShare of it either way, each
// of its steps or hops up to delaySeconds later than its earliest moment, and each step's or hop's
// length by up to lengthShare of it either way.
interface MoverVariation {
  readonly delaySeconds: number;
  readonly lengthShare: number;
  readonly speedShare: number;
}

// hitLength is the kind's drawn hit length while it moves, by which its stands are measured;
// without it, the planned hit length of its footprint.
export interface MoverSpec {
  readonly footprint: MoverFootprint;
  readonly hitLength?: number;
  readonly motion: MoverMotion;
  readonly movement: MovementKind;
  readonly variation: MoverVariation;
  readonly warningSeconds: number;
}

// One mover's draws, each from 0 up to 1, made as it is planned: how many times it moves, its
// speed, the delay before each of its moves, the length of each of its moves, a stalker's
// later-step road share, where a dart sets off, a dart's tilt, whether a hopper of a shy kind hops
// shy (below its kind's share), a dart's outcome (dartOutcome), where a dart turns back or stops,
// and which side a stalker's or shy hopper's one-sided reach favours (below a half, the left).
// EVEN_DRAWS moves it at its kind's speed and move length with no delay, at the near end of a
// range, never shy and crossing.
export interface MoverDraws {
  readonly count: number;
  readonly delays: readonly number[];
  readonly lengths: readonly number[];
  readonly share: number;
  readonly shy: number;
  readonly side: number;
  readonly speed: number;
  readonly start: number;
  readonly tilt: number;
  readonly turn: number;
  readonly turnAt: number;
}

// How many move delays and lengths each mover draws: as many as the most moves any kind makes.
const MOVE_DRAWS = 6;

const EVEN_DRAWS: MoverDraws = {
  count: 0,
  delays: Array.from({ length: MOVE_DRAWS }, () => 0),
  lengths: Array.from({ length: MOVE_DRAWS }, () => 0.5),
  share: 0,
  shy: 0.999999,
  side: 0,
  speed: 0.5,
  start: 0,
  tilt: 0,
  turn: 0.999999,
  turnAt: 0,
};

// The planner's random streams. spawns places every spawn and draws each mover's speed, first two
// delays and share; movers draws each mover's count, later delays, start, shyness, tilt, outcome,
// where it turns back or stops, reach side and move lengths, and each mover's start lane, so those
// never shift the spawns stream.
export interface PlannerStreams {
  readonly movers: Random;
  readonly spawns: Random;
}

// Every mover draws the same number of times from each stream, whatever it is and wherever it goes.
export function drawMover(streams: PlannerStreams): MoverDraws {
  const { movers, spawns } = streams;
  const delays = [spawns(), spawns()] as const;
  const share = spawns();
  const speed = spawns();
  const count = movers();
  const later = Array.from({ length: MOVE_DRAWS - delays.length }, () => movers());
  const start = movers();
  const shy = movers();
  const tilt = movers();
  const turn = movers();
  const turnAt = movers();
  const side = movers();
  return {
    count,
    delays: [...delays, ...later],
    lengths: Array.from({ length: MOVE_DRAWS }, () => movers()),
    share,
    shy,
    side,
    speed,
    start,
    tilt,
    turn,
    turnAt,
  };
}

// How a dart ends, by its outcome draw from 0 up to 1: below turnBackShare it turns back; below
// turnBackShare + stopShare it stops, in a lane at the low 1 - vergeShare of that stretch and on
// the far verge at the rest; and otherwise it crosses. The turn-back and stop shares add up to at
// most 1. One draw decides all of it, so the verge share takes no draw of its own.
type DartOutcome = "cross" | "stop" | "turn" | "verge";

export function dartOutcome(
  motion: Pick<
    Extract<MoverMotion, { kind: "cross" }>,
    "stopShare" | "turnBackShare" | "vergeShare"
  >,
  draw: number,
): DartOutcome {
  const { stopShare, turnBackShare, vergeShare } = motion;
  if (draw < turnBackShare) {
    return "turn";
  }
  if (draw < turnBackShare + stopShare * (1 - vergeShare)) {
    return "stop";
  }
  return draw < turnBackShare + stopShare ? "verge" : "cross";
}

// How far past the road's far edge, in lanes, a dart that stops on the verge stands: clear of
// the curb props on the widest sidewalk, where the ambient verge movers stop.
export const DART_VERGE_LANES = 1.25;

// Whether a dart stops on the verge, past the road's far edge: one with a stop beyond the road.
export function stopsOnVerge(laneCount: number, path: MoverPath): boolean {
  return path.motion === "cross" && path.stopAfter !== null && path.stopAfter > laneCount;
}

// The count a draw from 0 up to 1 picks from a mover's range, each count as likely.
export function drawnCount(range: MoveCount, draw: number): number {
  const spread = range.max - range.min;
  return range.min + Math.min(spread, Math.floor(draw * (spread + 1)));
}

// The factor a mover's speed is multiplied by, from 1 - speedShare to 1 + speedShare.
function speedFactor(variation: MoverVariation, draws: MoverDraws): number {
  return 1 + variation.speedShare * (2 * draws.speed - 1);
}

function delayOf(variation: MoverVariation, draws: MoverDraws, index: number): number {
  return variation.delaySeconds * (draws.delays[index] ?? 0);
}

// How long a mover's move at index lasts: length at a factor from 1 - lengthShare to
// 1 + lengthShare, drawn per move.
function moveLength(
  variation: MoverVariation,
  draws: MoverDraws,
  index: number,
  length: number,
): number {
  return length * (1 + variation.lengthShare * (2 * (draws.lengths[index] ?? 0.5) - 1));
}

function within(range: readonly [number, number], draw: number): number {
  return range[0] + (range[1] - range[0]) * draw;
}

// The fewest rows whose blocking length covers rows' blocking length stretched by stretch.
function rowsCovering(geometry: MoverGeometry, rows: number, stretch: number): number {
  const { cellLength, window } = geometry;
  const needed = (window + (rows - 1) * cellLength) * stretch;
  return Math.max(rows, 1 + Math.ceil((needed - window) / cellLength - 1e-9));
}

// The tilts a crosser draws from on a road scrolling at scrollSpeed: its range, its high end cut
// to the steepest that still leaves the pack reactionSeconds from a start highest of the road
// ahead, but never below its low end.
function crossTilts(
  motion: Pick<Extract<MoverMotion, { kind: "cross" }>, "reactionSeconds" | "tilt">,
  scrollSpeed: number,
  sightLength: number,
  highest: number,
): readonly [number, number] {
  const [low, high] = motion.tilt;
  const steepest = (highest * sightLength) / (motion.reactionSeconds * scrollSpeed) - 1;
  return [low, Math.max(low, Math.min(high, steepest))];
}

// A crosser sets off at its drawn share of the road ahead of the pack, the tallest pack's rows at
// sightLength, at its drawn speed and tilt: one placement per side it enters from, its contact with
// the pack, if it has one, starting as its row's window does. Its share is drawn from
// startRoadShare, its low end raised to leave the pack reactionSeconds between its cue ending and
// its reaching the pack's rows at its tilt, and its high end raised with it where a steep tilt
// needs, but never above the highest share that shows its cue wholly on the road. Its tilt is drawn
// from its range cut to the steepest that leaves a share at that highest, at the road's pace; with
// none, even at its range's lowest, it has no placement. Lifted, it sets off that share of the way
// from its drawn share up to the highest that shows its cue, at the same tilt, which leaves the
// pack at least its reaction time. One that turns back crosses back the whole road from its turn,
// on the road and in sight the longer for it, keeping clear every row it is level with and meeting
// the pack in every lane it sweeps either way while its row is in the window. One that stops stands
// in its stop lane, coming down the road with it, until it scrolls off the road's bottom: it meets
// the pack in every lane it sweeps to its stop and in its stop lane, and its start is raised as far
// as needed for the pack to have reactionSeconds to its reaching the pack's rows, which a tilt
// below 0 brings sooner once it stops; past the road's far edge, its stop lane is no stop, and it
// crosses. One that stops on the verge is planned as one that crosses: off the road it is out of
// play, so it holds its rows only while it crosses and stands nowhere past the road. Its contact
// lasts as long as its travel takes to cross the window, window / (1 + tilt) while it crosses,
// which its rows cover. It blocks every lane a box a lane wide would touch, but stands only in the
// lanes its drawn hit box touches over its drawn contact with the pack's hit boxes, until its hit
// box leaves the road if that comes before its contact's end: a stand wider or longer than its hit
// box would hide the road beside or behind it that the pack can step into. One that has crossed
// the road by the time it reaches the pack's rows is harmless: it blocks no lanes and stands
// nowhere. It keeps clear every row it is level with as it crosses or stands. It appears as its
// row comes on screen, or at the road's top where its start is farther up the road than its row,
// and waits idle at its edge until its cue, warningSeconds before it sets off.
function crossPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  draws: MoverDraws,
  lift: number,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength, window } =
    geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const cueOnRoad = 1 - (warning + cellLength) / sightLength;
  const tilt = within(crossTilts(motion, scrollSpeed, sightLength, cueOnRoad), draws.tilt);
  if (tilt <= -1) {
    throw new Error("A crosser's tilt must keep it coming down the road");
  }
  const lanesPerPixel = (motion.lanesPerSecond * speedFactor(spec.variation, draws)) / scrollSpeed;
  const outcome = dartOutcome(motion, draws.turn);
  const turnAfter =
    outcome === "turn" ? within(motion.turnAtShare, draws.turnAt) * laneCount : null;
  // It stops in the middle of the stopLanes-th lane from its edge, half a lane short of that many.
  const stopLanes = drawnCount(motion.stopLanes, draws.turnAt);
  // One that stops on the verge stops DART_VERGE_LANES past the far edge.
  const stopAfter =
    outcome === "verge"
      ? laneCount + DART_VERGE_LANES
      : outcome === "stop" && stopLanes <= laneCount
        ? stopLanes - 0.5
        : null;
  // Whether it is planned as one that crosses: it never stands on the road. One that stops on the
  // verge is out of play once off the road, so it is.
  const crosses = stopAfter === null || stopAfter > laneCount;
  // Its width, and its pause, in the middle of the road, standing with its lanes centred.
  const span = spec.footprint.lanes;
  const pause =
    motion.pauseSeconds === undefined
      ? {}
      : {
          pause: {
            after: (laneCount + span - 1) / 2,
            cue: warning,
            length: motion.pauseSeconds * scrollSpeed,
          },
        };
  if (motion.pauseSeconds !== undefined && tilt !== 0) {
    throw new Error("A crosser that pauses must cross level with the road");
  }
  // Its path but for the side it enters from, which none of the distances below depend on.
  const along = {
    direction: 1,
    enterTravel: 0,
    idle: 0,
    lanesPerPixel,
    motion: "cross",
    movement: spec.movement,
    ...pause,
    ...(motion.slide !== undefined && stopAfter !== null && !crosses
      ? { slide: motion.slide }
      : {}),
    ...(span === 1 ? {} : { span }),
    stopAfter,
    tilt,
    turnAfter,
    warning,
  } as const;
  // The travel it comes down the road in reactionSeconds of setting off.
  const reaction = motion.reactionSeconds * scrollSpeed;
  const reacting = crosses
    ? reaction * (1 + tilt)
    : Math.max(reaction * (1 + tilt), reaction + tilt * Math.min(reaction, crossingScroll(along)));
  const lowest = Math.max(motion.startRoadShare[0], reacting / sightLength);
  const highest = Math.min(cueOnRoad, Math.max(motion.startRoadShare[1], lowest));
  if (highest < lowest) {
    return [];
  }
  const drawn = within([lowest, highest], draws.start);
  const ahead = within([drawn, cueOnRoad], lift) * sightLength;
  const enterTravel = sightLength - ahead;
  const scrollTo = (travel: number) => crossScrollTo(along, travel - enterTravel);
  // The scroll from setting off to reaching the pack's rows, and to leaving the road or sight:
  // half a lane past the far edge, or past the edge it entered from once it has turned back. One
  // that stops leaves only off the road's bottom.
  const reaches = crosses ? ahead / (1 + tilt) : scrollTo(sightLength);
  const offRoad = scrollTo(roadLength + cellLength);
  // The scroll from setting off to having crossed lanes lanes, standing in its pause on the way.
  const crossed = (lanes: number) =>
    lanes / lanesPerPixel +
    ("pause" in pause && lanes > pause.pause.after ? pause.pause.length : 0);
  const across = turnAfter === null ? crossLength(laneCount, span) - 0.5 : 2 * turnAfter;
  const moving = crosses ? Math.min(crossed(across + 0.5), offRoad) : offRoad;
  // It shows as its row comes on screen, or at the road's top where it starts farther up the road
  // than its row: waiting idle at its edge until its cue, warning before it sets off.
  const shown = Math.max(warning, Math.min(enterTravel, sightLength - reaches));
  const appears = sightLength - shown - reaches;
  // Its hit box's inset at each side, in lanes, and the scroll from setting off to its hit box
  // leaving the road, which one that stops never does.
  const inset = geometry.laneInset / cellLength;
  const touching = crossed(across + 0.5 - inset);
  const contact = crosses
    ? Math.max(0, Math.min(window / (1 + tilt), touching - reaches))
    : scrollTo(sightLength + window) - reaches;
  // The row offset it is level with, moving away from its own as it drifts against the road while
  // it crosses, and keeping level with one row once it stops.
  const drift = (scroll: number) => tilt * Math.min(scroll, crossingScroll(along));
  const level = (scroll: number) =>
    crosses
      ? (-tilt * (scroll - reaches)) / rowSpacing
      : -(drift(scroll) - drift(reaches)) / rowSpacing;
  const firstRow = Math.floor(Math.min(level(0), level(moving)) + 1e-9);
  const lastRow = Math.ceil(Math.max(level(0), level(moving)) - 1e-9);
  const rows = rowsCovering(geometry, 1, crosses ? 1 / (1 + tilt) : contact / window);
  // Its contact as drawn, for its stand: its own hit length and the pack's hit boxes.
  const drawnWindow = drawnHitLength(geometry, spec) + geometry.packHitLength;
  const drawnContact = crosses
    ? Math.max(0, Math.min(drawnWindow / (1 + tilt), touching - reaches))
    : scrollTo(sightLength + drawnWindow) - reaches;
  return ([1, -1] as const).map((direction): MoverPlacement => {
    const path: MoverPath = {
      ...along,
      direction,
      enterTravel,
      idle: shown - warning,
      warning: shown,
    };
    const lanes = sweptLanes(laneCount, path, sightLength, sightLength + window);
    const touched = sweptLanes(laneCount, path, sightLength, sightLength + drawnWindow, inset);
    return {
      appears,
      cells: blockCells(firstRow, lastRow - firstRow + 1, 0, laneCount),
      lane: direction === 1 ? 0 : laneCount - span,
      lanes,
      path,
      rows,
      screen: [appears, appears + shown + moving],
      stands:
        touched.count > 0
          ? [
              {
                distance: 0,
                lane: touched.first,
                lanes: touched.count,
                length: drawnContact - geometry.packHitLength,
              },
            ]
          : [],
    };
  });
}

// A rider enters as its row reaches the point where riding at its speed brings it to the pack
// just as the row's window starts. Faster than the road, it overtakes what is in its lanes,
// from the rows above its own to those below the pack; slower, those rows overtake it, and it
// overlaps the pack for longer, which its rows cover. Its speed is its kind's at its drawn
// factor; every factor keeps it coming down the road. Its cue shows from as soon as its row comes
// on screen, and for at least warningSeconds. One that merges moves a lane to either side that
// stays on the road, one placement each, starting once its travel is its merge's share of the way
// to the pack's rows, but no sooner than its merge's cue, warningSeconds long, can show once it has
// entered, nor so late that it is still moving across as it reaches them; with no such moment it
// has no placement. It is placed as a rider over both its lanes, blocking and standing in each.
function ridePlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "ride" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength } = geometry;
  const speedMultiplier = motion.speedMultiplier * speedFactor(spec.variation, draws);
  if (speedMultiplier <= 0 || speedMultiplier === 1) {
    throw new Error("A rider must move faster or slower than the road");
  }
  const { lanes: across, rows } = spec.footprint;
  const warning = spec.warningSeconds * scrollSpeed;
  const enters = sightLength - sightLength / speedMultiplier;
  // Its cue shows from as soon as its row comes on screen, and never for less than its warning.
  const shown = Math.max(warning, enters);
  const leaves = enters + (roadLength + rows * cellLength) / speedMultiplier;
  // The row offset, in distance, that the rider's near end is level with at a scroll.
  const level = (scroll: number) => scroll - speedMultiplier * (scroll - enters);
  const firstRow = Math.floor(Math.min(level(enters), level(leaves)) / rowSpacing);
  const lastRow = Math.ceil(
    (Math.max(level(enters), level(leaves)) + (rows - 1) * cellLength) / rowSpacing,
  );
  const blockRows = rowsCovering(geometry, rows, 1 / speedMultiplier);
  // Its body covers the road its near end is level with from entering until its hit box, drawn
  // no longer than its planned hit length, has left the road's bottom, and its hit length above.
  const length = bodyLength(geometry, rows);
  const gone = enters + (roadLength + Math.max(length, rows * cellLength)) / speedMultiplier;
  const [nearest, farthest] = [level(enters), level(gone)].sort((a, b) => a - b);
  // A merge's start, as travel down the road from the road's top, and its length in scroll.
  const mergeLength = (motion.merge?.seconds ?? 0) * scrollSpeed;
  const mergeFrom = Math.max(
    warning * speedMultiplier,
    Math.min((motion.merge?.at ?? 0) * sightLength, sightLength - mergeLength * speedMultiplier),
  );
  if (motion.merge !== undefined && mergeFrom + mergeLength * speedMultiplier > sightLength) {
    return [];
  }
  const directions = motion.merge === undefined ? [0] : [-1, 1];
  return Array.from({ length: laneCount - across + 1 }, (_, lane) => lane).flatMap((lane) =>
    directions.flatMap((direction): MoverPlacement[] => {
      const merged = lane + direction;
      if (merged < 0 || merged + across > laneCount) {
        return [];
      }
      const lanes = { count: across + Math.abs(direction), first: Math.min(lane, merged) };
      const merge =
        direction === 0
          ? {}
          : {
              merge: {
                at: shown + mergeFrom / speedMultiplier,
                cue: warning,
                lanes: direction as LaneDirection,
                length: mergeLength,
              },
            };
      return [
        {
          appears: enters - shown,
          body: { from: nearest ?? 0, lanes, to: (farthest ?? 0) + length },
          cells: blockCells(firstRow, lastRow - firstRow + 1, lanes.first, lanes.count),
          lane,
          lanes,
          path: {
            lane,
            lanes: across,
            ...merge,
            motion: "ride",
            movement: spec.movement,
            speedMultiplier,
            warning: shown,
          },
          rows: blockRows,
          screen: [enters - shown, leaves],
          stands: [
            {
              distance: 0,
              lane: lanes.first,
              lanes: lanes.count,
              length:
                (drawnHitLength(geometry, spec) + geometry.packHitLength) / speedMultiplier -
                geometry.packHitLength,
            },
          ],
        },
      ];
    }),
  );
}

// Where a mover that stands on the road may be, by lane offset and travel from where it spawns.
interface StandOffset {
  readonly lane: number;
  readonly travel: number;
}

// The placements of a mover that stands on the road from its spawn and may be at any of the
// spots given, by offset from its start, one per start lane that keeps them on the road: it
// blocks every lane it may be in for as long as it can overlap the pack, and stands at every
// spot. It spawns late enough that its furthest spot toward the pack meets the pack no sooner
// than its row would.
function standingPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  spots: readonly StandOffset[],
  pathAt: (start: number) => MoverPath,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, rowSpacing, window } = geometry;
  const { lanes: across, rows } = spec.footprint;
  const height = rows * cellLength;
  const lanes = spots.map(({ lane }) => lane);
  const travels = spots.map(({ travel }) => travel);
  const [minLane, maxLane] = [Math.min(...lanes), Math.max(...lanes)];
  const [minTravel, maxTravel] = [Math.min(...travels), Math.max(...travels)];
  const blockRows = rows + Math.ceil((maxTravel - minTravel) / cellLength - 1e-9);
  const rowCount = Math.ceil((window + (blockRows - 1) * cellLength) / rowSpacing);
  const leaves = maxTravel + roadLength + height - minTravel;
  const placements: MoverPlacement[] = [];
  for (let start = -minLane; start + maxLane + across <= laneCount; start++) {
    const first = start + minLane;
    const count = maxLane - minLane + across;
    placements.push({
      appears: maxTravel,
      // Its spots are from its row up the road by its spread of travels, its hit box above each.
      body: {
        from: 0,
        lanes: { count, first },
        to: maxTravel - minTravel + bodyLength(geometry, rows),
      },
      cells: blockCells(0, rowCount, first, count),
      lane: start,
      lanes: { count, first },
      path: pathAt(start),
      rows: blockRows,
      screen: [maxTravel, leaves],
      stands: spots.map((spot) => ({
        distance: maxTravel - spot.travel,
        lane: start + spot.lane,
        lanes: across,
        length: drawnHitLength(geometry, spec),
      })),
    });
  }
  return placements;
}

// The step count a draw from 0 up to 1 picks: one of the lengths of the sequences within the
// motion's count, each as likely. Where every count in the range has sequences, as a stepper's and
// a hopper's do, it is drawnCount's.
function drawnStepCount(
  motion: Pick<Extract<MoverMotion, { kind: "steps" }>, "count" | "sequences">,
  draw: number,
): number {
  const { max, min } = motion.count;
  const lengths = [...new Set(motion.sequences.map((sequence) => sequence.length))]
    .filter((length) => length >= min && length <= max)
    .sort((a, b) => a - b);
  return lengths[Math.min(lengths.length - 1, Math.floor(draw * lengths.length))] ?? min;
}

// A stepping mover takes each step of a sequence as long as its drawn count in turn, each step
// its drawn length. Its first step's cue shows once it is wholly on the road; each later step,
// with no cue unless the motion cues each, starts its pause after the step before ends. Each move
// comes up to its drawn delay later, so later moves pause a random gap between them. A step with
// drift travels drift of its length along the road, and stands at a spot each cell of it. A step
// that would start once the mover has reached the pack's rows, at sightLength, never comes, nor
// any after it; a sequence with no step left has no placement, since a mover always moves. It
// stands at every spot a step of several spots passes over, as it does at each step's ends, and at
// both corners of each diagonal spot: moving a lane across and a row along at once, its hit box is
// in the lane it leaves while it comes level with the row it reaches, and in the lane it reaches
// while still level with the row it leaves.
function stepsPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "steps" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const length = motion.stepSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const count = drawnStepCount(motion, draws.count);
  const pause = (motion.pauseSeconds ?? 0) * scrollSpeed;
  const gap = motion.cueEach === true ? Math.max(pause, warning) : pause;
  const drift = motion.drift ?? 0;
  if (motion.shy !== undefined && draws.shy < motion.shy.share) {
    return shyPlacements(geometry, spec, motion.shy, motion.stepSeconds, count, draws);
  }
  const ways = motion.sequences.filter((sequence) => sequence.length === count);
  return ways.flatMap((shapes) => {
    const spots: StandOffset[] = [{ lane: 0, travel: 0 }];
    const steps: MoverStep[] = [];
    let ready = height + warning;
    for (const [i, shape] of shapes.entries()) {
      const at = ready + (i > 0 ? gap : 0) + delayOf(spec.variation, draws, i) * scrollSpeed;
      const last = spots.at(-1) ?? { lane: 0, travel: 0 };
      if (at + last.travel >= sightLength) {
        break;
      }
      const stepLength = moveLength(spec.variation, draws, i, length);
      const travel = shape.travel * cellLength + drift * stepLength;
      const spotCount = Math.max(stepSpots(shape), Math.ceil(Math.abs(travel) / cellLength - 1e-9));
      for (let spot = 1; spot <= spotCount; spot++) {
        spots.push({
          lane: last.lane + (shape.lanes * spot) / spotCount,
          travel: last.travel + (travel * spot) / spotCount,
        });
      }
      steps.push({
        at,
        lanes: shape.lanes,
        length: stepLength,
        travel,
        ...(steps.length > 0 && motion.cueEach !== true ? { uncued: true } : {}),
      });
      ready = at + stepLength;
    }
    if (steps.length === 0) {
      return [];
    }
    const corners = spots.slice(1).flatMap((spot, i) => {
      const before = spots[i] ?? spot;
      return before.lane !== spot.lane && before.travel !== spot.travel
        ? [
            { lane: before.lane, travel: spot.travel },
            { lane: spot.lane, travel: before.travel },
          ]
        : [];
    });
    return standingPlacements(geometry, spec, [...spots, ...corners], (lane) => ({
      lane,
      motion: "steps",
      movement: spec.movement,
      steps,
      warning,
    }));
  });
}

// The ways a stalker's or shy hopper's lane range may reach from its start lane, widest first: a
// lane to either side, one side only, or none. Of the two one-sided reaches, the side draw, from 0
// up to 1, puts the left first below a half and the right first from a half, so neither side is
// favoured across movers.
function reachesOf(side: number): readonly (readonly [number, number])[] {
  const oneSided: readonly (readonly [number, number])[] = [
    [-1, 0],
    [0, 1],
  ];
  return [[-1, 1], ...(side < 0.5 ? oneSided : [...oneSided].reverse()), [0, 0]];
}

// A stalker's or shy hopper's placements, one per reach that fits, the first in reachesOf its side
// draw ranked highest: it may stand at every travel given in every lane of its reach. pathAt makes
// its path from its start lane and its reach.
function reachPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  side: number,
  travels: readonly number[],
  pathAt: (lane: number, reach: LaneSpan) => MoverPath,
): MoverPlacement[] {
  const reaches = reachesOf(side);
  return reaches.flatMap(([left, right], rank) => {
    const spots = Array.from({ length: right - left + 1 }, (_, i) =>
      travels.map((travel) => ({ lane: left + i, travel })),
    ).flat();
    return standingPlacements(geometry, spec, spots, (lane) =>
      pathAt(lane, { count: right - left + 1, first: lane + left }),
    ).map((placement) => ({ ...placement, rank: reaches.length - rank }));
  });
}

// A stalker may be at any spot in its lanes, from its start down as many rows as its drawn count
// of steps, and is placed as standing at each of them, so whichever step it chooses on the road
// keeps the road passable. Its lanes are its start lane and, where there is room, a lane to
// either side: the wider, the more it can follow the pack, and the planner takes the widest that
// fits (rank). Its first step's cue comes its drawn delay after it is wholly on the road, and each
// later step, with no cue, once the step before has ended and the road between it and the pack,
// the tallest pack's rows at sightLength, is down to its drawn share of the road's length. Each
// step is its drawn length.
function approachPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "approach" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, roadLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const steps = drawnCount(motion.steps, draws.count);
  const pending: ApproachTiming[] = [
    {
      at: height + (within(motion.firstDelaySeconds, draws.delays[0] ?? 0) * scrollSpeed + warning),
      kind: "after",
    },
    ...Array.from({ length: steps - 1 }, (): ApproachTiming => ({
      kind: "near",
      travel: sightLength - within(motion.secondRoadShare, draws.share) * roadLength,
    })),
  ];
  const travels = Array.from({ length: steps + 1 }, (_, row) => row * cellLength);
  const lengths = Array.from({ length: steps }, (_, i) =>
    moveLength(spec.variation, draws, i, motion.stepSeconds * scrollSpeed),
  );
  return reachPlacements(geometry, spec, draws.side, travels, (lane, reach) => ({
    burst: cellLength,
    lane,
    lengths,
    motion: "approach",
    movement: spec.movement,
    pending,
    reach,
    rows: steps,
    steps: [],
    stopTravel: sightLength,
    warning,
  }));
}

// A shy hopper may be at any spot in its lanes, from its start up as many rows as its rise, and is
// placed as standing at each of them, so whichever hop it chooses on the road keeps the road
// passable. Its lanes are its start lane and, where there is room, a lane to either side, the
// widest that fits (rank). Its first hop's cue begins as its row comes within nearSeconds of the
// road's travel of the tallest pack's rows at sightLength, but no sooner than it is wholly on the
// road, and each later hop, with no cue, starts as the hop before ends, up to its drawn delay
// later; it makes as many hops as its drawn count, each its drawn length.
function shyPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  shy: ShyHops,
  hopSeconds: number,
  count: number,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const first = Math.max(height, sightLength - shy.nearSeconds * scrollSpeed) + warning;
  const lengths = Array.from({ length: count }, (_, i) =>
    moveLength(spec.variation, draws, i, hopSeconds * scrollSpeed),
  );
  const pending: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = pending.at(-1);
    pending.push(
      before === undefined
        ? first
        : before + (lengths[i - 1] ?? 0) + delayOf(spec.variation, draws, i) * scrollSpeed,
    );
  }
  const travels = Array.from({ length: shy.rise + 1 }, (_, row) => -row * cellLength);
  return reachPlacements(geometry, spec, draws.side, travels, (lane, reach) => ({
    burst: cellLength,
    lane,
    lengths,
    motion: "shy",
    movement: spec.movement,
    pending,
    reach,
    rise: shy.rise,
    shapes: shy.shapes,
    steps: [],
    stopTravel: sightLength,
    warning,
  }));
}

// How far a dart with no room at its drawn start is raised toward the highest start that shows
// its cue, lowest first, when the planner retries it.
export const DART_LIFTS = [0.25, 0.5, 0.75, 1] as const;

// The even draws from 0 to 1 a dart with no room at its own draws retries its tilt and speed at.
const DART_RETRY_DRAWS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1] as const;

// The draws a dart with no room at its own retries at, each its own draws with one changed: its
// tilt at each of DART_RETRY_DRAWS, then its speed at each, nearest its own draw first, the lower
// first between two as near. A draw its kind does not vary by, a tilt with no range or a speed with
// no jitter, is not retried, nor is a mover that is not a dart.
export function dartRetries(spec: MoverSpec, draws: MoverDraws): MoverDraws[] {
  const { motion, variation } = spec;
  if (motion.kind !== "cross") {
    return [];
  }
  const nearest = (own: number) =>
    DART_RETRY_DRAWS.filter((draw) => Math.abs(draw - own) > 1e-9).sort(
      (a, b) => Math.abs(a - own) - Math.abs(b - own) || a - b,
    );
  const tilts = motion.tilt[0] < motion.tilt[1] ? nearest(draws.tilt) : [];
  const speeds = variation.speedShare > 0 ? nearest(draws.speed) : [];
  return [
    ...tilts.map((tilt) => ({ ...draws, tilt })),
    ...speeds.map((speed) => ({ ...draws, speed })),
  ];
}

// One mover's placements, at its draws. A dart's start is lifted that share of the way from its
// drawn share up to the highest that shows its cue; other movers have no lift.
export function moverPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
  lift = 0,
): MoverPlacement[] {
  const { motion } = spec;
  switch (motion.kind) {
    case "approach":
      return approachPlacements(geometry, spec, motion, draws);
    case "cross":
      return crossPlacements(geometry, spec, motion, draws, lift);
    case "ride":
      return ridePlacements(geometry, spec, motion, draws);
    default:
      return stepsPlacements(geometry, spec, motion, draws);
  }
}

// How many movers may be on screen at once: in all, darting, and in-lane slower than the road
// (the slow vehicles).
export interface MoverCaps {
  readonly darts: number;
  readonly slowVehicles: number;
  readonly total: number;
}

// A mover on screen over [start, end), and the caps it counts toward.
export interface OnScreen {
  readonly dart: boolean;
  readonly interval: readonly [number, number];
  readonly slowVehicle: boolean;
}

export function onScreenOf(path: MoverPath, interval: readonly [number, number]): OnScreen {
  return {
    dart: path.motion === "cross",
    interval,
    slowVehicle: path.motion === "ride" && path.speedMultiplier < 1,
  };
}

// True when a mover keeps within every cap alongside the movers already planned: at no moment
// are more on screen than a cap allows, of the movers that cap counts.
export function screenHasRoom(
  caps: MoverCaps,
  planned: readonly OnScreen[],
  mover: OnScreen,
): boolean {
  const [start, end] = mover.interval;
  const overlapping = planned.filter(({ interval: [from, to] }) => from < end && start < to);
  // The count on screen is highest at the start of one of the intervals.
  const moments = [
    start,
    ...overlapping.map(({ interval: [from] }) => from).filter((from) => from > start),
  ];
  const within = (cap: number, counted: (other: OnScreen) => boolean) =>
    !counted(mover) ||
    moments.every(
      (moment) =>
        overlapping.filter(
          (other) => counted(other) && other.interval[0] <= moment && moment < other.interval[1],
        ).length < cap,
    );
  return (
    within(caps.total, () => true) &&
    within(caps.darts, (other) => other.dart) &&
    within(caps.slowVehicles, (other) => other.slowVehicle)
  );
}

// The spawn planner's grid of rows and lanes. block blocks lanes in a row's window for rows rows,
// as a dart's sweep where dart is set, if every lane-blocking spawn keeps clear of the path, and
// undoes it unless keep is set.
// leavesRoom is false when taking the cells would leave too few for the spawns placed later that
// are never skipped. packFits is true when the pack fits between each stand and every lane-blocking
// spawn placed so far along the path, and between the stands themselves, and stand records the
// stands for the spawns placed later. isFree is true when a mover of a motion may take a cell
// (moverMayTake in spawning.ts). take holds a cell for a mover, a dart if dart is set, so nothing
// placed later takes it, but a lane-blocking standing spawn where no mover's body comes: occupy
// records a mover's body, at distances along the zone, for those.
interface MoverGrid {
  block(row: number, lanes: LaneSpan, rows: number, keep: boolean, dart?: boolean): boolean;
  clearRun(lanes: LaneSpan, row: number): number;
  isFree(motion: MoverPath["motion"], lane: number, row: number): boolean;
  leavesRoom(cells: readonly BlockCell[]): boolean;
  occupy(body: MoverBody): void;
  packFits(stands: readonly MoverStand[]): boolean;
  stand(stands: readonly MoverStand[]): void;
  take(dart: boolean, lane: number, row: number): void;
}

// within is the share of the zone's rows the quota's movers are spread over, from and to; the
// whole zone without it.
interface MoverQuota<Kind extends string> {
  readonly count: number;
  readonly kind: Kind;
  readonly spec: MoverSpec;
  readonly within?: readonly [number, number];
}

interface MoverSpawn<Kind extends string> {
  readonly distance: number;
  readonly kind: Kind;
  readonly lane: number;
  readonly mover: MoverPath;
}

// The movers placed, and the kinds of those dropped, one entry each.
interface PlacedMovers<Kind extends string> {
  readonly dropped: readonly Kind[];
  readonly spawns: readonly MoverSpawn<Kind>[];
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

function standsOf(spot: Spot): MoverStand[] {
  return spot.placement.stands.map((stand) => ({
    ...stand,
    distance: spot.distance + stand.distance,
  }));
}

// Places every mover on rows at the distances given, each quota spread one per equal stretch of the
// zone, or of the share of it the quota's within holds it to, as the planner spreads other
// spawns, each mover wholly on screen within the zone, within the caps on screen. A mover with no
// room in its stretch, such as one over a cap there, waits: it comes on at the next row with
// room, within its share of the zone. A dart with no room at its drawn start retries the same rows
// from higher up the road, its start lifted by each of DART_LIFTS in turn, lowest first, before it
// waits; on each later row it tries its drawn start and then each lift. A dart with no room on any
// later row tries again the same way at each of its retries (dartRetries), another tilt of its
// kind's range and then another speed, until one has room, so a dart whose drawn path sweeps too
// many lanes in the pack's window still comes on, crossing at another tilt or speed. A mover with
// no room at any is dropped, which uses no random draw past its own draws, as the planner drops an
// obstacle it has no room for. A dart may take cells other spawns hold, and a rider cells only
// darts hold (MoverGrid.isFree); no other mover takes a cell a dart holds. A mover never stands
// still in place of moving. Each mover makes its own draws (drawMover) before it is placed, and is
// placed as they have it move, so the path rule holds for the speed and moments it was drawn. Of
// the places that fit, it takes a start lane from the movers stream, drawn toward the lanes left
// unblocked longest (laneBalanceWeight), so an edge lane that fits fewer of its ways comes up as
// often as a middle one; then, from the spawns stream, a place in that lane of the highest rank in
// its row, so each row gives the lane the widest reach that fits there. onScreen holds the movers
// already on screen, from an earlier call, and gains each mover placed.
export function placeMovers<Kind extends string>(
  streams: PlannerStreams,
  geometry: MoverGeometry & { readonly zoneLength: number },
  caps: MoverCaps,
  grid: MoverGrid,
  onScreen: OnScreen[],
  rows: readonly number[],
  quotas: readonly MoverQuota<Kind>[],
): PlacedMovers<Kind> {
  const fits = (spot: Spot) => {
    const [start, end] = screenOf(spot);
    const { placement } = spot;
    const { cells } = placement;
    return (
      start >= 0 &&
      end <= geometry.zoneLength &&
      screenHasRoom(caps, onScreen, onScreenOf(placement.path, [start, end])) &&
      cells.every(({ lane, row }) => grid.isFree(placement.path.motion, lane, spot.row + row)) &&
      grid.leavesRoom(cells.map(({ lane, row }) => ({ lane, row: spot.row + row }))) &&
      grid.packFits(standsOf(spot)) &&
      grid.block(
        spot.row,
        placement.lanes,
        placement.rows,
        false,
        placement.path.motion === "cross",
      )
    );
  };
  const spotsIn = (placements: readonly MoverPlacement[], first: number, end: number) =>
    placements.flatMap((placement) =>
      rows
        .slice(first, end)
        .map((distance, i) => ({ distance, placement, row: first + i }))
        .filter(fits),
    );
  // The spots that fit in the first of the starts that has any between first and end.
  const firstFitting = (
    starts: readonly (readonly MoverPlacement[])[],
    first: number,
    end: number,
  ) => {
    for (const placements of starts) {
      const fitting = spotsIn(placements, first, end);
      if (fitting.length > 0) {
        return fitting;
      }
    }
    return [];
  };
  // The spots that fit in the next row, from first on, that has any at one of the starts.
  const nearestLater = (
    starts: readonly (readonly MoverPlacement[])[],
    first: number,
    last: number,
  ) => {
    for (let row = first; row < last; row++) {
      const inRow = firstFitting(starts, row, row + 1);
      if (inRow.length > 0) {
        return inRow;
      }
    }
    return [];
  };

  const spawns: MoverSpawn<Kind>[] = [];
  const dropped: Kind[] = [];
  for (const { count, kind, spec, within } of quotas) {
    const quotaRows = rowsWithin(rows.length, within ?? WHOLE_ZONE);
    const [, to] = quotaRows;
    for (let i = 0; i < count; i++) {
      const draws = drawMover(streams);
      const lifts = spec.motion.kind === "cross" ? [0, ...DART_LIFTS] : [0];
      const [first, end] = nthStretch(count, i, quotaRows);
      const fittingAt = (moverDraws: MoverDraws) => {
        const starts = lifts.map((lift) => moverPlacements(geometry, spec, moverDraws, lift));
        const stretch = firstFitting(starts, first, end);
        return stretch.length > 0 ? stretch : nearestLater(starts, end, to);
      };
      let fitting = fittingAt(draws);
      if (fitting.length === 0) {
        for (const retry of dartRetries(spec, draws)) {
          fitting = fittingAt(retry);
          if (fitting.length > 0) {
            break;
          }
        }
      }
      if (fitting.length === 0) {
        dropped.push(kind);
        continue;
      }
      const startLanes = [...new Set(fitting.map(({ placement }) => placement.lane))].sort(
        (a, b) => a - b,
      );
      // Each start lane is weighted by the clearest run of rows its places' lanes have; one that
      // blocks no lane by a run of one.
      const weights = startLanes.map((start) =>
        laneBalanceWeight(
          Math.max(
            ...fitting
              .filter(({ placement }) => placement.lane === start)
              .map(({ placement, row }) =>
                placement.lanes.count === 0 ? 1 : grid.clearRun(placement.lanes, row),
              ),
          ),
        ),
      );
      const lane = weightedPick(streams.movers, startLanes, weights);
      const inLane = fitting.filter(({ placement }) => placement.lane === lane);
      const rankOf = ({ placement }: Spot) => placement.rank ?? 0;
      const best = new Map<number, number>();
      for (const fit of inLane) {
        best.set(fit.row, Math.max(rankOf(fit), best.get(fit.row) ?? rankOf(fit)));
      }
      const spot = randomPick(
        streams.spawns,
        inLane.filter((fit) => rankOf(fit) === best.get(fit.row)),
      );
      const { placement } = spot;
      const dart = placement.path.motion === "cross";
      placement.cells.forEach(({ lane, row }) => grid.take(dart, lane, spot.row + row));
      if (placement.body !== undefined) {
        const { from, lanes, to } = placement.body;
        grid.occupy({ from: spot.distance + from, lanes, to: spot.distance + to });
      }
      grid.block(spot.row, placement.lanes, placement.rows, true, dart);
      grid.stand(standsOf(spot));
      onScreen.push(onScreenOf(placement.path, screenOf(spot)));
      spawns.push({
        distance: spot.distance + placement.appears,
        kind,
        lane: placement.lane,
        mover: placement.path,
      });
    }
  }
  return { dropped, spawns };
}
