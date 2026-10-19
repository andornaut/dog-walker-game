import type { Scene } from "phaser";

import type { DogId } from "../../data/types";
import type { RunSetup } from "../../dev/runSetup";
import { loadoutFor } from "../../dev/setupRun";
import { type Random, randomStream } from "../../runner/random";
import type { Loadout } from "../../state/runState";
import { profileSave, runLoadout, walkerSpriteKey } from "../profileStore";

// The streams only the run's views draw from, each named from the setup's seed beside the
// session's own (runStreams).
export interface RunRandom {
  quips: Random;
  scenery: Random;
}

export function runRandom(seed: number): RunRandom {
  return { quips: randomStream(seed, "quips"), scenery: randomStream(seed, "scenery") };
}

// The saved pick with the setup's pack, gear and walker over it; a setup pack walks without a
// saved pick, with the saved walker.
export function pickedLoadout(
  scene: Scene,
  setup: RunSetup,
): { dogSlots: number; loadout: Loadout; walkerSprite: string } {
  const typed = setup as RunSetup<DogId, never>;
  try {
    const picked = runLoadout(scene);
    return {
      dogSlots: Math.max(picked.dogSlots, typed.pack?.length ?? 0),
      loadout: loadoutFor(picked.loadout, setup as Parameters<typeof loadoutFor>[1]),
      walkerSprite: picked.walkerSprite,
    };
  } catch (error) {
    const [first, ...rest] = typed.pack ?? [];
    if (first === undefined) {
      throw error;
    }
    const dogs = [first, ...rest.slice(0, 2)] as unknown as Loadout["dogs"];
    const fallback = { dogs, gear: null, walker: profileSave(scene).walker };
    const loadout = loadoutFor(fallback, setup as Parameters<typeof loadoutFor>[1]);
    return {
      dogSlots: dogs.length,
      loadout,
      walkerSprite: walkerSpriteKey(scene, loadout.walker),
    };
  }
}
