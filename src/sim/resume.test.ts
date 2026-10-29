import { STEP_SECONDS } from "@andornaut/game-kit/clock/fixedStep";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import { type InputEvent, takeCardChoice, takeDueInputs } from "../dev/inputLog";
import { screenRoadGeometry } from "../runner/screenGeometry";
import {
  chooseCard,
  forkPoint,
  resumeSession,
  type RunStreams,
  runStreams,
  type Session,
  type SessionStep,
  startSession,
  stepSession,
  zoneStartPoint,
} from "../runner/session";
import { startRoad } from "../runner/walk";
import { encodeResume, launchWalk, type ResumeWalk } from "../save/resume";
import { checkpointOf } from "../save/runSlices";
import { newRun, type PackDogs, type RunState } from "../state/runState";
import { simConfig } from "../testing/sim";
import { simulateRun } from "./simulate";
import { SKILL_PRESETS } from "./skills";

const PACK: PackDogs = ["kilo", "lady"];
const CONFIG = simConfig(SKILL_PRESETS.typical, PACK, { gear: "fannyPack", policy: "mixed" });
// A walk that reaches zone 4 turns up within this many seeds.
const SEARCH_SEEDS_MOST = 40;

type Point = "fork" | "zoneStart";

// Where a walk was saved to resume, and how many of its logged inputs it had taken by then.
interface Saved {
  readonly next: number;
  readonly walk: ResumeWalk;
}

// Plays session on from the logged inputs at next, as the game's replay does, and saves where it
// would resume from at point before zone index zone, or as that zone starts.
function playOn(
  streams: RunStreams,
  inputs: readonly InputEvent[],
  start: { next: number; session: Session },
  saveAt?: { point: Point; zone: number },
): { run: RunState; saved: Saved | undefined; sessionAt: Session | undefined } {
  let { next, session } = start;
  let saved: Saved | undefined;
  let sessionAt: Session | undefined;
  const save = (point: Session) => ({
    next,
    walk: { draws: streams.draws(), seed: streams.seed, session: point },
  });
  while (session.walk.run.phase.kind !== "ended") {
    let step: SessionStep;
    if (session.card === null) {
      const due = takeDueInputs(inputs, next, session.timeMs);
      next = due.next;
      step = stepSession(gameData, streams, screenRoadGeometry, STEP_SECONDS, due.due, session);
    } else {
      const taken = takeCardChoice(inputs, next);
      if (taken.choice === undefined) {
        throw new Error(`No choice logged for ${session.card.title}`);
      }
      next = taken.next;
      step = chooseCard(gameData, streams, screenRoadGeometry, taken.choice, session);
    }
    const { run } = step.session.walk;
    for (const event of step.events) {
      if (saved !== undefined || saveAt === undefined || run.zoneIndex !== saveAt.zone) {
        continue;
      }
      if (saveAt.point === "fork" && event.kind === "zoneEnded" && run.phase.kind !== "ended") {
        saved = save(forkPoint(step.session));
      } else if (saveAt.point === "zoneStart" && event.kind === "zonePlanned") {
        saved = save(zoneStartPoint(step.session, event.unplanned));
        sessionAt = step.session;
      }
    }
    session = step.session;
  }
  return { run: session.walk.run, saved, sessionAt };
}

// The first simulated walk that reaches zone 4, so every row can save it as zone 3 starts.
let reaching: { inputs: readonly InputEvent[]; run: RunState; seed: number } | undefined;
function walkReaching(): { inputs: readonly InputEvent[]; run: RunState; seed: number } {
  for (let seed = 1; seed <= SEARCH_SEEDS_MOST && reaching === undefined; seed++) {
    const result = simulateRun(gameData, seed, CONFIG);
    if (result.run.route.length >= 4) {
      reaching = { inputs: result.inputs, run: result.run, seed };
    }
  }
  if (reaching === undefined) {
    throw new Error(`no walk reaches zone 4 on ${SEARCH_SEEDS_MOST} seeds`);
  }
  return reaching;
}

// A walk saved between zones and resumed from its checkpoint, as the next launch does, plays the
// rest of the walk as the walk itself did: the run's streams take up where they were, each zone
// is planned from the seed as before, and the road, pulls and clocks are as they were saved.
describe("a walk resumed from its checkpoint", { timeout: 60_000 }, () => {
  it.each<{ point: Point; zone: number }>([
    { point: "zoneStart", zone: 2 },
    { point: "fork", zone: 2 },
    { point: "zoneStart", zone: 3 },
  ])("plays on as the walk did, saved at the $point of zone $zone", ({ point, zone }) => {
    const zoneIndex = zone - 1;
    const found = walkReaching();
    const { inputs, seed } = found;
    const streams = runStreams(seed);
    const run = newRun(gameData, PACK.length, {
      dogs: PACK,
      gear: CONFIG.gear,
      walker: CONFIG.walker,
    });
    const session = startSession(gameData, streams, screenRoadGeometry, {
      road: startRoad(LANE_COUNT),
      run,
    });
    const played = playOn(streams, inputs, { next: 0, session }, { point, zone: zoneIndex });
    expect(played.run).toEqual(found.run);
    const { saved } = played;
    if (saved === undefined) {
      throw new Error(`the walk was not saved at the ${point} of zone ${zone}`);
    }

    const checkpoint = {
      ...checkpointOf(gameData, saved.walk.session.walk.run),
      resume: encodeResume(gameData, saved.walk) ?? "",
    };
    const launched = launchWalk(gameData, true, checkpoint);
    if (launched.kind !== "resume") {
      throw new Error(`the walk did not resume: ${JSON.stringify(launched)}`);
    }
    const { walk } = launched;
    const resumedStreams = runStreams(walk.seed, walk.draws);
    const resumed = resumeSession(gameData, resumedStreams, screenRoadGeometry, walk.session);
    if (played.sessionAt !== undefined) {
      expect(resumed.session).toEqual(played.sessionAt);
    }
    const rest = playOn(resumedStreams, inputs, { next: saved.next, session: resumed.session });
    expect(rest.run).toEqual(found.run);
  });
});
