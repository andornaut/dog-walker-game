import type { Cents } from "../rules/units";
import type { PlateKind } from "./selection";

// Every tappable item and button shows one of these. disabled cannot be chosen; normal can;
// selected is picked, equipped or open; primary is the screen's one call to action.
type InteractionState = "disabled" | "normal" | "primary" | "selected";

// A tile is never the call to action, and a button is never picked.
export type TileState = Exclude<InteractionState, "primary">;
export type ButtonState = Exclude<InteractionState, "selected">;

export interface InteractionInput {
  // False when something outside the item rules it out, such as a volume while muted or a
  // card option the run cannot pay for.
  readonly available: boolean;
  // The choice holds all it can, so an unpicked item needs a pick undone first.
  readonly full: boolean;
  readonly picked: boolean;
  readonly primary: boolean;
}

// An owned, available item in a choice with room, not picked: spread it and set what differs.
export const PLAIN_ITEM: InteractionInput = {
  available: true,
  full: false,
  picked: false,
  primary: false,
};

export function tileState(input: Omit<InteractionInput, "primary">): TileState {
  const { available, full, picked } = input;
  if (!available) {
    return "disabled";
  }
  if (picked) {
    return "selected";
  }
  return full ? "disabled" : "normal";
}

// How a dog or Pocket gear tile on the home screen shows itself. available: owned, unpicked,
// with room. picked: in the pack or the Pocket. packFull: owned and unpicked while every slot
// of a pack of 2 or more is filled; with 1 slot, or in the Pocket, a tap swaps the choice
// instead. locked: not owned, with its price, green when the bank covers it. goal: not owned
// and unlocked by a goal rather than a price, with goal on its plate.
export type ItemTile =
  | { readonly kind: "available" }
  | { readonly kind: "goal"; readonly goal: string }
  | { readonly affordable: boolean; readonly kind: "locked"; readonly price: Cents }
  | { readonly kind: "packFull" }
  | { readonly kind: "picked" };

export interface ItemTileInput {
  // Whether the player can buy it now, from the home folder's isAffordable; unused once owned.
  readonly affordable: boolean;
  // How many the choice holds: the pack's slots, or 1 for the Pocket.
  readonly capacity: number;
  // The text on the goal plate of one a goal unlocks (a walker's name), or null for one sold
  // or owned.
  readonly goal: string | null;
  readonly picked: boolean;
  readonly pickedCount: number;
  // Its unlock price, or null once owned.
  readonly price: Cents | null;
}

export function itemTile(input: ItemTileInput): ItemTile {
  const { affordable, capacity, goal, picked, pickedCount, price } = input;
  if (goal !== null) {
    return { goal, kind: "goal" };
  }
  if (price !== null) {
    return { affordable, kind: "locked", price };
  }
  if (picked) {
    return { kind: "picked" };
  }
  return capacity > 1 && pickedCount >= capacity ? { kind: "packFull" } : { kind: "available" };
}

// The badge over an item not owned: a dollar bill while the bank covers its price, a padlock
// otherwise.
export type Badge = "bill" | "lock";

// How an item's portrait or icon draws: in full colour, or as its grey copy.
export type ArtLook = "colour" | "grey";

// Everything an item's state sets on its tile or row: its portrait's or icon's look, the
// badge, the plate and the ui-tile state. The art is grey on a disabled tile, except on one
// the player can buy now, whose art shows in full colour, on its light grey box, on the grey tile.
export interface ItemLook {
  readonly art: ArtLook;
  readonly badge: Badge | null;
  readonly plate: PlateKind | null;
  readonly state: TileState;
}

const OWNED_LOOK = { badge: null, plate: null } as const;

// An item tile on the home screen. An owned item shows in full colour with no badge or
// plate, greyed while the pack is full. One not owned is a disabled tile, as the shop's row
// is: while the player can buy it, its art in full colour with the dollar bill and the buy
// plate; when not, its art greyed with the padlock and the short plate, or the goal
// plate when a goal unlocks it.
export function itemTileLook(tile: ItemTile): ItemLook {
  switch (tile.kind) {
    case "available":
      return { ...OWNED_LOOK, art: "colour", state: "normal" };
    case "picked":
      return { ...OWNED_LOOK, art: "colour", state: "selected" };
    case "packFull":
      return { ...OWNED_LOOK, art: "grey", state: "disabled" };
    case "locked":
      return tile.affordable
        ? { art: "colour", badge: "bill", plate: "buy", state: "disabled" }
        : { art: "grey", badge: "lock", plate: "short", state: "disabled" };
    case "goal":
      return { art: "grey", badge: "lock", plate: "goal", state: "disabled" };
    default:
      return tile satisfies never;
  }
}

export function buttonState(input: Pick<InteractionInput, "available" | "primary">): ButtonState {
  if (!input.available) {
    return "disabled";
  }
  return input.primary ? "primary" : "normal";
}
