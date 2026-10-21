import type { MinorObstacle } from "./types";

// Obstacles that open no card. Shapes are lanes across by rows along the road; each zone
// weighs how often they appear there, in world.ts. Each obstacle has one look everywhere. A ball, car or
// cyclist comes as a mover at the zone's mover share, like any obstacle with a movement, and
// stands still otherwise.
export const MINOR_OBSTACLES = {
  ball: { movement: { kind: "dart" }, name: "Ball", shape: { lanes: 1, rows: 1 } },
  barrier2: {
    name: "Construction barrier",
    shape: { lanes: 2, rows: 1 },
  },
  barrier3: {
    name: "Construction barrier",
    shape: { lanes: 3, rows: 1 },
  },
  bench: { name: "Bench", shape: { lanes: 2, rows: 1 } },
  bin: { name: "Bin", shape: { lanes: 1, rows: 1 } },
  cone: { name: "Cone", shape: { lanes: 1, rows: 1 } },
  cyclist: {
    movement: { factor: 1.6, kind: "inLane" },
    name: "Cyclist",
    shape: { lanes: 1, rows: 1 },
  },
  hedge: { name: "Hedge", shape: { lanes: 3, rows: 1 } },
  parkedCar: {
    movement: { factor: 1.3, kind: "inLane" },
    name: "Car",
    shape: { lanes: 1, rows: 3 },
  },
} as const satisfies Record<string, MinorObstacle>;
