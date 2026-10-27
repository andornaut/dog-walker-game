// The walk tests' view of the spawn planner on the game's road: the real data, the game's
// road and pack, and each lane-blocking spawn's spans and contact with the pack.
import { MINOR_OBSTACLES } from "../data/minorObstacles";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { TUNING } from "../data/tuning";
import type {
  EncounterId,
  MinorObstacleId,
  ObstacleEncounterId,
  WalkerId,
  World,
  Zone,
  ZoneId,
} from "../data/types";
import { DEFAULT_WALKER, WALKERS } from "../data/walkers";
import { WORLD } from "../data/world";
import { type PackSprites, PART_INSET } from "../layout/packFormation";
import { screenLayout } from "../layout/screenLayout";
import { itemAt } from "../lib/arrays";
import { read } from "../rules/units";
import { slowestPackAgility } from "../rules/walkers";
import { approachOutcomes } from "../runner/approach";
import { type MoverPath, moverPlace } from "../runner/movers";
import {
  blocksLane,
  footprintOf,
  itemHeight,
  laneMoveSeconds,
  plannedCellInset,
  type RoadGeometry,
  type Walk,
  type WalkItem,
  walkScrollSpeed,
  zoneLength,
} from "../runner/walk";
import { walkGeometry, walkProjection } from "../runner/walkGeometry";
import { newRun, type RunState } from "../state/runState";
import { type BlockingSpan } from "./avoidable";
import { data } from "./walk";

// The real world, as the integrity tests read it.
export const REAL = { ...data, tuning: TUNING, world: WORLD };
export type Real = Omit<typeof REAL, "world"> & { world: World };
export const ZONE_IDS = WORLD.zones.map(({ id }) => id);
// The game's road, as RunScene lays it out for realRun's pack.
export const GAME_ROAD = (() => {
  const road = screenLayout(SCREEN_CONFIG).road;
  const pack: PackSprites = { dogs: ["duchess", "biscuit", "kilo"], walker: DEFAULT_WALKER };
  return walkGeometry(LANE_COUNT, pack, walkProjection(ROAD_CAMERA, road), road);
})();
export const ROAD_LENGTH = GAME_ROAD.roadBottom - GAME_ROAD.roadTop;
// A pack half again as tall as the game's three, as a taller pack box would make it.
export const TALLER = Math.round(GAME_ROAD.tallestPackBand / 2);
export const TALL_PACK_ROAD: RoadGeometry = {
  ...GAME_ROAD,
  packBand: { ...GAME_ROAD.packBand, top: GAME_ROAD.packBand.top - TALLER },
  sightLength: GAME_ROAD.sightLength - TALLER,
  tallestPackBand: GAME_ROAD.tallestPackBand + TALLER,
};
// The data with spawn rows spaced wider by this much.
export const widerRows = (tuned: Real, wider: number): Real => ({
  ...tuned,
  tuning: {
    ...tuned.tuning,
    pixels: {
      ...tuned.tuning.pixels,
      spawnRowSpacing: tuned.tuning.pixels.spawnRowSpacing + wider,
    },
  },
});
export const realRun = (tuned: Real, walker: WalkerId = DEFAULT_WALKER) =>
  newRun(tuned, 3, { dogs: ["duchess", "biscuit", "kilo"], gear: null, walker });
