import type { DogId, GameData } from "../data/types";
import { cents } from "../rules/units";
import type { HomeProfile } from "./home";

// The profile the home screen starts from until saves land: the starter dogs, a second dog
// slot so a playtest can walk two dogs, no gear, and a few walks in the logbook so the
// panel has something to show.
export function sampleProfile(data: Pick<GameData, "dogs">): HomeProfile {
  const starters = (Object.keys(data.dogs) as DogId[]).filter(
    (dog) => data.dogs[dog].unlock === "start",
  );
  return {
    bank: cents(12_000),
    dogSlots: 2,
    logbook: {
      bestWalk: cents(9_500),
      bestWalkDogs: starters.slice(0, 2),
      bestWalkZones: 3,
      dogsWalked: 5,
      lastWalk: "+$64. Headed home from Bark Park.",
      timesFired: 0,
      walks: 3,
    },
    ownedDogs: starters,
    ownedGear: [],
  };
}
