import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../../public/art/manifest.json";
import { encounterSpriteKey, minorObstacleSpriteKey } from "../../assets/spriteKeys";
import { gameData } from "../../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../../data/screen";
import type { EncounterId, MinorObstacleId, ZoneId } from "../../data/types";
import { laneCentreXs } from "../../layout/lanes";
import { screenLayout } from "../../layout/screenLayout";
import { randomStream } from "../../lib/random";
import {
  eachRoadsideProp,
  ROADSIDE,
  type RoadsideTable,
  START_STRIP_LENGTH,
} from "../../road/roadsideProps";
import { currentZone } from "../../rules/route";
import { STEP_SECONDS } from "../../runner/fixedStep";
import { moverPlace } from "../../runner/movers";
import { screenRoadGeometry } from "../../runner/screenGeometry";
import {
  chooseCard,
  runStreams,
  type Session,
  type SessionEvent,
  startSession,
  stepSession,
} from "../../runner/session";
import { startRoad, type WalkItem, zoneLength } from "../../runner/walk";
import { walkProjection } from "../../runner/walkGeometry";
import { newRun } from "../../state/runState";
import { defined } from "../../testing/defined";
import {
  type DistractionDeps,
  type DistractionFrame,
  distractionKeys,
  type DistractionPlace,
  distractionScroll,
  newDistractionPlace,
  placeDistraction,
  planDistractions,
  startDistractions,
  stepDistractions,
} from "./distractions";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const CENTRE_X = walkProjection(ROAD_CAMERA, LAYOUT.road).centreX;
const FIRST_LANE_X = defined(laneCentreXs(LANE_COUNT, LAYOUT.road)[0]);
const RUN = newRun(gameData, 3, { dogs: ["kilo", "biscuit"], gear: null, walker: "casey" });
const GEOMETRY = screenRoadGeometry(RUN);
const END = distractionScroll(gameData, GEOMETRY);
const COUNT = gameData.tuning.counts.distractionsPerZone;
const RIGHT = GEOMETRY.laneCount - 1;
const FIRST_ZONE = defined(gameData.world.zones[0]);
const NO_ROADSIDE: RoadsideTable = { shadowed: [], zones: {} };

// The shipped art, as the scene measures it: each sprite's tags and drawn width.
const ANCHORS = new Map(shippedManifest.sprites.map(({ anchor, key }) => [key, anchor]));
const TAGS = new Map<string, readonly string[]>();
const tagsOf = (key: string): readonly string[] => {
  if (!TAGS.has(key)) {
    const path = new URL(`../../../public/art/sprites/${key}.json`, import.meta.url);
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

describe("distractionKeys", () => {
  it.each(ZONES)("gives %s only art that is no obstacle on its road", (_, zone) => {
    const keys = distractionKeys(gameData, drawable, zone);
    const minors = Object.entries(zone.weights.minorObstacles) as [MinorObstacleId, number][];
    const encounters = Object.entries(zone.weights.obstacles) as [EncounterId, number][];
    const live = [
      ...minors.filter(([, weight]) => weight > 0).map(([id]) => minorObstacleSpriteKey(id)),
      ...encounters.filter(([, weight]) => weight > 0).map(([id]) => encounterSpriteKey(id)),
    ];
    // The ambient animals whose twin obstacle the zone weighs.
    const twins = gameData.ambient[zone.id as ZoneId]
      .filter(
        ({ twin }) =>
          twin !== undefined &&
          [...minors, ...encounters].some(([id, weight]) => id === twin && weight > 0),
      )
      .map(({ key }) => key);
    expect(keys.length).toBeGreaterThan(0);
    expect(
      keys.filter((key) => live.includes(key) || twins.includes(key) || !drawable(key)),
    ).toEqual([]);
  });

  it("leaves out an ambient squirrel where squirrels are obstacles", () => {
    const zone = defined(
      gameData.world.zones.find(
        ({ id, weights }) =>
          weights.obstacles.squirrel > 0 &&
          gameData.ambient[id as ZoneId].some(({ key }) => key === "squirrel-dash"),
      ),
    );
    expect(distractionKeys(gameData, drawable, zone)).not.toContain("squirrel-dash");
  });
});

describe("planDistractions", () => {
  it.each(ZONES)("plans %s's count, one in each stretch, gone before its end", (_, zone) => {
    const planned = planDistractions(deps(1), GEOMETRY, zone);
    expect(planned).toHaveLength(COUNT);
    const keys = distractionKeys(gameData, drawable, zone);
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
