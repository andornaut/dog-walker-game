import type { MinorObstacle } from "./types";

// Obstacles that open no card. Shapes are lanes across by rows along the road; each zone
// weighs how often they appear there, in world.ts.
export const MINOR_OBSTACLES = {
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
  hedge: { name: "Hedge", shape: { lanes: 3, rows: 1 } },
  parkedCar: { name: "Parked car", shape: { lanes: 1, rows: 3 } },
} as const satisfies Record<string, MinorObstacle>;
