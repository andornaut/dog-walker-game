import type { AmbientMover, ZoneId } from "./types";

// The ambient movers: scenery that moves across the backdrop's cross street and beside the
// road, with no effect on play. Each zone lists its kinds; perMinute sets how often each sets
// out, and the mix is drawn in proportion to it. Speeds are band pixels a second on the cross
// street and its sidewalks, road pixels a second beside the road.

const CAR = {
  gait: "steady",
  key: "ambient-car",
  path: "crossStreet",
  perMinute: 3,
  speed: 48,
  tag: "drive",
} as const satisfies AmbientMover;
const BIKE = {
  gait: "steady",
  key: "ambient-bike",
  path: "crossStreet",
  perMinute: 2,
  speed: 28,
  tag: "ride",
} as const satisfies AmbientMover;
const CAT = {
  gait: "steady",
  key: "ambient-cat",
  path: "crossWalk",
  perMinute: 1,
  speed: 80,
  tag: "run",
} as const satisfies AmbientMover;
const PEDESTRIAN = {
  gait: "steady",
  key: "ambient-pedestrian",
  path: "sidewalkToward",
  perMinute: 2,
  speed: 36,
  tag: "walk",
} as const satisfies AmbientMover;
const PEDESTRIAN_AWAY = {
  gait: "steady",
  key: "ambient-pedestrian-back",
  path: "sidewalkAway",
  perMinute: 2,
  speed: 36,
  tag: "walk",
} as const satisfies AmbientMover;
const RABBIT = {
  gait: "hop",
  key: "ambient-rabbit",
  path: "verge",
  perMinute: 1,
  speed: 110,
  tag: "hop",
} as const satisfies AmbientMover;
const BIRD = {
  gait: "fly",
  key: "ambient-bird",
  path: "verge",
  perMinute: 1,
  speed: 140,
  tag: "fly",
} as const satisfies AmbientMover;
const SQUIRREL = {
  gait: "steady",
  key: "squirrel-dash",
  path: "verge",
  perMinute: 2,
  speed: 220,
  tag: "run",
} as const satisfies AmbientMover;

export const AMBIENT = {
  homeStretch: [
    { ...CAR, perMinute: 12, speed: 24 },
    { ...BIKE, perMinute: 1 },
    { ...CAT, path: "verge", speed: 200 },
    { ...PEDESTRIAN, perMinute: 4 },
    { ...PEDESTRIAN_AWAY, perMinute: 4 },
    { ...RABBIT, perMinute: 2 },
    { ...SQUIRREL, perMinute: 3 },
    {
      gait: "steady",
      key: "ambient-plane",
      path: "sky",
      perMinute: 4,
      speed: 30,
      tag: "fly",
    },
  ],
  park: [
    { ...CAR, perMinute: 1 },
    { ...BIKE, perMinute: 4 },
    { ...BIRD, perMinute: 2 },
    { ...PEDESTRIAN, perMinute: 3 },
    { ...PEDESTRIAN_AWAY, perMinute: 3 },
    { ...RABBIT, perMinute: 3 },
    { ...SQUIRREL, perMinute: 3 },
    {
      gait: "steady",
      key: "ambient-balloon",
      path: "sky",
      perMinute: 2,
      rows: { from: 26, to: 40 },
      speed: 15,
      tag: "fly",
    },
  ],
  pawsPromenade: [
    { ...CAR, perMinute: 1 },
    { ...BIKE, perMinute: 4 },
    { ...BIRD, perMinute: 3 },
    { ...PEDESTRIAN, perMinute: 3 },
    { ...PEDESTRIAN_AWAY, perMinute: 3 },
    RABBIT,
    {
      gait: "steady",
      key: "ambient-turboprop",
      path: "sky",
      perMinute: 4,
      rows: { from: 12, to: 36 },
      speed: 30,
      tag: "fly",
    },
  ],
  shops: [
    { ...BIKE, perMinute: 5 },
    { ...BIRD, perMinute: 3 },
    { ...PEDESTRIAN, perMinute: 5 },
    { ...PEDESTRIAN_AWAY, perMinute: 5 },
    {
      gait: "steady",
      key: "ambient-pigeons",
      path: "sky",
      perMinute: 4,
      rows: { from: 16, to: 40 },
      speed: 60,
      tag: "fly",
    },
    {
      gait: "steady",
      key: "ambient-helicopter",
      path: "sky",
      perMinute: 2,
      rows: { from: 12, to: 38 },
      speed: 36,
      tag: "fly",
    },
  ],
  snoozeCrescent: [
    { ...CAR, perMinute: 2 },
    { ...BIKE, perMinute: 1 },
    { ...CAT, perMinute: 2 },
    { ...CAT, path: "verge", perMinute: 2, speed: 200 },
    { ...PEDESTRIAN, perMinute: 2 },
    { ...PEDESTRIAN_AWAY, perMinute: 1 },
    { ...RABBIT, perMinute: 2 },
    { ...SQUIRREL, perMinute: 1 },
    {
      gait: "steady",
      key: "ambient-geese",
      path: "sky",
      perMinute: 3,
      rows: { from: 18, to: 44 },
      speed: 40,
      tag: "fly",
    },
  ],
  street: [
    { ...BIKE, perMinute: 2 },
    CAT,
    { ...PEDESTRIAN, perMinute: 5 },
    { ...PEDESTRIAN_AWAY, perMinute: 5 },
    RABBIT,
    { ...SQUIRREL, perMinute: 3 },
  ],
} as const satisfies Readonly<Record<ZoneId, readonly AmbientMover[]>>;
