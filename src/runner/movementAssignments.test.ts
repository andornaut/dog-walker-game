import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { GameData, SignatureProfile } from "../data/types";
import { assignedMovement } from "./movementAssignments";
import { movementOf } from "./walkItems";

const profile: SignatureProfile = {
  finishAheadSeconds: 1,
  kind: "rectangle",
  lanes: 1,
  legSeconds: 0.4,
  rows: 1,
  warningSeconds: 0.3,
};
const data: GameData = {
  ...gameData,
  movementAssignments: {
    gardener: {
      default: { hops: { max: 4, min: 2 }, kind: "bounce", pauseSeconds: 0.6 },
      kind: "byZone",
      zones: { cabbagetown: { kind: "profile", profile: "gardenRectangle" } },
    },
  },
  movementProfiles: { gardenRectangle: profile },
};

describe("movement assignments", () => {
  it("selects a named profile only in its assigned neighbourhood", () => {
    const selected = assignedMovement(data, "cabbagetown", "gardener");
    expect(selected?.signature).toBe(profile);
    expect(selected?.kind).toBe("bounce");
    expect(assignedMovement(data, "highPark", "gardener")).toEqual({
      hops: { max: 4, min: 2 },
      kind: "bounce",
      pauseSeconds: 0.6,
    });
  });

  it("keeps unassigned entities and nonmoving pickups unchanged", () => {
    expect(assignedMovement(data, "highPark", "taxi")).toEqual(movementOf(data, "taxi"));
    expect(
      assignedMovement({ ...data, movementAssignments: {} }, "cabbagetown", "gardener"),
    ).toEqual(movementOf(data, "gardener"));
    expect(assignedMovement(data, "highPark", "treat")).toBeNull();
  });

  it("rejects a missing profile rather than using a different movement", () => {
    expect(() =>
      assignedMovement({ ...data, movementProfiles: {} }, "cabbagetown", "gardener"),
    ).toThrow("Missing movement profile");
  });
});
