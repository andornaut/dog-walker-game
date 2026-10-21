import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { randomStream } from "../lib/random";
import { startAmbient, stepAmbient } from "../road/ambient";
import { newRoadsidePlaces, placeRoadside } from "../road/roadsideProps";
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
const LAYOUT = screenLayout(SCREEN_CONFIG);
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const STAGE = { band: LAYOUT.backdrop, projection: PROJECTION };

// A scenery layer stepped beside the walk as the run scene steps it, returning how many of its
// sprites are out.
type Layer = (session: Session) => number;

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
  // The roadside props.
  roadside: () => {
    const out = newRoadsidePlaces();
    const stage = { frameWidth: () => 0, projection: PROJECTION, width: LAYOUT.roadView.width };
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
};

// A walk of STEPS steps from seed with no lane moves, each card
// taking its first enabled option, with a scenery layer stepped each step. Returns the walk's
// end, every event, and how many of the layer's sprites were out over the walk.
function walk(
  seed: number,
  layer: Layer | null,
): { events: SessionEvent[]; out: number; session: Session } {
  const streams = runStreams(seed);
  const run = newRun(gameData, 3, { dogs: ["koda", "biscuit"], gear: null, walker: "casey" });
  let session = startSession(gameData, streams, screenRoadGeometry, {
    road: startRoad(LANE_COUNT),
    run,
  });
  const events: SessionEvent[] = [];
  let out = 0;
  for (let step = 0; step < STEPS && session.walk.run.phase.kind === "walking"; step++) {
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
    out += layer?.(session) ?? 0;
  }
  return { events, out, session };
}

describe("scenery layers", () => {
  it.each(Object.keys(LAYERS).flatMap((name) => [1, 2].map((seed) => [name, seed] as const)))(
    "%s leaves a same-seed walk unchanged, seed %i",
    (name, seed) => {
      const plain = walk(seed, null);
      const layered = walk(seed, LAYERS[name]?.(seed) ?? null);
      expect(layered.out).toBeGreaterThan(0);
      expect(layered.session).toEqual(plain.session);
      expect(layered.events).toEqual(plain.events);
    },
  );
});
