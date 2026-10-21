import type { GameData, Movement, World, Zone } from "../data/types";

export type HopMovement = Extract<Movement, { kind: "hop" }>;

// The world with every zone at this mover share.
export function sharedWorld(world: World, share: number): World {
  const [first, ...rest] = world.zones;
  const shared = (zone: Zone): Zone => ({ ...zone, moverShare: share });
  return { ...world, zones: [shared(first), ...rest.map(shared)] };
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
