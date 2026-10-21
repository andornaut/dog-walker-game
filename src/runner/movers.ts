import type { MovementKind } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { type Random, randomPick } from "./random";
import type { RoadItem } from "./roadItems";

// Moving hazards. Everything here is measured in road scroll rather than time, so a mover
// keeps step with the road: it freezes when the road does, and a replay of the same scroll
// puts it in the same place. A lane position is fractional: lane i spans i - 0.5 to i + 0.5.
// A mover is an obstacle of a kind that moves: it meets the pack as its kind does.

// One step of a stepping mover. at is the scroll since it spawned when the step starts, and
// its cue shows for the path's warning before that; the step lasts length of scroll, moves
// lanes across, and travel down the road on top of the road's scroll (toward the pack when
// positive).
export interface MoverStep {
  readonly at: number;
  readonly lanes: number;
  readonly length: number;
  readonly travel: number;
}

// A planned mover. warning is the scroll each cue shows for before its move.
// cross (dart): its cue is at its row on the edge it enters from, and it sets off when its row
// has travelled enterTravel down the road, coming down the road at 1 + tilt of the road's speed
// as it crosses.
// ride (inLane): its cue is at the top of its lanes, where it enters once the cue ends, coming
// down them at speedMultiplier of the road's speed.
// steps (step, hop): it stands on the road from its spawn and takes each step in turn.
// approach: it stands on the road from its spawn and takes the steps it has chosen, each
// toward the pack as the pack stood when its cue began (approach.ts), and has pending steps
// still to choose: within its reach of lanes and rows down, burst a row's travel, each length
// long; none starts once its travel reaches stopTravel, the pack's rows.
export type MoverPath = {
  readonly movement: MovementKind;
  readonly warning: number;
} & (
  | {
      readonly direction: LaneDirection;
      readonly enterTravel: number;
      readonly lanesPerPixel: number;
      readonly motion: "cross";
      readonly tilt: number;
    }
  | {
      readonly lane: number;
      readonly lanes: number;
      readonly motion: "ride";
      readonly speedMultiplier: number;
    }
  | { readonly lane: number; readonly motion: "steps"; readonly steps: readonly MoverStep[] }
  | {
      readonly burst: number;
      readonly lane: number;
      readonly length: number;
      readonly motion: "approach";
      readonly pending: readonly ApproachTiming[];
      readonly reach: LaneSpan;
      readonly rows: number;
      readonly steps: readonly MoverStep[];
      readonly stopTravel: number;
    }
);

// When a stalker's pending step starts: after, at a scroll since it spawned; near, once its
// travel reaches travel, and no sooner than its cue can show after the step before began and
// that step has ended.
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
export interface MoverPlace {
  readonly lanePosition: number;
  readonly solid: boolean;
  readonly travel: number;
}

export function laneAt(lanePosition: number): number {
  return Math.floor(lanePosition + 0.5);
}

// A crosser enters on the road's edge.
function crossStart(laneCount: number, direction: LaneDirection): number {
  return direction === 1 ? -0.5 : laneCount - 0.5;
}

// How far through a step a mover is, from 0 before it to 1 after it.
function stepDone(step: MoverStep, since: number): number {
  return Math.min(1, Math.max(0, (since - step.at) / step.length));
}

export function moverPlace(laneCount: number, path: MoverPath, since: number): MoverPlace {
  const moved = since - path.warning;
  if (path.motion === "ride") {
    return {
      lanePosition: path.lane,
      solid: moved >= 0,
      travel: Math.max(0, moved) * path.speedMultiplier,
    };
  }
  if (path.motion === "steps" || path.motion === "approach") {
    let lanePosition = path.lane;
    let travel = since;
    for (const step of path.steps) {
      const done = stepDone(step, since);
      lanePosition += step.lanes * done;
      travel += step.travel * done;
    }
    return { lanePosition, solid: true, travel };
  }
  const start = crossStart(laneCount, path.direction);
  return {
    lanePosition: start + path.direction * path.lanesPerPixel * Math.max(0, moved),
    solid: moved >= 0,
    travel: path.enterTravel + moved * (moved >= 0 ? 1 + path.tilt : 1),
  };
}

