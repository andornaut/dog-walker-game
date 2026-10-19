import type { MinorObstacle, Skins } from "./types";

// Each size's looks by zone, shared by every obstacle of that size; a zone with none keeps
// each obstacle's base look. The construction barrier keeps its look everywhere.
const SKINS_1X1 = {} as const satisfies Skins;
const SKINS_1X3 = {} as const satisfies Skins;
const SKINS_2X1 = {} as const satisfies Skins;
const SKINS_3X1 = {} as const satisfies Skins;

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
  bench: { name: "Bench", shape: { lanes: 2, rows: 1 }, skins: SKINS_2X1 },
  bin: { name: "Bin", shape: { lanes: 1, rows: 1 }, skins: SKINS_1X1 },
  cone: { name: "Cone", shape: { lanes: 1, rows: 1 }, skins: SKINS_1X1 },
  hedge: { name: "Hedge", shape: { lanes: 3, rows: 1 }, skins: SKINS_3X1 },
  parkedCar: { name: "Parked car", shape: { lanes: 1, rows: 3 }, skins: SKINS_1X3 },
} as const satisfies Record<string, MinorObstacle>;
