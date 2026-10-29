import { type Random, randomStream } from "@andornaut/game-kit/random";

import type { DogId } from "../../data/types";
import type { RunSetup } from "../../dev/runSetup";
import { loadoutFor } from "../../dev/setupRun";
import type { Loadout } from "../../state/runState";
import type { RunSceneData } from "../RunScene";
import type { RunStart } from "./runRecorder";

// The streams only the run's views draw from, each named from the setup's seed beside the
// session's own (runStreams).
export interface RunRandom {
  ambient: Random;
  distractions: Random;
  quips: Random;
}

export function runRandom(seed: number): RunRandom {
  return {
    ambient: randomStream(seed, "ambient"),
    distractions: randomStream(seed, "distractions"),
    quips: randomStream(seed, "quips"),
  };
}

// What a walk's starter picked: the loadout and the dog slots owned.
export interface RunPick {
  dogSlots: number;
  loadout: Loadout;
}

// The walk a pick starts: start's setup, with its pack, gear and walker over the pick and a slot
// for each dog its pack names.
export function runSceneData(start: RunStart, pick: RunPick): RunSceneData {
  const { replay, setup } = start;
  const typed = setup as RunSetup<DogId, never>;
  return {
    dogSlots: Math.max(pick.dogSlots, pick.loadout.dogs.length, typed.pack?.length ?? 0),
    loadout: loadoutFor(pick.loadout, setup as Parameters<typeof loadoutFor>[1]),
    replay,
    setup,
  };
}
