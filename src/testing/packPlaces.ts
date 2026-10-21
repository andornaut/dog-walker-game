import type { PackPlace } from "../rules/dogs";

// A dog walked alone.
export const LONE: PackPlace = { lead: true, size: 1 };

// Every place a dog can have in a pack: leading one of 1 to 3 dogs, or following in one of 2
// or 3.
export const PACK_PLACES: readonly PackPlace[] = [
  LONE,
  { lead: true, size: 2 },
  { lead: false, size: 2 },
  { lead: true, size: 3 },
  { lead: false, size: 3 },
];

// A place in words, for a test's name.
export function placeName(place: PackPlace): string {
  return `${place.lead ? "leading" : "following in"} a pack of ${place.size}`;
}
