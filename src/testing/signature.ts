import type { SignatureProfile } from "../data/types";
import type { MoverPath } from "../runner/movers";
import { compileSignature } from "../runner/signaturePaths";
import { componentHitLength } from "../runner/walk";
import type { WalkItem } from "../runner/walkItems";
import { geometry } from "./walk";

export function signatureTrail(delays: readonly [number, number]) {
  const profile: Extract<SignatureProfile, { kind: "delayedTrail" }> = {
    anchor: { x: 10, y: 23 },
    bendSeconds: 0.1,
    bends: { max: 2, min: 2 },
    finishAheadSeconds: 0.1,
    followerDelays: delays,
    frame: { height: 24, width: 20 },
    kind: "delayedTrail",
    laneStep: 1,
    spriteKey: "chase-duckling",
    straightSeconds: 0.1,
    warningSeconds: 0.1,
  };
  const route = compileSignature(
    {
      cellLength: geometry.cell.length,
      laneCount: geometry.laneCount,
      scrollSpeed: 80,
      sightLength: geometry.sightLength,
    },
    profile,
    { count: 0, direction: 1 },
    { at: 0, lane: 2, span: 1, travel: 0 },
  );
  if (route === null) {
    throw new Error("Expected the complete trail to fit ahead of the pack");
  }
  const path: MoverPath = { lane: 2, motion: "signature", movement: "follow", route, warning: 8 };
  const height = componentHitLength(geometry, profile);
  const item = (feetY: number): WalkItem => ({
    height,
    id: 7,
    kind: "ducklings",
    lane: 2,
    laneSpan: 1,
    mover: { path, since: feetY - geometry.roadTop },
    y: feetY - height,
  });
  return { height, item, path };
}
