import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { GameData } from "../data/types";
import { WORLD } from "../data/world";
import { assignedMovement } from "../runner/movementAssignments";
import { type HopMovement, hoppingInstead } from "./movers";

const hop: HopMovement = { kind: "hop", most: 2, times: { max: 2, min: 1 } };

describe("hoppingInstead", () => {
  it("transforms direct and contextual legacy leaves without changing profile assignments", () => {
    const source: GameData = {
      ...gameData,
      movementAssignments: {
        ducklings: { kind: "profile", profile: "ducklingTrail" },
        gardener: {
          default: { kind: "step", steps: { max: 2, min: 1 } },
          kind: "byZone",
          zones: {
            cabbagetown: { kind: "profile", profile: "gardenRectangle" },
            highPark: { kind: "hop", most: 1, times: { max: 1, min: 1 } },
          },
        },
        grannyCartShopper: { kind: "step", steps: { max: 2, min: 1 } },
        taxi: { factor: 1.2, kind: "inLane" },
      },
    };
    const tuned = hoppingInstead(source, hop);
    expect(assignedMovement(tuned, "highPark", "gardener")).toBe(hop);
    expect(assignedMovement(tuned, "yongeStreet", "gardener")).toBe(hop);
    expect(assignedMovement(tuned, "kensingtonMarket", "grannyCartShopper")).toBe(hop);
    expect(tuned.movementAssignments.ducklings).toBe(source.movementAssignments.ducklings);
    expect(tuned.movementAssignments.taxi).toBe(source.movementAssignments.taxi);
    const signature = assignedMovement(tuned, "cabbagetown", "gardener");
    expect(signature?.kind).toBe("hop");
    expect(signature?.signature).toBe(source.movementProfiles.gardenRectangle);
    expect(source.movementAssignments.gardener).toMatchObject({
      default: { kind: "step" },
      zones: { highPark: { kind: "hop", most: 1 } },
    });
  });

  it("covers every production step or hop in baseline and explicit defaults", () => {
    const tuned = hoppingInstead(gameData, hop);
    for (const zone of WORLD.zones) {
      for (const kind of Object.keys(
        gameData.minorObstacles,
      ) as (keyof GameData["minorObstacles"])[]) {
        const original = assignedMovement(gameData, zone.id, kind);
        const changed = assignedMovement(tuned, zone.id, kind);
        if (original?.kind === "step" || original?.kind === "hop") {
          expect(changed).toMatchObject(hop);
          expect(changed?.signature).toBe(original.signature);
        } else {
          expect(changed).toEqual(original);
        }
      }
    }
  });
});
