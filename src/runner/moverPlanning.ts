import type { MoveCount, MovementKind } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { itemAt } from "../lib/arrays";
import { type Random, randomInt, randomPick, seededRandom, weightedPick } from "../lib/random";
import {
  type ApproachTiming,
  crossingScroll,
  crossLength,
  crossScrollTo,
  crossSpan,
  type LaneSpan,
  type MoverPath,
  moverPlace,
  type MoverStep,
  type StepShape,
} from "./movers";
import { nthStretch, rowsWithin, WHOLE_ZONE } from "./stretches";

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
// row; a dart has none, as a standing spawn may stand where a dart passes, but a stop-and-go
// across, a vehicle crossing side-on, has one. Of the placements that fit in a start lane and row,
// the planner takes one of the highest rank, 0 when unset.
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

// A step a lane to either side, left first.
export const SIDESTEPS: readonly StepShape[] = [
  { lanes: -1, travel: 0 },
  { lanes: 1, travel: 0 },
];

// Every hop of 1 to most spots one way: lanes to either side or, unless sideways, a row up the
// road, away from the pack, or diagonally up. A hop never goes down toward the pack. The planner
// picks among those that keep the road passable.
export function hopShapes(most: number, sideways: boolean): StepShape[] {
  const ways: readonly StepShape[] = sideways
    ? SIDESTEPS
    : [...SIDESTEPS, { lanes: 0, travel: -1 }, { lanes: -1, travel: -1 }, { lanes: 1, travel: -1 }];
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

// The value a draw from 0 up to 1 picks in a range, from its low end to its high end.
function rangeAt(range: readonly [number, number], draw: number): number {
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
// and waits idle at its edge until its cue, warningSeconds before it sets off. One with a pause, a
// stop-and-go across, is a vehicle, not a dart: level with its row the whole time it is on screen,
// stops included, it has a body across every lane of the road, from its row up the road for its
// hit length, its drawn one or its footprint's planned one, whichever is longer, so no standing
// spawn stands where it crosses.
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
  const tilt = rangeAt(crossTilts(motion, scrollSpeed, sightLength, cueOnRoad), draws.tilt);
  if (tilt <= -1) {
    throw new Error("A crosser's tilt must keep it coming down the road");
  }
  const lanesPerPixel = (motion.lanesPerSecond * speedFactor(spec.variation, draws)) / scrollSpeed;
  const outcome = dartOutcome(motion, draws.turn);
  const turnAfter =
    outcome === "turn" ? rangeAt(motion.turnAtShare, draws.turnAt) * laneCount : null;
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
  const drawn = rangeAt([lowest, highest], draws.start);
  const ahead = rangeAt([drawn, cueOnRoad], lift) * sightLength;
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
  // Its contact with the pack's rows, a window long: while it crosses, the travel its window
  // takes at its tilt, cut short where its hit box leaves the road; once it stops, until the
  // window has passed.
  const contactOver = (length: number) =>
    crosses
      ? Math.max(0, Math.min(length / (1 + tilt), touching - reaches))
      : scrollTo(sightLength + length) - reaches;
  const contact = contactOver(window);
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
  const drawnContact = contactOver(drawnWindow);
  const body =
    "pause" in pause
      ? {
          body: {
            from: 0,
            lanes: { count: laneCount, first: 0 },
            to: Math.max(drawnHitLength(geometry, spec), bodyLength(geometry, spec.footprint.rows)),
          },
        }
      : {};
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
      ...body,
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
  const lengths = stepCounts(motion);
  return (
    lengths[Math.min(lengths.length - 1, Math.floor(draw * lengths.length))] ?? motion.count.min
  );
}

// The lengths of a stepping mover's sequences within its motion's count, fewest first.
function stepCounts(
  motion: Pick<Extract<MoverMotion, { kind: "steps" }>, "count" | "sequences">,
): number[] {
  const { max, min } = motion.count;
  return [...new Set(motion.sequences.map((sequence) => sequence.length))]
    .filter((length) => length >= min && length <= max)
    .sort((a, b) => a - b);
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
      at:
        height + (rangeAt(motion.firstDelaySeconds, draws.delays[0] ?? 0) * scrollSpeed + warning),
      kind: "after",
    },
    ...Array.from({ length: steps - 1 }, (): ApproachTiming => ({
      kind: "near",
      travel: sightLength - rangeAt(motion.secondRoadShare, draws.share) * roadLength,
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

// The even draws from 0 to 1 a mover with no room at its own draws retries its tilt and speed at.
const RETRY_DRAWS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1] as const;

// The draws from 0 up to 1 that pick each of counts counts other than the one own picks, as
// drawnCount and drawnStepCount read a draw: nearest the one own picks first, the fewer first
// between two as near.
function otherCountDraws(counts: number, own: number): number[] {
  const picked = Math.min(counts - 1, Math.floor(own * counts));
  return Array.from({ length: counts }, (_, index) => index)
    .filter((index) => index !== picked)
    .sort((a, b) => Math.abs(a - picked) - Math.abs(b - picked) || a - b)
    .map((index) => (index + 0.5) / counts);
}

// The draws a mover with no room at its own retries at, each its own draws with one changed. A
// dart retries its tilt at each of RETRY_DRAWS, then its speed at each; a rider its speed at each;
// a stepper, hopper or stalker each other count of moves it may draw (drawnStepCount, drawnCount).
// Each is tried nearest its own draw first, the lower first between two as near. A draw its kind
// does not vary by, a tilt with no range, a speed with no jitter or a single count, is not retried.
export function moverRetries(spec: MoverSpec, draws: MoverDraws): MoverDraws[] {
  const { motion, variation } = spec;
  const nearest = (own: number) =>
    RETRY_DRAWS.filter((draw) => Math.abs(draw - own) > 1e-9).sort(
      (a, b) => Math.abs(a - own) - Math.abs(b - own) || a - b,
    );
  const speeds = variation.speedShare > 0 ? nearest(draws.speed) : [];
  switch (motion.kind) {
    case "approach": {
      const counts = motion.steps.max - motion.steps.min + 1;
      return otherCountDraws(counts, draws.count).map((count) => ({ ...draws, count }));
    }
    case "cross": {
      const tilts = motion.tilt[0] < motion.tilt[1] ? nearest(draws.tilt) : [];
      return [
        ...tilts.map((tilt) => ({ ...draws, tilt })),
        ...speeds.map((speed) => ({ ...draws, speed })),
      ];
    }
    case "ride":
      return speeds.map((speed) => ({ ...draws, speed }));
    default: {
      const counts = stepCounts(motion).length;
      return otherCountDraws(counts, draws.count).map((count) => ({ ...draws, count }));
    }
  }
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
// records a mover's body, at distances along the zone, for those. clearOf is true when a mover's
// body, at distances along the zone, shares no road with a lane-blocking standing spawn placed
// so far, which a dart may set off over.
interface MoverGrid {
  block(row: number, lanes: LaneSpan, rows: number, keep: boolean, dart?: boolean): boolean;
  clearOf(body: MoverBody): boolean;
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

// A spot's body, if it has one, at distances along the zone.
function bodyOf(spot: Spot): MoverBody | undefined {
  const { body } = spot.placement;
  return body === undefined
    ? undefined
    : { from: spot.distance + body.from, lanes: body.lanes, to: spot.distance + body.to };
}

function standsOf(spot: Spot): MoverStand[] {
  return spot.placement.stands.map((stand) => ({
    ...stand,
    distance: spot.distance + stand.distance,
  }));
}

// Places every mover on rows at the distances given, each quota spread one per equal stretch of the
// zone, or of the share of it the quota's within holds it to, as the planner spreads other spawns,
// each mover wholly on screen within the zone, within the caps on screen, its body, where it has
// one, clear of the lane-blocking standing spawns placed before it. A mover with no room in its
// stretch, such as one over a cap there, waits: it comes on at the next row with room, within its
// share of the zone. A dart with no room at its drawn start retries the same rows from higher up
// the road, its start lifted by each of DART_LIFTS in turn, lowest first, before it waits; on each
// later row it tries its drawn start and then each lift. A mover with no room on any later row
// tries again the same way at each of its retries (moverRetries): a dart at another tilt of its
// kind's range and then another speed, a rider at another speed, and a stepper, hopper or stalker
// at another count of moves, until one has room, so a dart whose drawn path sweeps too many lanes
// in the pack's window still comes on, crossing at another tilt or speed, a merging rider too fast
// to merge before it reaches the pack comes on slower, and a stepper with no room for its drawn
// steps takes fewer or more. A mover with no room at any is dropped, which uses no random draw past
// its own draws, as the planner drops an obstacle it has no room for. A dart may take cells other
// spawns hold, and a rider cells only darts hold (MoverGrid.isFree); no other mover takes a cell a
// dart holds. A mover never stands still in place of moving. Each mover makes its own draws
// (drawMover) before it is placed, and is placed as they have it move, so the path rule holds for
// the speed and moments it was drawn. Of the places that fit, it takes a start lane from the movers
// stream, drawn toward the lanes left unblocked longest (laneBalanceWeight), so an edge lane that
// fits fewer of its ways comes up as often as a middle one; then, from the spawns stream, a place
// in that lane of the highest rank in its row, so each row gives the lane the widest reach that
// fits there. onScreen holds the movers already on screen, from an earlier call, and gains each
// mover placed.
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
    const body = bodyOf(spot);
    return (
      start >= 0 &&
      end <= geometry.zoneLength &&
      screenHasRoom(caps, onScreen, onScreenOf(placement.path, [start, end])) &&
      cells.every(({ lane, row }) => grid.isFree(placement.path.motion, lane, spot.row + row)) &&
      (body === undefined || grid.clearOf(body)) &&
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
    end: number,
  ) => {
    for (let row = first; row < end; row++) {
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
      let fitting: Spot[] = [];
      for (const tried of [draws, ...moverRetries(spec, draws)]) {
        fitting = fittingAt(tried);
        if (fitting.length > 0) {
          break;
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
      const body = bodyOf(spot);
      if (body !== undefined) {
        grid.occupy(body);
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
