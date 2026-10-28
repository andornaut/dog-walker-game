import { minorObstacleSpriteKey } from "../../assets/spriteKeys";
import type { GameData, MinorObstacleId, Zone } from "../../data/types";
import { type Random, weightedPick } from "../../lib/random";
import { eachRoadsideProp, type RoadsideTable, START_STRIP_LENGTH } from "../../road/roadsideProps";
import { read } from "../../rules/units";
import {
  DART_VERGE_LANES,
  drawnLanes,
  hasLeftRoad,
  type MoverOnRoad,
  moverPlace,
  stopsOnVerge,
} from "../../runner/movers";
import type { SpawnEvent } from "../../runner/spawning";
import {
  footprintOf,
  itemHeight,
  type RoadGeometry,
  type WalkItem,
  type WalkItemKind,
  zoneLength,
} from "../../runner/walk";

// The distraction movers: red herrings. They wear the zone's own hazards (distractionKinds), step
// on and off the road's edges in the top part of the road, and are gone before their row nears the
// pack. They never hit anything and show no move cue: they block no lane, the walk never reads
// them, and they draw from a random stream of their own, so a seed plays the same walk with or
// without them. Each zone has about counts.distractionsPerZone, spread through it, each in one of
// three patterns: it starts on the verge, steps into the edge lane and steps back off (visit); it
// waits at the road's edge, half on the verge where a dart waits idle, then leaves (edge); or it
// starts in the edge lane as its row comes into view and steps off (leave). Each fades out past
// the verge. Like the road's movers it is measured in road scroll, so it stands still while the
// road does.
//
// None is drawn over a pickup or an obstacle, or stands on a roadside prop's footprint: as its row
// comes into view, it takes the side it drew if every road item, pending spawn and verge scenery
// stays clear of it, and its feet of every prop's footprint, over its whole time on screen, else
// the other side, else a row SHIFT_ROWS further up the zone, until past the latest row its stretch
// allows, where it is skipped. It sorts with the props by row, so a prop nearer the walker stands
// in front of it.

export type DistractionPattern = "edge" | "leave" | "visit";

// One distraction. key is its sprite. row is the zone distance its row comes into view at, the
// one it waits for until placed. side is the side it tries first, -1 left and 1 right, and placed
// the side it took. step, in [0, 1), sets when it steps.
export interface Distraction {
  readonly key: string;
  readonly latest: number;
  readonly pattern: DistractionPattern;
  placed: -1 | 1 | null;
  row: number;
  readonly side: -1 | 1;
  skipped: boolean;
  readonly step: number;
}

// The zone the distractions were planned for, by its index in the walk, and its distractions.
interface DistractionState {
  distractions: Distraction[];
  zoneIndex: number | null;
}

export type DistractionData = Pick<GameData, "encounters" | "minorObstacles" | "tuning">;

// What the distractions are placed against, in flat road pixels: the road's centre line and lane
// 0's middle, the roadside props' table, and the width of each sprite's drawn pixels at full size.
export interface DistractionStage {
  readonly centreX: number;
  readonly firstLaneX: number;
  readonly roadside: RoadsideTable;
  readonly width: (key: string) => number;
}

// The game data, the stream they draw from, the stage, and whether a sprite can be drawn walking
// or hopping: a sprite without it is never drawn.
export interface DistractionDeps {
  readonly data: DistractionData;
  readonly drawable: (key: string) => boolean;
  readonly random: Random;
  readonly stage: DistractionStage;
}

// What each frame needs: the road's geometry, the zone and how far into it the walk is, the art of
// the zone before it (null in the first), and what a distraction must keep clear of: the road's
// items and the verge scenery as they stand now, and the zone's spawns still to come.
export interface DistractionFrame {
  readonly geometry: RoadGeometry;
  readonly items: readonly WalkItem[];
  readonly pending: readonly SpawnEvent<WalkItemKind>[];
  readonly previousArt: string | null;
  readonly zone: Pick<Zone, "art" | "weights">;
  readonly zoneDistance: number;
  readonly zoneIndex: number;
}

