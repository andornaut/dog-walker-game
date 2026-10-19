import type { Scene } from "phaser";

import { gameData } from "../../data";
import type { DogId } from "../../data/types";
import { randomStream } from "../../dev/randomStreams";
import type { RunSetup } from "../../dev/runSetup";
import { loadoutFor } from "../../dev/setupRun";
import type { Random } from "../../runner/random";
import type { Loadout } from "../../state/runState";
import { runLoadout } from "../profileStore";

// The run's independent random streams, each from the setup's seed.
export interface RunRandom {
  cards: Random;
  forks: Random;
  needs: Random;
  quips: Random;
  scenery: Random;
}

export function runRandom(seed: number): RunRandom {
  return {
    cards: randomStream(seed, "cards"),
    forks: randomStream(seed, "forks"),
    needs: randomStream(seed, "needs"),
    quips: randomStream(seed, "quips"),
    scenery: randomStream(seed, "scenery"),
  };
}

// The saved pick with the setup's pack and gear over it; a setup pack walks without one.
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
    return {
      dogSlots: dogs.length,
      loadout: loadoutFor({ dogs, gear: null }, setup as Parameters<typeof loadoutFor>[1]),
      walkerSprite: gameData.walkers[gameData.defaultWalker].spriteKey,
    };
  }
}
