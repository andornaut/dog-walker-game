import { describe, expect, it } from "vitest";

import type { SignatureProfile } from "../data/types";
import { compileSignature, signaturePlace, signatureSweeps } from "./signaturePaths";

const geometry = { cellLength: 30, laneCount: 5, scrollSpeed: 30, sightLength: 600 };
const common = { finishAheadSeconds: 1, warningSeconds: 0.3 };
const origin = { at: 15, lane: 1, span: 1, travel: 30 };
const draws = { count: 0.5, direction: 1 } as const;

function compiled(profile: SignatureProfile) {
  const path = compileSignature(geometry, profile, draws, origin);
  if (path === null) {
    throw new Error("Expected a complete signature route");
  }
  return path;
}

describe("signature paths", () => {
  it("closes a one-lane by one-row rectangle before returning to road scroll", () => {
    const path = compiled({ ...common, kind: "rectangle", lanes: 1, legSeconds: 0.5, rows: 1 });
    expect(path.legs.map(({ to }) => to)).toEqual([
      { x: 2, y: 30 },
      { x: 2, y: 60 },
      { x: 1, y: 60 },
      { x: 1, y: 30 },
    ]);
    expect(signaturePlace(path, path.complete + 20)).toEqual({ x: 1, y: 50 });
    expect(path.cues).toHaveLength(4);
  });

  it("turns once after a row and continues sideways without resuming road scroll", () => {
    const path = compiled({
      ...common,
      downSeconds: 0.5,
      kind: "turnExit",
      lanesPerSecond: 4,
      rows: 1,
    });
    expect(path.legs[0]?.to).toEqual({ x: 1, y: 60 });
    expect(signaturePlace(path, path.complete + 30)).toEqual({ x: 9, y: 60 });
    expect(path.tail.y).toBe(0);
  });

  it("uses smooth alternating arcs with uninterrupted constant down-road speed", () => {
    const path = compiled({
      ...common,
      arcSeconds: 1,
      arcs: { max: 3, min: 2 },
      downFactor: 1.4,
      kind: "alternatingArcs",
      laneStep: 1,
    });
    expect(path.legs).toHaveLength(3);
    for (const leg of path.legs) {
      const quarter = signaturePlace(path, leg.at + leg.length / 4);
      expect(quarter.y).toBeCloseTo(leg.from.y + 10.5);
      expect(Math.abs(quarter.x - leg.from.x)).toBeLessThan(0.25);
      expect(signaturePlace(path, leg.at + leg.length / 2).x).toBeCloseTo(
        (leg.from.x + leg.to.x) / 2,
      );
    }
  });

  it("reflects lateral velocity at a road edge without changing down-road velocity", () => {
    const path = compiled({
      ...common,
      downFactor: 1.2,
      kind: "reflectingDiagonal",
      lanesPerSecond: 4,
      reflections: { max: 1, min: 1 },
    });
    const [out, back] = path.legs;
    expect(out?.to.x).toBe(4);
    expect(back?.to.x).toBe(0);
    for (const leg of path.legs) {
      expect((leg.to.y - leg.from.y) / leg.length).toBeCloseTo(1.2);
    }
    expect(path.tail.y).toBe(1.2);
  });

  it("makes two same-direction merges with a straight signal interval between them", () => {
    const path = compiled({
      ...common,
      count: 2,
      downFactor: 1.5,
      kind: "successiveMerges",
      laneStep: 1,
      mergeSeconds: 0.4,
      straightSeconds: 0.6,
    });
    expect(path.legs.map(({ from, to }) => to.x - from.x)).toEqual([1, 0, 1]);
    expect(path.cues).toHaveLength(2);
    expect(path.cues[1]?.start).toBeGreaterThanOrEqual(
      (path.legs[0]?.at ?? 0) + (path.legs[0]?.length ?? 0),
    );
  });

  it("positions three components on the same recorded path at distinct delayed phases", () => {
    const profile: SignatureProfile = {
      ...common,
      anchor: { x: 10, y: 23 },
      bendSeconds: 0.6,
      bends: { max: 3, min: 2 },
      followerDelays: [0.4, 0.8],
      frame: { height: 24, width: 20 },
      kind: "delayedTrail",
      laneStep: 1,
      spriteKey: "chase-duckling",
      straightSeconds: 0.4,
    };
    const path = compiled(profile);
    expect(path.componentDelays).toHaveLength(3);
    expect(
      new Set(path.componentDelays.map((_, index) => signaturePlace(path, origin.at, index).y))
        .size,
    ).toBe(3);
    for (const time of [15, 30, 60, 100]) {
      for (let component = 0; component < 3; component++) {
        const delay = path.componentDelays[component] ?? 0;
        expect(signaturePlace(path, time, component)).toEqual(signaturePlace(path, time - delay));
      }
    }
    expect(signatureSweeps(path, 0, path.complete).some(({ component }) => component === 2)).toBe(
      true,
    );
  });

  it("includes turns and delayed turns in continuous component sweep partitions", () => {
    const path = compiled({ ...common, kind: "rectangle", lanes: 1, legSeconds: 0.5, rows: 1 });
    const sweeps = signatureSweeps(path, 0, path.complete + 10);
    expect(sweeps.flatMap(({ from, to }) => [from.x, to.x])).toContain(2);
    expect(sweeps.flatMap(({ from, to }) => [from.y, to.y])).toContain(60);
    for (const sweep of sweeps) {
      const middle = signaturePlace(path, (sweep.start + sweep.end) / 2, sweep.component);
      expect(middle.x).toBeGreaterThanOrEqual(Math.min(sweep.from.x, sweep.to.x));
      expect(middle.x).toBeLessThanOrEqual(Math.max(sweep.from.x, sweep.to.x));
      expect(middle.y).toBeGreaterThanOrEqual(Math.min(sweep.from.y, sweep.to.y));
      expect(middle.y).toBeLessThanOrEqual(Math.max(sweep.from.y, sweep.to.y));
    }
  });

  it("rejects an out-of-road route or one that cannot finish safely ahead of the pack", () => {
    const profile: SignatureProfile = {
      ...common,
      count: 2,
      downFactor: 1.5,
      kind: "successiveMerges",
      laneStep: 1,
      mergeSeconds: 0.4,
      straightSeconds: 0.6,
    };
    expect(compileSignature(geometry, profile, draws, { ...origin, lane: 4 })).toBeNull();
    expect(compileSignature({ ...geometry, sightLength: 50 }, profile, draws, origin)).toBeNull();
    expect(() =>
      compileSignature(geometry, { ...profile, straightSeconds: 0 }, draws, origin),
    ).toThrow("Invalid signature");
  });
});
