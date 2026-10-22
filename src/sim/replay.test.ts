import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import {
  decodeInputLog,
  encodeInputLog,
  type InputLog,
  replayInputs,
  takeCardChoice,
  takeDueInputs,
} from "../dev/inputLog";
import { runSetupLimitsFor } from "../dev/pageRunSetup";
import { loadoutFor, withSetupStart } from "../dev/setupRun";
import { STEP_SECONDS } from "../runner/fixedStep";
import { screenRoadGeometry } from "../runner/screenGeometry";
import { chooseCard, runStreams, startSession, stepSession } from "../runner/session";
import { startRoad } from "../runner/walk";
import { newRun, type RunState } from "../state/runState";
import type { PolicyId } from "./policies";
import { simulateRun } from "./simulate";
import { SKILL_PRESETS, type SkillPresetId } from "./skills";

// The run scene's replay, without the scene: the run started from the log's setup, each step's
// inputs taken as they fall due, and each card's choice taken as it opens.
function replay(log: InputLog): RunState {
  const { setup } = log;
  // As the run scene reads it, over a saved pick the setup replaces.
  const typed = setup as Parameters<typeof loadoutFor>[1];
  const loadout = loadoutFor(
    { dogs: ["duchess"], gear: null, walker: gameData.defaultWalker },
    typed,
  );
  const run = withSetupStart(gameData, setup, newRun(gameData, loadout.dogs.length, loadout));
  const streams = runStreams(setup.seed);
  const road = startRoad(LANE_COUNT, setup.speed);
  let session = startSession(gameData, streams, screenRoadGeometry, { road, run });
  const events = [...replayInputs(log)];
  let next = 0;
  while (session.walk.run.phase.kind !== "ended") {
    if (session.card === null) {
      const due = takeDueInputs(events, next, session.timeMs);
      next = due.next;
      session = stepSession(
        gameData,
        streams,
        screenRoadGeometry,
        STEP_SECONDS,
        due.due,
        session,
      ).session;
    } else {
      const taken = takeCardChoice(events, next);
      if (taken.choice === undefined) {
        throw new Error(`No choice logged for ${session.card.title}`);
      }
      next = taken.next;
      session = chooseCard(gameData, streams, screenRoadGeometry, taken.choice, session).session;
    }
  }
  return session.walk.run;
}

// A simulated run's seed and inputs, written as the game's input log and read back as the dev
// panel reads a replay, play the same run in the game's replay.
describe("a simulated run", { timeout: 60_000 }, () => {
  it.each<{ pack: string; policy: PolicyId; seed: number; skill: SkillPresetId }>([
    { pack: "koda,biscuit", policy: "mixed", seed: 1, skill: "typical" },
    { pack: "zippy,archie,snowball", policy: "alwaysPay", seed: 3, skill: "novice" },
  ])("replays in the game: $skill, $pack, seed $seed", ({ pack, policy, seed, skill }) => {
    const dogs = pack.split(",") as [never];
    const result = simulateRun(gameData, seed, {
      gear: null,
      pack: dogs,
      player: { kind: "skill", skill: SKILL_PRESETS[skill] },
      policy,
      route: "straight",
      walker: gameData.defaultWalker,
    });
    const log: InputLog = {
      events: result.inputs,
      setup: {
        dev: false,
        gear: null,
        pack: dogs,
        seed,
        speed: 1,
        walker: gameData.defaultWalker,
        zone: 1,
      },
    };
    const decoded = decodeInputLog(runSetupLimitsFor(gameData), encodeInputLog(log));
    if (!decoded.ok) {
      throw new Error(decoded.errors.join("; "));
    }

    expect(result.inputs.length).toBeGreaterThan(0);
    expect(replay(decoded.log)).toEqual(result.run);
  });
});
