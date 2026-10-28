import type { GameData, Movement, World } from "../data/types";
import { randomStream, seededRandom } from "../lib/random";
import type { PlannerStreams } from "../runner/movers";
import { mapZones } from "./world";

export type HopMovement = Extract<Movement, { kind: "hop" }>;

// The planner's streams for a seed: spawns as one stream seeded with it, movers named from it.
export function plannerStreams(seed: number): PlannerStreams {
  return { movers: randomStream(seed, "movers"), spawns: seededRandom(seed) };
}

// The world with every zone at this mover share.
export function sharedWorld(world: World, share: number): World {
  return mapZones((zone) => ({ ...zone, moverShare: share }), world);
}

// The obstacles, minor or not, with every stepping or hopping mover hopping as hop does.
export function hoppingInstead<Data extends Pick<GameData, "encounters" | "minorObstacles">>(
  data: Data,
  hop: HopMovement,
): Data {
  const hopped = (entries: object) =>
    Object.fromEntries(
      Object.entries(entries).map(([id, entry]: [string, { movement?: Movement }]) => [
        id,
        entry.movement?.kind === "step" || entry.movement?.kind === "hop"
          ? { ...entry, movement: hop }
          : entry,
      ]),
    );
  return {
    ...data,
    encounters: hopped(data.encounters) as Data["encounters"],
    minorObstacles: hopped(data.minorObstacles) as Data["minorObstacles"],
  };
}
