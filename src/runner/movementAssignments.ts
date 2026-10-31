import type { GameData, Movement, NeighbourhoodId, SignatureProfile } from "../data/types";
import { isGearDrop, isPickup, movementOf, type WalkItemKind } from "./walkItems";

// Legacy movement retains its animation vocabulary; a named profile supplies the actual path.
export type ProfiledMovement = Movement & { readonly signature?: SignatureProfile };

export function assignedMovement(
  data: Pick<
    GameData,
    "encounters" | "minorObstacles" | "movementAssignments" | "movementProfiles"
  >,
  zone: NeighbourhoodId,
  kind: WalkItemKind,
): ProfiledMovement | null {
  const baseline = movementOf(data, kind);
  if (isPickup(kind) || isGearDrop(data, kind)) {
    return baseline;
  }
  const assignment = data.movementAssignments[kind];
  if (assignment === undefined) {
    return baseline;
  }
  const configured =
    assignment.kind === "byZone" ? (assignment.zones[zone] ?? assignment.default) : assignment;
  if (configured.kind !== "profile") {
    return configured;
  }
  const profile = data.movementProfiles[configured.profile];
  if (profile === undefined) {
    throw new Error(`Missing movement profile ${configured.profile}`);
  }
  const appearance =
    assignment.kind === "byZone" && assignment.default.kind !== "profile"
      ? assignment.default
      : baseline;
  if (appearance === null) {
    throw new Error(`Profile assignment requires a base movement for ${kind}`);
  }
  return { ...appearance, signature: profile };
}
