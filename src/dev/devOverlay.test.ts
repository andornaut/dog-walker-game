import { describe, expect, it } from "vitest";

import { cents } from "../lib/units";
import { devOverlayLines, type DevState } from "./devOverlay";
import type { RunSetup } from "./runSetup";

const setup: RunSetup = { dev: true, seed: 42, speed: 1.5, zone: 1 };
const state: DevState = { scrollSpeed: 180.4, setup, zoneDistance: 1234.9, zoneIndex: 1 };

describe("devOverlayLines", () => {
  it("shows the zone, distance and speed from the dev-state", () => {
    expect(devOverlayLines(60, undefined, setup, state)).toEqual([
      "seed 42  fps 60",
      "zone 2  1234px",
      "speed 180px/s x1.5",
    ]);
  });

  it("adds money and each dog's hearts when a run is supplied", () => {
    const run = {
      money: cents(1205),
      pack: [
        { dog: "kilo", hearts: 3, status: "walking" },
        { dog: "bo", status: "fired" },
      ],
    } as const;
    expect(devOverlayLines(60, undefined, setup, { ...state, run }).slice(3, 6)).toEqual([
      "money $12.05",
      "kilo 3hp",
      "bo fired",
    ]);
  });

  it("shows the zone's road, held, wall-clock and lag time, and the last zone's", () => {
    const time = {
      clocks: {
        current: { heldMs: 12_000, roadMs: 60_000, wallMs: 75_000, zoneIndex: 1 },
        last: { heldMs: 30_000, roadMs: 144_000, wallMs: 174_000, zoneIndex: 0 },
      },
      expectedRoadMs: 125_217,
    };
    expect(devOverlayLines(60, undefined, setup, { ...state, time }).slice(3, 8)).toEqual([
      "road 60.0s of 125.2s",
      "held 12.0s  wall 75.0s",
      "lag 3.0s",
      "zone 1 wall 174.0s",
      " road 144.0s held 30.0s",
    ]);
  });
});
