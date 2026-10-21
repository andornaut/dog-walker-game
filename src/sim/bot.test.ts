import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { GameData, MinorObstacleId, ZoneId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { read } from "../rules/units";
import { hitDog, itemBox } from "../runner/collision";
import { STEP_SECONDS } from "../runner/fixedStep";
import { stillInLane } from "../runner/laneMotion";
import { hasLeftRoad, moverPlace, moverPlacements } from "../runner/movers";
import { NO_PULLS } from "../runner/pulls";
import { seededRandom } from "../runner/random";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { blockingLength } from "../runner/spawning";
import {
  blocksLane,
  itemHeight,
  moverSpec,
  packBoxes,
  startRoad,
  steerWalk,
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

// The bot reads a mover as the walk's collision has it, for a pack standing in each lane. A lane
// change starts on the first walk step at or after the plan has it due, so it can come up to a
// step late. For each way a minor obstacle moves, every place the planner may put it, on the
// first zone's road and the last's, sampled a quarter step apart since the walk's steps can fall
// anywhere along its path: wherever the mover would hit a pack standing in a lane, the bot keeps
// the pack out of that lane from a step before to a step after; and it keeps the pack out of no
// lane the mover never hits, so a lane a mover only passes near stays open to the plan.
describe("a mover's hazards", () => {
  const route = gameData.world.zones.map(({ id }) => id as ZoneId);
  const movements = new Map(
    (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).flatMap((kind) => {
      const { movement, shape } = gameData.minorObstacles[kind];
      return movement === undefined || movement.kind === "still"
        ? []
        : [[JSON.stringify({ movement, shape }), { kind, movement }] as const];
    }),
  );
  const cases = [0, route.length - 1].flatMap((zoneIndex) =>
    [...movements.values()].map(({ kind, movement }) => ({
      kind,
      movement,
      name: `${JSON.stringify(movement)} in zone ${zoneIndex}`,
      zoneIndex,
    })),
  );

  it.each(cases)("covers every hit and only hits, moving $name", (mover) => {
    const run = testState(
      { biscuit: 3, duchess: 3, snowball: 3 },
      { route, zoneIndex: mover.zoneIndex },
    );
    const geometry = screenRoadGeometry(run);
    const speed = walkScrollSpeed(gameData, run);
    const road: BotRoad = { data: gameData, geometry, speed };
    const { cell, laneCount, roadBottom, roadTop, tallestPackBand } = geometry;
    const footprint = gameData.minorObstacles[mover.kind].shape;
    const height = itemHeight(gameData, geometry, mover.kind);
    const spec = moverSpec(gameData, seededRandom(1), footprint, mover.movement);
    const placements = moverPlacements(
      {
        cellLength: cell.length,
        laneCount,
        packLength: tallestPackBand,
        roadLength: roadBottom - roadTop,
        rowSpacing: read(gameData.tuning, "pixels", "spawnRowSpacing"),
        scrollSpeed: speed,
        sightLength: geometry.sightLength,
        window: blockingLength(
          { cellInset: cell.inset, cellLength: cell.length, packLength: tallestPackBand },
          1,
        ),
      },
      spec,
    );
    expect(placements.length).toBeGreaterThan(0);
    for (const { path } of placements) {
      const item: WalkItem = {
        height,
        id: 1,
        kind: mover.kind,
        lane: 0,
        laneSpan: footprint.lanes,
        mover: { path, since: 0 },
        y: roadTop - height,
      };
      const hazards = moverHazards(road, Infinity, item);
      const hits: { at: number; lane: number }[] = [];
      for (let at = 0; ; at += STEP_SECONDS / 4) {
        const place = moverPlace(laneCount, path, at * speed);
        const y = roadTop - height + place.travel;
        if (hasLeftRoad(laneCount, place) || y >= roadBottom) {
          break;
        }
        const box = itemBox(cell, {
          height,
          lane: place.lanePosition,
          laneSpan: footprint.lanes,
          y,
        });
        for (let lane = 0; lane < laneCount; lane++) {
          if (place.solid && hitDog(packBoxes(geometry, stillInLane(lane), run), box) !== null) {
            hits.push({ at, lane });
          }
        }
      }
      const inLane = (lane: number, hazard: { readonly lanes: number }) =>
        (hazard.lanes & (1 << lane)) !== 0;
      for (const { at, lane } of hits) {
        const covered = hazards.some(
          (hazard) =>
            inLane(lane, hazard) &&
            hazard.from <= at - STEP_SECONDS + 1e-9 &&
            hazard.to >= at + STEP_SECONDS - 1e-9,
        );
        expect(covered, `lane ${lane} at ${at.toFixed(4)}s`).toBe(true);
      }
      for (const hazard of hazards) {
        const hit = hits.some(
          ({ at, lane }) => inLane(lane, hazard) && at > hazard.from && at < hazard.to,
        );
        expect(hit, `lanes ${hazard.lanes} from ${hazard.from.toFixed(4)}s`).toBe(true);
      }
    }
  });
});

// A plan is for the lane the pack heads for. When the pack heads for another without the bot
// steering it there, such as on a Zoomies drift, the bot replans from there: with an obstacle
// ahead in the lane it planned to leave, it stays in the lane the pack drifted to, whichever way
// that is.
describe("a steering bot whose pack drifts", () => {
  const run = testState({ biscuit: 3, duchess: 3, snowball: 3 });
  const geometry = screenRoadGeometry(run);
  const road: BotRoad = { data: gameData, geometry, speed: walkScrollSpeed(gameData, run) };
  const [kind] = (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).filter((id) => {
    const { movement, shape } = gameData.minorObstacles[id];
    return movement === undefined && shape.lanes * shape.rows === 1;
  });
  if (kind === undefined) {
    throw new Error("No one-cell minor obstacle stands still");
  }
  const start = startRoad(geometry.laneCount);
  const lane = start.control.target;
  const height = itemHeight(gameData, geometry, kind);
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
