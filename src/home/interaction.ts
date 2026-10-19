import { type Cents, cents } from "../rules/units";

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
