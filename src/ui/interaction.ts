import { type Cents, cents } from "../rules/units";
import type { PlateKind } from "./selection";

// Every tappable item and button shows one of these. disabled cannot be chosen; normal can;
// selected is picked, equipped or open; primary is the screen's one call to action.
export type InteractionState = "disabled" | "normal" | "primary" | "selected";

// A tile is never the call to action, and a button is never picked.
export type TileState = Exclude<InteractionState, "primary">;
export type ButtonState = Exclude<InteractionState, "selected">;

export interface InteractionInput {
  // False when something outside the item rules it out, such as a volume while muted or a
  // card option the run cannot pay for.
  readonly available: boolean;
  readonly bank: Cents;
  // The choice holds all it can, so an unpicked item needs a pick undone first.
  readonly full: boolean;
  readonly picked: boolean;
  // Its unlock price, or null once owned or never for sale.
  readonly price: Cents | null;
  readonly primary: boolean;
}

// An owned, available item in a choice with room, not picked: spread it and set what differs.
export const PLAIN_ITEM: InteractionInput = {
  available: true,
  bank: cents(0),
  full: false,
  picked: false,
  price: null,
  primary: false,
};

// A locked item the bank covers stays normal, since buying it needs no room in the choice.
export function tileState(input: Omit<InteractionInput, "primary">): TileState {
  const { available, bank, full, picked, price } = input;
  if (!available) {
    return "disabled";
  }
  if (picked) {
    return "selected";
  }
  if (price !== null) {
    return price > bank ? "disabled" : "normal";
  }
  return full ? "disabled" : "normal";
}

// How a dog or Pocket gear tile on the home screen shows itself. available: owned, unpicked,
// with room. picked: in the pack or the Pocket. packFull: owned and unpicked while every slot
// of a pack of 2 or more is filled; with 1 slot, or in the Pocket, a tap swaps the choice
// instead. locked: not owned, with its price, green when the bank covers it. goal: not owned
// and unlocked by a goal rather than a price.
export type ItemTile =
  | { readonly kind: "available" }
  | { readonly kind: "goal"; readonly goal: string }
  | { readonly affordable: boolean; readonly kind: "locked"; readonly price: Cents }
  | { readonly kind: "packFull" }
  | { readonly kind: "picked" };

export interface ItemTileInput {
  readonly bank: Cents;
  // How many the choice holds: the pack's slots, or 1 for the Pocket.
  readonly capacity: number;
  // The goal that unlocks it, or null for one sold or owned.
  readonly goal: string | null;
  readonly picked: boolean;
  readonly pickedCount: number;
  // Its unlock price, or null once owned.
  readonly price: Cents | null;
}

export function itemTile(input: ItemTileInput): ItemTile {
  const { bank, capacity, goal, picked, pickedCount, price } = input;
  if (goal !== null) {
    return { goal, kind: "goal" };
  }
  if (price !== null) {
    return { affordable: price <= bank, kind: "locked", price };
  }
  if (picked) {
    return { kind: "picked" };
  }
  return capacity > 1 && pickedCount >= capacity ? { kind: "packFull" } : { kind: "available" };
}

// How an item's art shows: in full colour, as its grey copy, or as its flat silhouette.
export type ArtLook = "full" | "grey" | "silhouette";

// The padlock over an item not owned: open while the bank covers its price, closed otherwise.
export type Padlock = "closed" | "open";

// Everything an item's state sets on its tile or row: the art, the padlock, the plate and
// the ui-tile state.
export interface ItemLook {
  readonly art: ArtLook;
  readonly padlock: Padlock | null;
  readonly plate: PlateKind | null;
  readonly state: TileState;
}

const OWNED_LOOK = { art: "full", padlock: null, plate: null } as const;

// An item tile on the home screen. An owned item shows in full colour with no padlock or
// plate, greyed while the pack is full. One not owned shows its silhouette: on a normal tile
// with the open padlock and the buy plate while the bank covers it; on a disabled tile with
// the closed padlock and the short plate when not, or the goal plate when a goal unlocks it.
export function itemTileLook(tile: ItemTile): ItemLook {
  switch (tile.kind) {
    case "available":
      return { ...OWNED_LOOK, state: "normal" };
    case "picked":
      return { ...OWNED_LOOK, state: "selected" };
    case "packFull":
      return { ...OWNED_LOOK, art: "grey", state: "disabled" };
    case "locked":
      return tile.affordable
        ? { art: "silhouette", padlock: "open", plate: "buy", state: "normal" }
        : { art: "silhouette", padlock: "closed", plate: "short", state: "disabled" };
    case "goal":
      return { art: "silhouette", padlock: "closed", plate: "goal", state: "disabled" };
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

export function interactionState(input: InteractionInput): InteractionState {
  const state = tileState(input);
  return state === "normal" && input.primary ? "primary" : state;
}
