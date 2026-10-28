import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { minorObstacleSpriteKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import type { MinorObstacleId } from "../data/types";
import { laneCentreXs } from "../layout/lanes";
import { randomStream } from "../lib/random";
import { currentZone } from "../rules/route";
import { read } from "../rules/units";
import { STEP_SECONDS } from "../runner/fixedStep";
import { DART_VERGE_LANES } from "../runner/moverPlanning";
import { moverPlace } from "../runner/movers";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseCard,
  runStreams,
  type Session,
  type SessionEvent,
  startSession,
  stepSession,
} from "../runner/session";
import { startRoad, zoneLength } from "../runner/walk";
import { walkProjection } from "../runner/walkGeometry";
import { type WalkItem } from "../runner/walkItems";
import { newRun } from "../state/runState";
import { defined } from "../testing/defined";
import {
  type Distraction,
  type DistractionDeps,
  type DistractionFrame,
  distractionKinds,
  type DistractionPlace,
  distractionScroll,
  newDistractionPlace,
  placeDistraction,
  planDistractions,
  startDistractions,
  stepDistractions,
} from "./distractions";
import {
  eachRoadsideProp,
  ROADSIDE,
  type RoadsideTable,
  START_STRIP_LENGTH,
} from "./roadsideProps";

const LAYOUT = SCREEN_LAYOUT;
const CENTRE_X = walkProjection(ROAD_CAMERA, LAYOUT.road).centreX;
const FIRST_LANE_X = defined(laneCentreXs(LANE_COUNT, LAYOUT.road)[0]);
const RUN = newRun(gameData, 3, { dogs: ["kilo", "biscuit"], gear: null, walker: "casey" });
const GEOMETRY = screenRoadGeometry(RUN);
const END = distractionScroll(gameData, GEOMETRY);
const COUNT = gameData.tuning.counts.distractionsPerZone;
const RIGHT = GEOMETRY.laneCount - 1;
const FIRST_ZONE = defined(gameData.world.zones[0]);
const NO_ROADSIDE: RoadsideTable = { shadowed: [], zones: {} };
// Every minor obstacle weighed 0.
const NO_MINORS = Object.fromEntries(
  Object.keys(gameData.minorObstacles).map((id) => [id, 0]),
) as Record<MinorObstacleId, number>;

// The shipped art, as the scene measures it: each sprite's tags and drawn width.
const ANCHORS = new Map(shippedManifest.sprites.map(({ anchor, key }) => [key, anchor]));
const TAGS = new Map<string, readonly string[]>();
const tagsOf = (key: string): readonly string[] => {
  if (!TAGS.has(key)) {
    const path = new URL(`../../public/art/sprites/${key}.json`, import.meta.url);
    try {
      const json = JSON.parse(readFileSync(path, "utf8")) as {
        meta: { frameTags: { name: string }[] };
      };
      TAGS.set(
        key,
        json.meta.frameTags.map(({ name }) => name),
      );
    } catch {
      TAGS.set(key, []);
    }
  }
  return TAGS.get(key) ?? [];
};
// Whether a sprite walks, hops or runs, as the scene's drawable reads it.
const drawable = (key: string) => tagsOf(key).some((tag) => ["hop", "run", "walk"].includes(tag));
const width = (key: string) => ANCHORS.get(key)?.opaqueWidth ?? 36;

const deps = (seed: number, roadside = ROADSIDE): DistractionDeps => ({
  data: gameData,
  drawable,
  random: randomStream(seed, "distractions"),
  stage: { centreX: CENTRE_X, firstLaneX: FIRST_LANE_X, roadside, width },
});

// A frame of the first zone at zoneDistance, with items on the road and no spawns to come.
const frame = (zoneDistance: number, items: readonly WalkItem[] = []): DistractionFrame => ({
  geometry: GEOMETRY,
  items,
  pending: [],
  previousArt: null,
  zone: FIRST_ZONE,
  zoneDistance,
  zoneIndex: 0,
});

