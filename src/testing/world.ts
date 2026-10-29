import type {
  GameData,
  MinorObstacleId,
  ObstacleEncounterId,
  World,
  Zone,
  ZoneWeights,
} from "../data/types";
import { WORLD } from "../data/world";

// The world with each zone made over by remake, the first zone still first.
export function mapZones(remake: (zone: Zone) => Zone, world: World): World {
  const [first, ...rest] = world.zones;
  return { ...world, zones: [remake(first), ...rest.map((zone) => remake(zone))] };
}

// The data with each zone that weighs kind above 0 weighing it as much as all its other obstacles
// of kind's sort (minor or not) together, so about half of what such a zone plans of them is kind.
export function weighedUp<Data extends Pick<GameData, "world">>(
  kind: MinorObstacleId | ObstacleEncounterId,
  data: Data,
): Data {
  return {
    ...data,
    world: mapZones((zone) => {
      const sort = Object.hasOwn(zone.weights.minorObstacles, kind)
        ? "minorObstacles"
        : "obstacles";
      const weights: Readonly<Record<string, number>> = zone.weights[sort];
      const weight = weights[kind] ?? 0;
      if (weight === 0) {
        return zone;
      }
      const others = Object.values(weights).reduce((sum, each) => sum + each, 0) - weight;
      return { ...zone, weights: { ...zone.weights, [sort]: { ...weights, [kind]: others } } };
    }, data.world),
  };
}

const even = <Id extends string>(weights: Readonly<Record<Id, number>>): Record<Id, number> =>
  Object.fromEntries(Object.keys(weights).map((id) => [id, 1])) as Record<Id, number>;

function neutral(zone: Zone): Zone {
  const weights: ZoneWeights = {
    minorObstacles: even(zone.weights.minorObstacles),
    obstacles: even(zone.weights.obstacles),
  };
  return {
    ...zone,
    density: { cards: 1, luckyFinds: 1, minorObstacles: 1, tips: 1 },
    moverShare: 0,
    speed: 1,
    weights,
  };
}

// The live world with every zone's numbers pinned neutral: speed x1, even weights
// and no movers, so a rules test does not break on a zone edit. Integrity tests read the real
// world instead.
export const TEST_WORLD: World = mapZones(neutral, WORLD);
