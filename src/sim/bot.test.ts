import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, GameData, MinorObstacleId, Movement, ZoneId } from "../data/types";
import type { LaneDirection } from "../layout/lanes";
import { PART_INSET } from "../layout/packFormation";
import { itemAt } from "../lib/arrays";
import { seededRandom } from "../lib/random";
import { read } from "../rules/units";
import { hitDog } from "../runner/collision";
import { STEP_SECONDS } from "../runner/fixedStep";
import { type LaneMotion, stillInLane } from "../runner/laneMotion";
import {
  DART_LIFTS,
  hasLeftRoad,
  type MoverDraws,
  type MoverFootprint,
  type MoverPath,
  moverPlace,
  moverPlacements,
} from "../runner/movers";
import { moverOutcomes } from "../runner/outcomes";
import { NO_PULLS } from "../runner/pulls";
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
import { hoppingInstead, plannerStreams, sharedWorld } from "../testing/movers";
import { testState } from "../testing/runState";
import { IDEAL_SKILL, simConfig } from "../testing/sim";
import { actBot, type BotRoad, moverHazards, moverPrizes, newBot } from "./bot";
import { type BotSight, moverShows, sightPaths } from "./sight";
import { type RunResult, type SimData, simulateRun } from "./simulate";
import { type Skill, SKILL_PRESETS } from "./skills";

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

function run(
  data: SimData,
  seed: number,
  skill: Skill,
  pack: PackDogs = NO_CHASER,
  sight: BotSight = "sight",
): RunResult {
  return simulateRun(data, seed, simConfig(skill, pack, {}, sight));
}

// Obstacles, minor or not, moving or not, that the pack hit, and that reached it.
function obstacleCounts(data: SimData, results: readonly RunResult[]) {
  const counts = results.flatMap((result) =>
    [...Object.entries(result.items), ...Object.entries(result.movers)]
      .filter(([kind]) => blocksLane(data, kind as WalkItemKind))
      .map(([, count]) => count),
  );
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

  // A bot that plans over only part of the road can still box itself in. By foresight, nothing it
  // reads changes under it: by sight, a dart turning back or an uncued step can still hit it.
  it("hits nothing on a sparse road by foresight, with no reaction delay, no errors and a full look-ahead", () => {
    const sparse = withoutPulls(shortZones(gameData, 0.1));
    const sharp: Skill = {
      ...SKILL_PRESETS.typical,
      errorRate: 0,
      lookAheadSeconds: Infinity,
      reactionSeconds: 0,
    };
    const counts = obstacleCounts(sparse, [run(sparse, 5, sharp, NO_CHASER, "foresight")]);

    expect(counts.met).toBeGreaterThan(0);
    expect(counts.hit).toBe(0);
  });

  // The spawn planner keeps every obstacle avoidable from any lane the pack can be in; only a
  // dog's pull can force a hit. Read by foresight, a hopper's hop is read as any mover's path.
  it.each([
    { busy: withoutPulls(SHORT), name: "the game's movers" },
    {
      busy: withoutPulls(
        hoppingInstead(
          { ...SHORT, world: sharedWorld(SHORT.world, 1) },
          { kind: "hop", most: 2, times: { max: 2, min: 1 } },
        ),
      ),
      name: "every mover moving and every stepper and hopper hopping 1 or 2 times, up to 2 spots",
    },
  ])(
    "avoids every obstacle no pull forces, as an ideal player by foresight, with $name",
    ({ busy }) => {
      const results = [
        run(busy, 1, IDEAL_SKILL, ["duchess"], "foresight"),
        run(busy, 2, IDEAL_SKILL, NO_CHASER, "foresight"),
      ];
      const counts = obstacleCounts(busy, results);

      // The floor only checks that the runs met a real sample; it sits well under any mix's count.
      expect(counts.met).toBeGreaterThan(50);
      expect(counts.hit).toBe(0);
    },
  );

  // A replan during a lane change has up to a step less to spare than the plan before it, so a
  // plan clears a hazard's lanes a step early where it can, and a prize never draws it into a
  // path a replan finds a hit. On these counts and seed, a tip comes just before a stalker in the
  // lane next to it.
  it.each([{ first: 58, gain: 1, seed: 1 }])(
    "avoids every obstacle no pull forces, as an ideal player by foresight, at minor counts $first + $gain a zone",
    ({ first, gain, seed }) => {
      const counts = {
        ...gameData.tuning.counts,
        minorObstaclesFirstZone: first,
        minorObstaclesGainPerZone: gain,
      };
      const busy = withoutPulls(
        shortZones({ ...gameData, tuning: { ...gameData.tuning, counts } }, 0.25),
      );

      expect(
        obstacleCounts(busy, [run(busy, seed, IDEAL_SKILL, ["duchess"], "foresight")]).hit,
      ).toBe(0);
    },
  );

  // A pull never moves the pack into an obstacle too close to react to, so an ideal player is
  // never hit right after one, whatever the pack pulls toward. Steering away during a strain
  // cancels its pull, so only some strains pull. Read by foresight, no mover's surprise counts.
  it("is never hit right after a pull, as an ideal player by foresight, with pulls on", () => {
    const pulling: PackDogs = ["kilo", "biscuit", "buddy"];
    const results = [1, 2, 3].map((seed) => run(SHORT, seed, IDEAL_SKILL, pulling, "foresight"));
    const hits = results.reduce((sum, result) => sum + result.hits.afterPull, 0);
    const pulls = results.reduce((sum, result) => sum + result.pullsMoved, 0);

    expect(pulls).toBeGreaterThan(0);
    expect(hits).toBe(0);
  });
});