// A roadside table whose first zone has a curb prop at every slot a cell apart on the given
// sides, across the verge spot a distraction steps to.
const propsOn = (sides: readonly ("left" | "right")[]): RoadsideTable => {
  const verge = (LAYOUT.road.width / 2) * 1.5;
  const sideOf = (name: "left" | "right") => ({ start: sides.includes(name) ? 0 : 1, stride: 0 });
  const side = { gapStart: 0, gapStride: 0, lotStart: 0, lotStride: 0, offset: 0 };
  return {
    shadowed: [],
    zones: {
      [FIRST_ZONE.art]: {
        curb: {
          groups: [[{ across: verge, dz: 0, key: "test-prop" }], []],
          sides: { left: sideOf("left"), right: sideOf("right") },
        },
        gaps: [],
        lots: [],
        shadowColour: "000000",
        sides: { left: side, right: side },
        slot: GEOMETRY.cell.length,
      },
    },
  };
};

const ZONES = gameData.world.zones.map((zone) => [zone.id, zone] as const);

describe("distractionKinds", () => {
  it.each(ZONES)("gives %s its own one-lane people and animals at their weights", (_, zone) => {
    const kinds = distractionKinds(gameData, drawable, zone);
    const weights = Object.entries(zone.weights.minorObstacles) as [MinorObstacleId, number][];
    const expected = weights
      .filter(([id, weight]) => {
        const { onFoot, shape } = gameData.minorObstacles[id];
        return weight > 0 && onFoot === true && shape.lanes === 1;
      })
      .map(([id, weight]): [string, number] => [minorObstacleSpriteKey(id), weight])
      .filter(([key]) => drawable(key));
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).toEqual(expected);
    expect(kinds.map(([key]) => key)).not.toContain(minorObstacleSpriteKey("couple"));
  });

  it("gives a zone with no hazard to wear the ambient walkers", () => {
    const kinds = distractionKinds(gameData, drawable, {
      weights: {
        ...FIRST_ZONE.weights,
        minorObstacles: { ...FIRST_ZONE.weights.minorObstacles, ...NO_MINORS },
      },
    });
    expect(kinds).toEqual([
      ["ambient-pedestrian", 1],
      ["ambient-pedestrian-back", 1],
    ]);
  });
});

// A distraction of pattern placed on the left at row 0, stepping at step.
const leftAt = (pattern: Distraction["pattern"], step: number): Distraction => ({
  key: "tourist",
  latest: 1000,
  pattern,
  placed: -1,
  row: 0,
  side: -1,
  skipped: false,
  step,
});

describe("placeDistraction", () => {
  // Where each pattern starts, in lanes out from the left edge lane's middle: a visit on the verge,
  // an edge waiter at the road's edge where a dart waits idle, a leave in the edge lane.
  it.each([
    ["edge", 0.5],
    ["leave", 0],
    ["visit", DART_VERGE_LANES + 0.5],
  ] as const)("starts a %s %s lanes out", (pattern, out) => {
    const place = newDistractionPlace();
    expect(placeDistraction(gameData, GEOMETRY, 0, leftAt(pattern, 0), place)).toBe(true);
    expect(place.lanePosition).toBeCloseTo(-out);
  });
});

// Where a distraction is drawn at SAMPLES even moments through its time on screen, each null
// once it is not drawn.
const SAMPLES = 2000;
const samplesOf = (distraction: Distraction): (DistractionPlace | null)[] =>
  Array.from({ length: SAMPLES }, (_, i) => {
    const place = newDistractionPlace();
    return placeDistraction(gameData, GEOMETRY, (END * i) / SAMPLES, distraction, place)
      ? place
      : null;
  });

describe("distraction timeline", () => {
  // At step 0 a leave stands from its start, and a visit from stepping in, for its linger share.
  it.each([
    ["leave", "distractionLeaveLingerShare"],
    ["visit", "distractionVisitLingerShare"],
  ] as const)("stands a %s still in its edge lane for multipliers.%s", (pattern, key) => {
    const standing = samplesOf(leftAt(pattern, 0)).filter(
      (place) => place !== null && !place.moving && Math.abs(place.lanePosition) < 1e-9,
    );
    expect(standing.length / SAMPLES).toBeCloseTo(read(gameData.tuning, "multipliers", key), 2);
  });

  // The visit's linger leaves it time to walk back off the road at no more than the pace it
  // stepped on at, at any step, so a tuning pass can't hurry it off.
  it.each([0, 0.5, 0.999])(
    "walks a visit at step %s off the road no faster than it stepped on, before its time is up",
    (step) => {
      const lanes = samplesOf(leftAt("visit", step)).flatMap((place) =>
        place === null ? [] : [place.lanePosition],
      );
      const moves = lanes.slice(1).map((lane, i) => lane - defined(lanes[i]));
      const fastestIn = Math.max(...moves);
      expect(fastestIn).toBeGreaterThan(0);
      expect(Math.max(...moves.map((moved) => -moved))).toBeLessThanOrEqual(fastestIn);
      // Past the road's edge, half a lane out from the edge lane's middle.
      expect(lanes.at(-1)).toBeLessThan(-0.5);
    },
  );
});