// Where a distraction is drawn: its lane position (lane i spans i - 0.5 to i + 0.5, so the verge
// lies below 0 and past the last lane), its feet's flat road row, whether it is moving, whether
// it faces left, and its opacity.
export interface DistractionPlace {
  alpha: number;
  flip: boolean;
  lanePosition: number;
  moving: boolean;
  y: number;
}

// Lanes out from the edge lane's middle to the verge spot a distraction stands on, the same spot
// a dart that stops on the verge stops at, clear of every zone's curb props; and the lanes more
// it walks out past it as it fades out.
const VERGE_OUT = DART_VERGE_LANES + 0.5;
const FADE_OUT = 0.5;
// A stretch's row is drawn within this first share of it.
const ROW_SHARE = 0.5;
// A distraction that has no clear side tries again this many cell lengths further up the zone.
const SHIFT_ROWS = 1;
// Scroll between the moments a placement is checked at.
const SAMPLE_SCROLL = 8;
// A distraction's body runs a cell length up the road from its feet, and keeps this share of a
// cell clear of an item's hit box at each end, for art drawn past it, such as a puddle's far edge.
const ROW_MARGIN = 1;
// A roadside prop's footprint on the ground: its drawn width across, and along the road from this
// many cell lengths nearer than its feet to this many beyond them. A distraction's feet keep out
// of every footprint.
const PROP_FOOTPRINT = { far: 1, near: 0.5 } as const;
// A zone with no hazard to wear takes these.
const AMBIENT_WALKERS = ["ambient-pedestrian", "ambient-pedestrian-back"] as const;
const PATTERNS: readonly DistractionPattern[] = ["edge", "leave", "visit"];
// Lanes out from the edge lane's middle to the road's edge, where a dart waits idle before its cue
// and an edge waiter stands, half on the verge.
const EDGE_OUT = 0.5;

// Its timeline, as shares of its time on screen. A visit waits on the verge from 0 to a share
// from waitFrom up to waitSpan more, by its step, steps in over stepIn, stands for stand, then
// steps out to the verge and fades out by the end. A leave stands in its lane, and an edge waiter
// at the road's edge, from 0 to a share from waitFrom up to waitSpan more, then steps out and
// fades over stepOut.
const TIMELINE = {
  edge: { stepOut: 0.3, waitFrom: 0.3, waitSpan: 0.3 },
  leave: { stepOut: 0.35, waitFrom: 0.2, waitSpan: 0.25 },
  visit: { stand: 0.15, stepIn: 0.25, waitFrom: 0.05, waitSpan: 0.15 },
} as const;

export function startDistractions(): DistractionState {
  return { distractions: [], zoneIndex: null };
}

export function newDistractionPlace(): DistractionPlace {
  return { alpha: 1, flip: false, lanePosition: 0, moving: false, y: 0 };
}

// The scroll from a distraction's row coming into view to its being gone: once its row is down
// to distractionEndRoadShare of the road ahead of the pack.
export function distractionScroll(
  data: Pick<GameData, "tuning">,
  geometry: Pick<RoadGeometry, "sightLength">,
): number {
  const share = read(data.tuning, "multipliers", "distractionEndRoadShare");
  return Math.max(0, geometry.sightLength * (1 - share));
}

// The sprites a zone's distractions wear, each with its weight: the zone's own hazards, so a red
// herring looks like the real thing. They are its one-lane people and animals (onFoot) that it
// weighs above 0, at their weights, each only where its art can walk, hop or run; a zone with
// none takes the ambient walkers, evenly.
export function distractionKinds(
  data: Pick<GameData, "minorObstacles">,
  drawable: (key: string) => boolean,
  zone: Pick<Zone, "weights">,
): [string, number][] {
  const minors = Object.entries(zone.weights.minorObstacles) as [MinorObstacleId, number][];
  const kinds = minors
    .filter(([id, weight]) => {
      const obstacle = data.minorObstacles[id];
      return weight > 0 && obstacle.onFoot === true && obstacle.shape.lanes === 1;
    })
    .map(([id, weight]): [string, number] => [minorObstacleSpriteKey(id), weight])
    .filter(([key]) => drawable(key));
  return kinds.length > 0
    ? kinds
    : AMBIENT_WALKERS.filter((key) => drawable(key)).map((key) => [key, 1]);
}

