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
const FINISHED = { distance: 2000, finished: true, zoneDistance: 400, zoneIndex: 2 };

describe("advanceZones", () => {
  it.each([
    {
      completedZones: [],
      from: runStart,
      name: "travels at the base speed in the first zone",
      progress: at(0, 200, 200),
      seconds: 2,
    },
    {
      completedZones: [],
      from: at(1, 0, 1000),
      name: "travels at the base speed times the zone's multiplier",
      progress: at(1, 300, 1300),
      seconds: 2,
    },
    {
      // 1 s finishes zone 0's last 100 px, then 1 s at 150 px/s in zone 1.
      completedZones: [0],
      from: at(0, 900, 900),
      name: "carries the rest of a step across a zone boundary at the next zone's speed",
      progress: at(1, 150, 1150),
      seconds: 2,
    },
    {
      completedZones: [0],
      from: at(0, 900, 900),
      name: "reports a zone as complete when the step ends exactly on its boundary",
      progress: at(1, 0, 1000),
      seconds: 1,
    },
    {
      // Zone 0 takes 10 s and zone 1 takes 4 s, leaving 1 s at 200 px/s in zone 2.
      completedZones: [0, 1],
      from: runStart,
      name: "reports every zone crossed in one step, in order",
      progress: at(2, 200, 1800),
      seconds: 15,
    },
    {
      completedZones: [2],
      from: at(2, 300, 1900),
      name: "finishes the run at the end of the last zone and stops the distance there",
      progress: FINISHED,
      seconds: 100,
    },
    {
      completedZones: [],
      from: FINISHED,
      name: "stays put once the run has finished",
      progress: FINISHED,
      seconds: 5,
    },
  ])("$name", ({ completedZones, from, progress, seconds }) => {
    expect(advanceZones(route, seconds, from)).toEqual({ completedZones, progress });
  });
});

describe("zoneScrollSpeed and zoneFraction", () => {
  it("are the current zone's speed and how far through it", () => {
    expect(zoneScrollSpeed(route, at(1, 0, 1000))).toBe(150);
    expect(zoneFraction(route, at(1, 150, 1150))).toBeCloseTo(0.25);
  });

  it("are zero speed and the whole zone once the run has finished", () => {
    expect(zoneScrollSpeed(route, FINISHED)).toBe(0);
    expect(zoneFraction(route, FINISHED)).toBe(1);
  });
});