// The cue a mover shows, about a second before each move: an arrow across the road for a dart,
// down or up its lane for an in-lane move faster or slower than the road, or the wander mark
// before a step.
export type MoverTell =
  | { readonly direction: LaneDirection; readonly kind: "across" }
  | { readonly kind: "down" }
  | { readonly kind: "up" }
  | { readonly kind: "wander" };

export function moverTell(path: MoverPath, since: number): MoverTell | null {
  if (path.motion === "cross") {
    return since < path.warning ? { direction: path.direction, kind: "across" } : null;
  }
  if (path.motion === "ride") {
    if (since >= path.warning) {
      return null;
    }
    return { kind: path.speedMultiplier > 1 ? "down" : "up" };
  }
  const next = path.steps.some((step) => since >= step.at - path.warning && since < step.at);
  return next ? { kind: "wander" } : null;
}

// Whether a mover is moving rather than standing or showing its cue.
export function inMotion(path: MoverPath, since: number): boolean {
  if (path.motion === "cross" || path.motion === "ride") {
    return since >= path.warning;
  }
  return path.steps.some((step) => since >= step.at && since < step.at + step.length);
}

// Whether a mover faces left. Side-view art faces right, so it is mirrored while this holds: a
// crosser running left, and a stepper or hopper from the start of a step to the left until a
// step to the right. A rider and a stepper yet to move sideways face right.
export function facesLeft(path: MoverPath, since: number): boolean {
  if (path.motion === "cross") {
    return path.direction === -1;
  }
  if (path.motion === "ride") {
    return false;
  }
  const sideways = path.steps.filter((step) => step.lanes !== 0 && since >= step.at);
  return (sideways.at(-1)?.lanes ?? 0) < 0;
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
        y: road.roadTop - item.height + place.travel,
      });
    }
  }
  return moved;
}