// The zone's distractions: one in each of distractionsPerZone equal stretches of it, its row
// drawn in the stretch's first ROW_SHARE, each wearing one of distractionKinds by its weight and
// taking one of the three patterns evenly. Each takes the same draws whatever is picked.
export function planDistractions(
  deps: Pick<DistractionDeps, "data" | "drawable" | "random">,
  geometry: Pick<RoadGeometry, "cell" | "sightLength">,
  zone: Pick<Zone, "weights">,
): Distraction[] {
  const { data, drawable, random } = deps;
  const count = Math.max(0, Math.floor(read(data.tuning, "counts", "distractionsPerZone")));
  const kinds = distractionKinds(data, drawable, zone);
  const length = zoneLength(data);
  const stretch = count > 0 ? length / count : 0;
  // Every row is gone from the road before the zone ends.
  const last = length - distractionScroll(data, geometry) - geometry.cell.length;
  const planned: Distraction[] = [];
  for (let i = 0; i < count; i++) {
    const pick = random();
    const pattern = PATTERNS[Math.floor(random() * PATTERNS.length)] ?? "visit";
    const side = random() < 0.5 ? -1 : 1;
    const row = stretch * (i + ROW_SHARE * random());
    const step = random();
    if (kinds.length === 0) {
      continue;
    }
    const key = weightedPick(
      () => pick,
      kinds.map(([kind]) => kind),
      kinds.map(([, weight]) => weight),
    );
    const latest = Math.min(stretch * (i + 1) - geometry.cell.length, last);
    planned.push({
      key,
      latest,
      pattern,
      placed: null,
      row,
      side,
      skipped: row > latest,
      step,
    });
  }
  return planned;
}

// A new zone plans its own distractions, and the last zone's are gone. Then each distraction
// whose row has come into view takes a side clear of everything else on the road, or moves its
// row on up the zone, or is skipped.
export function stepDistractions(
  deps: DistractionDeps,
  frame: DistractionFrame,
  state: DistractionState,
): void {
  if (state.zoneIndex !== frame.zoneIndex) {
    state.zoneIndex = frame.zoneIndex;
    state.distractions = planDistractions(deps, frame.geometry, frame.zone);
  }
  for (const distraction of state.distractions) {
    while (
      distraction.placed === null &&
      !distraction.skipped &&
      distraction.row <= frame.zoneDistance
    ) {
      settle(deps, frame, distraction);
    }
  }
}

function settle(deps: DistractionDeps, frame: DistractionFrame, distraction: Distraction): void {
  for (const side of [distraction.side, -distraction.side as -1 | 1]) {
    if (isClear(deps, frame, distraction, side)) {
      distraction.placed = side;
      return;
    }
  }
  distraction.row += SHIFT_ROWS * frame.geometry.cell.length;
  if (distraction.row > distraction.latest) {
    distraction.skipped = true;
  }
}

// A box on the road: lane positions from left to right, and flat road rows from top to bottom.
interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// The flat x spans of the roadside props whose footprints take in a zone distance's row, as
// placeRoadside draws them: the zone's own past its start strip, and the zone before it's short of
// the strip.
function propsOnRow(
  stage: Pick<DistractionStage, "centreX" | "roadside" | "width">,
  frame: Pick<DistractionFrame, "geometry" | "previousArt" | "zone">,
  data: Pick<GameData, "tuning">,
  row: number,
): { left: number; right: number }[] {
  const spans: { left: number; right: number }[] = [];
  const visit = (shift: number, from: number, to: number) => (art: string | null) => {
    const zone = art === null ? undefined : stage.roadside.zones[art];
    if (zone === undefined || to <= from) {
      return;
    }
    eachRoadsideProp(zone, from - shift, to - shift, (prop, sign) => {
      const x = stage.centreX + sign * prop.across;
      const half = stage.width(prop.key) / 2;
      spans.push({ left: x - half, right: x + half });
    });
  };
  // A prop's footprint takes in the row when its feet stand from far nearer to near beyond it.
  const { length } = frame.geometry.cell;
  const from = row - PROP_FOOTPRINT.far * length;
  const to = row + PROP_FOOTPRINT.near * length;
  visit(0, Math.max(from, START_STRIP_LENGTH), to)(frame.zone.art);
  visit(-zoneLength(data), from, Math.min(to, 0))(frame.previousArt);
  return spans;
}

