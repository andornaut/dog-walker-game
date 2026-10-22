import type { GameData, MovementKind, ZoneId } from "../data/types";
import { itemCategory, opensACard, type WalkItemKind } from "../runner/walk";

// What a zone's plan asked for against what it placed on the road. The tuning counts are aims:
// the planner skips a spawn it has no room for, so placed can fall short of planned.

// What the counts read of a zone's plan, the road as planZone leaves it: each quota's kind,
// count and movement, null standing still, and each placed spawn's kind and movement, with no
// mover standing still.
export interface ZonePlanView {
  readonly pending: readonly {
    readonly kind: WalkItemKind;
    readonly mover?: { readonly movement: MovementKind };
  }[];
  readonly planned: readonly {
    readonly count: number;
    readonly kind: WalkItemKind;
    readonly movement: MovementKind | null;
  }[];
}

// Minor obstacles are split by how they move: standing still, darting across, riding in a lane,
// or anything else (hopping or stalking). Obstacles that are encounters split into those that
// open a card and those that do not (contact and pull obstacles).
export const DELIVERY_GROUPS = [
  "tips",
  "treats",
  "lucky",
  "minorStatic",
  "minorDart",
  "minorRider",
  "minorOther",
  "card",
  "noCard",
] as const;

export type DeliveryGroup = (typeof DELIVERY_GROUPS)[number];

export interface Delivered {
  placed: number;
  planned: number;
}

// One zone's counts, or, summed, every plan of a zone at a walk position: plans counts them.
// position is 1 for the walk's first zone.
export interface ZoneDelivery {
  readonly groups: Record<DeliveryGroup, Delivered>;
  readonly kinds: Partial<Record<WalkItemKind, Delivered>>;
  readonly plans: number;
  readonly position: number;
  readonly zone: ZoneId;
}

type DeliveryData = Pick<GameData, "encounters" | "minorObstacles">;

export function deliveryGroup(
  data: DeliveryData,
  kind: WalkItemKind,
  movement: MovementKind | null,
): DeliveryGroup {
  const category = itemCategory(data, kind);
  if (category === "tip" || category === "treat") {
    return `${category}s`;
  }
  if (category === "lucky") {
    return "lucky";
  }
  if (category === "obstacle") {
    return opensACard(data, kind) ? "card" : "noCard";
  }
  if (movement === null) {
    return "minorStatic";
  }
  if (movement === "dart") {
    return "minorDart";
  }
  return movement === "inLane" ? "minorRider" : "minorOther";
}

function noGroups(): Record<DeliveryGroup, Delivered> {
  return Object.fromEntries(
    DELIVERY_GROUPS.map((group) => [group, { placed: 0, planned: 0 }]),
  ) as Record<DeliveryGroup, Delivered>;
}

function addTo<Key extends string>(
  counts: Partial<Record<Key, Delivered>>,
  key: Key,
  placed: number,
  planned: number,
): void {
  const count = counts[key] ?? { placed: 0, planned: 0 };
  count.placed += placed;
  count.planned += planned;
  counts[key] = count;
}

// The counts of one zone's plan, read from the road planZone left: a kind under the group of the
// movement it was planned or placed with, so a mover planned that stood still instead counts as
// planned moving and placed standing.
export function zoneDelivery(
  data: DeliveryData,
  position: number,
  zone: ZoneId,
  plan: ZonePlanView,
): ZoneDelivery {
  const groups = noGroups();
  const kinds: Partial<Record<WalkItemKind, Delivered>> = {};
  for (const quota of plan.planned) {
    addTo(groups, deliveryGroup(data, quota.kind, quota.movement), 0, quota.count);
    addTo(kinds, quota.kind, 0, quota.count);
  }
  for (const spawn of plan.pending) {
    addTo(groups, deliveryGroup(data, spawn.kind, spawn.mover?.movement ?? null), 1, 0);
    addTo(kinds, spawn.kind, 1, 0);
  }
  return { groups, kinds, plans: 1, position, zone };
}

// The deliveries summed by walk position and zone, in walk position then zone id order.
export function sumDeliveries(deliveries: readonly ZoneDelivery[]): ZoneDelivery[] {
  const sums = new Map<string, ZoneDelivery>();
  for (const delivery of deliveries) {
    const key = `${delivery.position} ${delivery.zone}`;
    const sum = sums.get(key) ?? {
      groups: noGroups(),
      kinds: {},
      plans: 0,
      position: delivery.position,
      zone: delivery.zone,
    };
    for (const group of DELIVERY_GROUPS) {
      addTo(sum.groups, group, delivery.groups[group].placed, delivery.groups[group].planned);
    }
    for (const [kind, count] of Object.entries(delivery.kinds) as [WalkItemKind, Delivered][]) {
      addTo(sum.kinds, kind, count.placed, count.planned);
    }
    sums.set(key, { ...sum, plans: sum.plans + delivery.plans });
  }
  return [...sums.values()].sort((a, b) => a.position - b.position || a.zone.localeCompare(b.zone));
}
