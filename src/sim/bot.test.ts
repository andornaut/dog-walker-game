import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { GameData, MinorObstacleId } from "../data/types";
import { read } from "../rules/units";
import { hitDog, itemBox } from "../runner/collision";
import { STEP_SECONDS } from "../runner/fixedStep";
import { stillInLane } from "../runner/laneMotion";
import { hasLeftRoad, moverPlace, moverPlacements } from "../runner/movers";
import { seededRandom } from "../runner/random";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { blockingLength } from "../runner/spawning";
import {
  blocksLane,
  itemHeight,
  moverSpec,
  packBoxes,
  type WalkItem,
  type WalkItemKind,
  walkScrollSpeed,
} from "../runner/walk";
import type { PackDogs } from "../state/runState";
import { hoppingInstead, sharedWorld } from "../testing/movers";
import { testState } from "../testing/runState";
import { type BotRoad, moverHazards } from "./bot";
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

// A lane change starts on the first walk step at or after the plan has it due, so it can come up
// to a step late. Every hop a hopper can make, from every lane it can start in, sampled a quarter
// step apart since the walk's steps can fall anywhere along its path: wherever the hopper would
// hit a pack standing in a lane, the bot keeps the pack out of that lane from a step before to a
// step after.
describe("a hopper's hazards", () => {
  const run = testState({ biscuit: 3, duchess: 3, snowball: 3 });
  const geometry = screenRoadGeometry(run);
  const speed = walkScrollSpeed(gameData, run);
  const road: BotRoad = { data: gameData, geometry, speed };
  const { cell, laneCount, roadBottom, roadTop, tallestPackBand } = geometry;
  // A one-cell minor obstacle that hops, hopping up to 2 spots.
  const [kind] = (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).filter((id) => {
    const { movement, shape } = gameData.minorObstacles[id];
    return movement?.kind === "hop" && shape.lanes * shape.rows === 1;
  });
  if (kind === undefined) {
    throw new Error("No one-cell minor obstacle hops");
  }
  const height = itemHeight(gameData, geometry, kind);
  const footprint = gameData.minorObstacles[kind].shape;
  const spec = moverSpec(gameData, seededRandom(1), footprint, { kind: "hop", most: 2 });
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
  const hops = placements.map(({ lane, path }) => {
    const [step] = path.motion === "steps" ? path.steps : [];
    return { name: `${step?.lanes} lanes and ${step?.travel} pixels from lane ${lane}`, path };
  });

  it.each(hops)("covers every hit a step either side, hopping $name", ({ path }) => {
    const item: WalkItem = {
      height,
      id: 1,
      kind,
      lane: 0,
      laneSpan: footprint.lanes,
      mover: { path, since: 0 },
      y: roadTop - height,
    };
    const hazards = moverHazards(road, Infinity, item);
    let hits = 0;
    for (let at = 0; ; at += STEP_SECONDS / 4) {
      const place = moverPlace(laneCount, path, at * speed);
      const y = roadTop - height + place.travel;
      if (hasLeftRoad(laneCount, place) || y >= roadBottom) {
        break;
      }
      const box = itemBox(cell, { height, lane: place.lanePosition, laneSpan: footprint.lanes, y });
      for (let lane = 0; lane < laneCount; lane++) {
        if (!place.solid || hitDog(packBoxes(geometry, stillInLane(lane), run), box) === null) {
          continue;
        }
        hits += 1;
        const covered = hazards.some(
          (hazard) =>
            (hazard.lanes & (1 << lane)) !== 0 &&
            hazard.from <= at - STEP_SECONDS + 1e-9 &&
            hazard.to >= at + STEP_SECONDS - 1e-9,
        );
        expect(covered, `lane ${lane} at ${at.toFixed(4)}s`).toBe(true);
      }
    }
    expect(hits).toBeGreaterThan(0);
  });
});
