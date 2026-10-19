import { describe, expect, it } from "vitest";

import { advanceZones, runStart, zoneFraction, zoneScrollSpeed } from "./zones";

// Base 100 px/s; zone 0 is 1000 px at 1x, zone 1 is 600 px at 1.5x, zone 2 is 400 px at 2x.
const route = {
  baseSpeed: 100,
  zones: [
    { length: 1000, speedMultiplier: 1 },
    { length: 600, speedMultiplier: 1.5 },
    { length: 400, speedMultiplier: 2 },
  ],
};

const at = (zoneIndex: number, zoneDistance: number, distance: number) => ({
  distance,
  finished: false,
  zoneDistance,
  zoneIndex,
});

describe("advanceZones", () => {
  it("travels at the base speed times the zone's multiplier", () => {
    expect(advanceZones(route, 2, runStart)).toEqual({
      completedZones: [],
      progress: at(0, 200, 200),
    });
    expect(advanceZones(route, 2, at(1, 0, 1000)).progress).toEqual(at(1, 300, 1300));
  });

  it("carries the rest of a step across a zone boundary at the next zone's speed", () => {
    // 1 s finishes zone 0's last 100 px, then 1 s at 150 px/s in zone 1.
    expect(advanceZones(route, 2, at(0, 900, 900))).toEqual({
      completedZones: [0],
      progress: at(1, 150, 1150),
    });
  });

  it("reports a zone as complete when the step ends exactly on its boundary", () => {
    expect(advanceZones(route, 1, at(0, 900, 900))).toEqual({
      completedZones: [0],
      progress: at(1, 0, 1000),
    });
  });

  it("reports every zone crossed in one step, in order", () => {
    // Zone 0 takes 10 s and zone 1 takes 4 s, leaving 1 s at 200 px/s in zone 2.
    expect(advanceZones(route, 15, runStart)).toEqual({
      completedZones: [0, 1],
      progress: at(2, 200, 1800),
    });
  });

  it("finishes the run at the end of the last zone and stops the distance there", () => {
    expect(advanceZones(route, 100, at(2, 300, 1900))).toEqual({
      completedZones: [2],
      progress: { distance: 2000, finished: true, zoneDistance: 400, zoneIndex: 2 },
    });
  });

  it("stays put once the run has finished", () => {
    const { progress } = advanceZones(route, 100, at(2, 300, 1900));
    expect(advanceZones(route, 5, progress)).toEqual({ completedZones: [], progress });
  });

  it("gives the same position however the time is split into steps", () => {
    let progress = runStart;
    const completed: number[] = [];
    for (let i = 0; i < 150; i++) {
      const step = advanceZones(route, 0.1, progress);
      completed.push(...step.completedZones);
      ({ progress } = step);
    }
    const oneStep = advanceZones(route, 15, runStart);
    expect(completed).toEqual(oneStep.completedZones);
    expect(progress.zoneIndex).toBe(oneStep.progress.zoneIndex);
    expect(progress.distance).toBeCloseTo(oneStep.progress.distance);
  });
});

describe("zoneScrollSpeed", () => {
  it("is the base speed times the current zone's multiplier", () => {
    expect(zoneScrollSpeed(route, at(1, 0, 1000))).toBe(150);
  });

  it("is zero once the run has finished", () => {
    expect(zoneScrollSpeed(route, { ...at(2, 400, 2000), finished: true })).toBe(0);
  });
});

describe("zoneFraction", () => {
  it("is how far through the current zone", () => {
    expect(zoneFraction(route, at(1, 150, 1150))).toBeCloseTo(0.25);
    expect(zoneFraction(route, { ...at(2, 400, 2000), finished: true })).toBe(1);
  });
});
