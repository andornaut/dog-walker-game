import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, GameData, MinorObstacleId, Movement, ZoneId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { currentZoneId } from "../rules/route";
import { read } from "../rules/units";
import { approachOutcomes } from "../runner/approach";
import { hitDog } from "../runner/collision";
import { STEP_SECONDS } from "../runner/fixedStep";
import { type LaneMotion, stillInLane } from "../runner/laneMotion";
import {
  hasLeftRoad,
  type MoverDraws,
  type MoverFootprint,
  moverPlace,
  moverPlacements,
} from "../runner/movers";
import { NO_PULLS } from "../runner/pulls";
import { seededRandom } from "../runner/random";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { blockingLength } from "../runner/spawning";
import {
  blocksLane,
  itemHeight,
  moverSpec,
  obstacleHitBox,
  packBoxes,
  plannedCellInset,
  startRoad,
  steerWalk,
  sweptPackBoxes,
  type Walk,
  type WalkItem,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import type { PackDogs } from "../state/runState";
import { hoppingInstead, sharedWorld } from "../testing/movers";
import { testState } from "../testing/runState";
import { actBot, type BotRoad, moverHazards, newBot } from "./bot";
import { type RunResult, type SimData, simulateRun } from "./simulate";
import { IDEAL_SKILL, type Skill, SKILL_PRESETS } from "./skills";

// Zones a quarter as long, with a quarter of the spawns, so the road is as busy as the game's
// and a run is cheap.
function shortZones(data: GameData, share: number): GameData {
  const { counts, seconds } = data.tuning;
  const scaled = (value: number) => Math.round(value * share);
  return {
    ...data,
    tuning: {
      ...data.tuning,
      counts: {
        ...counts,
        minorObstaclesFirstZone: scaled(counts.minorObstaclesFirstZone),
        minorObstaclesGainPerZone: scaled(counts.minorObstaclesGainPerZone),
        obstaclesFirstZone: scaled(counts.obstaclesFirstZone),
        obstaclesGainPerZone: scaled(counts.obstaclesGainPerZone),
        tipsFirstZone: scaled(counts.tipsFirstZone),
        tipsGainPerZone: scaled(counts.tipsGainPerZone),
      },
      seconds: { ...seconds, zoneAtBaseSpeed: seconds.zoneAtBaseSpeed * share },
    },
  };
}

// No squirrels on the road, so no dog pulls and every hit is the bot's own doing.
function withoutPulls(data: GameData): GameData {
  const zones = data.world.zones.map((zone) => ({
    ...zone,
    weights: { ...zone.weights, obstacles: { ...zone.weights.obstacles, squirrel: 0 } },
  }));
  return {
    ...data,
    world: { ...data.world, zones: zones as unknown as GameData["world"]["zones"] },
  };
}

const SHORT = shortZones(gameData, 0.25);
const NO_CHASER: PackDogs = ["duchess", "biscuit", "snowball"];

function run(data: SimData, seed: number, skill: Skill, pack: PackDogs = NO_CHASER): RunResult {
  return simulateRun(data, seed, {
    gear: null,
    pack,
    player: { kind: "skill", skill },
    policy: "heartsUnlessLow",
    route: "straight",
    walker: "casey",
  });
}

// Obstacles, minor or not, moving or not, that the pack hit, and that reached it.
function obstacleCounts(data: SimData, results: readonly RunResult[]) {
  const counts = results.flatMap((result) => [
    ...Object.entries(result.items)
      .filter(([kind]) => blocksLane(data, kind as WalkItemKind))
      .map(([, count]) => count),
    ...Object.values(result.movers),
  ]);
  return {
    hit: counts.reduce((sum, count) => sum + count.touched, 0),
    met: counts.reduce((sum, count) => sum + count.met, 0),
  };
}

// Each run walks every zone frame by frame, so these take a few hundred
// milliseconds a run on a loaded machine.
describe("a steering bot", { timeout: 60_000 }, () => {
  it("plays the same run for the same seed, and another for another seed", () => {
    const first = run(SHORT, 3, SKILL_PRESETS.typical);

    expect(run(SHORT, 3, SKILL_PRESETS.typical)).toEqual(first);
    expect(run(SHORT, 4, SKILL_PRESETS.typical)).not.toEqual(first);
  });

  it("hits fewer obstacles as an expert than as a novice", () => {
    const seeds = [1, 2];
    const novice = obstacleCounts(
      SHORT,
      seeds.map((seed) => run(SHORT, seed, SKILL_PRESETS.novice)),
    );
    const expert = obstacleCounts(
      SHORT,
      seeds.map((seed) => run(SHORT, seed, SKILL_PRESETS.expert)),
    );

    expect(novice.met).toBeGreaterThan(0);
    expect(expert.hit / expert.met).toBeLessThan(novice.hit / novice.met);
  });

  // A bot that plans over only part of the road can still box itself in.
  it("hits nothing on a sparse road with no reaction delay, no errors and a full look-ahead", () => {
    const sparse = withoutPulls(shortZones(gameData, 0.1));
    const sharp: Skill = {
      ...SKILL_PRESETS.typical,
      errorRate: 0,
      lookAheadSeconds: Infinity,
      reactionSeconds: 0,
    };
    const counts = obstacleCounts(sparse, [run(sparse, 5, sharp)]);

    expect(counts.met).toBeGreaterThan(0);
    expect(counts.hit).toBe(0);
  });

  // The spawn planner keeps every obstacle avoidable from any lane the pack can be in; only a
  // dog's pull can force a hit. The bot reads a hopper's hop as it reads any mover's path.
  it.each([
    { busy: withoutPulls(SHORT), name: "the game's movers" },
    {
      busy: withoutPulls(
        hoppingInstead({ ...SHORT, world: sharedWorld(SHORT.world, 1) }, { kind: "hop", most: 2 }),
      ),
      name: "every mover moving and every stepper and hopper hopping up to 2 spots",
    },
  ])("avoids every obstacle no pull forces, as an ideal player, with $name", ({ busy }) => {
    const results = [run(busy, 1, IDEAL_SKILL, ["duchess"]), run(busy, 2, IDEAL_SKILL, NO_CHASER)];
    const counts = obstacleCounts(busy, results);

    expect(counts.met).toBeGreaterThan(100);
    expect(counts.hit).toBe(0);
  });

  // A pull never moves the pack into an obstacle too close to react to, so an ideal player is
  // never hit right after one, whatever the pack pulls toward. Steering away during a strain
  // cancels its pull, so only some strains pull.
  it("is never hit right after a pull, as an ideal player, with pulls on", () => {
    const pulling: PackDogs = ["koda", "biscuit", "zippy"];
    const results = [1, 2, 3].map((seed) => run(SHORT, seed, IDEAL_SKILL, pulling));
    const hits = results.reduce((sum, result) => sum + result.hits.afterPull, 0);
    const pulls = results.reduce((sum, result) => sum + result.pullsMoved, 0);

    expect(pulls).toBeGreaterThan(0);
    expect(hits).toBe(0);
  });
});

// For each way an obstacle moves, at both ends of every draw that varies it (its speed, the
// delays before its moves and a stalker's second-step share), every place the planner may put
// it, on the first zone's road and the last's, and every way a stalker may choose its steps:
// - it moves only while ahead of the pack's rows: no step, hop or dart starts once it has
//   reached them, a stalker never steps up the road and a hopper never hops down it;
// - the bot reads it as the walk's collision has it, for a pack standing in each lane. A lane
//   change starts on the first walk step at or after the plan has it due, so it can come up to
//   a step late; sampled a quarter step apart, wherever the mover would hit a pack standing in a
//   lane, the bot keeps the pack out of that lane from a step before to a step after; and it
//   keeps the pack out of no lane the mover never hits.
describe("a mover's moves and hazards", () => {
  const route = gameData.world.zones.map(({ id }) => id as ZoneId);
  type Moving = Exclude<Movement, { kind: "still" }>;
  const entries: { kind: WalkItemKind; movement: Moving; shape: MoverFootprint }[] = [
    ...(Object.keys(gameData.minorObstacles) as MinorObstacleId[]).map((kind) => {
      const { movement, shape } = gameData.minorObstacles[kind];
      return { kind: kind as WalkItemKind, movement, shape };
    }),
    ...(Object.keys(gameData.encounters) as EncounterId[]).flatMap((kind) => {
      const entry = gameData.encounters[kind];
      return entry.kind === "obstacle"
        ? [{ kind: kind as WalkItemKind, movement: entry.movement, shape: entry.shape }]
        : [];
    }),
  ].flatMap(({ kind, movement, shape }) =>
    movement === undefined || movement.kind === "still" ? [] : [{ kind, movement, shape }],
  );
  const movements = new Map(
    entries.map((entry) => [JSON.stringify([entry.movement, entry.shape]), entry]),
  );
  const LOW: MoverDraws = { delays: [0, 0], share: 0, speed: 0 };
  const HIGH: MoverDraws = { delays: [0.999999, 0.999999], share: 0.999999, speed: 0.999999 };
  const cases = [0, gameData.world.walkLength - 1].flatMap((zoneIndex) =>
    [LOW, HIGH].flatMap((draws) =>
      [...movements.values()].map((entry) => ({
        ...entry,
        draws,
        name: `${JSON.stringify(entry.movement)} in zone ${zoneIndex}, draws ${draws === LOW ? "low" : "high"}`,
        zoneIndex,
      })),
    ),
  );
  const placed = new Set<string>();

  it.each(cases)("moves ahead of the pack and is read as it hits, moving $name", (mover) => {
    const run = testState(
      { biscuit: 3, duchess: 3, snowball: 3 },
      { route, zoneIndex: mover.zoneIndex },
    );
    const geometry = screenRoadGeometry(run);
    const speed = walkScrollSpeed(gameData, run);
    const road: BotRoad = { data: gameData, geometry, speed, zone: currentZoneId(gameData, run) };
    const { cell, laneCount, roadBottom, roadTop, sightLength, tallestPackBand } = geometry;
    const zone = currentZoneId(gameData, run);
    const height = itemHeight(gameData, geometry, zone, mover.kind, true);
    const spec = moverSpec(gameData, seededRandom(1), mover.shape, mover.movement);
    const placements = moverPlacements(
      {
        cellLength: cell.length,
        laneCount,
        packLength: tallestPackBand,
        roadLength: roadBottom - roadTop,
        rowSpacing: read(gameData.tuning, "pixels", "spawnRowSpacing"),
        scrollSpeed: speed,
        sightLength,
        window: blockingLength(
          {
            cellInset: plannedCellInset(gameData, geometry, zone),
            cellLength: cell.length,
            packLength: tallestPackBand,
          },
          1,
        ),
      },
      spec,
      mover.draws,
    );
    if (placements.length > 0) {
      placed.add(JSON.stringify(mover.movement));
    }
    for (const { path } of placements) {
      const outcomes = path.motion === "approach" ? approachOutcomes(path) : [path];
      for (const outcome of outcomes) {
        if (outcome.motion === "cross") {
          expect(outcome.enterTravel).toBeLessThan(sightLength);
        }
        if (outcome.motion === "steps" || outcome.motion === "approach") {
          const before = (index: number) =>
            outcome.steps.slice(0, index).reduce((sum, step) => sum + step.travel, 0);
          outcome.steps.forEach((step, index) => {
            expect(step.at + before(index)).toBeLessThan(sightLength);
            if (mover.movement.kind === "hop") {
              expect(step.travel).toBeLessThanOrEqual(0);
            }
            if (mover.movement.kind === "approach") {
              expect(step.travel).toBeGreaterThanOrEqual(0);
            }
          });
        }
      }
      const item: WalkItem = {
        height,
        id: 1,
        kind: mover.kind,
        lane: 0,
        laneSpan: mover.shape.lanes,
        mover: { path, since: 0 },
        y: roadTop - height,
      };
      const hazards = moverHazards(road, Infinity, item);
      const packs = Array.from({ length: laneCount }, (_, lane) =>
        packBoxes(geometry, stillInLane(lane), run),
      );
      // The pack anywhere on the road within half a lane of its place in each lane.
      const halfway = (lane: number, toward: number): LaneMotion =>
        toward < 0 || toward >= laneCount
          ? stillInLane(lane)
          : { duration: 1, elapsed: 0.5, from: lane, kind: "moving", to: toward };
      const nearPacks = Array.from({ length: laneCount }, (_, lane) =>
        sweptPackBoxes(geometry, halfway(lane, lane - 1), halfway(lane, lane + 1), run),
      );
      // The lanes in which a pack standing there is hit at a time, of any way it moves, or with
      // near, while the mover is between lanes, a pack within half a lane of there; null once
      // every way has left.
      const hitLanes = (at: number, near = false): number[] | null => {
        const lanes = new Set<number>();
        let onRoad = false;
        for (const outcome of outcomes) {
          const place = moverPlace(laneCount, outcome, at * speed);
          const y = roadTop - height + place.travel;
          if (hasLeftRoad(laneCount, place) || y >= roadBottom) {
            continue;
          }
          onRoad = true;
          const box = obstacleHitBox(gameData, geometry, zone, {
            ...item,
            mover: { path: outcome, since: at * speed },
            y,
          });
          const between = near && !Number.isInteger(place.lanePosition);
          (between ? nearPacks : packs).forEach((pack, lane) => {
            if (place.solid && hitDog(pack, box) !== null) {
              lanes.add(lane);
            }
          });
        }
        return onRoad ? [...lanes] : null;
      };
      const inLane = (lane: number, hazard: { readonly lanes: number }) =>
        (hazard.lanes & (1 << lane)) !== 0;
      for (let at = 0, lanes = hitLanes(at); lanes !== null; at += STEP_SECONDS / 4) {
        for (const lane of lanes) {
          const covered = hazards.some(
            (hazard) =>
              inLane(lane, hazard) &&
              hazard.from <= at - STEP_SECONDS + 1e-9 &&
              hazard.to >= at + STEP_SECONDS - 1e-9,
          );
          expect(covered, `lane ${lane} at ${at.toFixed(4)}s`).toBe(true);
        }
        lanes = hitLanes(at + STEP_SECONDS / 4);
      }
      // Searched a tenth of a pixel of scroll apart, finer than the bot's sampling: a pack in a
      // hazard's lane, or changing lanes from it, is hit.
      for (const hazard of hazards) {
        let hit = false;
        for (let at = hazard.from; !hit && at < hazard.to; at += 0.1 / speed) {
          hit = (hitLanes(at, true) ?? []).some((lane) => inLane(lane, hazard));
        }
        expect(hit, `lanes ${hazard.lanes} from ${hazard.from.toFixed(4)}s`).toBe(true);
      }
    }
  });

  // Every way of moving has somewhere the planner can put it.
  it("places every way of moving somewhere", () => {
    expect([...placed].sort()).toEqual(
      [...new Set(entries.map(({ movement }) => JSON.stringify(movement)))].sort(),
    );
  });

  // A rider slower than the road still comes down it, at its slowest draw, so it never comes
  // back up at a pack that has passed it.
  it.each(
    entries.flatMap(({ kind, movement }) =>
      movement.kind === "inLane" ? [{ factor: movement.factor, kind }] : [],
    ),
  )("keeps the $kind coming down the road", ({ factor }) => {
    expect(factor * (1 - read(gameData.tuning, "multipliers", "moverSpeedJitter"))).toBeGreaterThan(
      0,
    );
  });
});

// A plan is for the lane the pack heads for. When the pack heads for another without the bot
// steering it there, such as on a Zoomies drift, the bot replans from there: with an obstacle
// ahead in the lane it planned to leave, it stays in the lane the pack drifted to, whichever way
// that is.
describe("a steering bot whose pack drifts", () => {
  const run = testState({ biscuit: 3, duchess: 3, snowball: 3 });
  const geometry = screenRoadGeometry(run);
  const road: BotRoad = {
    data: gameData,
    geometry,
    speed: walkScrollSpeed(gameData, run),
    zone: currentZoneId(gameData, run),
  };
  const [kind] = (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).filter((id) => {
    const { movement, shape } = gameData.minorObstacles[id];
    return movement === undefined && shape.lanes * shape.rows === 1;
  });
  if (kind === undefined) {
    throw new Error("No one-cell minor obstacle stands still");
  }
  const start = startRoad(geometry.laneCount);
  const lane = start.control.target;
  const height = itemHeight(gameData, geometry, currentZoneId(gameData, run), kind, false);
  const ahead: WalkItem = {
    height,
    id: 1,
    kind,
    lane,
    laneSpan: 1,
    y: geometry.packBand.top - height - 2 * road.speed,
  };
  const walk: Walk = { road: { ...start, items: [ahead] }, run };

  it.each([
    { name: "the way it planned to go", same: true },
    { name: "the other way", same: false },
  ])("replans when it drifts $name", ({ same }) => {
    const bot = newBot(seededRandom(1), IDEAL_SKILL);
    actBot(bot, road, NO_PULLS, walk);
    const [planned] = bot.plan;
    if (planned === undefined) {
      throw new Error("The bot planned no way around the obstacle");
    }
    const way: LaneDirection = same === (planned.direction === 1) ? 1 : -1;
    const drifted = steerWalk(gameData, geometry.laneCount, way, walk);
    const steered: LaneDirection[] = [];
    for (; bot.clock < 3; bot.clock += STEP_SECONDS) {
      steered.push(...actBot(bot, road, NO_PULLS, drifted).lanes);
    }
    expect(steered).toEqual([]);
  });
});
