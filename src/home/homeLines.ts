import type { DogId, GameData, HomeText } from "../data/types";
import { nextDogSlot } from "../rules/shop";
import { type Cents, cents } from "../rules/units";
import type { LastWalk, Owned } from "../save/schema";
import { dollarText, type HomeLoadout, packCapacity, packFeePerZone } from "./home";
import { homeLine } from "./homeText";

export type WalkerLine = keyof HomeText["bubble"];

// The walker's own line, in priority order: a player who has never walked; the last walk
// had a firing; something became affordable since the last visit; back from a walk.
export function walkerLineKey(
  lastWalk: Pick<LastWalk, "firings"> | null,
  newAffordable: boolean,
): WalkerLine {
  if (lastWalk === null) {
    return "firstVisit";
  }
  if (lastWalk.firings.length > 0) {
    return "afterFiring";
  }
  return newAffordable ? "newAffordable" : "afterWalk";
}

// The slot sign: the next slot and its price, then how much more to save (short) or that it
// can be bought. Null once every slot is owned.
export interface SlotSign {
  readonly sign: string;
  readonly short: boolean;
  readonly status: string;
}

export function slotSignLines(
  data: Pick<GameData, "dogSlots" | "homeText" | "tuning">,
  owned: Pick<Owned, "dogSlots">,
  bank: Cents,
): SlotSign | null {
  const slot = nextDogSlot(data, owned.dogSlots);
  if (slot === null) {
    return null;
  }
  const text = data.homeText;
  const sign = homeLine(text, "slotSign", {
    price: dollarText(slot.price),
    slot: String(slot.slot),
  });
  const short = slot.price > bank;
  const status = short
    ? homeLine(text, "slotSave", { amount: dollarText(cents(slot.price - bank)) })
    : homeLine(text, "slotBuy", {});
  return { short, sign, status };
}

// A step heading split for its plate: a leading number goes on the badge, so it is dropped
// from the label, and a trailing "(...)" is a note in the body font.
export function stepHeading(line: string): { label: string; note: string } {
  const match = /^(?:\d+\s+)?(.*?)\s*(\([^)]*\))?$/.exec(line.trim());
  return { label: match?.[1] ?? line, note: match?.[2] ?? "" };
}

// "Pack 1/2": the dogs picked and the pack's capacity.
export function packCountLine(
  data: Pick<GameData, "homeText" | "tuning">,
  owned: Pick<Owned, "dogSlots">,
  loadout: HomeLoadout,
): string {
  return homeLine(data.homeText, "packCount", {
    count: String(loadout.dogs.length),
    max: String(packCapacity(data, owned)),
  });
}

// "Start walk · 2 dogs · $40/zone" for a picked pack.
export function startWalkLine(
  data: Pick<GameData, "dogs" | "homeText" | "tuning">,
  loadout: HomeLoadout,
): string {
  const count = loadout.dogs.length;
  const text = data.homeText;
  const dogs = homeLine(text, count === 1 ? "packDogsOne" : "packDogsMany", {
    count: String(count),
  });
  return homeLine(text, "startWalk", {
    dogs,
    fee: dollarText(packFeePerZone(data, loadout)),
  });
}

// The player's last action on the home screen, for the message it leaves. Actions that only
// change the loadout leave none, so dropping a dog returns the hint.
export type HomeAction =
  | { readonly kind: "none" }
  | { readonly kind: "bought"; readonly name: string; readonly dog: DogId | null }
  | { readonly amount: Cents; readonly kind: "cantAfford"; readonly name: string }
  // A keyboard focus move: the focused item in words, so its icons never stand alone.
  | { readonly kind: "focus"; readonly text: string }
  | { readonly kind: "loadout" }
  | { readonly kind: "notice"; readonly text: string };

// The line under the steps: the last action's message, else the hint.
export function messageLine(text: HomeText, action: HomeAction): string {
  switch (action.kind) {
    case "bought":
      return action.dog === null
        ? `Bought ${action.name}!`
        : homeLine(text, "dogBought", { dog: action.name });
    case "cantAfford":
      return homeLine(text, "dogCantAfford", {
        amount: dollarText(action.amount),
        dog: action.name,
      });
    case "focus":
    case "notice":
      return action.text;
    case "loadout":
    case "none":
      return text.hint;
    default:
      return action satisfies never;
  }
}

// Who speaks in the walker's bubble: a bought dog's owner right after the purchase, else the
// owner of the most recently picked dog still in the pack, else the walker. quips holds the
// owner lines drawn this visit as dogs were picked or bought.
export function bubbleLine(
  text: HomeText,
  walkerLine: WalkerLine,
  state: { readonly action: HomeAction; readonly loadout: HomeLoadout },
  quips: ReadonlyMap<DogId, string>,
): string {
  const { action, loadout } = state;
  const bought = action.kind === "bought" ? action.dog : null;
  const speakers = bought === null ? [...loadout.dogs].reverse() : [bought];
  for (const dog of speakers) {
    const quip = quips.get(dog);
    if (quip !== undefined) {
      return quip;
    }
  }
  return text.bubble[walkerLine];
}