// Planning works in road distance. sightLength is how far a row travels down the road before
// its window, the stretch of road over which a one-row spawn on it overlaps the pack, which is
// window long. rowSpacing is the distance between rows, and cellLength a row of a footprint.
export interface MoverGeometry {
  readonly cellLength: number;
  readonly laneCount: number;
  readonly packLength: number;
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

// Where a mover stands as an obstacle, for the pack-fit gap: the distance at which its hit box
// meets the pack, its leftmost lane, the lanes it covers, and its contact with the pack less the
// pack's length: the road behind it the pack cannot step into while it passes.
export interface MoverStand {
  readonly distance: number;
  readonly lane: number;
  readonly lanes: number;
  readonly length: number;
}

// One way a mover can meet a row. Distances are relative to the row's distance; appears is
// its spawn. lanes and rows are what it blocks from its row on, as a standing obstacle that
// size would: every lane it touches while it overlaps the pack, for as long as it can. cells
// are the row offsets and lanes kept clear of other spawns: those it passes through on the
// road, and with leadIn, the whole row before its own, so the pack has two rows of road to
// steer around a sweep of several lanes. stands are each place it stands as an obstacle, by
// distance from its row. screen is from its cue appearing until it is out of sight. Of the
// placements that fit, the planner takes one of the highest rank, 0 when unset.
export interface MoverPlacement {
  readonly appears: number;
  readonly cells: readonly { readonly lane: number; readonly row: number }[];
  readonly lane: number;
  readonly lanes: LaneSpan;
  readonly leadIn: boolean;
  readonly path: MoverPath;
  readonly rank?: number;
  readonly rows: number;
  readonly screen: readonly [number, number];
  readonly stands: readonly MoverStand[];
}

function laneSpan(laneCount: number, a: number, b: number): LaneSpan {
  const first = Math.max(0, Math.min(laneAt(a), laneAt(b)));
  const last = Math.min(laneCount - 1, Math.max(laneAt(a), laneAt(b)));
  return { count: Math.max(0, last - first + 1), first };
}

// The lanes a crosser touches while its travel is from to to: its lane position and travel only
// move one way, so its ends bound it. A rider or stepping mover's are its own.
export function sweptLanes(laneCount: number, path: MoverPath, from: number, to: number): LaneSpan {
  if (path.motion === "ride") {
    return { count: path.lanes, first: path.lane };
  }
  if (path.motion === "steps" || path.motion === "approach") {
    return { count: 1, first: path.lane };
  }
  const moving = Math.max(from, path.enterTravel);
  if (moving >= to) {
    return { count: 0, first: 0 };
  }
  // The lane position once the crosser's travel has reached travel.
  const at = (travel: number) =>
    moverPlace(laneCount, path, path.warning + (travel - path.enterTravel) / (1 + path.tilt))
      .lanePosition;
  return laneSpan(laneCount, at(moving), at(to));
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

// cross: across the road at lanesPerSecond, tilted down the road by tilt of the road's speed.
// ride: down its lane at speedMultiplier of the road's speed, above 1 toward the pack, below 1
// away. steps: one of sequences, each step stepSeconds long however many spots it covers; the
// planner picks whichever keeps the road passable. approach: steps steps toward the pack, each
// stepSeconds long, the first firstDelaySeconds after the mover is wholly on the road and the
// second once the road between it and the pack is secondRoadShare of the road's length, each
// range drawn from per mover.
export type MoverMotion =
  | {
      readonly firstDelaySeconds: readonly [number, number];
      readonly kind: "approach";
      readonly secondRoadShare: readonly [number, number];
      readonly stepSeconds: number;
      readonly steps: number;
    }
  | { readonly kind: "cross"; readonly lanesPerSecond: number; readonly tilt: number }
  | { readonly kind: "ride"; readonly speedMultiplier: number }
  | {
      readonly kind: "steps";
      readonly sequences: readonly (readonly StepShape[])[];
      readonly stepSeconds: number;
    };

// How much movers of a kind differ: each one's speed by up to speedShare of it either way, and
// each of its steps, hops or darts up to delaySeconds later than its earliest moment.
export interface MoverVariation {
  readonly delaySeconds: number;
  readonly speedShare: number;
}

export interface MoverSpec {
  readonly footprint: MoverFootprint;
  readonly motion: MoverMotion;
  readonly movement: MovementKind;
  readonly variation: MoverVariation;
  readonly warningSeconds: number;
}

// One mover's draws, each from 0 up to 1, made as it is planned: its speed, the delay before
// each of its moves, and a stalker's second-step road share. EVEN_DRAWS moves it at its kind's
// speed with no delay, at the near end of a range.
export interface MoverDraws {
  readonly delays: readonly [number, number];
  readonly share: number;
  readonly speed: number;
}

export const EVEN_DRAWS: MoverDraws = { delays: [0, 0], share: 0, speed: 0.5 };

// Every mover draws the same number of times, whatever it is and wherever it goes.
export function drawMover(random: Random): MoverDraws {
  return { delays: [random(), random()], share: random(), speed: random() };
}

// The factor a mover's speed is multiplied by, from 1 - speedShare to 1 + speedShare.
export function speedFactor(variation: MoverVariation, draws: MoverDraws): number {
  return 1 + variation.speedShare * (2 * draws.speed - 1);
}

function delayOf(variation: MoverVariation, draws: MoverDraws, index: number): number {
  return variation.delaySeconds * (draws.delays[index] ?? 0);
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

const HALF_LANE_STEPS = 2;

// Crossers meet the pack partway across: one placement per side and per half lane crossed
// by the middle of its contact with the pack, which starts as its row's window does, at the
// mover's drawn speed and later by its drawn delay. Tilted, its contact lasts window / (1 + tilt),
// which its rows cover. Each cue appears on the road, a cell down from its top. A crosser that
// would set off only once it has reached the pack's rows, at sightLength, would never cross, so
// it has no placement there. A tilted crosser keeps the row after its own clear too, as it
// drifts along the road against its row.
function crossPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "cross" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, scrollSpeed, sightLength, window } = geometry;
  const { tilt } = motion;
  if (tilt <= -1) {
    throw new Error("A crosser's tilt must keep it coming down the road");
  }
  const lanesPerPixel = (motion.lanesPerSecond * speedFactor(spec.variation, draws)) / scrollSpeed;
  const warning = spec.warningSeconds * scrollSpeed;
  const late = (delayOf(spec.variation, draws, 0) * scrollSpeed) / (1 + tilt);
  const contact = window / (1 + tilt);
  const keptRows = tilt === 0 ? [-1, 0] : [-1, 0, 1];
  const placements: MoverPlacement[] = [];
  for (const direction of [1, -1] as const) {
    for (let step = 0; step <= laneCount * HALF_LANE_STEPS; step++) {
      // Moved this far by the middle of its contact, at which its travel is mid-window.
      const middle = step / HALF_LANE_STEPS / lanesPerPixel - late;
      const enterTravel = sightLength + window / 2 - (1 + tilt) * middle;
      const appears = sightLength + contact / 2 - warning - middle;
      if (appears < cellLength || enterTravel >= sightLength) {
        continue;
      }
      const path: MoverPath = {
        direction,
        enterTravel,
        lanesPerPixel,
        motion: "cross",
        movement: spec.movement,
        tilt,
        warning,
      };
      const lanes = sweptLanes(laneCount, path, sightLength, sightLength + window);
      if (lanes.count === 0) {
        continue;
      }
      const across = (laneCount + 0.5) / lanesPerPixel;
      const passed = (roadLength + cellLength - enterTravel) / (1 + tilt);
      const rows = rowsCovering(geometry, 1, 1 / (1 + tilt));
      placements.push({
        appears,
        cells: keptRows.flatMap((row) =>
          Array.from({ length: laneCount }, (_, lane) => ({ lane, row })),
        ),
        lane: direction === 1 ? 0 : laneCount - 1,
        lanes,
        leadIn: true,
        path,
        rows,
        screen: [appears, appears + warning + Math.min(across, passed)],
        stands: [
          {
            distance: 0,
            lane: lanes.first,
            lanes: lanes.count,
            length: contact - geometry.packLength,
          },
        ],
      });
    }
  }
  return placements;
}

// A rider enters as its row reaches the point where riding at its speed brings it to the pack
// just as the row's window starts. Faster than the road, it overtakes what is in its lanes,
// from the rows above its own to those below the pack; slower, those rows overtake it, and it
// overlaps the pack for longer, which its rows cover. Its speed is its kind's at its drawn
// factor; every factor keeps it coming down the road.
function ridePlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  kindMultiplier: number,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, laneCount, roadLength, rowSpacing, scrollSpeed, sightLength } = geometry;
  const speedMultiplier = kindMultiplier * speedFactor(spec.variation, draws);
  if (speedMultiplier <= 0 || speedMultiplier === 1) {
    throw new Error("A rider must move faster or slower than the road");
  }
  const { lanes: across, rows } = spec.footprint;
  const warning = spec.warningSeconds * scrollSpeed;
  const enters = sightLength - sightLength / speedMultiplier;
  const leaves = enters + (roadLength + rows * cellLength) / speedMultiplier;
  // The row offset, in distance, that the rider's near end is level with at a scroll.
  const level = (scroll: number) => scroll - speedMultiplier * (scroll - enters);
  const firstRow = Math.floor(Math.min(level(enters), level(leaves)) / rowSpacing);
  const lastRow = Math.ceil(
    (Math.max(level(enters), level(leaves)) + (rows - 1) * cellLength) / rowSpacing,
  );
  const blockRows = rowsCovering(geometry, rows, 1 / speedMultiplier);
  return Array.from({ length: laneCount - across + 1 }, (_, lane) => ({
    appears: enters - warning,
    cells: Array.from({ length: lastRow - firstRow + 1 }, (_, i) =>
      Array.from({ length: across }, (_unused, j) => ({ lane: lane + j, row: firstRow + i })),
    ).flat(),
    lane,
    lanes: { count: across, first: lane },
    leadIn: false,
    path: {
      lane,
      lanes: across,
      motion: "ride",
      movement: spec.movement,
      speedMultiplier,
      warning,
    },
    rows: blockRows,
    screen: [enters - warning, leaves],
    stands: [
      {
        distance: 0,
        lane,
        lanes: across,
        length: (geometry.window + (rows - 1) * cellLength) / speedMultiplier - geometry.packLength,
      },
    ],
  }));
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
      cells: Array.from({ length: rowCount }, (_, row) =>
        Array.from({ length: count }, (_unused, i) => ({ lane: first + i, row })),
      ).flat(),
      lane: start,
      lanes: { count, first },
      leadIn: false,
      path: pathAt(start),
      rows: blockRows,
      screen: [maxTravel, leaves],
      stands: spots.map((spot) => ({
        distance: maxTravel - spot.travel,
        lane: start + spot.lane,
        lanes: across,
        length: window + (rows - 1) * cellLength - geometry.packLength,
      })),
    });
  }
  return placements;
}

