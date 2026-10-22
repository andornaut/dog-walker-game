import type { SimConfig } from "../sim/simulate";
import type { Skill } from "../sim/skills";
import type { PackDogs } from "../state/runState";

// A bot that sees everything at once, never errs and plans over all it sees.
export const IDEAL_SKILL: Skill = {
  errorRate: 0,
  laneChangeCooldown: 0,
  lookAheadSeconds: Infinity,
  reactionSeconds: 0,
};

// A simulated run's setup for a test: a bot of skill walks pack with Casey and no gear, taking
// hearts unless an owner runs low and the middle path at each fork, unless overrides say
// otherwise.
export function simConfig(
  skill: Skill,
  pack: PackDogs,
  overrides: Partial<Omit<SimConfig, "pack" | "player">> = {},
): SimConfig {
  return {
    gear: null,
    pack,
    player: { kind: "skill", skill },
    policy: "heartsUnlessLow",
    route: "straight",
    walker: "casey",
    ...overrides,
  };
}