// For each way an obstacle moves, at both ends of every draw that varies it (its speed, the
// delays before its moves, a stalker's second-step share, a dart's tilt and where it turns back
// or stops), a dart that turns back or stops crossing once, turning and stopping, places the
// planner may put it spread across all of them, on the first zone's road and the last's, and every
// way a stalker may choose its steps:
// - it moves only while ahead of the pack's rows: no step, hop or dart starts once it has
//   reached them, a stalker never steps up the road and a hopper never hops down it;
// - the bot reads it as the walk's collision has it, for a pack standing in each lane. A lane
//   change starts on the first walk step at or after the plan has it due, so it can come up to
//   a step late; sampled a quarter step apart, wherever the mover would hit a pack standing in a
//   lane, the bot keeps the pack out of that lane from a step before to a step after; and it
//   keeps the pack out of no lane the mover never hits.
// The friendly neighbour in lane 2, stepping once as she comes down the road: the bot plans her as
// a prize in the lane she meets the pack's rows in, as soon as she reaches them.
describe("a moving prize", () => {
  const run = testState({ biscuit: 3 });
  const geometry = screenRoadGeometry(run);
  const speed = walkScrollSpeed(gameData, run);
  const road: BotRoad = { data: gameData, geometry, speed };
  const { cell, packBand, roadTop } = geometry;
  const height = itemHeight(gameData, geometry, "pettingNeighbour", true);
  it.each([
    { lane: 3, name: "a lane right", step: { lanes: 1, travel: 0 } },
    { lane: 1, name: "a lane left", step: { lanes: -1, travel: 0 } },
    { lane: 2, name: "a row down", step: { lanes: 0, travel: cell.length } },
  ])("is a prize in the lane she steps into: $name", ({ lane, step }) => {
    const path: MoverPath = {
      lane: 2,
      motion: "steps",
      movement: "step",
      steps: [{ at: 100, length: 30, ...step }],
      warning: 50,
    };
    const item: WalkItem = {
      height,
      id: 1,
      kind: "pettingNeighbour",
      lane: 2,
      laneSpan: 1,
      mover: { path, since: 0 },
      y: roadTop - height,
    };
    const [prize, ...others] = moverPrizes(road, Infinity, 1, [path], item);
    expect(others).toEqual([]);
    expect(prize?.lanes).toBe(1 << lane);
    expect(prize?.value).toBe(1);
    // Her row's bottom reaches the pack's rows once her travel down the road passes their top.
    const reaches = packBand.top - roadTop - step.travel;
    expect(Math.abs((prize?.at ?? 0) * speed - reaches)).toBeLessThanOrEqual(1);
  });
});

