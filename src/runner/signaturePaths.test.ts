import { describe, expect, it } from "vitest";

import type { SignatureProfile } from "../data/types";
import {
  compileSignature,
  signatureAlive,
  signatureComponentProgress,
  signatureMotionProgress,
  signaturePlace,
  signatureSweeps,
  signatureTravelSweeps,
} from "./signaturePaths";

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
    expect(path.legs.slice(1).map(({ to }) => to)).toEqual([
      { x: 2, y: 30 },
      { x: 2, y: 60 },
      { x: 1, y: 60 },
      { x: 1, y: 30 },
    ]);
    expect(signaturePlace(path, path.complete + 20)).toEqual({ x: 1, y: 50 });
    expect(path.cues).toHaveLength(4);
    expect(signaturePlace(path, Infinity)).toEqual({ x: 1, y: Infinity });
    expect(
      signatureTravelSweeps(path, 300, 330).every(({ from, to }) => from.x === 1 && to.x === 1),
    ).toBe(true);
  });

  it("turns once after a row and continues sideways without resuming road scroll", () => {
    const path = compiled({
      ...common,
      downSeconds: 0.5,
      kind: "turnExit",
      lanesPerSecond: 4,
      rows: 1,
    });
    expect(path.legs[1]?.to).toEqual({ x: 1, y: 60 });
    expect(signaturePlace(path, path.complete + 30)).toEqual({ x: 9, y: 60 });
    expect(path.tail.y).toBe(0);
    expect(signaturePlace(path, Infinity)).toEqual({ x: Infinity, y: 60 });
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
    expect(path.legs.slice(1)).toHaveLength(3);
    expect(path.cues).toEqual([
      {
        end: origin.at,
        start: origin.at - common.warningSeconds * geometry.scrollSpeed,
      },
    ]);
    for (const leg of path.legs.slice(1)) {
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
    const [out, back] = path.legs.slice(1);
    expect(out?.to.x).toBe(4);
    expect(back?.to.x).toBe(0);
    for (const leg of path.legs.slice(1)) {
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
    expect(path.legs.slice(1).map(({ from, to }) => to.x - from.x)).toEqual([1, 0, 1]);
    expect(path.cues).toHaveLength(2);
    expect(path.cues[1]?.start).toBeGreaterThanOrEqual(
      (path.legs[1]?.at ?? 0) + (path.legs[1]?.length ?? 0),
    );
  });

  it("positions three components on the same recorded path at distinct delayed phases", () => {
    const profile: SignatureProfile = {
      ...common,
      anchor: { x: 10, y: 23 },
      bendSeconds: 0.6,
      bends: { max: 3, min: 2 },
      downFactor: 1,
      followerDelays: [0.4, 0.8],
      frame: { height: 24, width: 20 },
      kind: "delayedTrail",
      laneStep: 1,
      spriteKey: "chase-duckling",
      straightSeconds: 0.4,
    };
    const path = compiled(profile);
    expect(path.componentDelays).toHaveLength(3);
    const bounds = { laneCount: 5, roadLength: 150 };
    const footprint = { height: 24, span: 1 };
    const leaderGone = path.complete + 175 - signaturePlace(path, path.complete).y;
    expect(signaturePlace(path, leaderGone).y).toBeGreaterThan(174);
    expect(signatureAlive(bounds, footprint, path, leaderGone)).toBe(true);
    expect(signatureAlive(bounds, footprint, path, leaderGone + 25)).toBe(false);
    expect(
      new Set(path.componentDelays.map((_, index) => signaturePlace(path, origin.at, index).y))
        .size,
    ).toBe(3);
    for (const time of [path.entryEnd + 24, 60, 100]) {
      for (let component = 0; component < 3; component++) {
        const delay = path.componentDelays[component] ?? 0;
        expect(signaturePlace(path, time, component)).toEqual(signaturePlace(path, time - delay));
      }
    }
    for (const time of [0, path.entryEnd / 2, path.entryEnd]) {
      expect(signatureMotionProgress(path, time)).toBe(0);
      for (let component = 0; component < 3; component++) {
        expect(signaturePlace(path, time, component)).toEqual(signaturePlace(path, 0, component));
        expect(signatureComponentProgress(path, time, component)).toBeCloseTo(
          -(path.componentDelays[component] ?? 0),
        );
      }
    }
    for (let component = 0; component < 3; component++) {
      const before = signaturePlace(path, path.entryEnd - 1e-7, component);
      const after = signaturePlace(path, path.entryEnd + 1e-7, component);
      expect(after.x).toBeCloseTo(before.x, 5);
      expect(after.y).toBeCloseTo(before.y, 5);
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

  it("uses actual configured tail speed for minimum time clearance", () => {
    const profile: SignatureProfile = {
      ...common,
      count: 2,
      downFactor: 3,
      finishAheadSeconds: 2,
      kind: "successiveMerges",
      laneStep: 1,
      mergeSeconds: 0.4,
      straightSeconds: 0.6,
    };
    expect(compileSignature({ ...geometry, sightLength: 250 }, profile, draws, origin)).toBeNull();
    const room = { ...geometry, sightLength: 400 };
    const path = compileSignature(room, profile, draws, origin);
    if (path === null) {
      throw new Error("Expected a route with enough actual time clearance");
    }
    const remainingSeconds =
      (room.sightLength - signaturePlace(path, path.complete).y) / (room.scrollSpeed * path.tail.y);
    expect(remainingSeconds).toBeGreaterThanOrEqual(profile.finishAheadSeconds);
  });

  it("holds the complete entry delay and cue without consuming travel or changing later geometry", () => {
    const profile: SignatureProfile = {
      ...common,
      kind: "rectangle",
      lanes: 1,
      legSeconds: 0.5,
      rows: 1,
    };
    const first = compiled(profile);
    const later = compileSignature(geometry, profile, draws, { ...origin, at: origin.at + 18 });
    if (later === null) {
      throw new Error("Expected a longer entry hold to retain the same geometric room");
    }
    expect(later.legs[0]).toMatchObject({
      at: 0,
      from: { x: origin.lane, y: origin.travel },
      length: later.entryEnd,
      to: { x: origin.lane, y: origin.travel },
    });
    expect(
      signatureSweeps(later, 0, later.entryEnd).every(
        ({ from, to }) => from.x === to.x && from.y === to.y,
      ),
    ).toBe(true);
    for (const progress of [0, 5, 20, 40, 80]) {
      expect(signaturePlace(later, later.entryEnd + progress)).toEqual(
        signaturePlace(first, first.entryEnd + progress),
      );
    }
  });
});
