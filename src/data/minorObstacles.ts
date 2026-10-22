import type { MinorObstacle } from "./types";

// Obstacles that open no card. Shapes are lanes across by rows along the road; each zone
// weighs how often they appear there, in world.ts. Each obstacle has one look everywhere. An
// obstacle with a movement comes as a mover at the zone's mover share, and stands still
// otherwise.
export const MINOR_OBSTACLES = {
  ball: {
    movement: { kind: "dart", tilt: { max: 0, min: 0 } },
    name: "Ball",
    shape: { lanes: 1, rows: 1 },
  },
  barrier2: {
    name: "Barrier",
    shape: { lanes: 2, rows: 1 },
  },
  barrier3: {
    name: "Barrier",
    shape: { lanes: 3, rows: 1 },
  },
  bench: { name: "Bench", shape: { lanes: 2, rows: 1 } },
  bin: { name: "Bin", shape: { lanes: 1, rows: 1 } },
  bunny: {
    movement: { kind: "hop", most: 2, shy: true, times: { max: 2, min: 1 } },
    name: "Bunny",
    shape: { lanes: 1, rows: 1 },
  },
  car: {
    movement: { factor: 2.3, kind: "inLane" },
    name: "Car",
    shape: { lanes: 1, rows: 3 },
  },
  cat: {
    movement: { kind: "dart", tilt: { max: 1.6, min: 0.1 } },
    name: "Cat",
    shape: { lanes: 1, rows: 1 },
  },
  cone: { name: "Cone", shape: { lanes: 1, rows: 1 } },
  coyote: {
    movement: { kind: "approach", steps: { max: 3, min: 2 } },
    name: "Coyote",
    shape: { lanes: 1, rows: 1 },
  },
  cyclist: {
    movement: { factor: 2.0, kind: "inLane" },
    name: "Cyclist",
    shape: { lanes: 1, rows: 1 },
  },
  deliveryTruck: {
    movement: { factor: 1.6, kind: "inLane" },
    name: "Delivery truck",
    shape: { lanes: 1, rows: 3 },
  },
  ducklings: {
    movement: { kind: "hop", most: 2, shy: true, sideways: true, times: { max: 2, min: 1 } },
    name: "Ducklings",
    shape: { lanes: 1, rows: 1 },
  },
  frisbeeDog: {
    movement: { kind: "dart", tilt: { max: 1.6, min: 0.1 } },
    name: "Frisbee dog",
    shape: { lanes: 1, rows: 1 },
  },
  garbageTruck: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Garbage truck",
    shape: { lanes: 1, rows: 3 },
  },
  goose: {
    movement: { factor: 2.07, kind: "inLane" },
    name: "Goose",
    shape: { lanes: 1, rows: 1 },
  },
  hedge: { name: "Hedge", shape: { lanes: 3, rows: 1 } },
  hotDogCart: { name: "Hot dog cart", shape: { lanes: 2, rows: 1 } },
  iceCreamTruck: {
    movement: { factor: 0.7, kind: "inLane" },
    name: "Ice cream truck",
    shape: { lanes: 1, rows: 3 },
  },
  jogger: {
    movement: { factor: 1.7, kind: "inLane" },
    name: "Jogger",
    shape: { lanes: 1, rows: 1 },
  },
  kidOnBike: {
    movement: { factor: 1.35, kind: "inLane" },
    name: "Kid on a bike",
    shape: { lanes: 1, rows: 1 },
  },
  mailCarrier: {
    movement: { kind: "step", steps: { max: 3, min: 2 } },
    name: "Mail carrier",
    shape: { lanes: 1, rows: 1 },
  },
  parkedCar: { name: "Parked car", shape: { lanes: 1, rows: 3 } },
  pigeons: {
    movement: { kind: "dart", tilt: { max: -0.3, min: -0.3 } },
    name: "Pigeons",
    shape: { lanes: 1, rows: 1 },
  },
  raccoon: {
    movement: { kind: "hop", most: 2, times: { max: 2, min: 1 } },
    name: "Raccoon",
    shape: { lanes: 1, rows: 1 },
  },
  scooter: {
    movement: { factor: 2.0, kind: "inLane" },
    name: "Scooter",
    shape: { lanes: 1, rows: 1 },
  },
  seagull: {
    movement: { kind: "dart", tilt: { max: 1.6, min: 0.1 } },
    name: "Seagull",
    shape: { lanes: 1, rows: 1 },
  },
  streetcar: {
    movement: { factor: 0.7, kind: "inLane" },
    name: "Streetcar",
    shape: { lanes: 1, rows: 3 },
  },
  stroller: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Stroller",
    shape: { lanes: 1, rows: 1 },
  },
} as const satisfies Record<string, MinorObstacle>;
