import { progressAt, segmentAt } from "@andornaut/game-kit/motion";

import type { MovementKind } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import type { RoadItem } from "./roadItems";
import { signatureAlive, type SignaturePath, signaturePlace } from "./signaturePaths";

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
      readonly lane: number;
      readonly motion: "signature";
      readonly route: SignaturePath;
    }
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
interface RideMerge {
  readonly at: number;
  readonly cue: number;
  readonly lanes: LaneDirection;
  readonly length: number;
}

// How far across a rider has merged since scroll after its cue appeared: none before its merge,
// and all of it after.
function mergedLanes(path: Extract<MoverPath, { motion: "ride" }>, since: number): number {
  const { merge } = path;
  return merge === undefined ? 0 : merge.lanes * progressAt(merge.at, merge.length, since);
}

// Whether a rider is moving across into its merge lane, since scroll after its cue appeared.
export function isMerging(path: MoverPath, since: number): boolean {
  if (path.motion === "signature") {
    return (
      path.route.profile.kind === "successiveMerges" &&
      path.route.legs.some(
        (leg) => leg.from.x !== leg.to.x && since >= leg.at && since < leg.at + leg.length,
      )
    );
  }
  return (
    path.motion === "ride" &&
    path.merge !== undefined &&
    since >= path.merge.at &&
    since < path.merge.at + path.merge.length
  );
}

// When a stalker's pending step starts: after, at a scroll since it spawned, after its cue;
// near, with no cue of its own, once its travel reaches travel and the step before has ended.
export type ApproachTiming =
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
interface CrossPause {
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
export function crossSpan(path: CrossPath): number {
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
export function crossScrollTo(path: CrossPath, travel: number): number {
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
export function crossLength(laneCount: number, span: number): number {
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

export function moverPlace(laneCount: number, path: MoverPath, since: number): MoverPlace {
  if (path.motion === "signature") {
    const point = signaturePlace(path.route, since);
    return { lanePosition: point.x, solid: true, travel: point.y };
  }
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
      const offset = segmentAt(
        {
          duration: step.length,
          easing: "linear",
          from: { x: 0, y: 0 },
          start: step.at,
          to: { x: step.lanes, y: step.travel },
        },
        since,
      );
      lanePosition += offset.x;
      travel += offset.y;
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
  if (path.motion === "signature") {
    return path.route.cues.some((cue) => since >= cue.start && since < cue.end)
      ? { kind: "wander" }
      : null;
  }
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
  if (path.motion === "signature") {
    return (
      since >= (path.route.legs[0]?.at ?? Infinity) &&
      (path.route.profile.kind !== "rectangle" || since < path.route.complete)
    );
  }
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
  if (path.motion === "signature") {
    const leg = path.route.legs
      .filter(
        (part) =>
          part.from.x !== part.to.x &&
          (since >= part.at ||
            path.route.cues.some((cue) => cue.end === part.at && since >= cue.start)),
      )
      .at(-1);
    return leg === undefined ? false : leg.to.x < leg.from.x;
  }
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
    const alive =
      mover.path.motion === "signature"
        ? signatureAlive(
            { laneCount: road.laneCount, roadLength: Infinity },
            { height: item.height, span: item.laneSpan },
            mover.path.route,
            mover.since,
          )
        : !hasLeftRoad(road.laneCount, place);
    if (alive) {
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

// Lanes first to first + count - 1.
export interface LaneSpan {
  readonly count: number;
  readonly first: number;
}

// One step of a stepping mover: lanes to either side, rows toward the pack (travel above 0) or
// away (below 0), or both, diagonally. A step is a spot; a hop is one step of 1 or more spots one
// way, a diagonal spot a lane across and a row along at once.
export interface StepShape {
  readonly lanes: number;
  readonly travel: number;
}
