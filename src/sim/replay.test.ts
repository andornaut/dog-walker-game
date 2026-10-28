import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { LANE_COUNT } from "../data/screen";
import type { GearId } from "../data/types";
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
import { simConfig } from "../testing/sim";
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
  // spares is how many spare treats the walk stores and spends at least, which the replay matches.
  it.each<{
    gear: GearId | null;
    pack: string;
    policy: PolicyId;
    seed: number;
    skill: SkillPresetId;
    spares: number;
  }>([
    { gear: null, pack: "kilo,biscuit", policy: "mixed", seed: 1, skill: "typical", spares: 0 },
    {
      gear: null,
      pack: "buddy,archie,snowball",
      policy: "alwaysPay",
      seed: 3,
      skill: "novice",
      spares: 0,
    },
    {
      gear: "fannyPack",
      pack: "kilo,biscuit",
      policy: "mixed",
      seed: 1,
      skill: "novice",
      spares: 1,
    },
  ])("replays in the game: $skill, $pack, $gear, seed $seed", (row) => {
    const { gear, pack, policy, seed, skill, spares } = row;
    const dogs = pack.split(",") as [never];
    const result = simulateRun(
      gameData,
      seed,
      simConfig(SKILL_PRESETS[skill], dogs, { gear, policy, walker: gameData.defaultWalker }),
    );
    const log: InputLog = {
      events: result.inputs,
      setup: {
        dev: false,
        gear,
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
    const { spent, stored } = result.run.spareTreats;
    expect(Math.min(stored, spent)).toBeGreaterThanOrEqual(spares);
  });
});