describe("planDistractions", () => {
  // Every distraction planned for the first zone over many seeds.
  const many = Array.from({ length: 200 }, (_, seed) =>
    planDistractions(deps(seed), GEOMETRY, FIRST_ZONE),
  ).flat();

  it.each(Object.entries(gameData.tuning.probability.distractionPatternOdds))(
    "draws the %s pattern at about its odds, %s",
    (pattern, odds) => {
      const share = many.filter((planned) => planned.pattern === pattern).length / many.length;
      expect(share).toBeCloseTo(odds, 1);
    },
  );

  it.each(ZONES)("plans %s's count, one in each stretch, gone before its end", (_, zone) => {
    const planned = planDistractions(deps(1), GEOMETRY, zone);
    expect(planned).toHaveLength(COUNT);
    const keys = distractionKinds(gameData, drawable, zone).map(([key]) => key);
    expect(planned.filter(({ key }) => !keys.includes(key))).toEqual([]);
    const stretch = zoneLength(gameData) / COUNT;
    planned.forEach(({ latest, row }, i) => {
      expect(row).toBeGreaterThanOrEqual(i * stretch);
      expect(latest).toBeLessThan((i + 1) * stretch);
      expect(latest + END).toBeLessThan(zoneLength(gameData));
    });
  });
});

describe("stepDistractions", () => {
  // The first distraction, settled as its row comes into view with items on the road and the
  // given roadside props.
  const firstSettled = (items: readonly WalkItem[], roadside = NO_ROADSIDE) => {
    const state = startDistractions();
    stepDistractions(deps(1, roadside), frame(0), state);
    const first = defined(state.distractions[0]);
    stepDistractions(deps(1, roadside), frame(first.row, items), state);
    return first;
  };
  const plain = firstSettled([]);

  it.each([
    ["each edge lane", null, [0, RIGHT]],
    ["the left edge lane", 1, [0]],
    ["the right edge lane", -1, [RIGHT]],
  ] as const)(
    "with a cone on its row in %s, takes side %s (null: moves up the road)",
    (_, side, lanes) => {
      // A cone whose hit box reaches the road's top with the distraction's row.
      const cones = lanes.map((lane, id): WalkItem => ({
        height: 40,
        id,
        kind: "cone",
        lane,
        laneSpan: 1,
        y: GEOMETRY.roadTop - 40,
      }));
      const first = firstSettled(cones);
      expect(first.placed).toBe(side);
      if (side === null) {
        expect(first.row).toBeGreaterThan(plain.row);
      }
    },
  );

  it.each([
    ["both verges", null, ["left", "right"]],
    ["the left verge", 1, ["left"]],
    ["the right verge", -1, ["right"]],
  ] as const)("with props along %s, takes side %s (null: skipped)", (_, side, sides) => {
    const roadside = propsOn(sides);
    const state = startDistractions();
    stepDistractions(deps(1, roadside), frame(0), state);
    const first = defined(state.distractions[0]);
    // The walk on up the stretch, until it takes a side or is skipped.
    for (let z = first.row; z <= first.latest + GEOMETRY.cell.length; z += GEOMETRY.cell.length) {
      stepDistractions(deps(1, roadside), frame(z), state);
    }
    expect(first.placed).toBe(side);
    expect(first.skipped).toBe(side === null);
  });
});

// What a walk drew of the distractions: each one drawn, with its sprite, the walk's items and its
// zone distance.
type Shown = (
  key: string,
  items: readonly WalkItem[],
  zoneDistance: number,
  place: DistractionPlace,
) => void;

