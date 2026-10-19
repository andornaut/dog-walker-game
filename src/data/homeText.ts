import type { HomeText } from "./types";

// The home screen's text. A {name} is filled in by the game: {dog} a dog's name, {gear} a gear
// item's name, {amount} and {price} money, {count} and {max} numbers. {slot} is a slot number
// in slotSign and the slot's name ("Dog slot 2") in slotBought.
export const HOME_TEXT = {
  bubble: {
    afterFiring: "Rough walk. They'll come around.",
    afterWalk: "Back already? Who's next?",
    firstVisit: "Morning! Who are we walking today?",
    howTo: "Tap to pick or buy. Hold for details.",
    newAffordable: "We could take on another client.",
  },
  dogBought: "{dog} joins your clients!",
  dogCantAfford: "Save {amount} more for {dog}.",
  gearBought: "{gear} is in your bag.",
  packCount: "Pack {count}/{max}",
  sectionDogs: "Pick your dogs",
  sectionDogsPrompt: "Add a dog",
  sectionGear: "Gear (optional)",
  sectionWalker: "Pick a walker",
  sectionWalkerPrompt: "Tap a face",
  slotBought: "{slot} is open. Room for one more dog!",
  slotBuy: "Tap to buy",
  slotSave: "Save {amount} more",
  slotSign: "Slot {slot} · {price}",
  startWalk: "Start walk",
} as const satisfies HomeText;
