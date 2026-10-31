import { type MoverDraws, moverPlacements, type MoverSpec } from "./moverPlanning";
import { validateSignature } from "./signaturePaths";
import { blockingLength, rowSpacing, type SpawnPlan } from "./spawning";

// The shortest screen interval among every geometrically legal signature variant. The entry
// hold is visible and only grows with its delay, so zero delay gives the minimum. Placements
// already enumerate both directions and every lane, with the complete route, followers and tail.
// Infinity means no complete variant fits the road, regardless of other spawns.
export function minimumSignatureOnScreen(plan: SpawnPlan<string>, spec: MoverSpec): number {
  if (spec.motion.kind !== "signature") {
    throw new Error("A signature capacity bound requires a signature mover");
  }
  if (!Number.isFinite(spec.variation.delaySeconds) || spec.variation.delaySeconds < 0) {
    throw new RangeError("Signature entry delay must be finite and nonnegative");
  }
  const { profile } = spec.motion;
  validateSignature(profile);
  let first = 0;
  let last = 0;
  let variants = 1;
  switch (profile.kind) {
    case "alternatingArcs":
      first = profile.arcs.min;
      last = profile.arcs.max;
      variants = last - first + 1;
      break;
    case "delayedTrail":
      first = profile.bends.min;
      last = profile.bends.max;
      variants = last - first + 1;
      break;
    case "reflectingDiagonal": {
      first = profile.reflections.min;
      variants = profile.reflections.max - first + 1;
      const across = plan.laneCount - spec.footprint.lanes;
      if (across <= 0) {
        return Infinity;
      }
      // Each full reflection advances this far down the road. Ignoring the first partial
      // crossing and using the smallest possible body only enlarges the set considered.
      const down = (across * plan.scrollSpeed * profile.downFactor) / profile.lanesPerSecond;
      const clearance =
        profile.finishAheadSeconds * plan.scrollSpeed * Math.max(1, profile.downFactor);
      const room = plan.sightLength - clearance - spec.footprint.rows * plan.cellLength;
      last = Math.min(profile.reflections.max, Math.ceil(room / down) + 1);
      break;
    }
  }
  const geometry = { ...plan, rowSpacing: rowSpacing(plan), window: blockingLength(plan, 1) };
  let minimum = Infinity;
  for (let count = first; count <= last; count++) {
    const draws: MoverDraws = {
      count: (count - first + 0.5) / variants,
      delays: [0, 0],
      lengths: [],
      share: 0,
      shy: 0,
      side: 0,
      speed: 0,
      start: 0,
      tilt: 0,
      turn: 0,
      turnAt: 0,
    };
    for (const {
      screen: [start, end],
    } of moverPlacements(geometry, spec, draws)) {
      minimum = Math.min(minimum, end - start);
    }
  }
  return minimum;
}