// Whether a distraction on side stays clear of every item, verge scenery, spawn still to come and
// roadside prop, from now until it is gone.
function isClear(
  deps: DistractionDeps,
  frame: DistractionFrame,
  distraction: Distraction,
  side: -1 | 1,
): boolean {
  const { data, stage } = deps;
  const { geometry, zoneDistance } = frame;
  const end = distractionScroll(data, geometry);
  const since = zoneDistance - distraction.row;
  const arrivals = frame.pending
    .filter((event) => event.distance <= zoneDistance + end - since)
    .map((event) => arrivalOf(data, geometry, event));
  const props = propsOnRow(stage, frame, data, distraction.row);
  const half = stage.width(distraction.key) / 2;
  let lastX: number | undefined;
  const placed = { ...distraction, placed: side };
  const place = newDistractionPlace();
  const margin = ROW_MARGIN * geometry.cell.length;
  for (let travel = since; travel <= end + SAMPLE_SCROLL; travel += SAMPLE_SCROLL) {
    const at = Math.min(travel, end);
    if (!distractionAt(geometry, end, at, placed, place)) {
      continue;
    }
    // Its feet sweep from where the last moment checked left them.
    const x = stage.firstLaneX + place.lanePosition * geometry.cell.length;
    const left = Math.min(x, lastX ?? x) - half;
    const right = Math.max(x, lastX ?? x) + half;
    lastX = x;
    if (props.some((prop) => left < prop.right && prop.left < right)) {
      return false;
    }
    const body: Box = {
      bottom: place.y + margin,
      left: place.lanePosition - 0.5,
      right: place.lanePosition + 0.5,
      top: place.y - geometry.cell.length - margin,
    };
    const ahead = at - since;
    for (const item of frame.items) {
      const box = itemBoxAfter(geometry, ahead, item);
      if (box !== null && overlaps(body, box)) {
        return false;
      }
    }
    for (const { distance: arrives, item } of arrivals) {
      const after = zoneDistance + ahead - arrives;
      const box = after < 0 ? null : itemBoxAfter(geometry, after, item);
      if (box !== null && overlaps(body, box)) {
        return false;
      }
    }
  }
  return true;
}

// A spawn still to come as the item it arrives as, at the zone distance it arrives at.
function arrivalOf(
  data: DistractionData,
  geometry: RoadGeometry,
  event: SpawnEvent<WalkItemKind>,
): { distance: number; item: WalkItem } {
  const height = itemHeight(data, geometry, event.kind, event.mover !== undefined);
  return {
    distance: event.distance,
    item: {
      height,
      id: -1,
      kind: event.kind,
      lane: event.lane,
      laneSpan: footprintOf(data, event.kind).lanes,
      ...(event.mover === undefined ? {} : { mover: { path: event.mover, since: 0 } }),
      y: geometry.roadTop - height,
    },
  };
}

