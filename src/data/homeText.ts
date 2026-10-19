import type { HomeText } from "./types";

// The home screen's text. A {name} is filled in by the game: {dog} a dog's name, {gear} a gear
// item's name, {amount}, {price} and {fee} money, {count} and {max} numbers, {dogs} the
// packDogsOne or packDogsMany line. {slot} is a slot number in slotSign and the slot's name
// ("Dog slot 2") in slotBought.
export const HOME_TEXT = {
  bubble: {
    afterFiring: "Rough walk. They'll come around.",
    afterWalk: "Back already? Who's next?",
    firstVisit: "Morning! Who are we walking today?",
    newAffordable: "We could take on another client.",
  },
  dogBought: "{dog} joins your clients!",
  dogCantAfford: "Save {amount} more for {dog}.",
  gearBought: "{gear} is in your bag.",
  hint: "Tap a dog to walk it. Tap a locked dog or gear to buy it. Hold for details.",
  packCount: "Pack {count}/{max}",
  packDogsMany: "{count} dogs",
  packDogsOne: "{count} dog",
  slotBought: "{slot} is open. Room for one more dog!",
  slotBuy: "Tap to buy",
  slotSave: "Save {amount} more",
  slotSign: "Slot {slot} · {price}",
  startWalk: "Start walk · {dogs} · {fee}/zone",
  stepDogs: "2 Dogs",
  stepGear: "3 Gear (optional)",
  stepWalker: "1 Walker",
} as const satisfies HomeText;