// What a walk of seed's first 90 seconds drew: with stepped, the distraction movers stepped
// beside it each step as the run scene steps them, and every one drawn passed to shown. The walk
// makes no lane moves and takes each card's first enabled option, and stays in its first zone.
function walk(
  seed: number,
  stepped: boolean,
  shown: Shown = () => undefined,
): { events: SessionEvent[]; out: number; session: Session } {
  const streams = runStreams(seed);
  let session = startSession(gameData, streams, screenRoadGeometry, {
    road: startRoad(LANE_COUNT),
    run: RUN,
  });
  const distractionDeps = deps(seed);
  const state = startDistractions();
  const place = newDistractionPlace();
  const events: SessionEvent[] = [];
  let out = 0;
  for (let step = 0; step < 90 / STEP_SECONDS && session.walk.run.phase.kind !== "ended"; step++) {
    const card = session.card;
    const next =
      card === null
        ? stepSession(gameData, streams, screenRoadGeometry, STEP_SECONDS, [], session)
        : chooseCard(
            gameData,
            streams,
            screenRoadGeometry,
            card.options.find((option) => option.availability.enabled)?.index ?? "skip",
            session,
          );
    session = next.session;
    events.push(...next.events);
    if (!stepped) {
      continue;
    }
    const { road, run } = session.walk;
    const { zoneDistance, zoneIndex } = run;
    const geometry = screenRoadGeometry(run);
    stepDistractions(
      distractionDeps,
      {
        geometry,
        items: road.items,
        pending: road.pending,
        previousArt: null,
        zone: currentZone(gameData, run),
        zoneDistance,
        zoneIndex,
      },
      state,
    );
    for (const distraction of state.distractions) {
      if (placeDistraction(gameData, geometry, zoneDistance, distraction, place)) {
        out++;
        shown(distraction.key, road.items, zoneDistance, place);
      }
    }
  }
  return { events, out, session };
}

describe("distraction movers in a walk", { timeout: 60_000 }, () => {
  it.each([1, 2, 3])("leave seed %i's walk unchanged", (seed) => {
    const plain = walk(seed, false);
    const stepped = walk(seed, true);
    expect(stepped.out).toBeGreaterThan(0);
    expect(stepped.session).toEqual(plain.session);
    expect(stepped.events).toEqual(plain.events);
  });

  it.each([1, 2, 3])(
    "draw seed %i's only on an edge lane or the verge, clear of the road's items and props' footprints, until gone",
    (seed) => {
      const { cell, laneCount, roadTop } = GEOMETRY;
      const misses = { inside: 0, late: 0, onProp: 0, overItem: 0 };
      const roadside = defined(ROADSIDE.zones[currentZone(gameData, RUN).art]);
      walk(seed, true, (key, items, zoneDistance, { lanePosition, y }) => {
        misses.inside += lanePosition > 0 && lanePosition < RIGHT ? 1 : 0;
        misses.late += y - roadTop >= END ? 1 : 0;
        for (const item of items) {
          const lane =
            item.mover === undefined
              ? item.lane
              : moverPlace(laneCount, item.mover.path, item.mover.since).lanePosition;
          const across =
            lanePosition - 0.5 < lane + item.laneSpan - 0.5 && lane - 0.5 < lanePosition + 0.5;
          const along = y - cell.length < item.y + item.height && item.y < y;
          misses.overItem += across && along ? 1 : 0;
        }
        // A prop's footprint runs from half a cell nearer than its feet to a cell beyond them.
        const row = zoneDistance - (y - roadTop);
        const x = FIRST_LANE_X + lanePosition * cell.length;
        const from = Math.max(START_STRIP_LENGTH, row - cell.length);
        eachRoadsideProp(roadside, from, row + cell.length / 2, (prop, sign) => {
          const propX = CENTRE_X + sign * prop.across;
          const reach = (width(key) + width(prop.key)) / 2;
          misses.onProp += Math.abs(x - propX) < reach ? 1 : 0;
        });
      });
      expect(misses).toEqual({ inside: 0, late: 0, onProp: 0, overItem: 0 });
    },
  );
});