// A stepping mover takes each step of a sequence in turn. Its first cue shows once it is
// wholly on the road, and each later one once the step before has ended, each move up to its
// drawn delay later. A step that would start once the mover has reached the pack's rows, at
// sightLength, never comes, nor any after it; a sequence with no step left has no placement,
// since a mover always moves. It stands at every spot a step of several spots passes over, as
// it does at each step's ends.
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
  return motion.sequences.flatMap((shapes) => {
    const spots: StandOffset[] = [{ lane: 0, travel: 0 }];
    const steps: MoverStep[] = [];
    let ready = height + warning;
    for (const [i, shape] of shapes.entries()) {
      const at = ready + delayOf(spec.variation, draws, i) * scrollSpeed;
      const last = spots.at(-1) ?? { lane: 0, travel: 0 };
      if (at + last.travel >= sightLength) {
        break;
      }
      const spotCount = stepSpots(shape);
      for (let spot = 1; spot <= spotCount; spot++) {
        spots.push({
          lane: last.lane + (shape.lanes * spot) / spotCount,
          travel: last.travel + (shape.travel * cellLength * spot) / spotCount,
        });
      }
      steps.push({ at, lanes: shape.lanes, length, travel: shape.travel * cellLength });
      ready = at + length + warning;
    }
    if (steps.length === 0) {
      return [];
    }
    return standingPlacements(geometry, spec, spots, (lane) => ({
      lane,
      motion: "steps",
      movement: spec.movement,
      steps,
      warning,
    }));
  });
}

