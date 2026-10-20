import type { GameData, WalkerId } from "../data/types";
import { cents } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import type { Owned, SaveDocument } from "../save/schema";
import { togglePick } from "./home";
import { homeLine } from "./homeText";
import { type ItemTile, itemTile } from "./interaction";

type WalkerText = Pick<GameData, "homeText" | "walkerPaces" | "walkerStyles" | "walkers">;

function goalZone(data: Pick<GameData, "walkers">, walker: WalkerId): string {
  return String(walkerGoal(data.walkers[walker]));
}

// The walkers as the picker shows them, left to right in the order they unlock: the starting
// walkers, then by the zone that unlocks each, ties in data order.
export function walkerOrder(data: Pick<GameData, "walkers">): WalkerId[] {
  const goal = (walker: WalkerId) => walkerGoal(data.walkers[walker]);
  return (Object.keys(data.walkers) as WalkerId[]).sort((a, b) => goal(a) - goal(b));
}

// A walker's tile on the home screen: the walker in use is picked, another owned one is
// available, and one not owned shows its name on a plate; a tap on it says the goal. Picking a
// walker replaces the one in use, so the choice is never full.
export function walkerTile(
  data: WalkerText,
  save: Pick<SaveDocument, "owned" | "walker">,
  walker: WalkerId,
): ItemTile {
  const owned = save.owned.walkers.includes(walker);
  return itemTile({
    bank: cents(0),
    capacity: 1,
    goal: owned
      ? null
      : homeLine(data.homeText, "walkerPlate", { walker: data.walkers[walker].name }),
    picked: save.walker === walker,
    pickedCount: 1,
    price: null,
  });
}

// An owned walker in words, as a pick or keyboard focus says it: "Ben: slow, hustler."
export function walkerInfo(data: WalkerText, walker: WalkerId): string {
  const { name, pace, style } = data.walkers[walker];
  return homeLine(data.homeText, "walkerInfo", {
    pace: data.walkerPaces[pace].name.toLowerCase(),
    style: data.walkerStyles[style].name.toLowerCase(),
    walker: name,
  });
}

// A tap on a walker's tile picks an owned walker, saying its pace and style, drops the one
// picked, or says what unlocks one not owned. It toggles as a dog does, in a pick of one.
export type WalkerTap =
  | { readonly kind: "drop" }
  | { readonly kind: "locked"; readonly text: string }
  | { readonly kind: "pick"; readonly text: string; readonly walker: WalkerId };

export function tapWalker(
  data: WalkerText,
  owned: Pick<Owned, "walkers">,
  picked: WalkerId | null,
  walker: WalkerId,
): WalkerTap {
  if (owned.walkers.includes(walker)) {
    const toggled = togglePick(1, picked === null ? [] : [picked], walker);
    const next = toggled.kind === "picked" ? toggled.picked[0] : undefined;
    return next === undefined
      ? { kind: "drop" }
      : { kind: "pick", text: walkerInfo(data, next), walker: next };
  }
  const text = homeLine(data.homeText, "walkerLocked", {
    walker: data.walkers[walker].name,
    zone: goalZone(data, walker),
  });
  return { kind: "locked", text };
}
