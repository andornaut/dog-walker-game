import type { MinorObstacle } from "./types";

// Obstacles that open no card. Shapes are lanes across by rows along the road; each zone
// weighs how often they appear there, in world.ts. Each obstacle has one look everywhere. An
// obstacle with a movement comes as a mover at the zone's mover share, and stands still
// otherwise.
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
  bunny: { movement: { kind: "hop", most: 2 }, name: "Bunny", shape: { lanes: 1, rows: 1 } },
  car: {
    movement: { factor: 1.3, kind: "inLane" },
    name: "Car",
    shape: { lanes: 1, rows: 3 },
  },
  cat: { movement: { kind: "dart" }, name: "Cat", shape: { lanes: 1, rows: 1 } },
  cone: { name: "Cone", shape: { lanes: 1, rows: 1 } },
  cyclist: {
    movement: { factor: 1.6, kind: "inLane" },
    name: "Cyclist",
    shape: { lanes: 1, rows: 1 },
  },
  deliveryTruck: {
    movement: { factor: 1.15, kind: "inLane" },
    name: "Delivery truck",
    shape: { lanes: 1, rows: 3 },
  },
  ducklings: {
    movement: { kind: "hop", most: 2, sideways: true },
    name: "Ducklings",
    shape: { lanes: 1, rows: 1 },
  },
  frisbeeDog: {
    movement: { kind: "dart", tilt: 0.3 },
    name: "Frisbee dog",
    shape: { lanes: 1, rows: 1 },
  },
  garbageTruck: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Garbage truck",
    shape: { lanes: 1, rows: 3 },
  },
  goose: {
    movement: { factor: 1.8, kind: "inLane" },
    name: "Goose",
    shape: { lanes: 1, rows: 1 },
  },
  hedge: { name: "Hedge", shape: { lanes: 3, rows: 1 } },
  iceCreamTruck: {
    movement: { factor: 0.7, kind: "inLane" },
    name: "Ice cream truck",
    shape: { lanes: 1, rows: 3 },
  },
  jogger: {
    movement: { factor: 1.3, kind: "inLane" },
    name: "Jogger",
    shape: { lanes: 1, rows: 1 },
  },
  kidOnBike: {
    movement: { factor: 1.25, kind: "inLane" },
    name: "Kid on a bike",
    shape: { lanes: 1, rows: 1 },
  },
  mailCarrier: {
    movement: { kind: "step", steps: 1 },
    name: "Mail carrier",
    shape: { lanes: 1, rows: 1 },
  },
  parkedCar: {
    movement: { kind: "hop", most: 1, sideways: true },
    name: "Parked car",
    shape: { lanes: 1, rows: 3 },
  },
  pigeons: {
    movement: { kind: "dart", tilt: -0.3 },
    name: "Pigeons",
    shape: { lanes: 1, rows: 1 },
  },
  raccoon: { movement: { kind: "hop", most: 1 }, name: "Raccoon", shape: { lanes: 1, rows: 1 } },
  scooter: {
    movement: { factor: 1.5, kind: "inLane" },
    name: "Scooter",
    shape: { lanes: 1, rows: 1 },
  },
  seagull: {
    movement: { kind: "dart", tilt: 0.3 },
    name: "Seagull",
    shape: { lanes: 1, rows: 1 },
  },
  stroller: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Stroller",
    shape: { lanes: 1, rows: 1 },
  },
} as const satisfies Record<string, MinorObstacle>;