describe("a mover's moves and hazards", { timeout: 60_000 }, () => {
  const route = gameData.world.zones.map(({ id }) => id as ZoneId);
  const entries: { kind: WalkItemKind; movement: Movement; shape: MoverFootprint }[] = [
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
    movement === undefined ? [] : [{ kind, movement, shape }],
  );
  const movements = new Map(
    entries.map((entry) => [JSON.stringify([entry.movement, entry.shape]), entry]),
  );
  // Each end of every draw, the count's included: the fewest and the most times it moves, and a
  // hopper of a shy kind hopping shy and not.
  const LOW: MoverDraws = {
    count: 0,
    delays: [0, 0, 0, 0],
    lengths: [0, 0, 0, 0],
    share: 0,
    shy: 0,
    side: 0,
    speed: 0,
    start: 0,
    tilt: 0,
    turn: 0.999999,
    turnAt: 0,
  };
  const HIGH: MoverDraws = {
    count: 0.999999,
    delays: [0.999999, 0.999999, 0.999999, 0.999999],
    lengths: [0.999999, 0.999999, 0.999999, 0.999999],
    share: 0.999999,
    shy: 0.999999,
    side: 0.999999,
    speed: 0.999999,
    start: 0.999999,
    tilt: 0.999999,
    turn: 0.999999,
    turnAt: 0.999999,
  };
  const endName = (draws: MoverDraws) => (draws === LOW ? "draws low" : "draws high");
  type DrawWay = readonly [string, Partial<MoverDraws>];
  // A dart whose tilt is drawn from a range is checked at both ends of it, and one of a kind that
  // turns back or stops crossing once, turning at both ends of its turn and stopping at both ends
  // of its stop lanes, at either end of its other draws.
  const tiltEnds = (movement: Movement): readonly DrawWay[] =>
    movement.kind === "dart" && movement.tilt.min !== movement.tilt.max
      ? [
          [", tilt low", { tilt: 0 }],
          [", tilt high", { tilt: 0.999999 }],
        ]
      : [["", {}]];
  const turnWays = (movement: Movement): readonly DrawWay[] => {
    if (movement.kind !== "dart" || movement.turnBackShare + movement.stopShare === 0) {
      return [["", {}]];
    }
    const turning: DrawWay[] =
      movement.turnBackShare > 0
        ? [
            [", turning halfway", { turn: 0, turnAt: 0 }],
            [", turning at the far edge", { turn: 0, turnAt: 0.999999 }],
          ]
        : [];
    // The outcome draw at the turn-back share stops it, nearest its edge and farthest.
    const stopping: DrawWay[] =
      movement.stopShare > 0
        ? [
            [", stopping nearest", { turn: movement.turnBackShare, turnAt: 0 }],
            [", stopping farthest", { turn: movement.turnBackShare, turnAt: 0.999999 }],
          ]
        : [];
    return [[", crossing once", { turn: 0.999999 }], ...turning, ...stopping];
  };
  // A dart is also checked lifted all the way to the highest start that shows its cue, as the
  // planner retries one with no room as drawn.
  const liftEnds = (movement: Movement, draws: MoverDraws): readonly [string, number][] =>
    movement.kind === "dart" && draws === LOW
      ? [
          ["", 0],
          [", lifted all the way", 1],
        ]
      : [["", 0]];
  const cases = [0, gameData.world.walkLength - 1].flatMap((zoneIndex) =>
    [LOW, HIGH].flatMap((draws) =>
      [...movements.values()].flatMap((entry) =>
        tiltEnds(entry.movement).flatMap(([tiltName, tilt]) =>
          turnWays(entry.movement).flatMap(([turnName, turn]) =>
            liftEnds(entry.movement, draws).map(([liftName, lift]) => ({
              ...entry,
              draws: { ...draws, ...tilt, ...turn },
              lift,
              name: `${JSON.stringify(entry.movement)} in zone ${zoneIndex}, ${endName(draws)}${[
                tiltName,
                turnName,
                liftName,
              ].join("")}`,
              zoneIndex,
            })),
          ),
        ),
      ),
    ),
  );
  // A hopper that hops its most times has thousands of places, which repeat the same checks, so
  // a case checks at most PLACES of them, spread evenly from the first to the last.
  const PLACES = 200;
  const spread = <T>(items: readonly T[]): readonly T[] =>
    items.length <= PLACES
      ? items
      : Array.from({ length: PLACES }, (_, i) =>
          itemAt(items, Math.round((i * (items.length - 1)) / (PLACES - 1))),
        );
  // The walk a case is placed on, and the places the planner may put its mover there.
  const placedCase = (mover: Omit<(typeof cases)[number], "lift"> & { lift?: number }) => {
    const run = testState(
      { biscuit: 3, duchess: 3, snowball: 3 },
      { route, zoneIndex: mover.zoneIndex },
    );
    const geometry = screenRoadGeometry(run);
    const speed = walkScrollSpeed(gameData, run);
    const { cell, laneCount, roadBottom, roadTop, sightLength, tallestPackBand } = geometry;
    const spec = moverSpec(gameData, plannerStreams(1), mover.shape, mover.movement);
    const placements = moverPlacements(
      {
        cellLength: cell.length,
        laneCount,
        laneInset: cell.inset,
        packHitLength: tallestPackBand - 2 * PART_INSET,
        packLength: tallestPackBand,
        roadLength: roadBottom - roadTop,
        rowSpacing: read(gameData.tuning, "pixels", "spawnRowSpacing"),
        scrollSpeed: speed,
        sightLength,
        window: blockingLength(
          {
            cellInset: plannedCellInset(gameData, geometry),
            cellLength: cell.length,
            packLength: tallestPackBand,
          },
          1,
        ),
      },
      spec,
      mover.draws,
      mover.lift,
    );
    return { geometry, placements: spread(placements), run, speed };
  };
  it.each(cases)("moves ahead of the pack and is read as it hits: $name", (mover) => {
    const { geometry, placements, run, speed } = placedCase(mover);
    const road: BotRoad = { data: gameData, geometry, speed };
    const { laneCount, roadBottom, roadTop, sightLength } = geometry;
    const height = itemHeight(gameData, geometry, mover.kind, true);
    for (const { path } of placements) {
      const outcomes = moverOutcomes(path);
      for (const outcome of outcomes) {
        if (outcome.motion === "cross") {
          expect(outcome.enterTravel).toBeLessThan(sightLength);
        }
        if (outcome.motion !== "cross" && outcome.motion !== "ride") {
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
      const hazards = moverHazards(road, Infinity, outcomes, item);
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
          const box = obstacleHitBox(gameData, geometry, {
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

  // By sight, the bot reads a mover from what it shows, and that reading holds until it shows
  // something new: from each moment it does, the mover is where one of the paths read then has it,
  // whichever way a stalker or shy hopper chooses its moves.
  it.each(cases)(
    "is where its sight reading has it until it shows something new: $name",
    (mover) => {
      const { geometry, placements, speed } = placedCase(mover);
      const road: BotRoad = { data: gameData, geometry, speed };
      const { laneCount, roadBottom, roadTop } = geometry;
      const height = itemHeight(gameData, geometry, mover.kind, true);
      const same = (a: MoverPath, b: MoverPath, since: number) => {
        const [p, q] = [moverPlace(laneCount, a, since), moverPlace(laneCount, b, since)];
        return (
          p.solid === q.solid &&
          Math.abs(p.lanePosition - q.lanePosition) < 1e-6 &&
          Math.abs(p.travel - q.travel) < 1e-6
        );
      };
      for (const outcome of placements.flatMap(({ path }) => moverOutcomes(path))) {
        const item: WalkItem = {
          height,
          id: 1,
          kind: mover.kind,
          lane: 0,
          laneSpan: mover.shape.lanes,
          mover: { path: outcome, since: 0 },
          y: roadTop - height,
        };
        let shows = moverShows(outcome, 0);
        let read = sightPaths(road, 0, item);
        for (let since = 0; ; since += (speed * STEP_SECONDS) / 4) {
          const place = moverPlace(laneCount, outcome, since);
          if (hasLeftRoad(laneCount, place) || roadTop - height + place.travel >= roadBottom) {
            break;
          }
          if (moverShows(outcome, since) !== shows) {
            shows = moverShows(outcome, since);
            read = sightPaths(road, since, item);
          }
          expect(
            read.some((path) => same(path, outcome, since)),
            `showing ${shows} at ${since.toFixed(1)}`,
          ).toBe(true);
        }
      }
    },
  );

  // Every way of moving has somewhere the planner can put it.
  it("has somewhere to put every way of moving", () => {
    const placed = new Set(
      cases.flatMap((mover) =>
        placedCase(mover).placements.length > 0 ? [JSON.stringify(mover.movement)] : [],
      ),
    );
    expect([...placed].sort()).toEqual(
      [...new Set(entries.map(({ movement }) => JSON.stringify(movement)))].sort(),
    );
  });

  // At the top of its tilt range, in every zone, a dart tilted toward the pack sets off no
  // higher than shows its cue wholly on the road and no lower than leaves the pack its reaction
  // margin, at both ends of its start draw and at each lift the planner retries it at. It keeps
  // its range's top tilt unless it sets off at that highest start, where the zone's pace leaves
  // no start for a steeper one.
  it.each(
    Array.from({ length: gameData.world.walkLength }, (_, zoneIndex) => zoneIndex).flatMap(
      (zoneIndex) =>
        [...movements.values()].flatMap((entry) =>
          entry.movement.kind === "dart" && entry.movement.tilt.max > 0
            ? [LOW, HIGH].flatMap((draws) =>
                [0, ...DART_LIFTS].map((lift) => ({
                  ...entry,
                  draws: { ...draws, tilt: 0.999999 },
                  lift,
                  name: `${JSON.stringify(entry.movement)} in zone ${zoneIndex}, start ${endName(draws)}, lift ${lift}`,
                  zoneIndex,
                })),
              )
            : [],
        ),
    ),
  )("starts a dart at its top tilt within its cue and the pack's reaction: $name", (mover) => {
    const { geometry, placements, speed } = placedCase(mover);
    const { cell, sightLength } = geometry;
    const reaction = read(gameData.tuning, "seconds", "pathReactionMargin");
    expect(placements.length).toBeGreaterThan(0);
    for (const { path } of placements) {
      if (path.motion !== "cross" || mover.movement.kind !== "dart") {
        throw new Error("A dart crosses");
      }
      const cueOnRoad = 1 - (path.warning - path.idle + cell.length) / sightLength;
      const ahead = (sightLength - path.enterTravel) / sightLength;
      expect(ahead).toBeLessThanOrEqual(cueOnRoad + 1e-9);
      expect((ahead * sightLength) / (1 + path.tilt) / speed).toBeGreaterThanOrEqual(
        reaction - 1e-9,
      );
      expect(
        Math.abs(path.tilt - mover.movement.tilt.max) < 1e-3 || Math.abs(ahead - cueOnRoad) < 1e-5,
      ).toBe(true);
    }
  });

  // In every zone, a dart at either end of its speed draw crosses at its kind's speed times
  // 1 -/+ the dart speed jitter, and set off as low and steep as it may be, still leaves the pack
  // its reaction margin between its cue ending and its reaching the pack's rows.
  it.each(
    Array.from({ length: gameData.world.walkLength }, (_, zoneIndex) => zoneIndex).flatMap(
      (zoneIndex) =>
        [...movements.values()].flatMap((entry) =>
          entry.movement.kind === "dart"
            ? [
                { end: -1, speed: 0 },
                { end: 1, speed: 0.999999 },
              ].map(({ end, speed }) => ({
                ...entry,
                draws: { ...LOW, speed, tilt: 0.999999 },
                end,
                name: `${JSON.stringify(entry.movement)} in zone ${zoneIndex}, speed ${end < 0 ? "low" : "high"}`,
                zoneIndex,
              }))
            : [],
        ),
    ),
  )("keeps the reaction margin for a dart at either end of its speed: $name", (mover) => {
    const { geometry, placements, speed } = placedCase(mover);
    const reaction = read(gameData.tuning, "seconds", "pathReactionMargin");
    const factor = 1 + mover.end * read(gameData.tuning, "multipliers", "dartSpeedJitter");
    const lanesPerSecond = read(gameData.tuning, "counts", "dartLanesPerSecond");
    expect(placements.length).toBeGreaterThan(0);
    for (const { path } of placements) {
      if (path.motion !== "cross") {
        throw new Error("A dart crosses");
      }
      expect(path.lanesPerPixel * speed).toBeCloseTo(lanesPerSecond * factor, 4);
      const reaches = (geometry.sightLength - path.enterTravel) / (1 + path.tilt) / speed;
      expect(reaches).toBeGreaterThanOrEqual(reaction - 1e-9);
    }
  });

  // A rider slower than the road still comes down it, at its slowest draw, so it never comes
  // back up at a pack that has passed it.
  it("keeps every in-lane rider coming down the road", () => {
    for (const { factor } of entries.flatMap(({ kind, movement }) =>
      movement.kind === "inLane" ? [{ factor: movement.factor, kind }] : [],
    )) {
      expect(
        factor * (1 - read(gameData.tuning, "multipliers", "moverSpeedJitter")),
      ).toBeGreaterThan(0);
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
  const road: BotRoad = {
    data: gameData,
    geometry,
    speed: walkScrollSpeed(gameData, run),
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
  const height = itemHeight(gameData, geometry, kind, false);
  const ahead: WalkItem = {
    height,
    id: 1,
    kind,
    lane,
    laneSpan: 1,
    y: geometry.packBand.top - height - 2 * road.speed,
  };
  const walk: Walk = { road: { ...start, items: [ahead] }, run };

  it("replans when it drifts the way it planned to go or the other way", () => {
    for (const { same } of [
      { name: "the way it planned to go", same: true },
      { name: "the other way", same: false },
    ]) {
      const bot = newBot(seededRandom(1), "sight", IDEAL_SKILL);
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
    }
  });
});
