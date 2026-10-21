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
    CAR,
    BIKE,
    { ...CAT, path: "verge", speed: 200 },
    PEDESTRIAN,
    PEDESTRIAN_AWAY,
    { ...RABBIT, perMinute: 2 },
    { ...SQUIRREL, perMinute: 3 },
  ],
  park: [
    { ...CAR, perMinute: 1 },
    { ...BIKE, perMinute: 3 },
    { ...BIRD, perMinute: 2 },
    PEDESTRIAN,
    PEDESTRIAN_AWAY,
    { ...RABBIT, perMinute: 3 },
    { ...SQUIRREL, perMinute: 3 },
  ],
  pawsPromenade: [
    { ...CAR, perMinute: 1 },
    { ...BIKE, perMinute: 3 },
    { ...BIRD, perMinute: 3 },
    { ...PEDESTRIAN, perMinute: 3 },
    { ...PEDESTRIAN_AWAY, perMinute: 3 },
    RABBIT,
  ],
  shops: [
    { ...CAR, perMinute: 5 },
    BIKE,
    { ...BIRD, perMinute: 3 },
    { ...PEDESTRIAN, perMinute: 4 },
    { ...PEDESTRIAN_AWAY, perMinute: 4 },
  ],
  snoozeCrescent: [
    { ...CAR, perMinute: 2 },
    { ...CAT, perMinute: 2 },
    { ...CAT, path: "verge", perMinute: 2, speed: 200 },
    { ...PEDESTRIAN, perMinute: 1 },
    { ...RABBIT, perMinute: 2 },
    { ...SQUIRREL, perMinute: 1 },
  ],
  street: [
    { ...CAR, perMinute: 4 },
    BIKE,
    CAT,
    PEDESTRIAN,
    PEDESTRIAN_AWAY,
    RABBIT,
    { ...SQUIRREL, perMinute: 3 },
  ],
} as const satisfies Readonly<Record<ZoneId, readonly AmbientMover[]>>;