// The world with every zone's weights changed by reweigh.
export function reweighed(reweigh: (weights: Zone["weights"]) => Zone["weights"]): World {
  const [first, ...rest] = WORLD.zones;
  const zoned = (zone: Zone): Zone => ({ ...zone, weights: reweigh(zone.weights) });
  return { ...WORLD, zones: [zoned(first), ...rest.map(zoned)] };
}
// The weights with each of ids weighed one higher.
export function raised<Id extends string>(
  weights: Readonly<Record<Id, number>>,
  ids: readonly Id[],
): Record<Id, number> {
  const entries = (Object.keys(weights) as Id[]).map((id) => [
    id,
    ids.includes(id) ? weights[id] + 1 : weights[id],
  ]);
  return Object.fromEntries(entries) as Record<Id, number>;
}
export const OBSTACLE_IDS = Object.keys(WORLD.zones[0].weights.obstacles) as ObstacleEncounterId[];
export const MINOR_OBSTACLE_IDS = Object.keys(MINOR_OBSTACLES) as MinorObstacleId[];
export const LUCKY_IDS = Object.keys(WORLD.zones[0].weights.luckyFinds) as EncounterId[];
// The run in zone, walked at position zoneIndex.
export const inZone = (run: RunState, zone: ZoneId, zoneIndex: number): RunState => ({
  ...run,
  route: Array.from({ length: zoneIndex + 1 }, () => zone),
  zoneIndex,
});
// The slowest pack's lane move, which sets the row spacing.
export const slowestLaneMove = read(TUNING, "seconds", "laneMove") / slowestPackAgility(REAL);
// The walkway from the zone's start, as blockingSpans measures it: its whole scroll, until the
// zone's last row has passed the pack.
export const walkwayOf = (tuned: Real, road: RoadGeometry, run: RunState) => ({
  laneCount: LANE_COUNT,
  laneMoveSeconds: slowestLaneMove,
  scrollSpeed: walkScrollSpeed(tuned, run),
  zoneLength: zoneLength(tuned) + road.sightLength,
});
// The walker whose pace scrolls the road fastest.
export const FASTEST_WALKER = (Object.keys(WALKERS) as WalkerId[]).reduce((fastest, walker) => {
  const speed = (id: WalkerId) => walkScrollSpeed(REAL, realRun(REAL, id));
  return speed(walker) > speed(fastest) ? walker : fastest;
});
// The walkers whose lane move covers the least and the most road: a lane move takes the same
// time whoever walks, over road that a walker's pace scrolls faster or slower.
export const LANE_MOVE_WALKERS = (() => {
  const road = (walker: WalkerId) => {
    const run = realRun(REAL, walker);
    return laneMoveSeconds(REAL, run) * walkScrollSpeed(REAL, run);
  };
  const walkers = (Object.keys(WALKERS) as WalkerId[]).sort((a, b) => road(a) - road(b));
  return [itemAt(walkers, 0), itemAt(walkers, walkers.length - 1)];
})();
// The greatest common divisor: the row spacing, of distances on rows, some of them negative.
export const gcdOf = (values: readonly number[]): number =>
  values.reduce((a, b) => {
    let [x, y] = [Math.abs(a), Math.abs(b)];
    while (y !== 0) {
      [x, y] = [y, x % y];
    }
    return x;
  }, 0);
// The length the planner gives a spawn's hit box: its rows less the planned inset at each end,
// which covers its drawn hit box (itemHeight) whatever obstacle it is.
export const plannedHeight = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  kind: WalkItem["kind"],
): number =>
  blocksLane(tuned, kind)
    ? footprintOf(tuned, kind).rows * road.cell.length - 2 * plannedCellInset(tuned, road)
    : itemHeight(tuned, road, kind, false);
// The length of the tallest pack's hit boxes, inside its outline by PART_INSET at each end, which
// the pack-fit gap keeps clear.
export const packHitLength = (road: RoadGeometry): number => road.tallestPackBand - 2 * PART_INSET;
// How the pack-fit check measures a spawn: planned, at the planner's hit length for its
// footprint and the tallest pack's outline; or drawn, at its kind's drawn hit length and the
// tallest pack's hit boxes.
export type Sizing = "drawn" | "planned";
// A spawn's hit length and the pack's length, as sizing measures them.
const sized = (
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  kind: WalkItem["kind"],
  moving: boolean,
): { height: number; pack: number } =>
  sizing === "planned"
    ? { height: plannedHeight(tuned, road, zone, kind), pack: road.tallestPackBand }
    : { height: itemHeight(tuned, road, kind, moving), pack: packHitLength(road) };
