import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { EncounterId, MinorObstacleId, MovementKind, ZoneId } from "../data/types";
import { keysOf } from "../lib/records";
import type { WalkItemKind } from "../runner/walkItems";
import { defined } from "../testing/defined";
import {
  DELIVERY_GROUPS,
  type DeliveryGroup,
  sumDeliveries,
  type ZoneDelivery,
  zoneDelivery,
  type ZonePlanView,
} from "./delivery";

const [FIRST_ZONE, SECOND_ZONE] = gameData.world.zones.map(({ id }) => id as ZoneId) as [
  ZoneId,
  ZoneId,
];

// A minor obstacle that moves as movement, or stands still with null.
function minorMoving(movement: MovementKind | null): MinorObstacleId {
  const kinds = keysOf(gameData.minorObstacles);
  return defined(
    kinds.find((kind) => {
      const entry = gameData.minorObstacles[kind];
      const moves = "movement" in entry ? entry.movement.kind : null;
      return moves === movement;
    }),
  );
}

// An encounter of a kind, an obstacle by how it resolves.
function encounter(kind: "lucky" | "obstacle", resolution?: string): EncounterId {
  const ids = keysOf(gameData.encounters);
  return defined(
    ids.find((id) => {
      const entry = gameData.encounters[id];
      return (
        entry.kind === kind && (resolution === undefined || entry.resolution.kind === resolution)
      );
    }),
  );
}

const CARD = encounter("obstacle", "card");
const CONTACT = encounter("obstacle", "contact");
const DART = minorMoving("dart");
const HOPPER = minorMoving("hop");
const LUCKY = encounter("lucky");
const RIDER = minorMoving("inLane");
const STATIC = minorMoving(null);

const moving = (movement: MovementKind | undefined) =>
  movement === undefined ? {} : { mover: { movement } };
const quota = (kind: WalkItemKind, count: number, movement?: MovementKind) => ({
  count,
  kind,
  movement: movement ?? null,
});
const spawns = (kind: WalkItemKind, count: number, movement?: MovementKind) =>
  Array.from({ length: count }, () => ({ kind, ...moving(movement) }));

// A known plan: what each quota asked for, and fewer placed for some. One dart planned moving was
// placed standing, and one card obstacle planned moving stood still.
const PLAN: ZonePlanView = {
  pending: [
    ...spawns("tip", 4),
    ...spawns("treat", 2),
    ...spawns(LUCKY, 1),
    ...spawns(STATIC, 2),
    ...spawns(DART, 1),
    ...spawns(DART, 1, "dart"),
    ...spawns(RIDER, 1, "inLane"),
    ...spawns(CARD, 1),
    ...spawns(CARD, 1, "approach"),
    ...spawns(CONTACT, 1),
  ],
  planned: [
    quota("tip", 5),
    quota("treat", 2),
    quota(LUCKY, 1),
    quota(STATIC, 3),
    quota(DART, 3, "dart"),
    quota(RIDER, 1, "inLane"),
    quota(HOPPER, 1, "hop"),
    quota(CARD, 2, "approach"),
    quota(CONTACT, 1),
  ],
};

const delivery = zoneDelivery(gameData, 2, FIRST_ZONE, PLAN);

describe("zoneDelivery", () => {
  it.each<[DeliveryGroup, number, number]>([
    ["tips", 4, 5],
    ["treats", 2, 2],
    ["lucky", 1, 1],
    ["minorStatic", 3, 3],
    ["minorDart", 1, 3],
    ["minorRider", 1, 1],
    ["minorOther", 0, 1],
    ["card", 2, 2],
    ["noCard", 1, 1],
  ])("counts %s as %i placed of %i planned", (group, placed, planned) => {
    expect(delivery.groups[group]).toEqual({ placed, planned });
  });

  it("covers every group", () => {
    expect(Object.keys(delivery.groups).sort()).toEqual([...DELIVERY_GROUPS].sort());
  });

  it.each<[WalkItemKind, number, number]>([
    ["tip", 4, 5],
    [STATIC, 2, 3],
    [DART, 2, 3],
    [HOPPER, 0, 1],
    [CARD, 2, 2],
  ])("counts %s as %i placed of %i planned, moving or not", (kind, placed, planned) => {
    expect(delivery.kinds[kind]).toEqual({ placed, planned });
  });

  it("names the zone and its walk position, as one plan", () => {
    expect(delivery).toMatchObject({ plans: 1, position: 2, zone: FIRST_ZONE });
  });
});

describe("sumDeliveries", () => {
  const sums = sumDeliveries([
    zoneDelivery(gameData, 2, SECOND_ZONE, PLAN),
    delivery,
    zoneDelivery(gameData, 1, SECOND_ZONE, PLAN),
    delivery,
  ]);

  it("gives one sum per walk position and zone, by position then zone id", () => {
    expect(sums.map(({ plans, position, zone }) => [position, zone, plans])).toEqual([
      [1, SECOND_ZONE, 1],
      ...[FIRST_ZONE, SECOND_ZONE].sort().map((zone) => [2, zone, zone === FIRST_ZONE ? 2 : 1]),
    ]);
  });

  it.each<[DeliveryGroup | WalkItemKind, number, number]>([
    ["tips", 8, 10],
    ["minorDart", 2, 6],
    [DART, 4, 6],
  ])("sums %s over the plans", (key, placed, planned) => {
    const sum = defined(sums.find((entry) => entry.position === 2 && entry.zone === FIRST_ZONE));
    const counts: Partial<Record<string, ZoneDelivery["groups"][DeliveryGroup]>> = {
      ...sum.kinds,
      ...sum.groups,
    };
    expect(counts[key]).toEqual({ placed, planned });
  });

  it("leaves the deliveries it sums as they were", () => {
    expect(delivery.groups.tips).toEqual({ placed: 4, planned: 5 });
  });
});
