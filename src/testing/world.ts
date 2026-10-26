import type { World, Zone, ZoneWeights } from "../data/types";
import { WORLD } from "../data/world";

const even = <Id extends string>(weights: Readonly<Record<Id, number>>): Record<Id, number> =>
  Object.fromEntries(Object.keys(weights).map((id) => [id, 1])) as Record<Id, number>;

function neutral(zone: Zone): Zone {
  const weights: ZoneWeights = {
    luckyFinds: even(zone.weights.luckyFinds),
    minorObstacles: even(zone.weights.minorObstacles),
    obstacles: even(zone.weights.obstacles),
  };
  return {
    ...zone,
    density: { luckyFinds: 1, obstacles: 1, tips: 1 },
    moverShare: 0,
    speed: 1,
    weights,
  };
}

// The live world with every zone's numbers pinned neutral: speed x1, even weights
// and no movers, so a rules test does not break on a zone edit. Integrity tests read the real
// world instead.
export const TEST_WORLD: World = {
  ...WORLD,
  zones: [neutral(WORLD.zones[0]), ...WORLD.zones.slice(1).map(neutral)],
};