// The ways a stalker's lane range may reach from its start lane, widest first: a lane to
// either side, one side only, or none.
const APPROACH_REACHES: readonly (readonly [number, number])[] = [
  [-1, 1],
  [-1, 0],
  [0, 1],
  [0, 0],
];

// A stalker may be at any spot in its lanes, from its start down as many rows as it has steps,
// and is placed as standing at each of them, so whichever step it chooses on the road keeps
// the road passable. Its lanes are its start lane and, where there is room, a lane to either
// side: the wider, the more it can follow the pack, and the planner takes the widest that fits
// (rank). Its first step comes its drawn delay after it is wholly on the road, and its second
// once the road between it and the pack, the tallest pack's rows at sightLength, is down to its
// drawn share of the road's length.
function approachPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  motion: Extract<MoverMotion, { kind: "approach" }>,
  draws: MoverDraws,
): MoverPlacement[] {
  const { cellLength, roadLength, scrollSpeed, sightLength } = geometry;
  const warning = spec.warningSeconds * scrollSpeed;
  const height = spec.footprint.rows * cellLength;
  const pending: ApproachTiming[] = [
    {
      at: height + (within(motion.firstDelaySeconds, draws.delays[0]) * scrollSpeed + warning),
      kind: "after",
    },
    ...Array.from({ length: motion.steps - 1 }, (): ApproachTiming => ({
      kind: "near",
      travel: sightLength - within(motion.secondRoadShare, draws.share) * roadLength,
    })),
  ];
  return APPROACH_REACHES.flatMap(([left, right], rank) => {
    const spots = Array.from({ length: right - left + 1 }, (_, i) =>
      Array.from({ length: motion.steps + 1 }, (_unused, row) => ({
        lane: left + i,
        travel: row * cellLength,
      })),
    ).flat();
    return standingPlacements(geometry, spec, spots, (lane) => ({
      burst: cellLength,
      lane,
      length: motion.stepSeconds * scrollSpeed,
      motion: "approach",
      movement: spec.movement,
      pending,
      reach: { count: right - left + 1, first: lane + left },
      rows: motion.steps,
      steps: [],
      stopTravel: sightLength,
      warning,
    })).map((placement) => ({ ...placement, rank: APPROACH_REACHES.length - rank }));
  });
}

