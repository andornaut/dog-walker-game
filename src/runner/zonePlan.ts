import type {
  EncounterId,
  GameData,
  MinorObstacleId,
  Movement,
  ObstacleEncounterId,
} from "../data/types";
import { PART_INSET } from "../layout/packFormation";
import { chanceRound, shuffled, weightedPick } from "../lib/random";
import { keysOf } from "../lib/records";
import { drawGearDrops } from "../rules/gearDrops";
import { modifiedStat } from "../rules/modifiers";
import { currentZone } from "../rules/route";
import { read } from "../rules/units";
import { slowestDebuffedAgility, slowestPackAgility } from "../rules/walkers";
import { zoneStats } from "../rules/zones";
import type { RunState } from "../state/runState";
import { STEP_SECONDS } from "./fixedStep";
import type { PlannerStreams } from "./moverPlanning";
import { moverMovement, moverSpec } from "./moverSpecs";
import type { SpawnQuota } from "./spawning";
import { spacedStretch } from "./stretches";
import {
  itemHeight,
  plannedCellInset,
  type RoadGeometry,
  type Walk,
  type WalkData,
  walkScrollSpeed,
  zoneLength,
} from "./walk";
import { blocksLane, footprintOf, movementOf, opensACard, type WalkItemKind } from "./walkItems";
import { planSpawns } from "./zonePlanner";

// The entries of a zone's weights above 0, in the data's order.
function positiveWeights<Id extends string>(weights: Readonly<Record<Id, number>>): [Id, number][] {
  return keysOf(weights)
    .map((id): [Id, number] => [id, weights[id]])
    .filter(([, weight]) => weight > 0);
}

// The chance weights of the obstacles in the run's current zone.
export function obstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [ObstacleEncounterId, number][] {
  return positiveWeights(currentZone(data, run).weights.obstacles);
}

// The minor obstacles that may appear in the run's current zone, with their weights.
export function minorObstacleWeights(
  data: Pick<GameData, "world">,
  run: Pick<RunState, "route" | "zoneIndex">,
): [MinorObstacleId, number][] {
  return positiveWeights(currentZone(data, run).weights.minorObstacles);
}

// The walk's first zone starts with spawns on the road in view, the first meeting the pack no
// sooner than this long in; later zones start with their own spawns still to come into view.
export function firstContactSeconds(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "zoneIndex">,
): number | undefined {
  return run.zoneIndex === 0 ? read(data.tuning, "seconds", "firstZoneContact") : undefined;
}

// Each obstacle and minor obstacle is drawn first by the zone's weights, so its shape is known
// when it is placed. Rush hour and the like scale both obstacle counts, the tips and the treats.
// Then each obstacle whose look moves comes as a mover at the zone's mover share: one quota per
// kind, and one per stepper, whose steps are its own. A pull obstacle blocks no lane, moving or
// not (blocksLane). Then the zone's lucky finds: of each kind, zoneStats' luckyFinds rounded by
// chanceRound, in the kinds' order, then shuffled, each a quota of its own held to its spaced
// stretch of the zone (spacedStretch) and, where its look moves, a mover at the mover share; a
// lucky find blocks no lane. Last, the zone's gear drops (drawGearDrops), each a quota of its own
// that blocks no lane, held to its spaced stretch.
export function spawnQuotas(
  data: WalkData,
  streams: PlannerStreams,
  run: RunState,
): SpawnQuota<WalkItemKind>[] {
  const random = streams.spawns;
  const zone = currentZone(data, run);
  const stats = zoneStats(data.tuning, zone, run.zoneIndex);
  const scaled = (stat: "obstacleSpawns" | "tipSpawns" | "treatSpawns", base: number) =>
    Math.round(modifiedStat(data.tuning, run.modifiers, stat, base));
  const drawn = <Kind extends WalkItemKind>(
    count: number,
    weights: readonly (readonly [Kind, number])[],
  ) => {
    const ids = weights.map(([id]) => id);
    const odds = weights.map(([, weight]) => weight);
    return weights.length === 0
      ? []
      : Array.from({ length: count }, () => weightedPick(random, ids, odds));
  };
  const kinds: WalkItemKind[] = [
    ...drawn(scaled("obstacleSpawns", stats.obstacles), obstacleWeights(data, run)),
    ...drawn(scaled("obstacleSpawns", stats.minorObstacles), minorObstacleWeights(data, run)),
  ];
  const quotas = new Map<WalkItemKind, number>();
  const movers = new Map<WalkItemKind, { readonly count: number; readonly movement: Movement }>();
  const steppers: SpawnQuota<WalkItemKind>[] = [];
  const count = <Key>(map: Map<Key, number>, key: Key) => map.set(key, (map.get(key) ?? 0) + 1);
  const moverQuota = (kind: WalkItemKind, movement: Movement, moverCount: number) => ({
    blocksLane: blocksLane(data, kind),
    count: moverCount,
    first: opensACard(data, kind),
    kind,
    mover: moverSpec(data, streams, footprintOf(data, kind), movement),
  });
  for (const kind of kinds) {
    const movement = moverMovement(data, random, zone.moverShare, kind);
    if (movement === null) {
      count(quotas, kind);
    } else if (movement.kind === "step") {
      steppers.push(moverQuota(kind, movement, 1));
    } else {
      movers.set(kind, { count: (movers.get(kind)?.count ?? 0) + 1, movement });
    }
  }
  const finds = shuffled(
    random,
    (Object.entries(stats.luckyFinds) as [EncounterId, number][]).flatMap(([kind, expected]) =>
      Array.from({ length: chanceRound(random, expected) }, () => kind),
    ),
  );
  const lucky = finds.map((kind, i): SpawnQuota<WalkItemKind> => {
    const within = spacedStretch(finds.length, i);
    const movement = moverMovement(data, random, zone.moverShare, kind);
    return movement === null
      ? { blocksLane: false, count: 1, footprint: footprintOf(data, kind), kind, within }
      : { ...moverQuota(kind, movement, 1), within };
  });
  const drops = drawGearDrops(data, random, run);
  return [
    ...[...movers].map(([kind, { count: moverCount, movement }]) =>
      moverQuota(kind, movement, moverCount),
    ),
    ...steppers,
    ...[...quotas].map(([kind, kindCount]) => ({
      blocksLane: blocksLane(data, kind),
      count: kindCount,
      first: opensACard(data, kind),
      footprint: footprintOf(data, kind),
      kind,
    })),
    ...lucky,
    ...drops.map((gear, i): SpawnQuota<WalkItemKind> => ({
      blocksLane: false,
      count: 1,
      kind: gear,
      within: spacedStretch(drops.length, i),
    })),
    {
      blocksLane: false,
      count: scaled("tipSpawns", stats.tips),
      kind: "tip",
      moversPassOver: true,
      moversRestOn: true,
    },
    {
      blocksLane: false,
      count: scaled("treatSpawns", stats.treats),
      kind: "treat",
      moversPassOver: true,
    },
  ];
}

