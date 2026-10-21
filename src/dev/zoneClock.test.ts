import { describe, expect, it } from "vitest";

import {
  type ClockFrame,
  lagMs,
  startZoneClocks,
  tickZoneClocks,
  type ZoneClocks,
} from "./zoneClock";

const frame = (overrides: Partial<ClockFrame>): ClockFrame => ({
  frameMs: 20,
  halted: false,
  roadMs: 0,
  stoppedMs: 0,
  zoneIndex: 0,
  ...overrides,
});

const run = (frames: readonly ClockFrame[], clocks: ZoneClocks = startZoneClocks(0)) =>
  frames.reduce((sum, next) => tickZoneClocks(next, sum), clocks);

describe("tickZoneClocks", () => {
  it("adds road time, hit stop time and wall-clock time", () => {
    const clocks = run([frame({ roadMs: 20 }), frame({ stoppedMs: 20 })]);
    expect(clocks.current).toEqual({ heldMs: 20, roadMs: 20, wallMs: 40, zoneIndex: 0 });
  });

  it("counts a halted frame's wall-clock time as held", () => {
    const clocks = run([frame({ frameMs: 5000, halted: true })]);
    expect(clocks.current).toMatchObject({ heldMs: 5000, roadMs: 0, wallMs: 5000 });
  });

  it("closes the zone's clock as the last when a frame starts in the next zone", () => {
    const clocks = run([frame({ roadMs: 20 }), frame({ frameMs: 10, roadMs: 10, zoneIndex: 1 })]);
    expect(clocks.last).toEqual({ heldMs: 0, roadMs: 20, wallMs: 20, zoneIndex: 0 });
    expect(clocks.current).toEqual({ heldMs: 0, roadMs: 10, wallMs: 10, zoneIndex: 1 });
  });
});

describe("lagMs", () => {
  it("is the wall-clock time neither on the road nor held", () => {
    expect(lagMs({ heldMs: 300, roadMs: 1000, wallMs: 2000, zoneIndex: 0 })).toBe(700);
  });
});
