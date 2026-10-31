import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import {
  MOVEMENT_ASSIGNMENTS,
  MOVEMENT_PROFILE_KEYS,
  MOVEMENT_PROFILES,
} from "../data/movementProfiles";
import type { EncounterId, MinorObstacleId, NeighbourhoodId } from "../data/types";
import { PART_INSET } from "../layout/packFormation";
import { plannerStreams } from "../testing/movers";
import { GAME_ROAD, inZone, REAL, realRun } from "../testing/planner";
import { assignedMovement } from "./movementAssignments";
import { type MoverDraws, type MoverGeometry, moverPlacements } from "./moverPlanning";
import { moverTell } from "./movers";
import { moverSpec } from "./moverSpecs";
import { signaturePlace, validateSignature } from "./signaturePaths";
import { blockingLength } from "./spawning";
import { componentHitLength, itemHeight, plannedCellInset, walkScrollSpeed } from "./walk";
import { footprintOf } from "./walkItems";

const contexts = Object.entries(MOVEMENT_ASSIGNMENTS).flatMap(([kind, assignment]) => {
  if (assignment.kind !== "byZone") {
    return [];
  }
  return Object.keys(assignment.zones).flatMap((zone) =>
    Array.from({ length: gameData.world.walkLength }, (_, position) => ({
      kind: kind as EncounterId | MinorObstacleId,
      position,
      zone: zone as NeighbourhoodId,
    })),
  );
});

describe("production signature recipes", () => {
  it("defines and assigns each named profile", () => {
    expect(Object.keys(MOVEMENT_PROFILES).sort()).toEqual([...MOVEMENT_PROFILE_KEYS].sort());
    const assigned = Object.values(MOVEMENT_ASSIGNMENTS).flatMap((assignment) =>
      assignment.kind === "byZone"
        ? Object.values(assignment.zones).flatMap((movement) =>
            movement?.kind === "profile" ? [movement.profile] : [],
          )
        : assignment.kind === "profile"
          ? [assignment.profile]
          : [],
    );
    expect([...new Set(assigned)].sort()).toEqual([...MOVEMENT_PROFILE_KEYS].sort());
    for (const profile of Object.values(MOVEMENT_PROFILES)) {
      expect(() => validateSignature(profile)).not.toThrow();
    }
  });

  it.each(contexts)(
    "admits $kind in $zone at walk position $position through the full jitter/count range",
    ({ kind, position, zone }) => {
      const run = inZone(realRun(REAL), zone, position);
      const scrollSpeed = walkScrollSpeed(gameData, run);
      const cellLength = GAME_ROAD.cell.length;
      const cellInset = plannedCellInset(gameData, GAME_ROAD);
      const geometry: MoverGeometry = {
        cellLength,
        laneCount: GAME_ROAD.laneCount,
        laneInset: GAME_ROAD.cell.inset,
        packHitLength: GAME_ROAD.tallestPackBand - 2 * PART_INSET,
        packLength: GAME_ROAD.tallestPackBand,
        roadLength: GAME_ROAD.roadBottom - GAME_ROAD.roadTop,
        rowSpacing: gameData.tuning.pixels.spawnRowSpacing,
        scrollSpeed,
        sightLength: GAME_ROAD.sightLength,
        window: blockingLength({ cellInset, cellLength, packLength: GAME_ROAD.tallestPackBand }, 1),
      };
      const selected = assignedMovement(gameData, zone, kind);
      if (selected?.signature === undefined) {
        throw new Error(`Missing configured signature for ${kind} in ${zone}`);
      }
      const base = moverSpec(gameData, plannerStreams(1), footprintOf(gameData, kind), selected);
      const profile = selected.signature;
      const spec = {
        ...base,
        hitLength:
          profile.kind === "delayedTrail"
            ? componentHitLength(GAME_ROAD, profile)
            : itemHeight(gameData, GAME_ROAD, kind, true),
      };
      for (const count of [0, 1]) {
        for (const jitter of [0, 1]) {
          for (const side of [0, 1]) {
            const draws: MoverDraws = {
              count,
              delays: [jitter],
              lengths: [],
              share: 0,
              shy: 0,
              side,
              speed: 0,
              start: 0,
              tilt: 0,
              turn: 0,
              turnAt: 0,
            };
            const placements = moverPlacements(geometry, spec, draws);
            expect(
              new Set(placements.map(({ lane }) => lane)).size,
              `count ${count}, jitter ${jitter}, side ${side}`,
            ).toBe(geometry.laneCount - spec.footprint.lanes + 1);
            for (const placement of placements) {
              if (placement.path.motion !== "signature") {
                throw new Error("Expected a complete signature path");
              }
              const { path } = placement;
              const { route } = path;
              const cue = route.cues.find((cue) => cue.end === route.entryEnd);
              expect(cue?.start).toBeCloseTo(jitter * spec.variation.delaySeconds * scrollSpeed);
              expect(cue).toBeDefined();
              if (cue === undefined) {
                throw new Error("Missing initial cue");
              }
              expect(moverTell(path, (cue.start + cue.end) / 2)).not.toBeNull();
              for (const [component] of route.componentDelays.entries()) {
                expect(signaturePlace(route, route.entryEnd / 2, component)).toEqual(
                  signaturePlace(route, 0, component),
                );
                const afterClearance = signaturePlace(
                  route,
                  route.complete + profile.finishAheadSeconds * scrollSpeed,
                  component,
                );
                expect(afterClearance.y).toBeLessThanOrEqual(geometry.sightLength);
              }
            }
          }
        }
      }
    },
  );
});