// Plans the run's current zone: its spawns, each obstacle and lucky encounter drawn by the
// zone's weights.
export function planZone(
  data: WalkData,
  geometry: Pick<
    RoadGeometry,
    | "cell"
    | "itemHeights"
    | "laneCount"
    | "lens"
    | "packBand"
    | "roadBottom"
    | "roadTop"
    | "sightLength"
    | "tallestPackBand"
  >,
  streams: PlannerStreams,
  walk: Walk,
): Walk {
  const { road, run } = walk;
  const length = zoneLength(data);
  // Each lane-blocking kind's drawn hit length, standing and moving, for the pack-fit gap.
  const withHitLengths = (quotas: SpawnQuota<WalkItemKind>[]) =>
    quotas.map((quota) =>
      !quota.blocksLane
        ? quota
        : {
            ...quota,
            hitLength: itemHeight(data, geometry, quota.kind, false),
            ...(quota.mover === undefined
              ? {}
              : {
                  mover: {
                    ...quota.mover,
                    hitLength: itemHeight(data, geometry, quota.kind, true),
                  },
                }),
          },
    );
  const firstContact = firstContactSeconds(data, run);
  // The zone's minor obstacles that never move, which one with no room is swapped among.
  const fixedKinds = minorObstacleWeights(data, run)
    .filter(([kind]) => movementOf(data, kind) === null)
    .map(([kind, weight]) => ({
      footprint: footprintOf(data, kind),
      hitLength: itemHeight(data, geometry, kind, false),
      kind,
      weight,
    }));
  const plan = {
    cellInset: plannedCellInset(data, geometry),
    cellLength: geometry.cell.length,
    ...(firstContact === undefined ? {} : { firstContactSeconds: firstContact }),
    fixedKinds,
    laneCount: geometry.laneCount,
    laneInset: geometry.cell.inset,
    // The slowest pack's lane move sets the row spacing, so every pack fits every gap.
    laneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestPackAgility(data),
    maxEmptyRows: read(data.tuning, "counts", "maxEmptyRows"),
    minOpenLanes: read(data.tuning, "counts", "openLanesPerRowMin"),
    minSpacing: read(data.tuning, "pixels", "spawnRowSpacing"),
    moverCaps: {
      darts: read(data.tuning, "counts", "maxDartMovers"),
      slowVehicles: read(data.tuning, "counts", "maxSlowVehicles"),
      total: read(data.tuning, "counts", "maxMovers"),
    },
    // The tallest pack's hit boxes, inside its outline by PART_INSET at each end.
    packHitLength: geometry.tallestPackBand - 2 * PART_INSET,
    packLength: geometry.tallestPackBand,
    // A Muddy pack's lane move, the slowest, spaces the path's lane changes: a puddle, a pothole
    // or a card may muddy the pack in any neighbourhood, and Muddy may last past its end.
    pathLaneMoveSeconds: read(data.tuning, "seconds", "laneMove") / slowestDebuffedAgility(data),
    // The path goes on from where the last zone's ends, or starts in the pack's lane.
    pathStart: road.path[road.path.length - 1]?.lane ?? road.control.target,
    quotas: withHitLengths(spawnQuotas(data, streams, run)),
    reactionSeconds: read(data.tuning, "seconds", "pathReactionMargin"),
    roadLength: geometry.roadBottom - geometry.roadTop,
    scrollSpeed: walkScrollSpeed(data, run),
    sightLength: geometry.sightLength,
    stepSeconds: STEP_SECONDS,
    zoneLength: length,
  };
  const planned = plan.quotas.map(({ count, kind, mover }) => ({
    count,
    kind,
    movement: mover?.movement ?? null,
  }));
  const { events, path } = planSpawns(streams, plan);
  return { road: { ...road, path, pending: events, planned }, run };
}
