import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_LAYOUT } from "../data/screen";
import { distanceAtY } from "../layout/projection";
import { randomStream } from "../lib/random";
import { startAmbient, stepAmbient } from "../road/ambient";
import { newRoadsidePlaces, placeRoadside, ROADSIDE } from "../road/roadsideProps";
import { type KeptScenery, struckBy, struckNow } from "../road/struckScenery";
import { currentZone, currentZoneId, zoneAt } from "../rules/route";
import { newRun } from "../state/runState";
import { STEP_SECONDS } from "./fixedStep";
import { screenRoadGeometry } from "./screenGeometry";
import {
  chooseCard,
  runStreams,
  type Session,
  type SessionEvent,
  startSession,
  stepSession,
} from "./session";
import { startRoad, zoneLength } from "./walk";
import { walkProjection } from "./walkGeometry";

const STEPS = 60 * 90;
const LAYOUT = SCREEN_LAYOUT;
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const STAGE = { band: LAYOUT.backdrop, projection: PROJECTION };

// A scenery layer stepped beside the walk as the run scene steps it, with the step's events,
// returning how many of its sprites are out.
type Layer = (session: Session, events: readonly SessionEvent[]) => number;

const LAYERS: Readonly<Record<string, (seed: number) => Layer>> = {
  // The ambient movers, from the stream the scene gives them.
  ambient: (seed) => {
    const state = startAmbient();
    const deps = { drawable: () => true, random: randomStream(seed, "ambient"), stage: STAGE };
    return (session) => {
      const zone = currentZoneId(gameData, session.walk.run);
      const frame = {
        movers: gameData.ambient[zone],
        now: session.timeMs / 1000,
        travelled: session.distanceBeforeZone + session.walk.run.zoneDistance,
        zone,
      };
      stepAmbient(deps, frame, state);
      return state.slots.filter((slot) => slot.active).length;
    };
  },
  // The roadside props, from a table that stands a tree every slot along every zone, so the
  // layer places props however sparse the shipped table is.
  roadside: () => {
    const out = newRoadsidePlaces();
    const tree = { across: 270, dz: 0, key: "roadside-tree-maple" };
    const side = { gapStart: 0, gapStride: 1, lotStart: 0, lotStride: 1 };
    const zone = {
      gaps: [[tree]],
      lots: [[tree]],
      shadowColour: "3e8948",
      sides: { left: { ...side, offset: 0 }, right: { ...side, offset: 1 } },
      slot: 140,
    };
    const table = {
      ...ROADSIDE,
      zones: Object.fromEntries(gameData.world.zones.map(({ art }) => [art, zone])),
    };
    const stage = {
      frameWidth: () => 0,
      projection: PROJECTION,
      reach: distanceAtY(PROJECTION, LAYOUT.junction.y),
      table,
      width: LAYOUT.roadView.width,
    };
    return (session) => {
      const { route, zoneIndex } = session.walk.run;
      return placeRoadside(
        stage,
        {
          current: currentZone(gameData, session.walk.run).art,
          currentStart: session.distanceBeforeZone,
          previous: zoneIndex === 0 ? null : zoneAt(gameData, route, zoneIndex - 1).art,
          previousStart: session.distanceBeforeZone - zoneLength(gameData),
          scroll: session.distanceBeforeZone + session.walk.run.zoneDistance,
        },
        out,
      );
    };
  },
  // The obstacles hits took out of play, kept as scenery until they scroll off.
  struck: () => {
    let kept: KeptScenery[] = [];
    return (session, events) => {
      const { run } = session.walk;
      const { roadBottom } = screenRoadGeometry(run);
      const struck = events.flatMap((event) =>
        event.kind === "walked" ? struckBy(event.step) : [],
      );
      kept = [...kept, ...struck].filter((item) => struckNow(roadBottom, run, item) !== null);
      return kept.length;
    };
  },
};

// A walk of STEPS steps from seed with no lane moves, each card
// taking its first enabled option, with a scenery layer stepped each step. Returns the walk's
// end, every event, and how many of the layer's sprites were out over the walk.
function walk(
  seed: number,
  layer: Layer | null,
): { events: SessionEvent[]; out: number; session: Session } {
  const streams = runStreams(seed);
  const run = newRun(gameData, 3, { dogs: ["kilo", "lady"], gear: null, walker: "casey" });
  let session = startSession(gameData, streams, screenRoadGeometry, {
    road: startRoad(LANE_COUNT),
    run,
  });
  const events: SessionEvent[] = [];
  let out = 0;
  for (let step = 0; step < STEPS && session.walk.run.phase.kind !== "ended"; step++) {
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
    out += layer?.(session, next.events) ?? 0;
  }
  return { events, out, session };
}

describe("scenery layers", { timeout: 30_000 }, () => {
  it.each(Object.keys(LAYERS).map((name) => [name, 1] as const))(
    "%s leaves a same-seed walk unchanged, seed %i",
    (name, seed) => {
      const plain = walk(seed, null);
      const layered = walk(seed, LAYERS[name]?.(seed) ?? null);
      expect(layered.out).toBeGreaterThan(0);
      expect(layered.session).toEqual(plain.session);
      expect(layered.events).toEqual(plain.events);
    },
  );

  it("never puts an obstacle a hit took out of play back on the road", () => {
    const struck = new Set<number>();
    let back = 0;
    const walked = walk(1, (session, events) => {
      for (const event of events) {
        if (event.kind === "walked") {
          struckBy(event.step).forEach(({ item }) => struck.add(item.id));
        }
      }
      back += session.walk.road.items.filter(({ id }) => struck.has(id)).length;
      return struck.size;
    });
    expect(walked.out).toBeGreaterThan(0);
    expect(back).toBe(0);
  });
});