// A standing spawn's span on the game's road.
export const standingSpan = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  { distance, kind, lane }: { distance: number; kind: WalkItem["kind"]; lane: number },
): BlockingSpan => ({
  distance,
  lane,
  laneSpan: footprintOf(tuned, kind).lanes,
  length: plannedHeight(tuned, road, zone, kind) + road.tallestPackBand,
});
export type MoverEvent = { distance: number; kind: WalkItem["kind"]; mover: MoverPath };
// The scroll since its cue over which moverSpans and moverContact look for a mover's contact.
export const MOVER_SCROLL = Math.ceil(4 * ROAD_LENGTH);
// Each way a mover may move, the lanes of the game's road its hit box overlaps the pack in at a
// scroll since its cue, as sizing measures it: a stalker's every way of choosing its steps, or the
// mover's one path. As collision cuts it, the box spans half a lane either side of each lane it
// covers, less the inset at each side, so one between lanes touches both.
function moverContacts(
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: MoverEvent,
): ((since: number) => number[])[] {
  const sight = road.sightLength;
  const { height, pack } = sized(sizing, tuned, road, zone, event.kind, true);
  const window = height + pack;
  const across = footprintOf(tuned, event.kind).lanes;
  const inset = road.cell.inset / road.cell.length;
  const paths = event.mover.motion === "approach" ? approachOutcomes(event.mover) : [event.mover];
  return paths.map((path) => (since) => {
    const place = moverPlace(LANE_COUNT, path, since);
    const first = Math.floor(place.lanePosition - 1 + inset) + 1;
    const last = Math.ceil(place.lanePosition + across - inset) - 1;
    const overlaps = place.solid && place.travel >= sight && place.travel < sight + window;
    return Array.from({ length: last - first + 1 }, (_unused, i) => first + i).filter(
      (lane) => overlaps && lane >= 0 && lane < LANE_COUNT,
    );
  });
}
// The scroll between inside and outside, a pixel apart, where a mover's contact starts or
// ends, halved down to a rounding error.
function contactEdge(touches: (since: number) => boolean, inside: number, outside: number) {
  let [touching, clear] = [inside, outside];
  for (let i = 0; i < 50; i++) {
    const middle = (touching + clear) / 2;
    if (touches(middle)) {
      touching = middle;
    } else {
      clear = middle;
    }
  }
  return (touching + clear) / 2;
}
// The scroll over which a mover overlaps the pack in any lane, from the first moment to the
// last, by its distance on the road, as sizing measures it: moverSpans' pixel steps put each end
// up to a pixel late, which shows two movers that meet the pack side by side as a gap of under a
// pixel.
export function moverContact(
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: MoverEvent,
): { end: number; start: number } {
  const ends = moverContacts(sizing, tuned, road, zone, event).flatMap((lanesAt) => {
    const touches = (since: number) => lanesAt(since).length > 0;
    const touching = Array.from({ length: MOVER_SCROLL }, (_, since) => since).filter(touches);
    if (touching.length === 0) {
      return [];
    }
    const [first, last] = [itemAt(touching, 0), itemAt(touching, touching.length - 1)];
    return [
      {
        end: contactEdge(touches, last, last + 1),
        start: first === 0 ? 0 : contactEdge(touches, first, first - 1),
      },
    ];
  });
  const at = (since: number) => event.distance + since - road.sightLength;
  return {
    end: at(Math.max(...ends.map(({ end }) => end))),
    start: at(Math.min(...ends.map(({ start }) => start))),
  };
}
// A pixel-long span for each pixel of scroll a mover overlaps the pack in each lane of the
// game's road it covers, as sizing measures it.
export function moverSpans(
  sizing: Sizing,
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  event: MoverEvent,
): BlockingSpan[] {
  const sight = road.sightLength;
  return moverContacts(sizing, tuned, road, zone, event).flatMap((lanesAt) =>
    Array.from({ length: MOVER_SCROLL }, (_, since) =>
      lanesAt(since).map((lane) => ({
        distance: event.distance + since - sight,
        lane,
        laneSpan: 1,
        length: 1,
      })),
    ).flat(),
  );
}
// Every lane-blocking spawn's spans on the game's road, at its planned size: a standing one's, or
// a mover's as it passes the pack. Each is placed by the scroll from the zone's start, so a row
// on the road in view as the zone starts, at a negative distance, is walked from the start.
export const blockingSpans = (
  tuned: Real,
  road: RoadGeometry,
  zone: ZoneId,
  pending: Walk["road"]["pending"],
): BlockingSpan[] =>
  pending
    .filter((event) => blocksLane(tuned, event.kind))
    .flatMap((event) =>
      event.mover === undefined
        ? [standingSpan(tuned, road, zone, event)]
        : moverSpans("planned", tuned, road, zone, { ...event, mover: event.mover }),
    )
    .map((span) => ({ ...span, distance: span.distance + road.sightLength }));
