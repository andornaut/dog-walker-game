import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT, ROAD_CAMERA, SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { randomStream } from "../lib/random";
import { startAmbient, stepAmbient } from "../road/ambient";
import { currentZoneId } from "../rules/route";
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
import { startRoad } from "./walk";
import { walkProjection } from "./walkGeometry";

const STEPS = 60 * 90;
const LAYOUT = screenLayout(SCREEN_CONFIG);
const STAGE = { band: LAYOUT.backdrop, projection: walkProjection(ROAD_CAMERA, LAYOUT.road) };

// A walk of STEPS steps from seed with no lane moves, each card taking its first enabled
// option; with ambient, the ambient movers step beside it each step as the run scene steps
// them, from the stream the scene gives them. Returns the walk's end and every event.
function walk(
  seed: number,
  ambient: boolean,
): { events: SessionEvent[]; out: number; session: Session } {
  const streams = runStreams(seed);
  const run = newRun(gameData, 3, { dogs: ["koda", "biscuit"], gear: null, walker: "casey" });
  let session = startSession(gameData, streams, screenRoadGeometry, {
    road: startRoad(LANE_COUNT),
    run,
  });
  const state = startAmbient();
  const deps = {
    drawable: () => true,
    random: randomStream(seed, "ambient"),
    stage: STAGE,
  };
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
    if (ambient) {
      const zone = currentZoneId(gameData, session.walk.run);
      const frame = {
        movers: gameData.ambient[zone],
        now: session.timeMs / 1000,
        travelled: session.distanceBeforeZone + session.walk.run.zoneDistance,
        zone,
      };
      stepAmbient(deps, frame, state);
      out += state.slots.filter((slot) => slot.active).length;
    }
  }
  return { events, out, session };
}

describe("ambient movers", () => {
  it.each([1, 2])("leave a same-seed walk unchanged, seed %i", (seed) => {
    const plain = walk(seed, false);
    const withAmbient = walk(seed, true);
    expect(withAmbient.out).toBeGreaterThan(0);
    expect(withAmbient.session).toEqual(plain.session);
    expect(withAmbient.events).toEqual(plain.events);
  });
});
