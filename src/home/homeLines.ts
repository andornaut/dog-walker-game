import type { DogId, GameData, HomeText, WalkerId } from "../data/types";
import { packPlace, packSizeRaise } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import type { Cents } from "../rules/units";
import { type LastWalk, MAX_RUN_DOGS, type Owned } from "../save/schema";
import { packOrder } from "../state/pack";
import { dollarText, type HomeLoadout, packCapacity, type Purchase } from "./home";
import { homeLine } from "./homeText";

export type WalkerLine = keyof HomeText["bubble"];

// After each of this many first walks, the walker says how to use the screen.
export const HOW_TO_WALKS = 3;

// What changed since the last visit: something became affordable, a walker was unlocked.
export interface VisitNews {
  readonly affordable: boolean;
  readonly walker: boolean;
}

// The walker's own line, in priority order: a player who has never walked; a walker unlocked
// since the last visit; the last walk had a firing; something became affordable since the
// last visit; back from one of the first few walks, how to use the screen; back from a later
// walk.
export function walkerLineKey(
  lastWalk: Pick<LastWalk, "firings"> | null,
  news: VisitNews,
  walks: number,
): WalkerLine {
  if (lastWalk === null) {
    return "firstVisit";
  }
  if (news.walker) {
    return "newWalker";
  }
  if (lastWalk.firings.length > 0) {
    return "afterFiring";
  }
  if (news.affordable) {
    return "newAffordable";
  }
  return walks <= HOW_TO_WALKS ? "howTo" : "afterWalk";
}

// Whether a walker is owned now that was not at the last visit. With no last visit to compare
// with (a session's first), there is none.
export function walkerUnlockedSince(
  remembered: readonly WalkerId[] | undefined,
  owned: readonly WalkerId[],
): boolean {
  return remembered !== undefined && owned.some((id) => !remembered.includes(id));
}

// The Dogs band's pack count: the dogs picked and the pack's capacity.
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

// The Dogs band's pack-size bonus: the hearts the pack's size raises its lead dog's owner's max
// by, with the gear picked, or null when it raises none or no dog is picked.
export function packBonusLine(
  data: Pick<GameData, "dogs" | "homeText" | "shopGear" | "tuning">,
  loadout: HomeLoadout,
): string | null {
  const order = packOrder(data.dogs, loadout.dogs);
  const [lead] = order;
  if (lead === undefined || order.length > MAX_RUN_DOGS) {
    return null;
  }
  const modifiers = loadout.gear === null ? [] : modifiersOf(data.shopGear[loadout.gear].effects);
  const raise = packSizeRaise(data.tuning, modifiers, packPlace(order, lead), data.dogs[lead]);
  return raise > 0 ? homeLine(data.homeText, "packBonus", { hearts: String(raise) }) : null;
}

// The player's last action on the home screen, for the message it leaves in the walker's
// bubble. Picking a dog or gear item leaves none; picking a walker leaves its agility and perk.
export type HomeAction =
  | { readonly kind: "none" }
  | { readonly kind: "bought"; readonly name: string; readonly purchase: Purchase }
  | { readonly amount: Cents; readonly kind: "cantAfford"; readonly name: string }
  // A keyboard focus move: the focused item in words, so its icons never stand alone.
  | { readonly kind: "focus"; readonly text: string }
  | { readonly kind: "notice"; readonly text: string };

// What buying an item says, naming it: a dog joins the clients, gear goes in the bag, a slot
// opens.
function boughtLine(text: HomeText, purchase: Purchase, name: string): string {
  switch (purchase.kind) {
    case "dog":
      return homeLine(text, "dogBought", { dog: name });
    case "dogSlot":
      return homeLine(text, "slotBought", { slot: name });
    case "gear":
      return homeLine(text, "gearBought", { gear: name });
    default:
      return purchase satisfies never;
  }
}

// The last action's message, or null for an action that leaves none.
export function messageLine(text: HomeText, action: HomeAction): string | null {
  switch (action.kind) {
    case "bought":
      return boughtLine(text, action.purchase, action.name);
    case "cantAfford":
      return homeLine(text, "dogCantAfford", {
        amount: dollarText(action.amount),
        dog: action.name,
      });
    case "focus":
    case "notice":
      return action.text;
    case "none":
      return null;
    default:
      return action satisfies never;
  }
}

// What the walker's bubble says, as paragraphs that each start on a new line, in priority
// order: a bought dog's message with its owner's parting line; the last action's message;
// the parting line of the most recently picked dog still in the pack; the walker's own line.
// quips holds the owner lines drawn this visit as dogs were picked or bought.
export function bubbleSpeech(
  text: HomeText,
  walkerLine: WalkerLine,
  state: { readonly action: HomeAction; readonly loadout: HomeLoadout },
  quips: ReadonlyMap<DogId, string>,
): string[] {
  const { action, loadout } = state;
  if (action.kind === "bought" && action.purchase.kind === "dog") {
    const joined = boughtLine(text, action.purchase, action.name);
    const quip = quips.get(action.purchase.dog);
    return quip === undefined ? [joined] : [joined, quip];
  }
  const message = messageLine(text, action);
  if (message !== null) {
    return [message];
  }
  const quip = [...loadout.dogs]
    .reverse()
    .map((dog) => quips.get(dog))
    .find((line) => line !== undefined);
  return [quip ?? text.bubble[walkerLine]];
}