// The road an item covers scroll after it stands as given, or null once a crosser has left the
// road (one that stops on the verge never does). A stalker's or shy hopper's moves still to
// choose may take it anywhere in its lanes and rows, so it covers all of them.
function itemBoxAfter(geometry: RoadGeometry, scroll: number, item: WalkItem): Box | null {
  if (item.mover === undefined) {
    const y = item.y + scroll;
    return {
      bottom: y + item.height,
      left: item.lane - 0.5,
      right: item.lane + item.laneSpan - 0.5,
      top: y,
    };
  }
  const { laneCount, roadTop } = geometry;
  const mover: MoverOnRoad = { ...item.mover, since: item.mover.since + scroll };
  const { path } = mover;
  const place = moverPlace(laneCount, path, mover.since);
  if (hasLeftRoad(laneCount, place) && !stopsOnVerge(laneCount, path)) {
    return null;
  }
  const span = drawnLanes(item.laneSpan, path);
  const y = roadTop - item.height + place.travel;
  const box = {
    bottom: y + item.height,
    left: place.lanePosition - 0.5,
    right: place.lanePosition + span - 0.5,
    top: y,
  };
  if ((path.motion === "approach" || path.motion === "shy") && path.pending.length > 0) {
    const { count, first } = path.reach;
    box.left = Math.min(box.left, first - 0.5);
    box.right = Math.max(box.right, first + count - 1 + span - 0.5);
    if (path.motion === "approach") {
      box.bottom += path.rows * path.burst;
    } else {
      box.top -= path.rise * path.burst;
    }
  }
  return box;
}

// How far out from its edge lane's middle a distraction is, travel after its row came into view,
// a share through of its time on screen; whether it is moving, and which way.
function outAt(
  distraction: Distraction,
  share: number,
): { inward: boolean; moving: boolean; out: number } {
  const ease = (from: number, span: number) => Math.min(1, Math.max(0, (share - from) / span));
  if (distraction.pattern === "visit") {
    const { stand, stepIn, waitFrom, waitSpan } = TIMELINE.visit;
    const wait = waitFrom + waitSpan * distraction.step;
    const outFrom = wait + stepIn + stand;
    if (share < outFrom) {
      const moving = share >= wait && share < wait + stepIn;
      return { inward: true, moving, out: VERGE_OUT * (1 - ease(wait, stepIn)) };
    }
    return {
      inward: false,
      moving: true,
      out: (VERGE_OUT + FADE_OUT) * ease(outFrom, 1 - outFrom),
    };
  }
  const { stepOut, waitFrom, waitSpan } = TIMELINE[distraction.pattern];
  const wait = waitFrom + waitSpan * distraction.step;
  // An edge waiter faces the road while it waits, as a dart does.
  const start = distraction.pattern === "edge" ? EDGE_OUT : 0;
  return {
    inward: distraction.pattern === "edge" && share < wait,
    moving: share >= wait,
    out: start + (VERGE_OUT + FADE_OUT - start) * ease(wait, stepOut),
  };
}

// Writes where a placed distraction is drawn travel after its row came into view, or returns
// false while it is not: before its row is in view, and from when it is gone.
function distractionAt(
  geometry: Pick<RoadGeometry, "laneCount" | "roadTop">,
  end: number,
  travel: number,
  distraction: Distraction,
  out: DistractionPlace,
): boolean {
  const side = distraction.placed;
  if (side === null || travel < 0 || travel >= end || end <= 0) {
    return false;
  }
  const step = outAt(distraction, travel / end);
  if (step.out >= VERGE_OUT + FADE_OUT) {
    return false;
  }
  const edge = side === -1 ? 0 : geometry.laneCount - 1;
  out.lanePosition = edge + side * step.out;
  out.y = geometry.roadTop + travel;
  out.moving = step.moving;
  // The art faces right: it faces left walking out on the left side or in on the right.
  out.flip = step.inward === (side === 1);
  out.alpha = Math.min(1, Math.max(0, (VERGE_OUT + FADE_OUT - step.out) / FADE_OUT));
  return true;
}

// Writes where a distraction is drawn now into out, or returns false while it is not drawn: not
// yet placed, skipped, its row not yet in view, or gone.
export function placeDistraction(
  data: Pick<GameData, "tuning">,
  geometry: Pick<RoadGeometry, "laneCount" | "roadTop" | "sightLength">,
  zoneDistance: number,
  distraction: Distraction,
  out: DistractionPlace,
): boolean {
  const end = distractionScroll(data, geometry);
  return distractionAt(geometry, end, zoneDistance - distraction.row, distraction, out);
}