// One mover's placements, at its draws.
export function moverPlacements(
  geometry: MoverGeometry,
  spec: MoverSpec,
  draws: MoverDraws = EVEN_DRAWS,
): MoverPlacement[] {
  const { motion } = spec;
  switch (motion.kind) {
    case "approach":
      return approachPlacements(geometry, spec, motion, draws);
    case "cross":
      return crossPlacements(geometry, spec, motion, draws);
    case "ride":
      return ridePlacements(geometry, spec, motion.speedMultiplier, draws);
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

// The spawn planner's grid of rows and lanes. block blocks lanes in a row's window for rows
// rows, with the row before it as a lead-in if asked, if every lane-blocking spawn stays
// avoidable, and undoes it unless keep is set. leavesRoom is false when taking the cells would
// leave too few for the spawns placed later that are never skipped. packFits is true when the
// pack fits between each stand and every lane-blocking spawn placed so far, and stand records
// the stands for the spawns placed later.
export interface MoverGrid {
  block(row: number, lanes: LaneSpan, rows: number, leadIn: boolean, keep: boolean): boolean;
  isFree(lane: number, row: number): boolean;
  leavesRoom(cells: readonly { readonly lane: number; readonly row: number }[]): boolean;
  packFits(stands: readonly MoverStand[]): boolean;
  stand(stands: readonly MoverStand[]): void;
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

// The movers placed, and the kinds of those dropped, one entry each.
export interface PlacedMovers<Kind extends string> {
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

// Places every mover on rows at the distances given, each quota spread one per equal
// stretch of the zone as the planner spreads other spawns, each mover wholly on screen
// within the zone, within the caps on screen. A mover with no room in its stretch, such as one
// over a cap there, waits: it comes on at a later row with room. One with no room on any later
// row is dropped, which uses no random draw past its own draws, as the planner drops an obstacle
// it has no room for. A mover never stands still in place of moving. Each mover makes its own
// draws (drawMover) before it is placed, and is placed as they have it move, so the path rule
// holds for the speed and moments it was drawn; of the places that fit, it takes one of those
// with the highest rank.
export function placeMovers<Kind extends string>(
  random: Random,
  geometry: MoverGeometry & { readonly zoneLength: number },
  caps: MoverCaps,
  grid: MoverGrid,
  rows: readonly number[],
  quotas: readonly MoverQuota<Kind>[],
): PlacedMovers<Kind> {
  const onScreen: OnScreen[] = [];
  const fits = (spot: Spot) => {
    const [start, end] = screenOf(spot);
    const { placement } = spot;
    return (
      start >= 0 &&
      end <= geometry.zoneLength &&
      screenHasRoom(caps, onScreen, onScreenOf(placement.path, [start, end])) &&
      placement.cells.every(({ lane, row }) => grid.isFree(lane, spot.row + row)) &&
      grid.leavesRoom(placement.cells.map(({ lane, row }) => ({ lane, row: spot.row + row }))) &&
      grid.packFits(standsOf(spot)) &&
      grid.block(spot.row, placement.lanes, placement.rows, placement.leadIn, false)
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
  const dropped: Kind[] = [];
  for (const { count, kind, spec } of quotas) {
    for (let i = 0; i < count; i++) {
      const placements = moverPlacements(geometry, spec, drawMover(random));
      const end = Math.floor(((i + 1) * rows.length) / count);
      const stretch = spotsIn(placements, Math.floor((i * rows.length) / count), end);
      const fitting = stretch.length > 0 ? stretch : spotsIn(placements, end, rows.length);
      if (fitting.length === 0) {
        dropped.push(kind);
        continue;
      }
      const rank = Math.max(...fitting.map(({ placement }) => placement.rank ?? 0));
      const spot = randomPick(
        random,
        fitting.filter(({ placement }) => (placement.rank ?? 0) === rank),
      );
      const { placement } = spot;
      placement.cells.forEach(({ lane, row }) => grid.take(lane, spot.row + row));
      grid.block(spot.row, placement.lanes, placement.rows, placement.leadIn, true);
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
