import type { DogId, GameData, HomeText, WalkerId } from "../data/types";
import type { Cents } from "../lib/units";
import { packPlace, packSizeRaise } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import type { StorageState } from "../save/profile";
import { type LastWalk, MAX_RUN_DOGS, type Owned } from "../save/schema";
import { packOrder } from "../state/pack";
import { fillLine } from "../lib/lines";
import { dollarText, type HomeLoadout, packCapacity, type Purchase } from "./home";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";

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
// last visit; the one-time suggestion to install the game, when suggestInstall; back from one
// of the first few walks, how to use the screen; back from a later walk.
export function walkerLineKey(
  lastWalk: Pick<LastWalk, "firings"> | null,
  news: VisitNews,
  suggestInstall: boolean,
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
  if (suggestInstall) {
    return "install";
  }
  return walks <= HOW_TO_WALKS ? "howTo" : "afterWalk";
}

// A walker owned now that was not at the last visit, or null for none. With no last visit to
// compare with (a session's first), there is none.
export function walkerUnlockedSince(
  remembered: readonly WalkerId[] | undefined,
  owned: readonly WalkerId[],
): WalkerId | null {
  return remembered === undefined ? null : (owned.find((id) => !remembered.includes(id)) ?? null);
}

// The walker's own line in words: the new walker's names them, joined is the walker unlocked
// since the last visit.
export function walkerSays(
  data: Pick<GameData, "homeText" | "walkers">,
  line: WalkerLine,
  joined: WalkerId | null,
): string {
  const { bubble } = data.homeText;
  if (line !== "newWalker" || joined === null) {
    return bubble[line];
  }
  const walker = data.walkers[joined].name;
  return fillLine(HOME_TEXT_FIELDS.bubble, bubble, "newWalker", { walker });
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
      return homeLine(text, "cantAfford", {
        amount: dollarText(action.amount),
        item: action.name,
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

// The line said first in the walker's bubble for each storage state, or null for none.
const STORAGE_NOTICES: Readonly<Record<StorageState, "newerSave" | "unsaved" | null>> = {
  available: null,
  newer: "newerSave",
  unavailable: "unsaved",
};

// What the walker's bubble says first while nothing is saved: why, as zero or one paragraph.
export function storageNotice(text: HomeText, state: StorageState): string[] {
  const key = STORAGE_NOTICES[state];
  return key === null ? [] : [text[key]];
}

// What the walker's bubble says, as paragraphs that each start on a new line, in priority
// order: a bought dog's owner's parting line; the last action's message; the parting line of
// the most recently picked dog still in the pack; the walker's own line, walkerLine. A purchase
// or a refusal shows on the Pet shop's plate only, never again here. quips holds the owner
// lines drawn this visit as dogs were picked or bought. owner is the dog whose owner says the
// last paragraph, or null when the walker or a message has the last word.
export function bubbleSpeech(
  text: HomeText,
  walkerLine: string,
  state: { readonly action: HomeAction; readonly loadout: HomeLoadout },
  quips: ReadonlyMap<DogId, string>,
): { owner: DogId | null; paragraphs: string[] } {
  const { action, loadout } = state;
  if (action.kind === "bought" && action.purchase.kind === "dog") {
    const { dog } = action.purchase;
    const quip = quips.get(dog);
    if (quip !== undefined) {
      return { owner: dog, paragraphs: [quip] };
    }
  }
  const shops = action.kind === "bought" || action.kind === "cantAfford";
  const message = shops ? null : messageLine(text, action);
  if (message !== null) {
    return { owner: null, paragraphs: [message] };
  }
  const owner = [...loadout.dogs].reverse().find((dog) => quips.has(dog));
  const quip = owner === undefined ? undefined : quips.get(owner);
  return owner === undefined || quip === undefined
    ? { owner: null, paragraphs: [walkerLine] }
    : { owner, paragraphs: [quip] };
}
